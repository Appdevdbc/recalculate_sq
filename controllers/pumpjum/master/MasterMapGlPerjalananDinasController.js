import { db } from "../../../config/db.js";
import * as dotenv from "dotenv";
import dayjs from "dayjs";

dotenv.config();

// Get List of Master mapping GL perjalanan dinas data
export const PUMPJUM_MasterMapGlPerjalananDinasList = async (req, res) => {
    const { rowsPerPage, page } = req.query;

    const domain = req.query.domain || req.body.domain || req.params.domain;
    const sortBy = req.query.sortBy || 'odt.id';
    const sort = req.query.descending === "true" ? "desc" : "asc";

    if (!domain) {
        return res.status(400).json({ error: "Missing domain parameter" });
    }

    try {
        let response;

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db('dbPortalFA.dbo.mstr_map_gl_onduty as odt')
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
                "dom.domain_shortname",
                db.raw("COALESCE(sup.vd_sort, NULL) as supplier_desc"),
            )
            .where('odt.domain', domain)
            .leftJoin("dbPortalFA.dbo.domain as dom", "odt.domain", "=", "dom.domain_code")
            .leftJoin(
                db.select('gl_code', 'gl_desc')
                    .from('dbPortalFA.dbo.qad_gl')
                    .groupBy('gl_code', 'gl_desc')
                    .as('gl'),
                'odt.gl_id',
                'gl.gl_code'
            )
            .leftJoin('dbPortalFA.dbo.qad_subacc as sub', function () {
                this.on('odt.subacc_id', '=', 'sub.subacc_code')
                    .andOn('odt.domain', '=', 'sub.subacc_domain');
            })
            .leftJoin('dbMaster.dbo.qad_supplier as sup', function () {
                this.on('odt.supplier', '=', 'sup.vd_addr')
                    .andOn('odt.domain', '=', 'sup.vd_domain');
            })
            .modify((query) => {
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere('odt.domain', 'like', search)
                        this.orWhere('dom.domain_shortname', 'like', search)
                        this.orWhere('odt.on_duty_type', 'like', search)
                        this.orWhere('odt.on_duty_item_code', 'like', search)
                        this.orWhere('odt.on_duty_item_name', 'like', search)
                        this.orWhere('odt.gl_id', 'like', search)
                        this.orWhere('gl.gl_desc', 'like', search)
                        this.orWhere('odt.subacc_id', 'like', search)
                        this.orWhere('sub.subacc_desc', 'like', search)
                        this.orWhere('odt.supplier', 'like', search)
                        this.orWhere('sup.vd_sort', 'like', search)
                    });
                }
            })
            .orderBy(sortBy, sort);
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db('dbPortalFA.dbo.mstr_map_gl_onduty as odt')
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
                "dom.domain_shortname",
                db.raw("COALESCE(sup.vd_sort, NULL) as supplier_desc"),
            )
            .where('odt.domain', domain)
            .leftJoin("dbPortalFA.dbo.domain as dom", "odt.domain", "=", "dom.domain_code")
            .leftJoin(
                db.select('gl_code', 'gl_desc')
                    .from('dbPortalFA.dbo.qad_gl')
                    .groupBy('gl_code', 'gl_desc')
                    .as('gl'),
                'odt.gl_id',
                'gl.gl_code'
            )
            .leftJoin('dbPortalFA.dbo.qad_subacc as sub', function () {
                this.on('odt.subacc_id', '=', 'sub.subacc_code')
                    .andOn('odt.domain', '=', 'sub.subacc_domain');
            })
            .leftJoin('dbMaster.dbo.qad_supplier as sup', function () {
                this.on('odt.supplier', '=', 'sup.vd_addr')
                    .andOn('odt.domain', '=', 'sup.vd_domain');
            })
            .modify((query) => {
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere('odt.domain', 'like', search)
                        this.orWhere('dom.domain_shortname', 'like', search)
                        this.orWhere('odt.on_duty_type', 'like', search)
                        this.orWhere('odt.on_duty_item_code', 'like', search)
                        this.orWhere('odt.on_duty_item_name', 'like', search)
                        this.orWhere('odt.gl_id', 'like', search)
                        this.orWhere('gl.gl_desc', 'like', search)
                        this.orWhere('odt.subacc_id', 'like', search)
                        this.orWhere('sub.subacc_desc', 'like', search)
                        this.orWhere('odt.supplier', 'like', search)
                        this.orWhere('sup.vd_sort', 'like', search)
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
            const trxOnduty = await db("dbPortalFA.dbo.trx_onduty")
                .select("status_data")
                .where('gl', v.gl_id)
                .where('subacc', v.subacc_id)
                .first();
            return {
                ...v,
                isUsed: trxOnduty ? true : false,
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

export const PUMPJUM_MasterMapGlPerjalananDinasDetail = async (req, res) => {
  try {
    const id = req.query.id;

    let query =  await db("dbPortalFA.dbo.mstr_map_gl_onduty as odt")
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
        .where("odt.id", id)
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

// Create Master mapping GL perjalanan dinas
export const PUMPJUM_MasterMapGlPerjalananDinasSave = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            domain,
            on_duty_type,
            on_duty_item_code,
            on_duty_item_name,
            gl_id,
            subacc_id,
            supplier,
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

        const checkExist = await query('dbPortalFA.dbo.mstr_map_gl_onduty')
            .where('domain', domain)
            .where('on_duty_type', on_duty_type)
            .where('on_duty_item_code', on_duty_item_code)
            .where('on_duty_item_name', on_duty_item_name)
            .where('gl_id', gl_id)
            .where('subacc_id', subacc_id)
            .where('supplier', supplier)
            .first()

        if (checkExist) {
            await query.rollback();
            return res.status(400).json({ message: `Data tersebut sudah ada` });
        }

        const payload = {
            domain: parseInt(domain ?? 0),
            on_duty_type,
            on_duty_item_code,
            on_duty_item_name,
            gl_id,
            subacc_id,
            supplier,
            created_by: parseInt(empid),
            created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        }

        await query("dbPortalFA.dbo.mstr_map_gl_onduty").insert(payload);

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

// Update Master mapping GL perjalanan dinas
export const PUMPJUM_MasterMapGlPerjalananDinasUpdate = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            id,
            domain,
            on_duty_item_code,
            on_duty_item_name,
            gl_id,
            subacc_id,
            supplier,
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

        const checkExist = await query('dbPortalFA.dbo.mstr_map_gl_onduty')
            .where('domain', domain)
            .where('on_duty_item_code', on_duty_item_code)
            .where('on_duty_item_name', on_duty_item_name)
            .where('gl_id', gl_id)
            .where('subacc_id', subacc_id)
            .where('supplier', supplier)
            .first();

        if (checkExist && checkExist.id !== Number(id)) {
            await query.rollback();
            return res.status(400).json({ message: `Data tersebut sudah ada` });
        }

        const empid = user.user_nik;
        const payload = {
            gl_id,
            subacc_id,
            supplier,
            updated_by: parseInt(empid),
            updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss")
        }

        await query("dbPortalFA.dbo.mstr_map_gl_onduty")
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

// Delete  Master mapping GL perjalanan dinas
export const PUMPJUM_MasterMapGlPerjalananDinasDelete = async (req, res) => {
    try {
        const { domain, id } = req.query;

        if (!domain || !id) {
            return res.status(400).json({ 
                message: 'Domain and Mapping GL perjalanan dinas Id are required' 
            });
        }

        // Delete all matching records
        await db("dbPortalFA.dbo.mstr_map_gl_onduty")
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
