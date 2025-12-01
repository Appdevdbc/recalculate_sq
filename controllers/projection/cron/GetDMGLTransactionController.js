import { db } from "../../../config/db.js";      
import axios from 'axios';      
import dayjs from 'dayjs';  
    
export const Projection_GetDmGlData = async (req, res) => {        
    const transaction = await db.transaction();      
    
    try {        
        const { domain } = req.query;      
    
        const currentDate = dayjs();    
        const previousMonth = currentDate.subtract(1, 'month');    
        const year = previousMonth.year();    
        const month = previousMonth.format('MMMM');  
    
        const aktual = await db('dbPortalFA.dbo.kode_pnl as kp')        
            .select('kp.kode_pnl_id', 'pnl.gl_id')        
            .join('dbPortalFA.dbo.pnl_gl as pnl', 'kp.kode_pnl_id', 'pnl.kode_pnl_id')        
            .where('kp.tipe', 'Aktual')        
            .where('pnl.tipe', 'Aktual')        
            .where('pnl.domain', domain)        
            .where('pnl.tahun', year);   
          
        const processedGlCodes = new Set();  
  
        for (const data of aktual) {     
            if (processedGlCodes.has(data.gl_id)) {  
                console.log(`Skipping already processed gl_code: ${data.gl_id}`);  
                continue;  
            }  
      
            const response = await axios.get(`https://app-api.dbc.co.id/mis/lap_projection/get_dm_gl_transactions?apikey=AppDevDBC2023!!&domain=100&gl_code=${data.gl_id}&date_start=${year}-${previousMonth.month() + 1}-01&date_end=${year}-${previousMonth.month() + 1}-01`);        
            const transactions = response.data;      
  
            const monthlySums = {};      
    
            transactions.forEach(transaction => {        
                const postingDate = dayjs(transaction.Posting_Date);   
                const transactionMonth = postingDate.format('MMMM');  
                const transactionYear = postingDate.year();        
                const key = `${transactionYear}-${transactionMonth}`;      
    
                if (!monthlySums[key]) {        
                    monthlySums[key] = 0;        
                }      
    
                monthlySums[key] += parseFloat(transaction.BC_Period_Amount);        
            });      
     
            const insertKey = `${year}-${month}`;    
            if (monthlySums[insertKey]) {   
                const findTransaksiAktual = await db('dbPortalFA.dbo.transaksi_aktual')  
                .select('transaksi_aktual_id')  
                .where('gl_code', data.gl_id)  
                .where('domain', domain)  
                .where('tahun', year)  
                .first();  
  
                if (findTransaksiAktual) {   
                    await transaction('dbPortalFA.dbo.transaksi_aktual')  
                    .where('gl_code', data.gl_id)  
                    .where('domain', domain)  
                    .where('tahun', year)  
                    .update({  
                        [month.toLowerCase().slice(0, 3)]: monthlySums[insertKey].toFixed(2),          
                        updated_by: 'system',        
                        updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),  
                    });  
                } else {  
                    const insertData = {     
                        domain: domain,        
                        tahun: year,        
                        gl_code: data.gl_id,        
                        [month.toLowerCase().slice(0, 3)]: monthlySums[insertKey].toFixed(2),      
                        created_by: 'system',        
                        created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),        
                        updated_by: 'system',        
                        updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),        
                    };  
      
                    console.log('try to insert: ', insertData);  
        
                    await transaction('dbPortalFA.dbo.transaksi_aktual').insert(insertData);   
                }   
            }  
  
            processedGlCodes.add(data.gl_id);  
        }        
    
        await transaction.commit();    
        console.log('Data successfully fetched and inserted.');        
        res.status(200).json({ message: 'Data successfully fetched and inserted.' });    
    } catch (error) {        
        await transaction.rollback();     
        console.error('Error fetching or inserting data:', error);        
        res.status(500).json({ error: 'Error fetching or inserting data.' });    
    }        
}  