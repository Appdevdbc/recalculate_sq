import { dbRecalculate, dbDBCNet } from "../config/db.js";
import { getWSA } from "../helpers/utils.js"; // sesuaikan dengan lokasi file getWSA
import dayjs from "dayjs";
import * as dotenv from 'dotenv';
dotenv.config();

export const recalculate = async (req, res) => {
  const startTime = Date.now();
  try {
    let response = [];
    let responseOrderHead = [];
    if (req && req.query && req.query.no_web !== undefined && req.query.no_web !== '') {
      let params = req.query.no_web.split(','); // array of values
      const placeholders = params.map(() => '?').join(',');
      responseOrderHead = await dbDBCNet.raw(`select no_quote, domain, no_web from order_head where no_web in (${placeholders})`, params);
    } else {
      responseOrderHead = await dbDBCNet.raw(`select top ${process.env.MAX_ORDER} no_quote, domain, no_web from order_head where quote_stat = 1 and no_quote is not null and date_order >= dateadd(day, ${process.env.BACKDATE}, getdate())`);
    }

    let rows = [];
    let columns = {};

    if (responseOrderHead.length <= 0) {
      rows = {
        message: 'Tidak ada order yang perlu recalculate dalam ' + (process.env.BACKDATE * -1) + ' hari terakhir'
      };
    }

    for (let i = 0; i < responseOrderHead.length; i++) {

      let domain = responseOrderHead[i].domain;
      let no_quote = responseOrderHead[i].no_quote;
      let no_web = responseOrderHead[i].no_web;
      let linked = domain == '320' ? process.env.LINKED_QAD_RBS : process.env.LINKED_QAD_DBC;

      let sql = `
        declare @qo_lama as table (
          qo_ord_date date,
          qo_bill varchar(10),
          qo__chr01 varchar(10),
          qo_cust varchar(10),
          qo_ship varchar(10),
          qo_site varchar(10),
          qod_line int,
          qod_part varchar(20),
          qod_price decimal,
          qod_list_pr decimal,
          qo__chr05 varchar(10),
          qod_disc_pct float,
          qod_qty_quot decimal,
          cm_region varchar(20)
        );

        -- Ambil data diskon line dari QAD

        insert into @qo_lama
        select * from openquery(${linked}, '
          select 
            qo_ord_date,
            qo_bill,
            qo__chr01,
            qo_cust,
            qo_ship,
            qo_site,
            qod_line,
            qod_part,
            qod_price,
            qod_list_pr,
            qo__chr05,
            qod_disc_pct,
            qod_qty_quot,
            cm_region
          from
            pub.qo_mstr,
            pub.qod_det,  
            pub.cm_mstr, 
            pub.pt_mstr
          where  
            pt_part = qod_part and
            cm_addr = qo_cust and
            qod_nbr = qo_nbr and
            pt_domain = ''${domain}'' and
            qo_domain = ''${domain}'' and   
            cm_domain = ''${domain}'' and 
            qod_domain = ''${domain}'' and
            qo_nbr = ''${no_quote}''
          with(nolock)
        ');

        declare @disc_tambahan float    
        declare @promo varchar(30)        
        declare @pro table (kode_promo varchar(30), disc float)
        
        -- Ambil data diskon tambahan dari master promo QAD Web

        insert into @pro
        select top 1 
          kode_group_promo, 
          isnull(disc, 0) 
        from (
          select     
            m.id,
            m.kode_group_promo,  
            m.bill_to,
            m.sub_agen,
            m.sold_to,
            m.ship_to,
            m.disc,   
            m.minimal,
            m.maximal,
            m.kelipatan,     
            sum(qod_qty_quot) qod_qty_quot
          from (            
            select 
              qo_ord_date, 
              qo_bill, 
              qo__chr01, 
              qo_cust, 
              qo_ship, 
              cm_region, 
              qo_site, 
              qod_part,
              qod_qty_quot
            from        
              @qo_lama          
          ) q,   
          qaddbc.dbo.master_promo m,  
          qaddbc.dbo.group_promo_item g,
          qaddbc.dbo.group_promo gp
        where 
          gp.kode_group_promo = g.kode_group_promo and
          m.kode_group_promo = gp.kode_group_promo and
          g.kode_group_promo = m.kode_group_promo and          
          gp.site = g.site and
          g.site = m.site and
          g.kode_item = qod_part and
          q.qo_site = m.site and      
          qo_ord_date >= m.tgl_awal_eff and
          qo_ord_date <= m.tgl_akhir_eff  and  
          m.approve = 1 and gp.otomatis = 1 and
          (
            m.bill_to = '' or
            m.bill_to = qo_bill
          ) and
          (
            m.sub_agen = '' or
            m.sub_agen = qo__chr01
          ) and
          (
            m.sold_to = '' or
            m.sold_to = qo_cust
          ) and
          (
            m.ship_to = '' or
            m.ship_to = qo_ship
          ) and
          (
            m.region = '' or
            m.region = cm_region
          ) and
          (
            m.site = qo_site
          ) 
        group by
          m.id,
          m.kode_group_promo,  
          m.bill_to,
          m.sub_agen,
          m.sold_to,
          m.ship_to,
          m.disc,   
          m.minimal,
          m.maximal,
          m.kelipatan
        having
          (    
            ((
              (m.minimal = 0 and m.maximal = 0) or 
              (
                (sum(qod_qty_quot) >= m.minimal and sum(qod_qty_quot) <= m.maximal) or 
                (sum(qod_qty_quot) >= m.minimal and m.maximal = 0)
              )) and (m.kelipatan = 0)) or
              ((m.kelipatan = 1) and (sum(qod_qty_quot) % m.minimal = 0)
            ))    
          ) a
        order by id desc, bill_to desc, sub_agen desc, sold_to desc, ship_to desc
            
        select @promo = kode_promo, @disc_tambahan = isnull(sum(disc), 0)
        from @pro
        group by kode_promo

        select 
          '${no_quote}' qo_nbr, 
          qo__chr05 disc_lama, 
          @disc_tambahan disc_baru, 
          qod_line, 
          qod_part,  
          qod_disc_pct,       
          qod_list_pr,     
          qod_price, 
          (qod_disc_pct - cast(qo__chr05 as float)) + @disc_tambahan total_diskon,       
          @promo promo,
          '${domain}' domain
        from     
          @qo_lama;
      `;

      const [array] = await dbRecalculate.raw(sql);
      response = array;

      let parsedData = {};
      let result = '';
      let procOK = '';
      let procResult = '';

      if (response != undefined) {
        if (response.disc_baru !== '') {
          const args = {
            frdomain: domain,
            qono: no_quote,
            disctambahan: response.disc_baru,
            discpct: response.total_diskon,
            parDBLogical: 'qaddb'
          };

          let callWsa;
          callWsa = await getWSA(process.env.WSA, "assDBCDisctambahan", args);
          parsedData = JSON.parse(JSON.stringify(callWsa));

          result = parsedData.result;
          procOK = parsedData.procOK;
          procResult = parsedData.procResult;

        } else if (response.qod_disc_pct === 0) {
          result = null;
          procOK = false;
          procResult = 'Diskon dasar bernilai nol';
        } else {
          result = null;
          procOK = false;
          procResult = 'Belum ada data diskon tambahan';
        }

        if ([true, false].includes(procOK)) {
          await dbDBCNet("dbo.order_head")
            .update({
              quote_stat: 2
            })
            .where("no_web", no_web);
        }

        await dbRecalculate("dbo.recalculate_log").insert({
          qo_nbr: no_quote,
          disc_lama: response.disc_lama,
          disc_baru: response.disc_baru,
          qod_line: response.qod_line,
          qod_part: response.qod_part,
          qod_disc_pct: response.qod_disc_pct,
          qod_list_pr: response.qod_list_pr,
          qod_price: response.qod_price,
          total_diskon: response.total_diskon,
          promo: response.promo,
          domain: domain,
          result: result,
          procOK: procOK,
          procResult: procResult,
          created_date: dayjs().format("YYYY-MM-DD HH:mm:ss")
        });

        columns = {
          qo_nbr: no_quote,
          disc_lama: response.disc_lama,
          disc_baru: response.disc_baru,
          qod_line: response.qod_line,
          qod_part: response.qod_part,
          qod_disc_pct: response.qod_disc_pct,
          qod_list_pr: response.qod_list_pr,
          qod_price: response.qod_price,
          total_diskon: response.total_diskon,
          promo: response.promo,
          domain: domain,
          result: result,
          procOK: procOK,
          procResult: procResult,
          created_date: dayjs().format("YYYY-MM-DD HH:mm:ss")
        }
      } else {
        columns = {
          no_web: no_web,
          domain: domain,
          message: 'Nomer SQ belum terbentuk di QAD'
        };
      }

      rows[i] = columns;
      columns = {};

    }

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    const result = {
      data: rows,
      processing_time: `${processingTime}ms`
    };

    if (res && typeof res.status === 'function') {
      res.status(200).json(result);
    } else {
      return result;
    }
  } catch (error) {
    console.log(error);
    const errorResponse = {
      type: 'error',
      message: process.env.DEBUG == 1 ? error.message : `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
    };
    
    if (res && typeof res.status === 'function') {
      return res.status(406).json(errorResponse);
    } else {
      return errorResponse;
    }
  }
}
