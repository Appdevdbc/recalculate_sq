import { db, finapp_dbc_bupot, dbDbcHris } from "../../config/db.js";
import * as dotenv from 'dotenv' ;
dotenv.config();

export const PUMPJUM_listDepartment = async (req, res) => {
    // #swagger.tags = ['Department']
    /* #swagger.security = [{
                "bearerAuth": []
        }] */
    // #swagger.description = 'Fungsi untuk menampilkan list data department'
    try {
  
      if (req.query.rowsPerPage == null) {
        // const response = await dbDbcHris("dbHRIS_newer.dbo.master_department as dept")
        // .select(
        //   'dept.dept_idreal',
        //   'dept.dept_name',
        //   'dept.dept_groupid',
        //   db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
        // )        
        // .where((query) => {
        //   query.where("dept_active", "ACTIVE");
        //   if (req.query.domain != null) {
        //     query.where("dom.domain_code", req.query.domain);
        //   }
        // })
        // .innerJoin("dbPortalFA.dbo.domain as dom", "dept.dept_groupid", "=", "dom.domain_shortname")
        // .orderBy("dept_name");

          const response = await dbDbcHris("AppDB_DBC_HRIS.dbo.T_DBC_Job_Position as dept")
            .distinct('dept.DepartmentCode as dept_idreal', 'dept.DepartmentName as dept_name')
            .select(
              'dept.BusinessUnitCode as dept_groupid'
            )
            .where((query) => {
              if (req.query.business_unit) {
                query.where("dept.BusinessUnitCode", req.query.business_unit);
              }
              query.whereNotNull("dept.DepartmentCode");
            });

          // Get domain mapping separately
          const domainMap = new Map();
          if (response.length > 0) {
            const businessUnits = [...new Set(response.map(r => r.dept_groupid))];
            const domains = await db("dbPortalFA.dbo.domain")
              .select('domain_code', 'domain_shortname')
              .whereIn('domain_shortname', businessUnits);
            
            domains.forEach(d => domainMap.set(d.domain_shortname, d.domain_code));
          }

          // Filter by domain if requested
          const filteredResponse = req.query.domain 
            ? response.filter(r => domainMap.get(r.dept_groupid) === req.query.domain)
            : response;

          // Add domain_code to response and sort
          const finalResponse = filteredResponse.map(item => ({
            ...item,
            domain_code: domainMap.get(item.dept_groupid) || null
          })).sort((a, b) => a.dept_name.localeCompare(b.dept_name));
          
        res.status(200).json(finalResponse);
  
      }else{
        // const sorting =  (req.query.descending == 'true'?'desc':'asc');
        // const columnSort = (req.query.sortBy =='desc'?
        // 'dept_name asc':`${req.query.sortBy} ${sorting}`);
        // const page = Math.floor(req.query.page);
        // const response = await dbDbcHris("dbHRIS_newer.dbo.master_department as dept")
        //             .select(
        //               'dept.dept_idreal',
        //               'dept.dept_name',
        //               'dept.dept_groupid',
        //               db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
        //             )
        //             .innerJoin("dbPortalFA.dbo.domain as dom", "dept.dept_groupid", "=", "dom.domain_shortname")
        //             .where((query) => 
        //               {
        //                 query.where("dept_active", "ACTIVE");
        //                 if (req.query.domain != null) {
        //                   query.where("dom.domain_code", req.query.domain);
        //                 }
        //                 if(req.query.filter != null)
        //                 {
        //                   query.orWhere('dept_idreal', 'like', `%${req.query.filter}%`)
        //                   query.orWhere('dept_name', 'like', `%${req.query.filter}%`)
        //                 }                    
        //             })
        //             .orderByRaw(columnSort)
        //            /*  .orderBy('code_value', 'asc') */
        //             .paginate({
        //                 perPage: Math.floor(req.query.rowsPerPage),
        //                 currentPage:page,
        //                 isLengthAware :true,
        //               });

        const sorting = (req.query.descending == 'true'?'desc':'asc');
        const sortBy = (() => {
          switch (req.query.sortBy) {
            case 'dept_idreal': return 'dept.DepartmentCode';
            case 'dept_name': return 'dept.DepartmentName';
            case 'dept_groupid': return 'dept.BusinessUnitCode';
            case 'domain_code': return 'dom.domain_code';
            default: return 'dept.DepartmentName';
          }
        })();
        const columnSort = req.query.sortBy === 'desc'
          ? 'dept.DepartmentName asc'
          : `${sortBy} ${sorting}`;
        const page = Math.floor(req.query.page) || 1;

        const baseQuery = dbDbcHris("AppDB_DBC_HRIS.dbo.T_DBC_Job_Position as dept")
                    .select(
                      'dept.DepartmentCode as dept_idreal',
                      'dept.DepartmentName as dept_name',
                      'dept.BusinessUnitCode as dept_groupid'
                    )
                    .where((query) => {
                      if (req.query.filter != null) {
                        query.where(function () {
                          this.orWhere('dept.DepartmentCode', 'like', `%${req.query.filter}%`)
                              .orWhere('dept.DepartmentName', 'like', `%${req.query.filter}%`);
                        });
                      }
                      if (req.query.business_unit) {
                        query.where("dept.BusinessUnitCode", req.query.business_unit);
                      }
                      query.whereNotNull('dept.DepartmentCode');
                    });

        const response = await baseQuery
                    .orderByRaw(columnSort)
                    .paginate({
                      perPage: Math.floor(req.query.rowsPerPage) || 10,
                      currentPage: page,
                      isLengthAware: true,
                    });

        // Get domain mapping for the data
        const domainMap = new Map();
        if (response.data.length > 0) {
          const businessUnits = [...new Set(response.data.map(r => r.dept_groupid))];
          const domains = await db("dbPortalFA.dbo.domain")
            .select('domain_code', 'domain_shortname')
            .whereIn('domain_shortname', businessUnits);
          
          domains.forEach(d => domainMap.set(d.domain_shortname, d.domain_code));
        }

        // Filter by domain and add domain_code
        if (req.query.domain != null) {
          response.data = response.data.filter(r => domainMap.get(r.dept_groupid) === req.query.domain);
        }

        response.data = response.data.map(item => ({
          ...item,
          domain_code: domainMap.get(item.dept_groupid) || null
        }));

        res.status(200).json(response);
      }
     
    } catch (error) {
      console.log(error)
      return res.status(406).json(/* { message: error.message } */
        {
          type:'error',
          message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
      });
    }
};

export const PUMPJUM_listGrade = async (req, res) => {
    // #swagger.tags = ['Grade']
    /* #swagger.security = [{
                "bearerAuth": []
        }] */
    // #swagger.description = 'Fungsi untuk menampilkan list data grade'
    try {
  
      if (req.query.rowsPerPage == null) {
        let response = await dbDbcHris("dbHRIS_newer.dbo.mapping_grade")
        .select('grade_name')
        .orderBy("grade_new");
        response = response.filter((v) => v.grade_name !== 'Superintendent / Section Head');
        res.status(200).json(response);
  
      }else{
        const sorting =  (req.query.descending == 'true'?'desc':'asc');
        const columnSort = (req.query.sortBy =='desc'?
        'grade_new asc':`${req.query.sortBy} ${sorting}`);
        const page = Math.floor(req.query.page);
        let response =  await dbDbcHris("dbHRIS_newer.dbo.mapping_grade")
                    .where("dept_active", 'ACTIVE')
                    .where((query) => 
                      {
                        if(req.query.filter != null)
                        {
                          query.orWhere('grade_name', 'like', `%${req.query.filter}%`)
                        }                    
                    })
                    .orderByRaw(columnSort)
                   /*  .orderBy('code_value', 'asc') */
                    .paginate({
                        perPage: Math.floor(req.query.rowsPerPage),
                        currentPage:page,
                        isLengthAware :true,
                      });
        response.data = response.data.filter((v) => v.grade_name !== 'Superintendent / Section Head');
        res.status(200).json(response);
      }
     
    } catch (error) {
      return res.status(406).json(/* { message: error.message } */
        {
          type:'error',
          message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
      });
    }
};

export const PUMPJUM_listSupplier = async (req, res) => {
  try {
    const { domain } = req.query;

    if (req.query.rowsPerPage == null) {
      const response = await db("dbMaster.dbo.qad_supplier")
      .select(
        'vd_addr',
        'vd_sort',
        'vd_curr',
        db.raw("vd_addr + ' - ' + CAST(vd_sort AS VARCHAR) AS vd_name"),
      )
      .where("vd_domain", domain)
      .orderBy("vd_sort");
      res.status(200).json(response);

    }else{
      const sorting =  (req.query.descending == 'true'?'desc':'asc');
      const columnSort = (req.query.sortBy =='desc'?
      'vd_sort asc':`${req.query.sortBy} ${sorting}`);
      const page = Math.floor(req.query.page);
      const response =  await db("dbMaster.dbo.qad_supplier")
                  .select(
                    'vd_addr',
                    'vd_sort',
                    db.raw("vd_addr + ' - ' + CAST(vd_sort AS VARCHAR) AS vd_name"),
                  )
                  .where("vd_domain", domain)
                  .where((query) => 
                    {
                      if(req.query.filter != null)
                      {
                        query.orWhere('vd_sort', 'like', `%${req.query.filter}%`)
                        query.orWhere('vd_addr', 'like', `%${req.query.filter}%`)
                      }                    
                  })
                  .orderByRaw(columnSort)
                 /*  .orderBy('code_value', 'asc') */
                  .paginate({
                      perPage: Math.floor(req.query.rowsPerPage),
                      currentPage:page,
                      isLengthAware :true,
                    });
      res.status(200).json(response);
    }
   
  } catch (error) {
    console.log(error)
    return res.status(406).json(/* { message: error.message } */
      {
        type:'error',
        message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
    });
  }
};

export const PUMPJUM_listUser = async (req, res) => {
  try {
    if (req.query.rowsPerPage == null) {
      const response = await db("dbPortalFA.dbo.users")
      .select(
        'user_nik',
        'user_name',
      )
      .where("user_active", 1)
      .where((query) => {
        if (req.query.filter != null) {
          query.orWhere("user_nik", "like", `%${req.query.filter}%`);
          query.orWhere("user_name", "like", `%${req.query.filter}%`);
          query.orWhere("user_domain", "like", `%${req.query.filter}%`);
        }
      })
      .orderBy("user_nik");
      res.status(200).json(response);
    } else {
      const sorting = req.query.descending === "true" ? "desc" : "asc";
      const columnSort =
        req.query.sortBy === "desc"
          ? "user_nik asc"
          : `${req.query.sortBy} ${sorting}`;

      const page = Math.floor(req.query.page);
      const response = await db("users")
        .select(
          'user_nik',
          'user_name',
        )
        .where("user_active", 1)
        .where((query) => {
          if (req.query.filter != null) {
            query.orWhere("user_nik", "like", `%${req.query.filter}%`);
            query.orWhere("user_name", "like", `%${req.query.filter}%`);
            query.orWhere("user_domain", "like", `%${req.query.filter}%`);
          }
        })
        .orderByRaw(columnSort)
        .paginate({
          perPage: Math.floor(req.query.rowsPerPage),
          currentPage: page,
          isLengthAware: true,
        });

      res.status(200).json(response);
    }
  } catch (error) {
    console.log(error);
    return res.status(406).json({
      type: "error",
      message:
        process.env.DEBUG == 1
          ? error.message
          : `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
    });
  }
};

export const PUMPJUM_listInvoiceStatus = async (req, res) => {
  try {
    if (req.query.rowsPerPage == null) {
      const response = await finapp_dbc_bupot("finapp_dbc_bupot.dbo.mst_bm_inv_sts")
      .select(
        'id_inv_sts',
        'inv_name',
        'inv_desc',
        'inv_status',
      )
      .where((query) => {
        if (req.query.filter != null) {
          query.orWhere("inv_name", "like", `%${req.query.filter}%`);
          query.orWhere("inv_desc", "like", `%${req.query.filter}%`);
        }
      })
      .orderBy("inv_name");
      res.status(200).json(response);
    } else {
      const sorting = req.query.descending === "true" ? "desc" : "asc";
      const columnSort =
        req.query.sortBy === "desc"
          ? "inv_name asc"
          : `${req.query.sortBy} ${sorting}`;

      const page = Math.floor(req.query.page);
      const response = await finapp_dbc_bupot("finapp_dbc_bupot.dbo.mst_bm_inv_sts")
        .select(
          'id_inv_sts',
          'inv_name',
          'inv_desc',
          'inv_status',
        )
        .where((query) => {
          if (req.query.filter != null) {
            query.orWhere("inv_name", "like", `%${req.query.filter}%`);
            query.orWhere("inv_desc", "like", `%${req.query.filter}%`);
          }
        })
        .orderByRaw(columnSort)
        .paginate({
          perPage: Math.floor(req.query.rowsPerPage),
          currentPage: page,
          isLengthAware: true,
        });

      res.status(200).json(response);
    }
  } catch (error) {
    console.log(error);
    return res.status(406).json({
      type: "error",
      message:
        process.env.DEBUG == 1
          ? error.message
          : `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
    });
  }
};

export const generatePumNumber = async (payload) => {
  const { domain } = payload;

  const trxOndutyMax = await db("dbPortalFA.dbo.trx_onduty as odt")
                              .select(
                              db.raw(`
                                  MAX(CAST(SUBSTRING(odt.pum_number, CHARINDEX('-', odt.pum_number) + 1, LEN(odt.pum_number)) AS INT)) as maxNumber
                              `)
                              )
                              .where('odt.domain', domain)
                              .whereNotNull('odt.pum_number')
                              .first();

const trxNondutyMax = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
                              .select(
                              db.raw(`
                                  MAX(CAST(SUBSTRING(ndt.pum_number, CHARINDEX('-', ndt.pum_number) + 1, LEN(ndt.pum_number)) AS INT)) as maxNumber
                              `)
                              )
                              .where('ndt.domain', domain)
                              .whereNotNull('ndt.pum_number')
                              .first();

  // Promise.all untuk jalanin 2 query bareng
  const [ondutyMax, nondutyMax] = await Promise.all([trxOndutyMax, trxNondutyMax]);

  const maxOnduty = ondutyMax.maxNumber || 0;
  const maxNonduty = nondutyMax.maxNumber || 0;

  const biggest = Math.max(maxOnduty, maxNonduty);

  const templateNumber = await db("dbPortalFA.dbo.mstr_num_pum")
                      .select('start_year', 'start_numbering')
                      .where('domain', domain)
                      .first();
  if (!templateNumber) return null;

  const splitStartNumbering = templateNumber.start_numbering.split('-');
  const prefix = splitStartNumbering[0]; //prefix
  const numberPart = splitStartNumbering[1]; //number
  const digitLength = numberPart.length;
  const nextNumber = (biggest + 1).toString().padStart(digitLength, '0');
  const result = `${prefix}-${nextNumber}`;

  return result;
}

export const generatePumNumberWithLastMasterNumber = async (payload) => {
  // const query = await db.transaction();
  try {
    const { domain } = payload;

    let lastNumber = await db("dbPortalFA.dbo.mstr_num_pum")
      .where("domain", domain)
      .max("current_number as current_number")
      .first();

    const currentYear = new Date().getFullYear(); 
    const templateNumber = await db("dbPortalFA.dbo.mstr_num_pum")
      .select("id", "start_year", "start_numbering", "current_number", "prefix")
      .where('domain', domain)
      .where('start_year', currentYear)
      .first();

    if (!templateNumber) return null;

    if (!lastNumber || !lastNumber.current_number) {
      if (!lastNumber) {
        lastNumber = {};
      }
      lastNumber.current_number = templateNumber.start_numbering;
    }

    lastNumber = parseInt(lastNumber?.current_number || '0', 10);

    const digitLength = templateNumber.start_numbering.length;

    const nextNumber = (lastNumber + 1).toString().padStart(digitLength, '0');
    const result = {
      ...templateNumber,
      nextNumber,
      newNumberFormat: `${templateNumber.prefix ?? ''}${nextNumber}`,
    };

    // await query.commit();
    return result;
  } catch (error) {
    console.log(error)
    return null;
  }
}

export const PUMPJUM_listOwnBankNumber = async (req, res) => {
  try {
    if (req.query.rowsPerPage == null) {
      const response = await db("dbMaster.dbo.qad_supp_own_bank")
      .select(
        'id',
        'suppcode',
        'suppname',
        'bank_gl_account',
        'suppbank_nbr',
        'ownbank_nbr',
      )
      .where((query) => {
        if (req.query.filter != null) {
          query.orWhere("suppcode", "like", `%${req.query.filter}%`);
          query.orWhere("suppname", "like", `%${req.query.filter}%`);
          query.orWhere("bank_gl_account", "like", `%${req.query.filter}%`);
          query.orWhere("suppbank_nbr", "like", `%${req.query.filter}%`);
          query.orWhere("ownbank_nbr", "like", `%${req.query.filter}%`);
        }
      })
        .where((query) => {
          if (req.query.supplier != null) {
            query.where("suppcode", "=", req.query.supplier);
          }
        })
      .orderBy("ownbank_nbr");
      res.status(200).json(response);
    } else {
      const sorting = req.query.descending === "true" ? "desc" : "asc";
      const columnSort =
        req.query.sortBy === "desc"
          ? "id asc"
          : `${req.query.sortBy} ${sorting}`;

      const page = Math.floor(req.query.page);
      const response = await db("dbMaster.dbo.qad_supp_own_bank")
        .select(
          'id',
          'suppcode',
          'suppname',
          'bank_gl_account',
          'suppbank_nbr',
          'ownbank_nbr',
        )
        .where((query) => {
          if (req.query.filter != null) {
            query.orWhere("suppcode", "like", `%${req.query.filter}%`);
            query.orWhere("suppname", "like", `%${req.query.filter}%`);
            query.orWhere("bank_gl_account", "like", `%${req.query.filter}%`);
            query.orWhere("suppbank_nbr", "like", `%${req.query.filter}%`);
            query.orWhere("ownbank_nbr", "like", `%${req.query.filter}%`);
          }
        })
        .orderByRaw(columnSort)
        .paginate({
          perPage: Math.floor(req.query.rowsPerPage),
          currentPage: page,
          isLengthAware: true,
        });

      res.status(200).json(response);
    }
  } catch (error) {
    console.log(error);
    return res.status(406).json({
      type: "error",
      message:
        process.env.DEBUG == 1
          ? error.message
          : `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
    });
  }
};

export const PUMPJUM_listUangMukaType = async (req, res) => {
  // #swagger.tags = ['uang muka type']
  /* #swagger.security = [{
              "bearerAuth": []
      }] */
  // #swagger.description = 'Fungsi untuk menampilkan list data uang muka type'
  try {
    const domain = req.query.domain || req.body.domain || req.params.domain;
    if (!domain) {
      return res.status(400).json({ error: "Missing domain parameter" });
    }

    if (req.query.rowsPerPage == null) {
      const response = await db("dbPortalFA.dbo.mstr_um_type")
      .select('um_code', 'um_name')
      .where("domain", domain)
      .modify((query) => {
        if (req.query.filter) {
            const search = `%${req.query.filter}%`;
            query.where(function () {
                this.orWhere('um_code', 'like', search)
                this.orWhere('dom.um_name', 'like', search)
            });
        }
      })
      .orderBy("um_code");
      res.status(200).json(response);

    }else{
      const sorting =  (req.query.descending == 'true'?'desc':'asc');
      const columnSort = (req.query.sortBy =='desc'?
      'um_code asc':`${req.query.sortBy} ${sorting}`);
      const page = Math.floor(req.query.page);
      const response =  await db("dbPortalFA.dbo.mstr_um_type")
                  .where("domain", domain)
                  .modify((query) => {
                    if (req.query.filter) {
                        const search = `%${req.query.filter}%`;
                        query.where(function () {
                            this.orWhere('um_code', 'like', search)
                            this.orWhere('dom.um_name', 'like', search)
                        });
                    }
                  })
                  .orderByRaw(columnSort)
                 /*  .orderBy('code_value', 'asc') */
                  .paginate({
                      perPage: Math.floor(req.query.rowsPerPage),
                      currentPage:page,
                      isLengthAware :true,
                    });
      res.status(200).json(response);
    }
   
  } catch (error) {
    return res.status(406).json(/* { message: error.message } */
      {
        type:'error',
        message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
    });
  }
};

export const PUMPJUM_listPaymentMethod = async (req, res) => {
  // #swagger.tags = ['payment method']
  /* #swagger.security = [{
              "bearerAuth": []
      }] */
  // #swagger.description = 'Fungsi untuk menampilkan list data payment method'
  try {
    const domain = req.query.domain || req.body.domain || req.params.domain;
    if (!domain) {
      return res.status(400).json({ error: "Missing domain parameter" });
    }

    if (req.query.rowsPerPage == null) {
      const response = await db("dbPortalFA.dbo.mstr_payment_method")
      .select('method_code', 'method_name')
      .where("domain", domain)
      .modify((query) => {
        if (req.query.filter) {
            const search = `%${req.query.filter}%`;
            query.where(function () {
                this.orWhere('method_code', 'like', search)
                this.orWhere('method_name', 'like', search)
            });
        }
      })
      .orderBy("method_code");
      res.status(200).json(response);

    }else{
      const sorting =  (req.query.descending == 'true'?'desc':'asc');
      const columnSort = (req.query.sortBy =='desc'?
      'method_code asc':`${req.query.sortBy} ${sorting}`);
      const page = Math.floor(req.query.page);
      const response =  await db("dbPortalFA.dbo.mstr_payment_method")
                  .where("domain", domain)
                  .modify((query) => {
                    if (req.query.filter) {
                        const search = `%${req.query.filter}%`;
                        query.where(function () {
                            this.orWhere('method_code', 'like', search)
                            this.orWhere('method_name', 'like', search)
                        });
                    }
                  })
                  .orderByRaw(columnSort)
                 /*  .orderBy('code_value', 'asc') */
                  .paginate({
                      perPage: Math.floor(req.query.rowsPerPage),
                      currentPage:page,
                      isLengthAware :true,
                    });
      res.status(200).json(response);
    }
   
  } catch (error) {
    return res.status(406).json(/* { message: error.message } */
      {
        type:'error',
        message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
    });
  }
};

export const PUMPJUM_listSite = async (req, res) => {
    // #swagger.tags = ['site']
    /* #swagger.security = [{
                "bearerAuth": []
        }] */
    // #swagger.description = 'Fungsi untuk menampilkan list data site'
    try {
      let result = [];
      if (req.query.rowsPerPage == null) {
        let response = await db("dbPortalFA.dbo.site_mstr as site")
        .select(
          'site.site_domain',
          'site.site_code',
          'site.site_desc',
          db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
        )        
        .where((query) => {
          if (req.query.domain != null) {
            query.where("site.site_domain", req.query.domain);
          }
          if(req.query.filter != null) {
            query.orWhere('site_code', 'like', `%${req.query.filter}%`)
            query.orWhere('site_desc', 'like', `%${req.query.filter}%`)
          }
        })
        .innerJoin("dbPortalFA.dbo.domain as dom", "site.site_domain", "=", "dom.domain_code")
        .orderBy("site_desc");
        if (response.length > 0) {
          result = response.map((el) => ({
            ...el,
            label: `${el.site_code} - ${el.site_desc}`,
          }));
        }
        res.status(200).json(result);
  
      }else{
        const sorting =  (req.query.descending == 'true'?'desc':'asc');
        const columnSort = (req.query.sortBy =='desc'?
        'site_desc asc':`${req.query.sortBy} ${sorting}`);
        const page = Math.floor(req.query.page);
        const response = await db("dbPortalFA.dbo.site_mstr as site")
                    .select(
                      'site.site_domain',
                      'site.site_code',
                      'site.site_desc',
                      db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                    )
                    .innerJoin("dbPortalFA.dbo.domain as dom", "site.site_domain", "=", "dom.domain_code")
                    .where((query) => 
                      {
                        if (req.query.domain != null) {
                          query.where("site.site_domain", req.query.domain);
                        }
                        if(req.query.filter != null) {
                          query.orWhere('site_code', 'like', `%${req.query.filter}%`)
                          query.orWhere('site_desc', 'like', `%${req.query.filter}%`)
                        }
                    })
                    .orderByRaw(columnSort)
                   /*  .orderBy('code_value', 'asc') */
                    .paginate({
                        perPage: Math.floor(req.query.rowsPerPage),
                        currentPage:page,
                        isLengthAware :true,
                      });
        res.status(200).json(response);
      }
     
    } catch (error) {
      console.log(error)
      return res.status(406).json(/* { message: error.message } */
        {
          type:'error',
          message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
      });
    }
};

export const PUMPJUM_listTypeApproval = async (req, res) => {
    // #swagger.tags = ['type approval']
    /* #swagger.security = [{
                "bearerAuth": []
        }] */
    // #swagger.description = 'Fungsi untuk menampilkan list data type approval'
    try {
      if (req.query.rowsPerPage == null) {
        let response = await db("dbPortalFA.dbo.mstr_type_approval as app")
        .select(
          'app.domain',
          'app.code',
          'app.name',
          db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
        )        
        .where((query) => {
          if (req.query.domain != null) {
            query.where("app.domain", req.query.domain);
          }
          if(req.query.filter != null) {
            query.orWhere('code', 'like', `%${req.query.filter}%`)
            query.orWhere('name', 'like', `%${req.query.filter}%`)
          }
        })
        .innerJoin("dbPortalFA.dbo.domain as dom", "app.domain", "=", "dom.domain_code")
        .orderBy("app.name");
        res.status(200).json(response);
  
      }else{
        const sorting =  (req.query.descending == 'true'?'desc':'asc');
        const columnSort = (req.query.sortBy =='desc'?
        'site_desc asc':`${req.query.sortBy} ${sorting}`);
        const page = Math.floor(req.query.page);
        const response = await db("dbPortalFA.dbo.mstr_type_approval as app")
                     .select(
                      'app.domain',
                      'app.code',
                      'app.name',
                      db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                    )
                    .innerJoin("dbPortalFA.dbo.domain as dom", "app.domain", "=", "dom.domain_code")
                    .where((query) => 
                      {
                        if (req.query.domain != null) {
                          query.where("app.domain", req.query.domain);
                        }
                        if(req.query.filter != null) {
                          query.orWhere('code', 'like', `%${req.query.filter}%`)
                          query.orWhere('name', 'like', `%${req.query.filter}%`)
                        }
                    })
                    .orderByRaw(columnSort)
                   /*  .orderBy('code_value', 'asc') */
                    .paginate({
                        perPage: Math.floor(req.query.rowsPerPage),
                        currentPage:page,
                        isLengthAware :true,
                      });
        res.status(200).json(response);
      }
     
    } catch (error) {
      console.log(error)
      return res.status(406).json(/* { message: error.message } */
        {
          type:'error',
          message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
      });
    }
};


export const PUMPJUM_listEmployee = async (req, res) => {
  try {
    if (req.query.rowsPerPage == null) {
      const response = await dbDbcHris("dbHRIS_newer.dbo.master_employee as emp")
      .select(
        'emp.employee_id',
        'emp.employee_name',
        'emp.employee_jabatan',
        'emp.employee_bu_id'
      )
      .where("employee_stat", "ACTIVE")
      .where((query) => {
        if (req.query.filter != null) {
          query.where(function () {
            this.orWhere("employee_id", "like", `%${req.query.filter}%`)
                .orWhere("employee_name", "like", `%${req.query.filter}%`)
                .orWhere("employee_bu_id", "like", `%${req.query.filter}%`)
                .orWhere("employee_jabatan", "like", `%${req.query.filter}%`);
          });
        }
      })
      .orderBy("employee_id");
      
      // Get domain mapping separately
      const domainMap = new Map();
      if (response.length > 0) {
        const businessUnits = [...new Set(response.map(r => r.employee_bu_id).filter(Boolean))];
        const domains = await db("dbPortalFA.dbo.domain")
          .select('domain_code', 'domain_shortname')
          .whereIn('domain_shortname', businessUnits);
        
        domains.forEach(d => domainMap.set(d.domain_shortname, d.domain_code));
      }
      
      // Filter by domain and add domain_code
      let filteredResponse = req.query.domain 
        ? response.filter(r => domainMap.get(r.employee_bu_id) === req.query.domain)
        : response;
      
      // Add domain_code to response
      const finalResponse = filteredResponse.map(item => ({
        employee_id: item.employee_id,
        employee_name: item.employee_name,
        employee_jabatan: item.employee_jabatan,
        domain_code: domainMap.get(item.employee_bu_id) || null
      }));
      
      res.status(200).json(finalResponse);
    } else {
      const sorting = req.query.descending === "true" ? "desc" : "asc";
      const columnSort =
        req.query.sortBy === "desc"
          ? "user_nik asc"
          : `${req.query.sortBy} ${sorting}`;

      const page = Math.floor(req.query.page);
      const baseResponse = await dbDbcHris("dbHRIS_newer.dbo.master_employee")
        .select(
          'employee_id',
          'employee_name',
          'employee_jabatan',
          'employee_bu_id'
        )
        .where("employee_stat", "ACTIVE")
        .where((query) => {
          if (req.query.filter != null) {
            query.where(function () {
              this.orWhere("employee_id", "like", `%${req.query.filter}%`)
                  .orWhere("employee_name", "like", `%${req.query.filter}%`)
                  .orWhere("employee_bu_id", "like", `%${req.query.filter}%`)
                  .orWhere("employee_jabatan", "like", `%${req.query.filter}%`);
            });
          }
        })
        .orderByRaw(columnSort)
        .paginate({
          perPage: Math.floor(req.query.rowsPerPage),
          currentPage: page,
          isLengthAware: true,
        });
      
      // Get domain mapping separately
      const domainMap = new Map();
      if (baseResponse.data.length > 0) {
        const businessUnits = [...new Set(baseResponse.data.map(r => r.employee_bu_id).filter(Boolean))];
        const domains = await db("dbPortalFA.dbo.domain")
          .select('domain_code', 'domain_shortname')
          .whereIn('domain_shortname', businessUnits);
        
        domains.forEach(d => domainMap.set(d.domain_shortname, d.domain_code));
      }
      
      // Filter by domain and add domain_code
      if (req.query.domain != null) {
        baseResponse.data = baseResponse.data.filter(r => domainMap.get(r.employee_bu_id) === req.query.domain);
      }
      
      baseResponse.data = baseResponse.data.map(item => ({
        employee_id: item.employee_id,
        employee_name: item.employee_name,
        employee_jabatan: item.employee_jabatan,
        domain_code: domainMap.get(item.employee_bu_id) || null
      }));

      res.status(200).json(baseResponse);
    }
  } catch (error) {
    console.log(error);
    return res.status(406).json({
      type: "error",
      message:
        process.env.DEBUG == 1
          ? error.message
          : `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
    });
  }
};


export const PUMPJUM_listGlAccountPerjalananDinas = async (req, res) => {
  // #swagger.tags = ['GL account perjalanan dinas']
  /* #swagger.security = [{
              "bearerAuth": []
      }] */
  // #swagger.description = 'Fungsi untuk menampilkan list data GL account perjalanan dinas'
  try {
    const domain = req.query.domain || req.body.domain || req.params.domain;
    if (!domain) {
      return res.status(400).json({ error: "Missing domain parameter" });
    }

    if (req.query.rowsPerPage == null) {
      const response = await db("dbPortalFA.dbo.mstr_map_gl_onduty as odt")
      .select(
        'odt.id',
        'odt.domain',
        'odt.on_duty_type',
        'odt.on_duty_item_code',
        'odt.on_duty_item_name',
        'odt.gl_id',
        'gl.gl_desc',
        'odt.subacc_id',
        'sub.subacc_desc',
        'odt.supplier',
        'sup.vd_sort',
        "dom.domain_shortname"
      )
      .leftJoin("dbPortalFA.dbo.domain as dom", "odt.domain", "=", "dom.domain_code")
      .leftJoin("dbPortalFA.dbo.qad_gl as gl", "odt.gl_id", "=", "gl.gl_code")
      .leftJoin('dbPortalFA.dbo.qad_subacc as sub', function () {
          this.on('odt.subacc_id', '=', 'sub.subacc_code')
              .andOn('odt.domain', '=', 'sub.subacc_domain');
      })
      .leftJoin('dbMaster.dbo.qad_supplier as sup', function () {
          this.on('odt.supplier', '=', 'sup.vd_addr')
              .andOn('odt.domain', '=', 'sup.vd_domain');
      })
      .where("odt.domain", domain)
      .modify((query) => {
        if (req.query.filterOndutyType) {
          query.where('odt.on_duty_type', req.query.filterOndutyType)
        }
        if (req.query.filter) {
            const search = `%${req.query.filter}%`;
            query.where(function () {
                this.orWhere('gl_id', 'like', search)
                this.orWhere('method_name', 'like', search)
            });
        }
      })
      .orderBy("gl_id");
      res.status(200).json(response);

    }else{
      const sorting =  (req.query.descending == 'true'?'desc':'asc');
      const columnSort = (req.query.sortBy =='desc'?
      'gl_id asc':`${req.query.sortBy} ${sorting}`);
      const page = Math.floor(req.query.page);
      const response =  await db("dbPortalFA.dbo.mstr_map_gl_onduty as odt")
                  .select(
                    'odt.id',
                    'odt.domain',
                    'odt.on_duty_type',
                    'odt.on_duty_item_code',
                    'odt.on_duty_item_name',
                    'odt.gl_id',
                    'gl.gl_desc',
                    'odt.subacc_id',
                    'sub.subacc_desc',
                    'odt.supplier',
                    'sup.vd_sort',
                    "dom.domain_shortname"
                  )
                  .leftJoin("dbPortalFA.dbo.domain as dom", "odt.domain", "=", "dom.domain_code")
                  .leftJoin("dbPortalFA.dbo.qad_gl as gl", "odt.gl_id", "=", "gl.gl_code")
                  .leftJoin('dbPortalFA.dbo.qad_subacc as sub', function () {
                      this.on('odt.subacc_id', '=', 'sub.subacc_code')
                          .andOn('odt.domain', '=', 'sub.subacc_domain');
                  })
                  .leftJoin('dbMaster.dbo.qad_supplier as sup', function () {
                      this.on('odt.supplier', '=', 'sup.vd_addr')
                          .andOn('odt.domain', '=', 'sup.vd_domain');
                  })
                  .where("odt.domain", domain)
                  .modify((query) => {
                    if (req.query.filter) {
                        const search = `%${req.query.filter}%`;
                        query.where(function () {
                            this.orWhere('gl_id', 'like', search)
                            this.orWhere('method_name', 'like', search)
                        });
                    }
                  })
                  .orderByRaw(columnSort)
                 /*  .orderBy('code_value', 'asc') */
                  .paginate({
                      perPage: Math.floor(req.query.rowsPerPage),
                      currentPage:page,
                      isLengthAware :true,
                    });
      res.status(200).json(response);
    }
   
  } catch (error) {
    return res.status(406).json(/* { message: error.message } */
      {
        type:'error',
        message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
    });
  }
};


export const PUMPJUM_listGlAccountNonPerjalananDinas = async (req, res) => {
  // #swagger.tags = ['GL account non perjalanan dinas']
  /* #swagger.security = [{
              "bearerAuth": []
      }] */
  // #swagger.description = 'Fungsi untuk menampilkan list data GL account non perjalanan dinas'
  try {
    const domain = req.query.domain || req.body.domain || req.params.domain;
    if (!domain) {
      return res.status(400).json({ error: "Missing domain parameter" });
    }

    if (req.query.rowsPerPage == null) {
      const response = await db('dbPortalFA.dbo.mstr_map_gl_nonduty as ndt')
      .select(
          'ndt.id',
          'ndt.domain',
          'ndt.um_type_id',
          'umt.um_name',
          'ndt.payment_method_id',
          'pym.method_name',
          'ndt.gl_id',
          'gl.gl_desc',
          'ndt.subacc_id',
          'sub.subacc_desc',
          'ndt.prodline_id',
          'prd.pl_desc',
          "dom.domain_shortname"
      )
      .where('ndt.domain', domain)
      .leftJoin("dbPortalFA.dbo.domain as dom", "ndt.domain", "=", "dom.domain_code")
      .leftJoin("dbPortalFA.dbo.qad_gl as gl", "ndt.gl_id", "=", "gl.gl_code")
      .leftJoin('dbPortalFA.dbo.mstr_um_type as umt', function () {
          this.on('ndt.um_type_id', '=', 'umt.um_code')
              .andOn('ndt.domain', '=', 'umt.domain');
      })
      .leftJoin('dbPortalFA.dbo.mstr_payment_method as pym', function () {
          this.on('ndt.payment_method_id', '=', 'pym.method_code')
              .andOn('ndt.domain', '=', 'pym.domain');
      })
      .leftJoin('dbPortalFA.dbo.qad_subacc as sub', function () {
          this.on('ndt.subacc_id', '=', 'sub.subacc_code')
              .andOn('ndt.domain', '=', 'sub.subacc_domain');
      })
      .leftJoin('dbMaster.dbo.qad_prod_line as prd', function () {
          this.on('ndt.prodline_id', '=', 'prd.pl_prod_line')
              .andOn('ndt.domain', '=', 'prd.domain');
      })
      .modify((query) => {
        if (req.query.payment_method_id) {
          query.where('ndt.payment_method_id', req.query.payment_method_id)
        }
        if (req.query.um_type_id) {
          query.where('ndt.um_type_id', req.query.um_type_id)
        }
      })
      .orderBy("gl_id");
      res.status(200).json(response);

    }else{
      const sorting =  (req.query.descending == 'true'?'desc':'asc');
      const columnSort = (req.query.sortBy =='desc'?
      'gl_id asc':`${req.query.sortBy} ${sorting}`);
      const page = Math.floor(req.query.page);
      const response =  await db('dbPortalFA.dbo.mstr_map_gl_nonduty as ndt')
                  .select(
                      'ndt.id',
                      'ndt.domain',
                      'ndt.um_type_id',
                      'umt.um_name',
                      'ndt.payment_method_id',
                      'pym.method_name',
                      'ndt.gl_id',
                      'gl.gl_desc',
                      'ndt.subacc_id',
                      'sub.subacc_desc',
                      'ndt.prodline_id',
                      'prd.pl_desc',
                      "dom.domain_shortname"
                  )
                  .where('ndt.domain', domain)
                  .leftJoin("dbPortalFA.dbo.domain as dom", "ndt.domain", "=", "dom.domain_code")
                  .leftJoin("dbPortalFA.dbo.qad_gl as gl", "ndt.gl_id", "=", "gl.gl_code")
                  .leftJoin('dbPortalFA.dbo.mstr_um_type as umt', function () {
                      this.on('ndt.um_type_id', '=', 'umt.um_code')
                          .andOn('ndt.domain', '=', 'umt.domain');
                  })
                  .leftJoin('dbPortalFA.dbo.mstr_payment_method as pym', function () {
                      this.on('ndt.payment_method_id', '=', 'pym.method_code')
                          .andOn('ndt.domain', '=', 'pym.domain');
                  })
                  .leftJoin('dbPortalFA.dbo.qad_subacc as sub', function () {
                      this.on('ndt.subacc_id', '=', 'sub.subacc_code')
                          .andOn('ndt.domain', '=', 'sub.subacc_domain');
                  })
                  .leftJoin('dbMaster.dbo.qad_prod_line as prd', function () {
                      this.on('ndt.prodline_id', '=', 'prd.pl_prod_line')
                          .andOn('ndt.domain', '=', 'prd.domain');
                  })
                  .modify((query) => {
                    if (req.query.filter) {
                        const search = `%${req.query.filter}%`;
                        query.where(function () {
                            this.orWhere('gl_id', 'like', search)
                            this.orWhere('method_name', 'like', search)
                        });
                    }
                    if (req.query.payment_method_id) {
                      query.where('ndt.payment_method_id', req.query.payment_method_id)
                    }
                    if (req.query.um_type_id) {
                      query.where('ndt.um_type_id', req.query.um_type_id)
                    }
                  })
                  .orderByRaw(columnSort)
                 /*  .orderBy('code_value', 'asc') */
                  .paginate({
                      perPage: Math.floor(req.query.rowsPerPage),
                      currentPage:page,
                      isLengthAware :true,
                    });
      res.status(200).json(response);
    }
   
  } catch (error) {
    return res.status(406).json(/* { message: error.message } */
      {
        type:'error',
        message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
    });
  }
};
