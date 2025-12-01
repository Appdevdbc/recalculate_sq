import { db } from "../../../config/db.js";
import * as dotenv from "dotenv";
import dayjs from "dayjs";

dotenv.config();

// Get List of Master Numbering PUM data
export const PUMPJUM_MasterNumberingPumList = async (req, res) => {
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
            response = await db('dbPortalFA.dbo.mstr_num_pum as num')
            .select(
                'num.id',
                'num.domain',
                'num.start_year',
                'num.start_numbering',
                "num.current_number",
                'num.prefix',
                "dom.domain_shortname",
                db.raw("CONCAT(num.prefix, num.start_numbering ) as prefixNumber"),
            )
            .where('num.domain', domain)
            .leftJoin("dbPortalFA.dbo.domain as dom", "num.domain", "=", "dom.domain_code")
            .modify((query) => {
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere('num.domain', 'like', search)
                        this.orWhere('num.start_year', 'like', search)
                        this.orWhere('num.start_numbering', 'like', search)
                        this.orWhere('num.prefix', 'like', search)
                    });
                }
            })
            .orderBy(sortBy, sort);
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db('dbPortalFA.dbo.mstr_num_pum as num')
            .select(
                'num.id',
                'num.domain',
                'num.start_year',
                'num.start_numbering',
                "num.current_number",
                "num.prefix",
                "dom.domain_shortname",
                db.raw("CONCAT(num.prefix, num.start_numbering ) as prefixNumber"),
            )
            .where('num.domain', domain)
            .leftJoin("dbPortalFA.dbo.domain as dom", "num.domain", "=", "dom.domain_code")
            .modify((query) => {
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere('num.domain', 'like', search)
                        this.orWhere('num.start_year', 'like', search)
                        this.orWhere('num.start_numbering', 'like', search)
                        this.orWhere('num.prefix', 'like', search)
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

export const PUMPJUM_MasterNumberingPumDetail = async (req, res) => {
  try {
    const id = req.query.id;

    let query =  await db("dbPortalFA.dbo.mstr_num_pum")
      .select("id", "domain", "start_year", "start_numbering", "current_number", "prefix")
      .where("id", id)
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

// Create Master Numbering PUM
export const PUMPJUM_MasterNumberingPumSave = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            domain,
            start_year,
            start_numbering,
            prefix,
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

        const checkExist = await query('dbPortalFA.dbo.mstr_num_pum')
            .where('domain', domain)
            .where('start_year', start_year)
            .first()

        if (checkExist) {
            await query.rollback();
            return res.status(400).json({ message: `Data tersebut sudah ada` });
        }

        const checkExist2 = await query('dbPortalFA.dbo.mstr_num_pum')
            .where('domain', domain)
            .where('start_year', start_year)
            .where('start_numbering', start_numbering)
            .modify((query) => {
                if (prefix) {
                    query.where('prefix', prefix)
                }
            })
            .first()

        if (checkExist2) {
            await query.rollback();
            return res.status(400).json({ message: `Data tersebut sudah ada` });
        }

        const payload = {
            domain: parseInt(domain ?? 0),
            start_year,
            start_numbering,
            prefix,
            created_by: parseInt(empid),
            created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        }

        if (prefix) {
            payload.prefix = prefix;
        }

        await query("dbPortalFA.dbo.mstr_num_pum").insert(payload);

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

// Update Master Numbering PUM
export const PUMPJUM_MasterNumberingPumUpdate = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            id,
            domain,
            start_year,
            start_numbering,
            prefix,
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

        const checkExist = await query('dbPortalFA.dbo.mstr_num_pum')
            .where('domain', domain)
            .where('start_year', start_year)
            .first();

        if (checkExist && checkExist.id !== Number(id)) {
            await query.rollback();
            return res.status(400).json({ message: `Data tersebut sudah ada` });
        }

        const checkExist2 = await query('dbPortalFA.dbo.mstr_num_pum')
            .where('domain', domain)
            .where('start_year', start_year)
            .where('start_numbering', start_numbering)
            .modify((query) => {
                if (prefix) {
                    query.where('prefix', prefix)
                }
            })
            .first();

        if (checkExist2 && checkExist.id !== Number(id)) {
            await query.rollback();
            return res.status(400).json({ message: `Data tersebut sudah ada` });
        }

        const empid = user.user_nik;
        const payload = {
            start_year,
            start_numbering,
            prefix,
            updated_by: parseInt(empid),
            updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss")
        }

        await query("dbPortalFA.dbo.mstr_num_pum")
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

// Delete  Master Numbering PUM
export const PUMPJUM_MasterNumberingPumDelete = async (req, res) => {
    try {
        const { domain, id } = req.query;

        if (!domain || !id) {
            return res.status(400).json({ 
                message: 'Domain and Numbering PUM Id are required' 
            });
        }

        // Delete all matching records
        await db("dbPortalFA.dbo.mstr_num_pum")
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