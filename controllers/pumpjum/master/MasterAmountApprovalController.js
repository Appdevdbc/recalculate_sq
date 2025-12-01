import { validationResult } from "express-validator";
import { db, dbDbcHris } from "../../../config/db.js";
import * as dotenv from "dotenv";
import dayjs from "dayjs";

dotenv.config();

const parsedResponse = (response) => {
    const result = response.map((row) => ({
        ...row,
        department_id: JSON.parse(row.department_id || '[]'),
        um_type_id: JSON.parse(row.um_type_id || '[]'),
    }));
    return result;
};

// Get List of Master Amount Approval data
export const PUMPJUM_MasterAmountApprovalList = async (req, res) => {
    const { rowsPerPage, page } = req.query;

    const domain = req.query.domain || req.body.domain || req.params.domain;
    const sortBy = req.query.sortBy || 'id';
    const sort = req.query.descending === "true" ? "desc" : "asc";

    if (!domain) {
        return res.status(400).json({ error: "Missing domain parameter" });
    }

    try {
        let response;

        // Get matching departments first if filter exists
        let deptIds = [];
        if (req.query.filter) {
            const search = `%${req.query.filter}%`;
            const matchingDepts = await dbDbcHris('dbHRIS_newer.dbo.master_department')
                .select('dept_idreal')
                .where('dept_name', 'like', search);
            deptIds = matchingDepts.map(d => d.dept_idreal);
        }

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db('dbPortalFA.dbo.mstr_amt_app as app')
                .select(
                    'app.id',
                    'app.domain',
                    'app.grade',
                    'app.amt_min',
                    'app.amt_max',
                    'app.department_id',
                    'app.um_type_id',
                    "dom.domain_shortname"
                )
                .where('app.domain', domain)
                .leftJoin("dbPortalFA.dbo.domain as dom", "app.domain", "=", "dom.domain_code")
                .modify((query) => {
                    if (req.query.filter) {
                        const search = `%${req.query.filter}%`;
                        query.where(function () {
                            this.orWhere('app.domain', 'like', search)
                                .orWhere("app.grade", "like", search)
                                .orWhere("dom.domain_shortname", "like", search);
                                
                            if (deptIds.length > 0) {
                                this.orWhere(function() {
                                    for (const deptId of deptIds) {
                                        this.orWhere('app.department_id', 'like', `%"${deptId}"%`);
                                    }
                                });
                            }
                        });
                    }
                    if (sortBy !== 'um_name') {
                        query.orderBy(sortBy, sort);
                    }
                });
            response.data = await parsedResponse(response.data)
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db('dbPortalFA.dbo.mstr_amt_app as app')
                .select(
                    'app.id',
                    'app.domain',
                    'app.grade',
                    'app.amt_min',
                    'app.amt_max',
                    'app.department_id',
                    'app.um_type_id',
                    "dom.domain_shortname"
                )
                .where('app.domain', domain)
                .leftJoin("dbPortalFA.dbo.domain as dom", "app.domain", "=", "dom.domain_code")
                .modify((query) => {
                    if (req.query.filter) {
                        const search = `%${req.query.filter}%`;
                        query.where(function () {
                            this.orWhere('app.domain', 'like', search)
                                .orWhere("app.grade", "like", search)
                                .orWhere("dom.domain_shortname", "like", search);
                                
                            if (deptIds.length > 0) {
                                this.orWhere(function() {
                                    for (const deptId of deptIds) {
                                        this.orWhere('app.department_id', 'like', `%"${deptId}"%`);
                                    }
                                });
                            }
                        });
                    }
                    if (sortBy !== 'um_name') {
                        query.orderBy(sortBy, sort);
                    }
                })
                .paginate({
                    perPage: Math.abs(Math.floor(parseInt(rowsPerPage, 10))),
                    currentPage: pages,
                    isLengthAware: true,
                });
            response.data = await parsedResponse(response.data)
        }

        // add return department_name
        const departments = await dbDbcHris('dbHRIS_newer.dbo.master_department').select('dept_idreal', 'dept_name');
        const depUnique = departments.filter((v, i, a) => a.findIndex(t => t.dept_idreal === v.dept_idreal) === i);
        response.data = response.data.map(app => {
            let deptMatched = [];

            if (app.department_id.length > 0) {
                deptMatched = depUnique.filter(dept => app.department_id.includes(dept.dept_idreal)).map(d => d.dept_name);
            }
            return {
                ...app,
                department_name: deptMatched,
            };
        });

        // Mapping UM name
        const umTypes = await db('dbPortalFA.dbo.mstr_um_type').select('um_code', 'um_name');
        const umUnique = umTypes.filter((v, i, a) => a.findIndex(t => t.um_code === v.um_code) === i);
        response.data = response.data.map(app => {
            let umMatched = [];

            if (app.um_type_id.length > 0) {
                umMatched = umUnique
                    .filter(um => app.um_type_id.includes(um.um_code))
                    .map(d => d.um_name);
            }

            return {
                ...app,
                um_name: umMatched.join(', '),
            };
        });

        // Manual sort if sortBy === 'um_name'
        if (sortBy === 'um_name') {
            response.data.sort((a, b) => {
                const nameA = a.um_name || '';
                const nameB = b.um_name || '';
                return sort === 'asc'
                    ? nameA.localeCompare(nameB)
                    : nameB.localeCompare(nameA);
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

export const PUMPJUM_MasterAmountApprovalDetail = async (req, res) => {
  try {
    const id = req.query.id;

    let query =  await db("dbPortalFA.dbo.mstr_amt_app")
      .select("id", "domain", "grade", "amt_min", "amt_max", "department_id", "um_type_id",)
      .where("id", id)
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

// Create Master Amount Approval
export const PUMPJUM_MasterAmountApprovalSave = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            domain,
            grade,
            department_id,
            amt_min,
            amt_max,
            um_type_id,
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
        const ammountApproval = await query('dbPortalFA.dbo.mstr_amt_app')
            .select('id', 'domain', 'grade', 'amt_min', 'amt_max', 'department_id', 'um_type_id')
            .where('domain', domain)
            .where('grade', grade)
            .where(function () {
                for (const dept of department_id) {
                    this.orWhere('department_id', 'like', `%\"${dept}\"%`);
                }
            })
            .where(function () {
                for (const type of um_type_id) {
                    this.orWhere('um_type_id', 'like', `%${type}%`);
                }
            })
            .first();

        if (ammountApproval) {
            await query.rollback();
            return res.status(400).json({ message: `Data tersebut sudah ada` });
        }

        const payload = {
            domain: parseInt(domain ?? 0),
            grade: grade,
            department_id: JSON.stringify(department_id),
            amt_min: parseInt(amt_min ?? 0),
            amt_max: parseInt(amt_max ?? 0),
            created_by: parseInt(empid),
            created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            um_type_id: JSON.stringify(um_type_id),
        }

        await query("dbPortalFA.dbo.mstr_amt_app").insert(payload);

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

// Update Master Amount Approval
export const PUMPJUM_MasterAmountApprovalUpdate = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            amount_approval_id,
            domain,
            grade,
            department_id,
            amt_min,
            amt_max,
            um_type_id,
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
        const ammountApproval = await query('dbPortalFA.dbo.mstr_amt_app')
            .select('id', 'domain', 'grade', 'amt_min', 'amt_max', 'department_id', 'um_type_id')
            .where('domain', domain)
            .where('grade', grade)
            .where(function () {
                for (const dept of department_id) {
                    this.orWhere('department_id', 'like', `%\"${dept}\"%`);
                }
            })
            .where(function () {
                for (const type of um_type_id) {
                    this.orWhere('um_type_id', 'like', `%${type}%`);
                }
            })
            .first();

        if (ammountApproval && ammountApproval.id !== amount_approval_id) {
            await query.rollback();
            return res.status(400).json({ message: `Data tersebut sudah ada` });
        }

        const payload = {
            domain: parseInt(domain ?? 0),
            grade,
            department_id: JSON.stringify(department_id),
            amt_min: parseInt(amt_min ?? 0),
            amt_max: parseInt(amt_max ?? 0),
            updated_by: parseInt(empid),
            updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            um_type_id: JSON.stringify(um_type_id),
        }

        await query("dbPortalFA.dbo.mstr_amt_app")
        .where('id', amount_approval_id)
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

// Delete  Master Amount Approval
export const PUMPJUM_MasterAmountApprovalDelete = async (req, res) => {
    try {
        const { domain, amount_approval_id } = req.query;

        if (!domain || !amount_approval_id) {
            return res.status(400).json({ 
                message: 'Domain and Amount Approval Id are required' 
            });
        }

        // Delete all matching records
        await db("dbPortalFA.dbo.mstr_amt_app")
        .where({ domain, id: amount_approval_id })
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