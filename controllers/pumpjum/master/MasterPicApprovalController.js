import { db, linked_dbDbcHris } from "../../../config/db.js";
import * as dotenv from "dotenv";
import dayjs from "dayjs";

dotenv.config();

const parsedResponse = (response) => {
    const result = response.map((row) => ({
        ...row,
        site: JSON.parse(row.site || '[]')
    }));
    return result;
};

// Get List of Master Pic Approval data
export const PUMPJUM_MasterPicApprovalList = async (req, res) => {
    const { rowsPerPage, page } = req.query;

    const domain = req.query.domain || req.body.domain || req.params.domain;
    const sortBy = req.query.sortBy || 'id';
    const sort = req.query.descending === "true" ? "desc" : "asc";

    if (!domain) {
        return res.status(400).json({ error: "Missing domain parameter" });
    }

    try {
        let response;

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db('dbPortalFA.dbo.mstr_pic_app as app')
            .select(
                'app.id',
                'app.domain',
                'app.site',
                'app.type_pum',
                'app.type_approval_id',
                'app.employee_id',
                'app.level',
                "dom.domain_shortname",
                "emp.employee_name",
                "emp.employee_jabatan",
                db.raw("COALESCE(tap.name, NULL) as type_approval_name"),
            )
            .where('app.domain', domain)
            .leftJoin("dbPortalFA.dbo.domain as dom", "app.domain", "=", "dom.domain_code")
            .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), "app.employee_id", "=", "emp.employee_id")
            .leftJoin("dbPortalFA.dbo.mstr_type_approval as tap", "app.type_approval_id", "=", "tap.code")
            .modify((query) => {
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere('app.domain', 'like', search)
                        this.orWhere('dom.domain_shortname', 'like', search)
                        this.orWhere('emp.employee_name', 'like', search)
                        this.orWhere('tap.name', 'like', search)
                        this.orWhere('app.type_pum', 'like', search)
                        this.orWhere('app.level', 'like', search)
                            .orWhereExists(function () {
                                this.select(db.raw('1'))
                                    .from('dbPortalFA.dbo.site_mstr as sit')
                                    .where('sit.site_desc', 'like', search)
                                    .andWhereRaw(`
                                    EXISTS (
                                        SELECT 1
                                        FROM OPENJSON(app.site)
                                        WITH (id NVARCHAR(MAX) '$')
                                        WHERE id = sit.site_code
                                    )
                                `);
                            });
                    });
                }
            })
            .orderBy(sortBy, sort);
            response.data = await parsedResponse(response.data)
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db('dbPortalFA.dbo.mstr_pic_app as app')
            .select(
                'app.id',
                'app.domain',
                'app.site',
                'app.type_pum',
                'app.type_approval_id',
                'app.employee_id',
                'app.level',
                "dom.domain_shortname",
                "emp.employee_name",
                "emp.employee_jabatan",
                db.raw("COALESCE(tap.name, NULL) as type_approval_name"),
            )
            .where('app.domain', domain)
            .leftJoin("dbPortalFA.dbo.domain as dom", "app.domain", "=", "dom.domain_code")
            .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), 'app.employee_id', 'emp.employee_id')
            .leftJoin("dbPortalFA.dbo.mstr_type_approval as tap", "app.type_approval_id", "=", "tap.code")
            .modify((query) => {
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere('app.domain', 'like', search)
                        this.orWhere('dom.domain_shortname', 'like', search)
                        this.orWhere('emp.employee_name', 'like', search)
                        this.orWhere('tap.name', 'like', search)
                        this.orWhere('app.type_pum', 'like', search)
                        this.orWhere('app.level', 'like', search)
                            .orWhereExists(function () {
                                this.select(db.raw('1'))
                                    .from('dbPortalFA.dbo.site_mstr as sit')
                                    .where('sit.site_desc', 'like', search)
                                    .andWhereRaw(`
                                    EXISTS (
                                        SELECT 1
                                        FROM OPENJSON(app.site)
                                        WITH (id NVARCHAR(MAX) '$')
                                        WHERE id = sit.site_code
                                    )
                                `);
                            });
                    });
                }
                if (req.query.filter_domain) {
                    query.where(function () {
                        this.where("app.domain", req.query.filter_domain);
                    });
                }
                if (req.query.filter_site) {
                    query.whereExists(function () {
                        this.select(db.raw('1'))
                        .fromRaw('OPENJSON(app.site)')
                        .whereRaw('value = ?', [req.query.filter_site]);
                    });
                }
                if (req.query.filter_type_pum) {
                    query.where(function () {
                        this.where("app.type_pum", req.query.filter_type_pum);
                    });
                }
            })
            .orderBy(sortBy, sort)
            .paginate({
                perPage: Math.abs(Math.floor(parseInt(rowsPerPage, 10))),
                currentPage: pages,
                isLengthAware: true,
            });
            response.data = await parsedResponse(response.data)
        }

        // add return site_name
        const sites = await db('dbPortalFA.dbo.site_mstr').select('site_code', 'site_desc');
        response.data = response.data.map(app => {
            const siteMatched = sites
            .filter(site => app.site.includes(site.site_code))
            .map(site => `${site.site_code} - ${site.site_desc}`);
            
            return {
                ...app,
                site: siteMatched,
            };
        });

        return res.status(200).json({
            message: "Success",
            data: response,
        });
    } catch (error) {
        console.log(error)
        return res.status(406).json(
            /* { message: error.message } */
            {
                type: "error",
                message:
                    process.env.DEBUG == 1
                    ? error.message
                    : `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
            }
        );
    }
};

export const PUMPJUM_MasterPicApprovalDetail = async (req, res) => {
  try {
    const id = req.query.id;

    let query =  await db("dbPortalFA.dbo.mstr_pic_app as app")
        .select(
            'app.id',
            'app.domain',
            'app.site',
            'app.type_pum',
            'app.type_approval_id',
            'app.employee_id',
            'app.level',
            "dom.domain_shortname",
            "emp.employee_name",
            "emp.employee_jabatan",
            db.raw("COALESCE(tap.name, NULL) as type_approval_name"),
        )
        .leftJoin("dbPortalFA.dbo.domain as dom", "app.domain", "=", "dom.domain_code")
        .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), "app.employee_id", "=", "emp.employee_id")
        .leftJoin("dbPortalFA.dbo.mstr_type_approval as tap", "app.type_approval_id", "=", "tap.code")
        .where("app.id", id)
        .first();
    query = await parsedResponse([query]);

    // Mengirimkan response
    res.json({
      message: "success",
      status: true,
      data: query[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal server error, please call IT",
      status: false,
      error: error.message,
    });
  }
};

// Create Master Pic Approval
export const PUMPJUM_MasterPicApprovalSave = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            domain,
            site,
            type_approval_id,
            type_pum,
            employee_id,
            level,
        } = req.body;

        // Validate user, and get user_nik to assign created_by
        const user = await db("dbPortalFA.dbo.users")
                        .select('user_nik')
                        .where('user_id', req.body.empid)
                        .first()

        if(!user) {
            await query.rollback();
            return res.status(400).json({ message: 'Invalid user, silahkan hubungi Tim IT' });
        }

        const empid = user.user_nik;

        const picApproval = await query('dbPortalFA.dbo.mstr_pic_app as app')
            .select(
                'app.id',
                'app.domain',
                'app.site',
                'app.type_approval_id',
                'app.employee_id',
                'app.level',
                'app.type_pum',
                'app.created_by'
            )
            .where('app.domain', domain)
            .where('app.type_pum', type_pum)
            .where(function () {
                for (const vSite of site) {
                    this.orWhere('app.site', 'like', `%\"${vSite}\"%`);
                }
            })
            .modify((query) => {
                if (['FC', 'Tax-Officer', 'Tax-Approver', 'FA-Approver'].includes(type_approval_id)) {
                    query.andWhere('app.type_approval_id', type_approval_id);
                } else if (type_approval_id === 'AP') {
                    query.andWhere('app.type_approval_id', type_approval_id);
                    query.andWhere('app.type_pum', type_pum);
                } else {
                    query.andWhere('app.level', level);
                }
            })
            .first();

        if (picApproval) {
            await query.rollback();
            return res.status(400).json({ message: `Data tersebut sudah ada` });
        }

        const payload = {
            domain: parseInt(domain || 0),
            site: JSON.stringify(site),
            type_approval_id,
            type_pum,
            employee_id,
            level: level || null,
            created_by: parseInt(empid),
            created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        }

        await query("dbPortalFA.dbo.mstr_pic_app").insert(payload);

        await query.commit();
        return res.status(201).json({ message: 'Data berhasil dibuat' });
    } catch (error) {
        console.log(error)
        await query.rollback();
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1 ? error.message : 'Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT',
        });
    }
}

// Update Master Pic Approval
export const PUMPJUM_MasterPicApprovalUpdate = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            id,
            domain,
            site,
            type_approval_id,
            type_pum,
            employee_id,
            level,
        } = req.body;

        // Validate user, and get user_nik to assign created_by
        const user = await db("dbPortalFA.dbo.users")
                        .select('user_nik')
                        .where('user_id', req.body.empid)
                        .first()

        if(!user) {
            await query.rollback();
            return res.status(400).json({ message: 'Invalid user, silahkan hubungi Tim IT' });
        }

        const empid = user.user_nik;
        const picApproval = await query('dbPortalFA.dbo.mstr_pic_app as app')
            .select(
                'app.id',
                'app.domain',
                'app.site',
                'app.type_approval_id',
                'app.employee_id',
                'app.level',
                'app.type_pum',
                'app.created_by'
            )
            .where('app.domain', domain)
            .where('app.type_pum', type_pum)
            .where(function () {
                for (const vSite of site) {
                    this.orWhere('app.site', 'like', `%\"${vSite}\"%`);
                }
            })
            .modify((query) => {
                if (['FC', 'Tax-Officer', 'Tax-Approver', 'FA-Approver'].includes(type_approval_id)) {
                    query.andWhere('app.type_approval_id', type_approval_id);
                } else if (type_approval_id === 'AP') {
                    query.andWhere('app.type_approval_id', type_approval_id);
                    query.andWhere('app.type_pum', type_pum);
                } else {
                    query.andWhere('app.level', level);
                }
            })
            .first();

        if (picApproval && picApproval.id !== Number(id)) {
            await query.rollback();
            return res.status(400).json({ message: `Data tersebut sudah ada` });
        }

        const payload = {
            domain: parseInt(domain || 0),
            site: JSON.stringify(site),
            type_approval_id,
            type_pum,
            employee_id,
            level: level || null,
            updated_by: parseInt(empid),
            updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss")
        }

        await query("dbPortalFA.dbo.mstr_pic_app")
        .where('id', id)
        .update(payload);

        await query.commit();
        return res.status(201).json({ message: 'Data berhasil diubah' });
    } catch (error) {
        console.log(error)
        await query.rollback();
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1 ? error.message : 'Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT',
        });
    }
}

// Delete  Master Pic Approval
export const PUMPJUM_MasterPicApprovalDelete = async (req, res) => {
    try {
        const { domain, id } = req.query;

        if (!domain || !id) {
            return res.status(400).json({ 
                message: 'Domain and Approval Id are required' 
            });
        }

        // Delete all matching records
        await db("dbPortalFA.dbo.mstr_pic_app")
        .where({ domain, id })
        .delete();

        return res.status(204).json({ message: 'Data berhasil dihapus!'})
    } catch(error){
        return res.status(406).json(/* { message: error.message } */
        {
            type:'error',
            message: process.env.DEBUG == 1 ? error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
        });
    }
}

export const PUMPJUM_MasterPICCheckCurrentUser = async (req, res) => {
  try {
    const { employee_id, type_approval_id } = req.query;

    let query =  await db("dbPortalFA.dbo.mstr_pic_app as app")
        .select(
            'app.id',
            'app.domain',
            'app.type_pum',
            'app.type_approval_id',
            'app.employee_id',
            'app.level',
        )
        .where("app.employee_id", employee_id)
        .modify((query) => {
            if (req.query.type_approval_id) {
                query.where("app.type_approval_id", type_approval_id);
            }
            if (req.query.type_pum) {
                query.where("app.type_pum", req.query.type_pum);
            }
        })
        .first();

    // Mengirimkan response
    res.json({
      message: "success",
      status: true,
      data: query || null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal server error, please call IT",
      status: false,
      error: error.message,
    });
  }
};
