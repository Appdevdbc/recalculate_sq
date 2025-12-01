import { db } from "../../../config/db.js";
import * as dotenv from "dotenv";
import dayjs from "dayjs";

dotenv.config();

// Get List of Master mapping GL non perjalanan dinas data
export const PUMPJUM_MasterMapGlNonPerjalananDinasList = async (req, res) => {
    const { rowsPerPage, page } = req.query;

    const domain = req.query.domain || req.body.domain || req.params.domain;
    const sortBy = req.query.sortBy || 'ndt.id';
    const sort = req.query.descending === "true" ? "desc" : "asc";

    if (!domain) {
        return res.status(400).json({ error: "Missing domain parameter" });
    }

    try {
        let response;

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db('dbPortalFA.dbo.mstr_map_gl_nonduty as ndt')
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
            .leftJoin(
                db.select('gl_code', 'gl_desc')
                    .from('dbPortalFA.dbo.qad_gl')
                    .groupBy('gl_code', 'gl_desc')
                    .as('gl'),
                'ndt.gl_id',
                'gl.gl_code'
            )
            .leftJoin("dbPortalFA.dbo.mstr_um_type as umt", "ndt.um_type_id", "=", "umt.um_code")
            .leftJoin("dbPortalFA.dbo.mstr_payment_method as pym", "ndt.payment_method_id", "=", "pym.method_code")
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
                        this.orWhere('ndt.domain', 'like', search)
                        this.orWhere('dom.domain_shortname', 'like', search)
                        this.orWhere('ndt.um_type_id', 'like', search)
                        this.orWhere('ndt.payment_method_id', 'like', search)
                        this.orWhere('ndt.gl_id', 'like', search)
                        this.orWhere('gl.gl_desc', 'like', search)
                        this.orWhere('ndt.subacc_id', 'like', search)
                        this.orWhere('sub.subacc_desc', 'like', search)
                        this.orWhere('ndt.prodline_id', 'like', search)
                        this.orWhere('prd.pl_desc', 'like', search)
                        this.orWhere('pym.method_name', 'like', search)
                        this.orWhere('umt.um_name', 'like', search)
                    });
                }
            })
            .orderBy(sortBy, sort);
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db('dbPortalFA.dbo.mstr_map_gl_nonduty as ndt')
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
            .leftJoin(
                db.select('gl_code', 'gl_desc')
                    .from('dbPortalFA.dbo.qad_gl')
                    .groupBy('gl_code', 'gl_desc')
                    .as('gl'),
                'ndt.gl_id',
                'gl.gl_code'
            )
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
                        this.orWhere('ndt.domain', 'like', search)
                        this.orWhere('dom.domain_shortname', 'like', search)
                        this.orWhere('ndt.um_type_id', 'like', search)
                        this.orWhere('ndt.payment_method_id', 'like', search)
                        this.orWhere('ndt.gl_id', 'like', search)
                        this.orWhere('gl.gl_desc', 'like', search)
                        this.orWhere('ndt.subacc_id', 'like', search)
                        this.orWhere('sub.subacc_desc', 'like', search)
                        this.orWhere('ndt.prodline_id', 'like', search)
                        this.orWhere('prd.pl_desc', 'like', search)
                        this.orWhere('pym.method_name', 'like', search)
                        this.orWhere('umt.um_name', 'like', search)
                        
                    });
                }
            })
            .orderBy(sortBy, sort)
            .paginate({
                perPage: Math.abs(Math.floor(parseInt(rowsPerPage, 10))),
                currentPage: pages,
                isLengthAware: true,
            });
        }

        response.data = await Promise.all(response.data.map(async (v) => {
            const trxNonduty = await db("dbPortalFA.dbo.trx_nonduty_header")
                .select("status_data")
                .where('gl', v.gl_id)
                .where('subacc', v.subacc_id)
                .first();
            return {
                ...v,
                isUsed: trxNonduty ? true : false,
            }
        }));

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

export const PUMPJUM_MasterMapGlNonPerjalananDinasDetail = async (req, res) => {
  try {
    const id = req.query.id;

    let query =  await db("dbPortalFA.dbo.mstr_map_gl_nonduty as ndt")
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
        .leftJoin("dbPortalFA.dbo.domain as dom", "ndt.domain", "=", "dom.domain_code")
        .leftJoin("dbPortalFA.dbo.qad_gl as gl", "ndt.gl_id", "=", "gl.gl_code")
        .leftJoin("dbPortalFA.dbo.mstr_um_type as umt", "ndt.um_type_id", "=", "umt.um_code")
        .leftJoin("dbPortalFA.dbo.mstr_payment_method as pym", "ndt.payment_method_id", "=", "pym.method_code")
        .leftJoin('dbPortalFA.dbo.qad_subacc as sub', function () {
            this.on('ndt.subacc_id', '=', 'sub.subacc_code')
                .andOn('ndt.domain', '=', 'sub.subacc_domain');
        })
        .leftJoin('dbMaster.dbo.qad_prod_line as prd', function () {
            this.on('ndt.prodline_id', '=', 'prd.pl_prod_line')
                .andOn('ndt.domain', '=', 'prd.domain');
        })
        .where("ndt.id", id)
        .first();

    // Mengirimkan response
    res.json({
      message: "success",
      status: true,
      data: query,
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

// Create Master mapping GL non perjalanan dinas
export const PUMPJUM_MasterMapGlNonPerjalananDinasSave = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            domain,
            um_type_id,
            payment_method_id,
            gl_id,
            subacc_id,
            prodline_id,
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

        const checkExist = await query('dbPortalFA.dbo.mstr_map_gl_nonduty')
            .where('domain', domain)
            .where('um_type_id', um_type_id)
            .where('payment_method_id', payment_method_id)
            .where('gl_id', gl_id)
            .modify((query) => {
                if (subacc_id) {
                    query.where('subacc_id', subacc_id)
                }
                if (prodline_id) {
                    query.where('prodline_id', prodline_id)
                }
            })
            .first()

        if (checkExist) {
            await query.rollback();
            return res.status(400).json({ message: `Data tersebut sudah ada` });
        }

        const payload = {
            domain: parseInt(domain ?? 0),
            um_type_id,
            payment_method_id,
            gl_id,
            subacc_id,
            prodline_id,
            created_by: parseInt(empid),
            created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        }

        if (subacc_id) {
            payload.subacc_id = subacc_id;
        }
        if (prodline_id) {
            payload.prodline_id = prodline_id;
        }

        await query("dbPortalFA.dbo.mstr_map_gl_nonduty").insert(payload);

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

// Update Master mapping GL non perjalanan dinas
export const PUMPJUM_MasterMapGlNonPerjalananDinasUpdate = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            id,
            domain,
            payment_method_id,
            gl_id,
            subacc_id,
            prodline_id,
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

        const checkExist = await query('dbPortalFA.dbo.mstr_map_gl_nonduty')
            .where('domain', domain)
            .where('payment_method_id', payment_method_id)
            .where('gl_id', gl_id)
            .modify((query) => {
                if (subacc_id) {
                    query.where('subacc_id', subacc_id)
                }
                if (prodline_id) {
                    query.where('prodline_id', prodline_id)
                }
            })
            .first();

        if (checkExist && checkExist.id !== Number(id)) {
            await query.rollback();
            return res.status(400).json({ message: `Data tersebut sudah ada` });
        }

        const empid = user.user_nik;
        const payload = {
            gl_id,
            updated_by: parseInt(empid),
            updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss")
        }
        
        if (subacc_id) {
            payload.subacc_id = subacc_id;
        }
        if (prodline_id) {
            payload.prodline_id = prodline_id;
        }

        await query("dbPortalFA.dbo.mstr_map_gl_nonduty")
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

// Delete  Master mapping GL non perjalanan dinas
export const PUMPJUM_MasterMapGlNonPerjalananDinasDelete = async (req, res) => {
    try {
        const { domain, id } = req.query;

        if (!domain || !id) {
            return res.status(400).json({ 
                message: 'Domain and Mapping GL perjalanan dinas Id are required' 
            });
        }

        // Delete all matching records
        await db("dbPortalFA.dbo.mstr_map_gl_nonduty")
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
