import { db, dbDbcHris, dbHris, linked_dbDbcHris } from '../../../config/db.js';
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import dayjs from 'dayjs';
import { formatRupiah2, encryptString, useEncrypt, getWSA } from '../../../helpers/utils.js';
import { sendMailNew } from "../../../helpers/mail.js";
import ejs from "ejs";
import { unlink } from 'node:fs';
import fs from 'fs';
import pdfTemplate from '../../../helpers/pdfTemplate.js';
import handlebars from "handlebars";
import { inbound_supp_inv_non_perjalanan_dinas, inbound_pettycash_non_perjalanan_dinas } from "../../../helpers/inbound.js";
import { uploadFileWithParams, downloadFileWithParams } from "../../../helpers/ftp.js";
import { generatePumNumber, generatePumNumberWithLastMasterNumber } from '../generalController.js';

dotenv.config();

// Get List of Non Perjalanan dinas
export const PUMPJUM_NonPerjalananDinasList = async (req, res) => {
    const { rowsPerPage, page } = req.query;

    const domain = req.query.domain || req.body.domain || req.params.domain;
    const sortBy = req.query.sortBy || 'created_date';
    const sort = req.query.descending === "true" ? "desc" : "asc";

    if (!domain) {
        return res.status(400).json({ error: 'Missing domain parameter' });
    }

    const picFCList = await db("dbPortalFA.dbo.mstr_pic_app as app")
        .select("app.employee_id")
        .where("app.type_approval_id", "FC");

    const picFCNikList = picFCList.map(p => p.employee_id);

    const picFC = await db("dbPortalFA.dbo.mstr_pic_app as app")
        .select("app.employee_id", "app.site")
        .where("app.employee_id", req.query.empNik)
        .andWhere("app.type_approval_id", "FC")
        .first();
    
    let siteList = [];
    if (picFC && picFC.site) {
        try {
            siteList = JSON.parse(picFC.site);
        } catch (e) {
            siteList = [];
        }
    }

    const isPICFC = !!picFC;

    try {
        let response;
        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
                .select(
                    "ndt.id",
                    "ndt.domain",
                    "ndt.pum_number",
                    "ndt.perihal",
                    "ndt.payment_method_id",
                    "ndt.feedback_notes",
                    "ndt.status_data",
                    "ndt.created_by",
                    "ndt.created_date",
                    "ndt.updated_by",
                    "ndt.approval_fa_tax_nik",
                    "ndt.due_date_inv",
                    db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                    db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                    db.raw("COALESCE(usr.user_name, NULL) as created_name"),
                )
                .leftJoin("dbPortalFA.dbo.users as usr", "ndt.created_by", "=", "usr.user_nik")
                .leftJoin("dbPortalFA.dbo.domain as dom", "ndt.domain", "=", "dom.domain_code")
                .modify((query) => {
                    if (!isPICFC) {
                        query.where("ndt.created_by", req.query.empNik);
                    } else {
                        query.whereIn("ndt.site", siteList);
                    }
                    if (req.query.filter_domain) {
                        query.where(function () {
                            this.where("ndt.domain", req.query.filter_domain);
                        });
                    }
                    if (req.query.filter_status) {
                        query.where(function () {
                            this.where("ndt.status_data", req.query.filter_status);
                        });
                    }
                    if (req.query.filter) {
                        const search = `%${req.query.filter}%`;
                        query.where(function () {
                            this.orWhere("dom.domain_shortname", "like", search)
                                .orWhere("ndt.perihal", "like", search)
                                .orWhere("ndt.feedback_notes", "like", search)
                                .orWhere("ndt.status_data", "like", search)
                                .orWhere("ndt.pum_number", "like", search);
                        });
                    }
                })
                .orderBy(sortBy, sort);
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
                .select(
                    "ndt.id",
                    "ndt.domain",
                    "ndt.pum_number",
                    "ndt.perihal",
                    "ndt.payment_method_id",
                    "ndt.feedback_notes",
                    "ndt.status_data",
                    "ndt.created_by",
                    "ndt.created_date",
                    "ndt.updated_by",
                    "ndt.approval_fa_tax_nik",
                    "ndt.due_date_inv",
                    db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                    db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                    db.raw("COALESCE(usr.user_name, NULL) as created_name"),
                )
                .leftJoin("dbPortalFA.dbo.users as usr", "ndt.created_by", "=", "usr.user_nik")
                .leftJoin("dbPortalFA.dbo.domain as dom", "ndt.domain", "=", "dom.domain_code")
                .modify((query) => {
                    if (!isPICFC) {
                        query.where("ndt.created_by", req.query.empNik);
                    } else {
                        query.whereIn("ndt.site", siteList);
                    }
                    if (req.query.filter_domain) {
                        query.where(function () {
                            this.where("ndt.domain", req.query.filter_domain);
                        });
                    }
                    if (req.query.filter_status) {
                        query.where(function () {
                            this.where("ndt.status_data", req.query.filter_status);
                        });
                    }
                    if (req.query.filter) {
                        const search = `%${req.query.filter}%`;
                        query.where(function () {
                            this.orWhere("dom.domain_shortname", "like", search)
                                .orWhere("ndt.perihal", "like", search)
                                .orWhere("ndt.feedback_notes", "like", search)
                                .orWhere("ndt.status_data", "like", search)
                                .orWhere("ndt.pum_number", "like", search);
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

        response.data = response.data.map((row) => {
            let isEdit = false;
            const isFullyApprovedSuperior = row.status_data === "Fully Approved Superior";
            const isUpdatedByFC = picFCNikList.includes(row.updated_by);

            if (["Draft", "Require Revision"].includes(row.status_data) && row.created_by === req.query.empNik) {
                isEdit = true;
            } else if (isFullyApprovedSuperior && isPICFC) {
                if (!isUpdatedByFC) {
                    isEdit = true;
                } else if (isUpdatedByFC && row.created_by === req.query.empNik) {
                    isEdit = true;
                }
            }

            return { ...row, isEdit };
        });

        return res.status(200).json({
            message: 'Success',
            data: response,
        });
    } catch (error) {
        console.log(error)
        return res.status(406).json(
            /* { message: error.message } */
            {
                type: 'error',
                message:
                    process.env.DEBUG == 1
                        ? error.message
                        : `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
            }
        );
    }
};

export const PUMPJUM_NonPerjalananDinasDetail = async (req, res) => {
    try {
        const id = req.query.id;

        const header = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select("ndt.employee_nik")
            .where("ndt.id", id)
            .first();
        const isOS = /\D/.test(header?.employee_nik);
        const empTable = isOS
            ? `[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[T_EMP_Master_Outsource] as emp`
            : `[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`;
        const empNameColumn = isOS
            ? db.raw("COALESCE(emp.EmployeeName, NULL) as employee_name")
            : db.raw("COALESCE(emp.employee_name, NULL) as employee_name");
        const empPositionColumn = isOS
            ? db.raw("COALESCE(emp.PositionName, NULL) as employee_nm_pos")
            : db.raw("COALESCE(emp.employee_nm_pos, NULL) as employee_nm_pos");

        let query = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select(
                "ndt.id",
                "ndt.pum_number",
                "ndt.domain",
                "ndt.site",
                "ndt.employee_nik",
                "ndt.department_name",
                "ndt.supplier",
                "ndt.perihal",
                "ndt.payment_method_id",
                "ndt.is_taxable",
                "ndt.um_type_id",
                "ndt.due_date_inv",
                "ndt.gl",
                "ndt.subacc",
                "ndt.prodline",
                "ndt.file_attachment",
                "ndt.feedback_notes",
                "ndt.reason_approver",
                "ndt.status_data",
                "ndt.approval_grade_min",
                "ndt.approval_grade_max",
                "ndt.approval_nik",
                "ndt.approval_fa_tax_min",
                "ndt.approval_fa_tax_max",
                "ndt.approval_fa_tax_nik",
                "ndt.description",
                "ndt.daybook",
                "ndt.inv_status",
                "ndt.allocation_status",
                "ndt.own_bank_number",
                "qgl.gl_desc",
                "sub.subacc_desc",
                "pmn.method_name",
                "sit.site_desc",
                "umt.um_name",
                "prd.pl_desc",
                "usr.user_jabatan",
                db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                db.raw("COALESCE(dom.domain_longname, NULL) as domain_longname"),
                empNameColumn,
                empPositionColumn,
                db.raw("COALESCE(sup.vd_sort, NULL) as supplier_desc"),
                db.raw("FORMAT(ndt.created_date, 'dd MMMM yyyy') as requested_at"),
                db.raw("CONVERT(varchar, ndt.created_date, 120) as created_date_print")
            )
            .leftJoin("dbPortalFA.dbo.users as usr", "ndt.employee_nik", "=", "usr.user_nik")
            .leftJoin("dbPortalFA.dbo.domain as dom", "usr.user_domain", "=", "dom.domain_code")
            .leftJoin(db.raw(empTable), "ndt.employee_nik", "=", `${isOS ? 'emp.EmployeeNIK' : 'emp.employee_id'}`)
            .leftJoin("dbPortalFA.dbo.qad_gl as qgl", "ndt.gl", "=", "qgl.gl_code")
            .leftJoin("dbPortalFA.dbo.qad_subacc as sub", "ndt.subacc", "=", "sub.subacc_code")
            .leftJoin("dbPortalFA.dbo.mstr_payment_method as pmn", "ndt.payment_method_id", "=", "pmn.method_code")
            .leftJoin("dbMaster.dbo.qad_supplier as sup", "ndt.supplier", "=", "sup.vd_addr")
            .leftJoin("dbPortalFA.dbo.site_mstr as sit", "ndt.site", "=", "sit.site_code")
            .leftJoin("dbPortalFA.dbo.mstr_um_type as umt", "ndt.um_type_id", "=", "umt.um_code")
            .leftJoin("dbMaster.dbo.qad_prod_line as prd", "ndt.prodline", "=", "prd.pl_prod_line")
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

export const PUMPJUM_NonPerjalananDinasItemList = async (req, res) => {
    try {
        const { pum_number } = req.query;

        let query = await db("dbPortalFA.dbo.trx_nonduty_detail as ndt")
            .select(
                "ndt.id",
                "ndt.pum_number",
                "ndt.date",
                "ndt.no_data",
                "ndt.no_po",
                "ndt.description",
                "ndt.currency",
                "ndt.amount",
                "ndt.jenis_pajak",
                "ndt.tarif",
                "ndt.tax_based",
                "ndt.tax_amount",
                "ndt.tax_amount_system",
                "ndt.tc_amount",
            )
            .where("ndt.pum_number", pum_number);

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

export const PUMPJUM_NonPerjalananDinasApprovalList = async (req, res) => {
    const { rowsPerPage, page, empNik } = req.query;

    const domain = req.query.domain || req.body.domain || req.params.domain;
    const sortBy = req.query.sortBy || 'created_date';
    const sort = req.query.descending === "true" ? "desc" : "asc";

    if (!domain) {
        return res.status(400).json({ error: 'Missing domain parameter' });
    }

    try {
        const historyApproval = await db("dbPortalFA.dbo.trx_nonduty_approval as a")
            .select('a.pum_number')
            .where('a.created_by', empNik)
            .whereIn("status_data", ["Partially Approved Superior", "Fully Approved Superior", "Approved FA", "Approved Tax"]);
        const historyPumNumbers = historyApproval.map(item => item.pum_number);

        let response;
        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select(
                "ndt.id",
                "ndt.domain",
                "ndt.pum_number",
                "ndt.perihal",
                "ndt.payment_method_id",
                "ndt.status_data",
                "ndt.created_by",
                "ndt.created_date",
                "pay.method_name",
                "ndt.department_name",
                db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                db.raw("COALESCE(usr.user_name, NULL) as created_name"),
                db.raw("FORMAT(ndt.created_date, 'dd MMMM yyyy') as requested_at"),
            )
            .leftJoin("dbPortalFA.dbo.users as usr", "ndt.created_by", "=", "usr.user_nik")
            .leftJoin("dbPortalFA.dbo.domain as dom", "ndt.domain", "=", "dom.domain_code")
            .leftJoin("dbPortalFA.dbo.mstr_payment_method as pay", "ndt.payment_method_id", "=", "pay.method_code")
            .whereNotNull('pum_number')
            .where('pum_number','<>','')
            .modify((query) => {
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere("dom.domain_shortname", "like", search)
                        .orWhere("ndt.pum_number", "like", search)
                        .orWhere("ndt.perihal", "like", search)
                        .orWhere("ndt.status_data", "like", search)
                        .orWhere("pay.method_name", "like", search)
                        .orWhere("usr.user_name", "like", search)
                        .orWhere("ndt.department_name", "like", search)
                    });
                }
            })
            .orderBy(sortBy, sort);
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select(
                "ndt.id",
                "ndt.domain",
                "ndt.pum_number",
                "ndt.perihal",
                "ndt.payment_method_id",
                "ndt.status_data",
                "ndt.created_by",
                "ndt.created_date",
                "pay.method_name",
                "ndt.department_name",
                "ndt.approval_nik",
                "ndt.approval_fa_tax_nik",
                db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                db.raw("COALESCE(usr.user_name, NULL) as created_name"),
                db.raw("FORMAT(ndt.created_date, 'dd MMMM yyyy') as requested_at"),
            )
            .leftJoin("dbPortalFA.dbo.users as usr", "ndt.created_by", "=", "usr.user_nik")
            .leftJoin("dbPortalFA.dbo.domain as dom", "ndt.domain", "=", "dom.domain_code")
            .leftJoin("dbPortalFA.dbo.mstr_payment_method as pay", "ndt.payment_method_id", "=", "pay.method_code")
            .whereNotNull('pum_number')
            .where('pum_number','<>','')
            .modify((query) => {
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere("dom.domain_shortname", "like", search)
                        .orWhere("ndt.pum_number", "like", search)
                        .orWhere("ndt.perihal", "like", search)
                        .orWhere("ndt.status_data", "like", search)
                        .orWhere("pay.method_name", "like", search)
                        .orWhere("usr.user_name", "like", search)
                        .orWhere("ndt.department_name", "like", search)
                    });
                }
                if (req.query.filter_domain) {
                    query.where(function () {
                        this.where("ndt.domain", req.query.filter_domain);
                    });
                }
                if (req.query.filter_dept) {
                    query.where(function () {
                        this.where("ndt.department_id", req.query.filter_dept);
                    });
                }
                if (req.query.filter_emp) {
                    query.where(function () {
                        this.where("ndt.created_by", req.query.filter_emp);
                    });
                }
                if (req.query.filter_status) {
                    query.where(function () {
                        this.where("ndt.status_data", req.query.filter_status);
                    });
                }
                query.andWhere(function () {
                    this.where(function () {
                        if (historyPumNumbers.length > 0) {
                            this.orWhereIn('ndt.pum_number', historyPumNumbers);
                        }
                        this.orWhere(function () {
                            this.whereIn('ndt.status_data', ['Pending Approval', 'Partially Approved Superior'])
                                .where('ndt.approval_nik', empNik);
                        });
                        this.orWhere(function () {
                            this.whereIn('ndt.status_data', ['Pending Approval Tax', 'Approved Tax'])
                                .where('ndt.approval_fa_tax_nik', empNik);
                        });
                        this.orWhere(function () {
                            this.whereIn('ndt.status_data', ['Fully Approved Superior'])
                                .where('ndt.approval_fa_tax_nik', empNik)
                                .where('ndt.is_taxable', 0);
                        });
                    });
                });
            })
            .orderBy(sortBy, sort)
            .paginate({
                perPage: Math.abs(Math.floor(parseInt(rowsPerPage, 10))),
                currentPage: pages,
                isLengthAware: true,
            });
        }

        return res.status(200).json({
            message: 'Success',
            data: response,
        });
    } catch (error) {
        console.log(error)
        return res.status(406).json(
            /* { message: error.message } */
            {
                type: 'error',
                message:
                    process.env.DEBUG == 1
                    ? error.message
                    : `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
            }
        );
    }
};

export const PUMPJUM_NonPerjalananDinasFinanceCheckerSubmit = async (req, res) => {
    const query = await db.transaction();
    try {
        const { pum_number } = req.body;

        const user = await dbDbcHris("AppDB_DBC_HRIS.dbo.T_DBC_Employee")
            .where("EmployeeId", req.body.empid)
            .first();
        // const user = await dbDbcHris("dbHRIS_newer.dbo.master_employee")
        //     .select('employee_id')
        //     .where('employee_pk', req.body.empid)
        //     .first();

        if (!user) {
            await query.rollback();
            return res.status(400).json({ message: 'Invalid user, silahkan hubungi Tim IT' });
        }

        const header = await query("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select("ndt.employee_nik")
            .where("ndt.pum_number", pum_number)
            .first();
        const isOS = /\D/.test(header?.employee_nik);
        const empTable = isOS
            ? `[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[T_EMP_Master_Outsource] as emp`
            : `[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`;
        const empNameColumn = isOS
            ? db.raw("COALESCE(emp.EmployeeName, NULL) as employee_name")
            : db.raw("COALESCE(emp.employee_name, NULL) as employee_name");


        const trxNonduty = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select(
                "ndt.id",
                "ndt.pum_number",
                "ndt.domain",
                "ndt.site",
                "ndt.employee_nik",
                "ndt.department_name",
                "ndt.supplier",
                "ndt.perihal",
                "ndt.payment_method_id",
                "ndt.is_taxable",
                "ndt.um_type_id",
                "ndt.due_date_inv",
                "ndt.gl",
                "ndt.subacc",
                "ndt.prodline",
                "ndt.file_attachment",
                "ndt.feedback_notes",
                "ndt.reason_approver",
                "ndt.status_data",
                "ndt.approval_grade_min",
                "ndt.approval_grade_max",
                "ndt.approval_nik",
                "ndt.approval_fa_tax_min",
                "ndt.approval_fa_tax_max",
                "ndt.approval_fa_tax_nik",
                db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                empNameColumn,
            )
            .leftJoin("dbPortalFA.dbo.users as usr", "ndt.employee_nik", "=", "usr.user_nik")
            .leftJoin("dbPortalFA.dbo.domain as dom", "usr.user_domain", "=", "dom.domain_code")
            .leftJoin(db.raw(empTable), "ndt.employee_nik", "=", `${isOS ? 'emp.EmployeeNIK' : 'emp.employee_id'}`)
            .where("pum_number", pum_number)
            .first();
        if (!trxNonduty) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal amelakukan penyimpanan data, silahkan hubungi Tim IT' });
        }
        if (!['Fully Approved Superior'].includes(trxNonduty.status_data)) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal amelakukan penyimpanan data, silahkan hubungi Tim IT' });
        }

        const trxNondutyDetail = await db("dbPortalFA.dbo.trx_nonduty_detail as dtl")
            .select(
                "dtl.*",
            )
            .where("dtl.pum_number", trxNonduty.pum_number);
        if (trxNondutyDetail.length === 0) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal amelakukan penyimpanan data, silahkan hubungi Tim IT' });
        }

        const payloadUpdate = {
            supplier: req.body.supplier_id,
            payment_method_id: req.body.payment_method_id,
            is_taxable: (req.body.is_taxable === '1') ? true : false,
            um_type_id: req.body.um_type_id,
            due_date_inv:  dayjs(req.body.due_date_inv, 'DD/MM/YYYY').format('YYYY-MM-DD HH:mm:ss'),
            perihal: req.body.perihal,
            gl: req.body.gl || null,
            subacc: req.body.subacc || null,
            prodline: req.body.prodline || null,
            description: req.body.description,
            updated_by: user.EmployeeNIK,
            // updated_by: user.employee_id,
            updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        }

        await query("dbPortalFA.dbo.trx_nonduty_header")
            .where("pum_number", req.body.pum_number)
            .update(payloadUpdate);

        // store history approval
        const payloadHistory = {
            domain: parseInt(trxNonduty.domain || 0),
            pum_number: trxNonduty.pum_number,
            status_data: 'Approved Finance Checker',
            created_by: user.EmployeeNIK,
            // created_by: user.employee_id,
            created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        }
        await query("dbPortalFA.dbo.trx_nonduty_approval").insert(payloadHistory);

        if (req.body.is_taxable === '1') {
            // jika data ada pajaknya maka kirim notif ke user tax officer untuk create tax
            const userTaxOficcer = await db('dbPortalFA.dbo.mstr_pic_app as app')
                    .select(
                        "app.*",
                        "dom.domain_shortname",
                        "emp.employee_name",
                        "emp.employee_jabatan",
                        "emp.employee_email",
                        "emp.employee_pk",
                        db.raw("COALESCE(tap.name, NULL) as type_approval_name"),
                    )
                    .where('app.domain', trxNonduty.domain)
                    .whereRaw("app.site LIKE ?", [`%${trxNonduty.site}%`])
                    .where('app.type_pum', 'Non Duty')
                    .where('app.type_approval_id', 'Tax-Officer')
                    .leftJoin("dbPortalFA.dbo.domain as dom", "app.domain", "=", "dom.domain_code")
                    .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), "app.employee_id", "=", "emp.employee_id")
                    .leftJoin("dbPortalFA.dbo.mstr_type_approval as tap", "app.type_approval_id", "=", "tap.code");

            if (userTaxOficcer.length === 0) {
                await query.rollback();
                return res.status(400).json({
                    message: `mohon infokan pada PIC PUM PJUM, untuk set approval 'Tax Officer' pada menu Master 'PIC Approval FA & Tax'`
                });
            }

            // send mail
            const promises = userTaxOficcer.map(async (v) => {            
                const resPortal = await dbHris("ptl_policy").where("id", 0).first();
                let token = jwt.sign({ user: v.employee_pk }, process.env.TOKEN, {
                    expiresIn: resPortal.idle_time,
                });
                const mailUser = process.env.EMAILDUMMY != '' ? process.env.EMAILDUMMY : v.employee_email;
                const totalAmountItem = trxNondutyDetail.reduce((acc, item) => acc + (item.amount || 0), 0);
                const dataMail = {
                    from: 'Pengajuan Uang Muka System',
                    to: mailUser,
                    subject: 'Pengajuan Uang Muka System - Non Perjalanan Dinas',
                    employee_name_approver: v.employee_name,
                    employee_name: trxNonduty.employee_name,
                    department_name: trxNonduty.department_name,
                    pum_number: trxNonduty.pum_number,
                    um_value: formatRupiah2(totalAmountItem),
                    status_data: trxNonduty.status_data,
                    link: `${process.env.LINK_FRONTEND}/#/pum-pjum/proses-non-perjalanan-dinas-tax-edit/${useEncrypt(String(trxNonduty.id))}`,
                };

                let html = await ejs.renderFile("view/pumpjum/mailtoTaxOfficer.ejs", {
                    data: dataMail,
                });

                dataMail.html = html;
                await sendMailNew(dataMail);
            }); await Promise.all(promises);
            // end send mail
        } else {
            // jika data tidak ada pajaknya maka kirim notif ke user Approval FA untuk proses approval
            const userFaApprover = await db('dbPortalFA.dbo.mstr_pic_app as app')
                    .select(
                        'app.*',
                        "dom.domain_shortname",
                        "emp.employee_name",
                        "emp.employee_jabatan",
                        "emp.employee_email",
                        "emp.employee_pk",
                        db.raw("COALESCE(tap.name, NULL) as type_approval_name"),
                    )
                    .where('app.domain', trxNonduty.domain)
                    .whereRaw("app.site LIKE ?", [`%${trxNonduty.site}%`])
                    .where('app.type_pum', 'Non Duty')
                    .where('app.type_approval_id', 'FA-Approver')
                    .leftJoin("dbPortalFA.dbo.domain as dom", "app.domain", "=", "dom.domain_code")
                    .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), "app.employee_id", "=", "emp.employee_id")
                    .leftJoin("dbPortalFA.dbo.mstr_type_approval as tap", "app.type_approval_id", "=", "tap.code");

            if (userFaApprover.length === 0) {
                await query.rollback();
                return res.status(400).json({
                    message: `mohon infokan pada PIC PUM PJUM, untuk set approval 'finance Approver' pada menu Master 'PIC Approval FA & Tax'`
                });
            }

            const userFaApproverMinLevel = userFaApprover.reduce((a, b) => (a.level < b.level ? a : b));
            const userFaApproverMaxLevel = userFaApprover.reduce((a, b) => (a.level > b.level ? a : b));

            await query("dbPortalFA.dbo.trx_nonduty_header")
                .where("pum_number", pum_number)
                .update({
                approval_fa_tax_max: userFaApproverMaxLevel.level,
                approval_fa_tax_min: userFaApproverMinLevel.level,
                approval_fa_tax_nik: userFaApproverMinLevel.employee_id,
            });

            // send mail
            const resPortal = await dbHris("ptl_policy").where("id", 0).first();
            let token = jwt.sign({ user: userFaApproverMinLevel.employee_pk }, process.env.TOKEN, {
                expiresIn: resPortal.idle_time,
            });
            const mailUser = process.env.EMAILDUMMY != '' ? process.env.EMAILDUMMY : userFaApproverMinLevel.employee_email;
            const totalAmountItem = trxNondutyDetail.reduce((acc, item) => acc + (item.amount || 0), 0);
            const dataMail = {
                from: 'Pengajuan Uang Muka System',
                to: mailUser,
                subject: 'Pengajuan Uang Muka System - Non Perjalanan Dinas',
                employee_name_approver: userFaApproverMinLevel.employee_name,
                employee_name: trxNonduty.employee_name,
                department_name: trxNonduty.department_name,
                pum_number: trxNonduty.pum_number,
                um_value: formatRupiah2(totalAmountItem),
                status_data: trxNonduty.status_data,
                link: process.env.LINK_FRONTEND + "#/approval-pum-pjum/" + (
                    await encryptString(
                        trxNonduty.id, // id header 
                        userFaApproverMinLevel.employee_pk, // id user approval
                        userFaApproverMinLevel.employee_id, // nik user approval
                        token,
                    )) + "",
            };

            let html = await ejs.renderFile("view/pumpjum/mailtoFAApprover.ejs", {
                data: dataMail,
            });

            dataMail.html = html;
            await sendMailNew(dataMail);
            // end send mail
        }

        await query.commit();

        return res.status(200).json({ message: 'Data non perjalanan dinas berhasil disimpan' });
    } catch (error) {
        console.log(error)
        await query.rollback();
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1 ? error.message : 'Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT',
        });
    }
}

export const PUMPJUM_NonPerjalananDinasTaxOfficerSubmit = async (req, res) => {
    const query = await db.transaction();
    try {
        const { id } = req.body;

        const user = await dbDbcHris("AppDB_DBC_HRIS.dbo.T_DBC_Employee")
            .where("EmployeeId", req.body.empid)
            .first();
        // const user = await dbDbcHris("dbHRIS_newer.dbo.master_employee")
        //     .select('employee_id')
        //     .where('employee_pk', req.body.empid)
        //     .first();

        if (!user) {
            await query.rollback();
            return res.status(400).json({ message: 'Invalid user, silahkan hubungi Tim IT' });
        }

        const trxNonduty = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select(
                "ndt.id",
                "ndt.pum_number",
                "ndt.domain",
                "ndt.site",
                "ndt.employee_nik",
                "ndt.department_name",
                "ndt.supplier",
                "ndt.perihal",
                "ndt.payment_method_id",
                "ndt.is_taxable",
                "ndt.um_type_id",
                "ndt.due_date_inv",
                "ndt.gl",
                "ndt.subacc",
                "ndt.prodline",
                "ndt.file_attachment",
                "ndt.feedback_notes",
                "ndt.reason_approver",
                "ndt.status_data",
                "ndt.approval_grade_min",
                "ndt.approval_grade_max",
                "ndt.approval_nik",
                "ndt.approval_fa_tax_min",
                "ndt.approval_fa_tax_max",
                "ndt.approval_fa_tax_nik",
                db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                db.raw("COALESCE(emp.employee_name, NULL) as employee_name")
            )
            .leftJoin("dbPortalFA.dbo.users as usr", "ndt.employee_nik", "=", "usr.user_nik")
            .leftJoin("dbPortalFA.dbo.domain as dom", "usr.user_domain", "=", "dom.domain_code")
            .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), "ndt.employee_nik", "=", "emp.employee_id")
            .where("id", id)
            .first();
        if (!trxNonduty) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal amelakukan penyimpanan data, silahkan hubungi Tim IT' });
        }
        if (!['Fully Approved Superior', 'Draft Tax', 'Revision Tax'].includes(trxNonduty.status_data)) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal amelakukan penyimpanan data, silahkan hubungi Tim IT' });
        }

        const trxNondutyDetail = await db("dbPortalFA.dbo.trx_nonduty_detail as dtl")
            .select(
                "dtl.*",
            )
            .where("dtl.pum_number", trxNonduty.pum_number);
        if (trxNondutyDetail.length === 0) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal amelakukan penyimpanan data, silahkan hubungi Tim IT' });
        }

        const userTaxAndFaApprover = await db('dbPortalFA.dbo.mstr_pic_app as app')
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
                    "emp.employee_email",
                    "emp.employee_pk",
                    db.raw("COALESCE(tap.name, NULL) as type_approval_name"),
                )
                .where('app.domain', trxNonduty.domain)
                .whereRaw("app.site LIKE ?", [`%${trxNonduty.site}%`])
                .where('app.type_pum', 'Non Duty')
                .whereIn("app.type_approval_id", ["Tax-Approver", "FA-Approver"])
                .leftJoin("dbPortalFA.dbo.domain as dom", "app.domain", "=", "dom.domain_code")
                .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), "app.employee_id", "=", "emp.employee_id")
                .leftJoin("dbPortalFA.dbo.mstr_type_approval as tap", "app.type_approval_id", "=", "tap.code");

        const hasTaxApprover = userTaxAndFaApprover.some(v => v.type_approval_id === 'Tax-Approver');
        const hasFaApprover = userTaxAndFaApprover.some(v => v.type_approval_id === 'FA-Approver');

        if (!hasTaxApprover) {
            await query.rollback();
            return res.status(400).json({
                message: `mohon infokan pada PIC PUM PJUM, untuk set approval 'Tax Approver' pada menu Master 'PIC Approval FA & Tax'`
            });
        }

        if (!hasFaApprover) {
            await query.rollback();
            return res.status(400).json({
                message: `mohon infokan pada PIC PUM PJUM, untuk set approval 'finance Approver' pada menu Master 'PIC Approval FA & Tax'`
            });
        }

        const userTaxAndFaApproverMinLevel = userTaxAndFaApprover.reduce((a, b) => (a.level < b.level ? a : b));
        const userTaxAndFaApproverMaxLevel = userTaxAndFaApprover.reduce((a, b) => (a.level > b.level ? a : b));

        await query("dbPortalFA.dbo.trx_nonduty_header")
            .where("id", req.body.id)
            .update({
            approval_fa_tax_max: userTaxAndFaApproverMaxLevel.level,
            approval_fa_tax_min: userTaxAndFaApproverMinLevel.level,
            approval_fa_tax_nik: userTaxAndFaApproverMinLevel.employee_id,
            status_data: 'Pending Approval Tax',
        });

        // store history approval
        const payloadHistory = {
            domain: parseInt(trxNonduty.domain || 0),
            pum_number: trxNonduty.pum_number,
            status_data: 'Pending Approval Tax',
            created_by: user.EmployeeNIK,
            // created_by: user.employee_id,
            created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        }
        await query("dbPortalFA.dbo.trx_nonduty_approval").insert(payloadHistory);

        // send mail
        const resPortal = await dbHris("ptl_policy").where("id", 0).first();
        let token = jwt.sign({ user: userTaxAndFaApproverMinLevel.employee_pk }, process.env.TOKEN, {
            expiresIn: resPortal.idle_time,
        });
        const mailUser = process.env.EMAILDUMMY != '' ? process.env.EMAILDUMMY : userTaxAndFaApproverMinLevel.employee_email;
        const totalAmountItem = trxNondutyDetail.reduce((acc, item) => acc + (item.amount || 0), 0);
        const dataMail = {
            from: 'Pengajuan Uang Muka System',
            to: mailUser,
            subject: 'Pengajuan Uang Muka System - Non Perjalanan Dinas',
            employee_name_approver: userTaxAndFaApproverMinLevel.employee_name,
            employee_name: trxNonduty.employee_name,
            department_name: trxNonduty.department_name,
            pum_number: trxNonduty.pum_number,
            um_value: formatRupiah2(totalAmountItem),
            status_data: trxNonduty.status_data,
            link: process.env.LINK_FRONTEND + "#/approval-pum-pjum/" + (
                await encryptString(
                    trxNonduty.id, // id header 
                    userTaxAndFaApproverMinLevel.employee_pk, // id user approval
                    userTaxAndFaApproverMinLevel.employee_id, // nik user approval
                    token,
                )) + "",
        };

        let html = await ejs.renderFile("view/pumpjum/mailtoFAApprover.ejs", {
            data: dataMail,
        });

        dataMail.html = html;
        await sendMailNew(dataMail);
        // end send mail

        await query.commit();

        return res.status(200).json({ message: 'Data non perjalanan dinas berhasil disimpan' });
    } catch (error) {
        console.log(error)
        await query.rollback();
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1 ? error.message : 'Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT',
        });
    }
}

export const PUMPJUM_NonPerjalananDinasApproval = async (req, res) => {
    const query = await db.transaction();
    try {
        const { id } = req.body;

        // Validate user, and get user_nik
        const user = await dbDbcHris("AppDB_DBC_HRIS.dbo.T_DBC_Employee")
            .where("EmployeeId", req.body.empid)
            .first();
        // const user = await dbDbcHris("dbHRIS_newer.dbo.master_employee")
        //     .where('employee_pk', req.body.empid)
        //     .first();

        if (!user) {
            await query.rollback();
            return res.status(400).json({ message: 'Invalid user, silahkan hubungi Tim IT' });
        }

        const empid = user.EmployeeNIK;
        // const empid = user.employee_id;

        const header = await query("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select("ndt.employee_nik")
            .where("ndt.id",id)
            .first();
        const isOS = /\D/.test(header?.employee_nik);
        const empTable = isOS
            ? `[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[T_EMP_Master_Outsource] as emp`
            : `[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`;
        const empNameColumn = isOS
            ? db.raw("COALESCE(emp.EmployeeName, NULL) as employee_name")
            : db.raw("COALESCE(emp.employee_name, NULL) as employee_name");

        const trxNonduty = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select(
                "ndt.id",
                "ndt.pum_number",
                "ndt.domain",
                "ndt.site",
                "ndt.employee_nik",
                "ndt.department_name",
                "ndt.supplier",
                "ndt.perihal",
                "ndt.payment_method_id",
                "ndt.is_taxable",
                "ndt.um_type_id",
                "ndt.due_date_inv",
                "ndt.gl",
                "ndt.subacc",
                "ndt.prodline",
                "ndt.file_attachment",
                "ndt.feedback_notes",
                "ndt.reason_approver",
                "ndt.status_data",
                "ndt.approval_grade_min",
                "ndt.approval_grade_max",
                "ndt.approval_nik",
                "ndt.approval_fa_tax_min",
                "ndt.approval_fa_tax_max",
                "ndt.approval_fa_tax_nik",
                db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                empNameColumn,
            )
            .leftJoin("dbPortalFA.dbo.users as usr", "ndt.employee_nik", "=", "usr.user_nik")
            .leftJoin("dbPortalFA.dbo.domain as dom", "usr.user_domain", "=", "dom.domain_code")
            .leftJoin(db.raw(empTable), "ndt.employee_nik", "=", `${isOS ? 'emp.EmployeeNIK' : 'emp.employee_id'}`)
            .where("id", id)
            .first();
        if (!trxNonduty) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal amelakukan approval, silahkan hubungi Tim IT' });
        }

        const trxNondutyDetail = await db("dbPortalFA.dbo.trx_nonduty_detail as dtl")
            .select(
                "dtl.*",
            )
            .where("dtl.pum_number", trxNonduty.pum_number);
        if (trxNondutyDetail.length === 0) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal amelakukan approval, silahkan hubungi Tim IT' });
        }

        const isNeedApprovalAtasan = ['Pending Approval', 'Partially Approved Superior'].includes(trxNonduty.status_data);
        const isNonTaxNeedApprovalFA = ['Fully Approved Superior'].includes(trxNonduty.status_data) && !trxNonduty.is_taxable;
        const isTaxNeedApprovalTaxOrFA = ['Pending Approval Tax', 'Approved Tax'].includes(trxNonduty.status_data);
        if (isNeedApprovalAtasan) {
            // approval atasan
            let currentApprovalGradeMin = trxNonduty.approval_grade_min;
            let status = trxNonduty.status_data;
            let nextNikApprover = null;
            let checkNextApprover = null;

            const employeeCurrentApprover = await dbDbcHris("AppDB_DBC_HRIS.dbo.T_DBC_Employee")
                .where("EmployeeNIK", trxNonduty.approval_nik)
                .first();
            // const employeeCurrentApprover = await dbDbcHris("dbHRIS_newer.dbo.master_employee")
            //     .where("employee_id", trxNonduty.approval_nik)
            //     .first();

            if (!employeeCurrentApprover) {
                await query.rollback();
                return res.status(400).json({ message: 'Gagal melakukan approval, silahkan hubungi Tim IT' });
            }

            const isWithinRange = trxNonduty.approval_grade_min <= trxNonduty.approval_grade_max;
            const isCurrentApprover = trxNonduty.approval_nik === user.EmployeeNIK;
            // const isCurrentApprover = trxNonduty.approval_nik === user.employee_id;
            if (!isWithinRange || !isCurrentApprover) {
                await query.rollback();
                return res.status(400).json({ message: 'Gagal melakukan approval, silahkan hubungi Tim IT' });
            }

            status = trxNonduty.status_data === 'Pending Approval' ? 'Partially Approved Superior' : trxNonduty.status_data;

            if (trxNonduty.approval_grade_min === trxNonduty.approval_grade_max) {
                status = 'Fully Approved Superior';
            } else {
                // currentApprovalGradeMin += 1;
                // const findApprover = async (nik) => {
                //     console.log(nik)
                //     if (!nik) return null;
                //     const emp = await dbDbcHris("AppDB_DBC_HRIS.dbo.T_DBC_Employee")
                //         .where("EmployeeNIK", nik)
                //         .where("ActiveStatus", "Active")
                //         .first();
                //     if (!emp) return null;

                //     const grade = emp.GradeCode.replace(/^0+(?!$)/, '');

                //     const result = {
                //         EmployeeId: emp.EmployeeId,
                //         EmployeeNIK: emp.EmployeeNIK,
                //         OfficialEmail: emp.OfficialEmail,
                //         EmployeeName: emp.EmployeeName,
                //     }
                //     if (Number(grade) === currentApprovalGradeMin) {
                //         return result;
                //     } else if (Number(grade) > currentApprovalGradeMin && currentApprovalGradeMin <= trxNonduty.approval_grade_max) {
                //         currentApprovalGradeMin = Number(grade);
                //         return result;
                //     }

                //     return null;
                // };

                // checkNextApprover = await findApprover(employeeCurrentApprover.FirstSuperiorNIK) || await findApprover(employeeCurrentApprover.SecondSuperiorNIK);
                // if (checkNextApprover) {
                //     nextNikApprover = checkNextApprover.EmployeeNIK;
                // }

                // if (!nextNikApprover) {
                //     status = 'Fully Approved Superior';
                // }
                // currentApprovalGradeMin += 1;

                const findApprover = async (nik) => {
                    if (!nik) return null;

                    const emp = await dbDbcHris("AppDB_DBC_HRIS.dbo.T_DBC_Employee")
                        .where("EmployeeNIK", nik)
                        .where("ActiveStatus", "Active")
                        .first();
                    // const emp = await dbDbcHris("dbHRIS_newer.dbo.master_employee")
                    //     .where("employee_id", nik)
                    //     .where("employee_stat", "ACTIVE")
                    //     .first();
                    if (!emp) return null;

                    const grade = Number(emp.GradeCode.replace(/^0+(?!$)/, ''));
                    // const grade = Number(emp.employee_grade);

                    const result = {
                        EmployeeId: emp.EmployeeId,
                        EmployeeNIK: emp.EmployeeNIK,
                        OfficialEmail: emp.OfficialEmail,
                        EmployeeName: emp.EmployeeName,
                        // EmployeeId: emp.employee_pk,
                        // EmployeeNIK: emp.employee_id,
                        // OfficialEmail: emp.employee_email,
                        // EmployeeName: emp.employee_name,
                        GradeCode: grade,
                    };

                    return result;
                };

                for (let grade = currentApprovalGradeMin; grade < trxNonduty.approval_grade_max; grade++) {
                    checkNextApprover = await findApprover(employeeCurrentApprover.FirstSuperiorNIK) || await findApprover(employeeCurrentApprover.SecondSuperiorNIK);
                    // checkNextApprover = await findApprover(employeeCurrentApprover.employee_spv) || await findApprover(employeeCurrentApprover.employee_mgr);
                    if (!checkNextApprover) {
                        // Tidak ditemukan approver di grade ini, lanjut loop
                        continue;
                    }

                    if (checkNextApprover.GradeCode > trxNonduty.approval_grade_max) {
                        status = 'Fully Approved Superior';
                        break;
                    } else {
                        nextNikApprover = checkNextApprover.EmployeeNIK;
                        currentApprovalGradeMin = checkNextApprover.GradeCode;
                        break;
                    }
                }

                if (!checkNextApprover && !nextNikApprover) {
                    status = 'Fully Approved Superior';
                }
            }


            const payload = {
                status_data: status,
                approval_grade_min: currentApprovalGradeMin
            }

            if (status === 'Fully Approved Superior') {
                const userFinanceChecker = await db('dbPortalFA.dbo.mstr_pic_app as app')
                    .select(
                        "app.*",
                        "dom.domain_shortname",
                        "emp.employee_name",
                        "emp.employee_jabatan",
                        "emp.employee_email",
                        "emp.employee_pk",
                        db.raw("COALESCE(tap.name, NULL) as type_approval_name"),
                    )
                    .where('app.domain', trxNonduty.domain)
                    .whereRaw("app.site LIKE ?", [`%${trxNonduty.site}%`])
                    .where('app.type_pum', 'Non Duty')
                    .where('app.type_approval_id', 'FC')
                    .leftJoin("dbPortalFA.dbo.domain as dom", "app.domain", "=", "dom.domain_code")
                    .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), "app.employee_id", "=", "emp.employee_id")
                    .leftJoin("dbPortalFA.dbo.mstr_type_approval as tap", "app.type_approval_id", "=", "tap.code");
                if (userFinanceChecker.length === 0) {
                    await query.rollback();
                    return res.status(400).json({
                        message: `mohon infokan pada PIC PUM PJUM, untuk set approval 'finance checker' pada menu Master 'PIC Approval FA & Tax'`
                    });
                }

                const promises = userFinanceChecker.map(async (v) => {            
                    const resPortal = await dbHris("ptl_policy").where("id", 0).first();
                    let token = jwt.sign({ user: v.employee_pk }, process.env.TOKEN, {
                        expiresIn: resPortal.idle_time,
                    });
                    // send mail
                    const mailUser = process.env.EMAILDUMMY != '' ? process.env.EMAILDUMMY : v.employee_email;
                    const totalAmountItem = trxNondutyDetail.reduce((acc, item) => acc + (item.amount || 0), 0);
                    const dataMail = {
                        from: 'Pengajuan Uang Muka System',
                        to: mailUser,
                        subject: 'Pengajuan Uang Muka System - Non Perjalanan Dinas',
                        employee_name_approver: v.employee_name,
                        employee_name: trxNonduty.employee_name,
                        department_name: trxNonduty.department_name,
                        pum_number: trxNonduty.pum_number,
                        um_value: formatRupiah2(totalAmountItem),
                        status_data: status,
                        link: `${process.env.LINK_FRONTEND}/#/pum-pjum/edit-non-perjalanan-dinas/${useEncrypt(String(trxNonduty.id))}`,
                    };

                    let html = await ejs.renderFile("view/pumpjum/mailNonPerjalananDinasFinanceChecker.ejs", {
                        data: dataMail,
                    });

                    dataMail.html = html;
                    await sendMailNew(dataMail);
                    // end send mail
                }); await Promise.all(promises);  
            }

            if (nextNikApprover) {
                payload.approval_nik = nextNikApprover;


                const resPortal = await dbHris("ptl_policy").where("id", 0).first();
                let token = jwt.sign({ user: checkNextApprover.EmployeeId }, process.env.TOKEN, {
                    expiresIn: resPortal.idle_time,
                });
                // send mail
                const mailUser = process.env.EMAILDUMMY != '' ? process.env.EMAILDUMMY : checkNextApprover.OfficialEmail;
                const totalAmountItem = trxNondutyDetail.reduce((acc, item) => acc + (item.amount || 0), 0);
                const dataMail = {
                    from: 'Pengajuan Uang Muka System',
                    to: mailUser,
                    subject: 'Pengajuan Uang Muka System - Non Perjalanan Dinas',
                    employee_name_approver: checkNextApprover.EmployeeName,
                    employee_name: trxNonduty.employee_name,
                    department_name: trxNonduty.department_name,
                    pum_number: trxNonduty.pum_number,
                    um_value: formatRupiah2(totalAmountItem),
                    status_data: trxNonduty.status_data,
                    link: process.env.LINK_FRONTEND + "#/approval-pum-pjum/" + (
                        await encryptString(
                            trxNonduty.id, // id header 
                            checkNextApprover.EmployeeId, // id user approval
                            checkNextApprover.EmployeeNIK, // nik user approval
                            token,
                        )) + "",
                };

                let html = await ejs.renderFile("view/pumpjum/mailSuperiorApproval.ejs", {
                    data: dataMail,
                });

                dataMail.html = html;
                await sendMailNew(dataMail);
                // end send mail

            }

            await query("dbPortalFA.dbo.trx_nonduty_header")
                .where("id", id)
                .update(payload);


            // store history approval
            const payloadHistory = {
                domain: parseInt(trxNonduty.domain || 0),
                pum_number: trxNonduty.pum_number,
                status_data: status,
                created_by: empid,
                created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            }
            await query("dbPortalFA.dbo.trx_nonduty_approval").insert(payloadHistory);

            await query.commit();
            return res.status(200).json({ message: 'Proses approval berhasil' });
        } else if (isNonTaxNeedApprovalFA || isTaxNeedApprovalTaxOrFA) {
            // approval Tax atau approval finance FA
            let currentApprovalGradeMin = trxNonduty.approval_fa_tax_min;
            let status = trxNonduty.status_data;
            let status_history = null;
            let nextNikApprover = null;
            let checkNextApprover = null;

            const employeeCurrentApprover = await dbDbcHris("AppDB_DBC_HRIS.dbo.T_DBC_Employee")
                .where("EmployeeNIK", trxNonduty.approval_fa_tax_nik)
                .first();
            // const employeeCurrentApprover = await dbDbcHris("dbHRIS_newer.dbo.master_employee")
            //     .where("employee_id", trxNonduty.approval_fa_tax_nik)
            //     .first();

            if (!employeeCurrentApprover) {
                await query.rollback();
                return res.status(400).json({ message: 'Gagal melakukan approval, silahkan hubungi Tim IT' });
            }

            const isWithinRange = trxNonduty.approval_fa_tax_min <= trxNonduty.approval_fa_tax_max;
            const isCurrentApprover = trxNonduty.approval_fa_tax_nik === user.EmployeeNIK;
            // const isCurrentApprover = trxNonduty.approval_fa_tax_nik === user.employee_id;
            if (!isWithinRange || !isCurrentApprover) {
                await query.rollback();
                return res.status(400).json({ message: 'Gagal melakukan approval, silahkan hubungi Tim IT' });
            }

            if (trxNonduty.status_data === 'Pending Approval Tax') {
                // jika proses approval tax
                const userTaxAndFaApprover = await db('dbPortalFA.dbo.mstr_pic_app as app')
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
                        "emp.employee_email",
                        "emp.employee_pk",
                        db.raw("COALESCE(tap.name, NULL) as type_approval_name"),
                    )
                    .where('app.domain', trxNonduty.domain)
                    .whereRaw("app.site LIKE ?", [`%${trxNonduty.site}%`])
                    .where('app.type_pum', 'Non Duty')
                    .whereIn("app.type_approval_id", ["Tax-Approver", "FA-Approver"])
                    .leftJoin("dbPortalFA.dbo.domain as dom", "app.domain", "=", "dom.domain_code")
                    .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), "app.employee_id", "=", "emp.employee_id")
                    .leftJoin("dbPortalFA.dbo.mstr_type_approval as tap", "app.type_approval_id", "=", "tap.code");

                const hasTaxApprover = userTaxAndFaApprover.some(v => v.type_approval_id === 'Tax-Approver');
                const hasFaApprover = userTaxAndFaApprover.some(v => v.type_approval_id === 'FA-Approver');

                if (!hasTaxApprover) {
                    await query.rollback();
                    return res.status(400).json({
                        message: `mohon infokan pada PIC PUM PJUM, untuk set approval 'Tax Approver' pada menu Master 'PIC Approval FA & Tax'`
                    });
                }

                if (!hasFaApprover) {
                    await query.rollback();
                    return res.status(400).json({
                        message: `mohon infokan pada PIC PUM PJUM, untuk set approval 'finance Approver' pada menu Master 'PIC Approval FA & Tax'`
                    });
                }

                const userTaxApproverMaxLevel = userTaxAndFaApprover.filter(item => item.type_approval_id === 'Tax-Approver').reduce((a, b) => (a.level > b.level ? a : b));
                const nextTypeApproval = trxNonduty.approval_fa_tax_min === userTaxApproverMaxLevel.level ? 'FA-Approver' : 'Tax-Approver';
                const nextApprover = userTaxAndFaApprover.find(item => item.type_approval_id === nextTypeApproval && item.level > trxNonduty.approval_fa_tax_min) || null;
                if (nextApprover) {
                    const isSameUser = nextApprover.employee_id === userTaxApproverMaxLevel.employee_id;
                    if (nextTypeApproval === 'FA-Approver' && isSameUser) {
                        // Cek jika tidak ada FA Approver lain dengan level di atas user
                        const faApprovers = userTaxAndFaApprover.filter(item => item.type_approval_id === 'FA-Approver');
                        const hasOtherFaAbove = faApprovers.some(fa => fa.level > nextApprover.level && fa.employee_id !== nextApprover.employee_id);

                        if (!hasOtherFaAbove) {
                            // Auto approve FA juga
                            status = 'Approved FA';
                            status_history = 'Approved FA'; //flag untuk history approval
                            // store history
                            await query("dbPortalFA.dbo.trx_nonduty_approval").insert({
                                domain: parseInt(trxNonduty.domain || 0),
                                pum_number: trxNonduty.pum_number,
                                status_data: 'Approved Tax',
                                created_by: empid,
                                created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                            });
                        } else {
                            // Masih ada FA Approver lain maka lanjut normal
                            status = 'Approved Tax';
                            currentApprovalGradeMin = nextApprover.level;
                            nextNikApprover = nextApprover.employee_id;
                            checkNextApprover = {
                                EmployeeId: nextApprover.employee_pk,
                                EmployeeNIK: nextApprover.employee_id,
                                OfficialEmail: nextApprover.employee_email,
                                EmployeeName: nextApprover.employee_name,
                            };
                        }
                    } else {
                        // Normal case
                        status = nextTypeApproval === 'FA-Approver' ? 'Approved Tax' : status;
                        currentApprovalGradeMin = nextApprover.level;
                        nextNikApprover = nextApprover.employee_id;
                        checkNextApprover = {
                            EmployeeId: nextApprover.employee_pk,
                            EmployeeNIK: nextApprover.employee_id,
                            OfficialEmail: nextApprover.employee_email,
                            EmployeeName: nextApprover.employee_name,
                        };
                    }
                }

                if (!nextNikApprover && status !== 'Approved FA') {
                    status = 'Approved Tax';
                }
            } else {
                // jika proses approval FA
                if (trxNonduty.approval_fa_tax_min === trxNonduty.approval_fa_tax_max) {
                    status = 'Approved FA';
                } else {
                    const userFaApprover = await db('dbPortalFA.dbo.mstr_pic_app as app')
                        .select(
                            "app.*",
                            "dom.domain_shortname",
                            "emp.employee_name",
                            "emp.employee_jabatan",
                            "emp.employee_email",
                            "emp.employee_pk",
                            db.raw("COALESCE(tap.name, NULL) as type_approval_name"),
                        )
                        .where('app.domain', trxNonduty.domain)
                        .whereRaw("app.site LIKE ?", [`%${trxNonduty.site}%`])
                        .where('app.type_pum', 'Non Duty')
                        .where('app.type_approval_id', 'FA-Approver')
                        .leftJoin("dbPortalFA.dbo.domain as dom", "app.domain", "=", "dom.domain_code")
                        .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), "app.employee_id", "=", "emp.employee_id")
                        .leftJoin("dbPortalFA.dbo.mstr_type_approval as tap", "app.type_approval_id", "=", "tap.code")
                        .orderBy('app.level', 'asc');
    
                    if (userFaApprover.length === 0) {
                        await query.rollback();
                        return res.status(400).json({
                            message: `mohon infokan pada PIC PUM PJUM, untuk set approval 'finance Approver' pada menu Master 'PIC Approval FA & Tax'`
                        });
                    }
    
                    const nextApprover = userFaApprover.find(item => item.level > trxNonduty.approval_fa_tax_min);
                    
                    if (nextApprover) {
                        currentApprovalGradeMin = nextApprover.level;
                        nextNikApprover = nextApprover.employee_id;
                        checkNextApprover = {
                            EmployeeId: nextApprover.employee_pk,
                            EmployeeNIK: nextApprover.employee_id,
                            OfficialEmail: nextApprover.employee_email,
                            EmployeeName: nextApprover.employee_name,
                        },
                        status_history = 'Approved FA'; //flag untuk history approval
                    }
    
                    if (!nextNikApprover) {
                        status = 'Approved FA';
                    }
                }
            }

            const payload = {
                status_data: status,
                approval_fa_tax_min: currentApprovalGradeMin
            }
            if (status === 'Approved FA') {
                const userFinanceAP = await db('dbPortalFA.dbo.mstr_pic_app as app')
                    .select(
                        "app.*",
                        "dom.domain_shortname",
                        "emp.employee_name",
                        "emp.employee_jabatan",
                        "emp.employee_email",
                        "emp.employee_pk",
                        db.raw("COALESCE(tap.name, NULL) as type_approval_name"),
                    )
                    .where('app.domain', trxNonduty.domain)
                    .whereRaw("app.site LIKE ?", [`%${trxNonduty.site}%`])
                    .where('app.type_pum', 'Non Duty')
                    .where('app.type_approval_id', 'AP')
                    .leftJoin("dbPortalFA.dbo.domain as dom", "app.domain", "=", "dom.domain_code")
                    .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), "app.employee_id", "=", "emp.employee_id")
                    .leftJoin("dbPortalFA.dbo.mstr_type_approval as tap", "app.type_approval_id", "=", "tap.code");
                if (userFinanceAP.length === 0) {
                    await query.rollback();
                    return res.status(400).json({
                        message: `mohon infokan pada PIC PUM PJUM, untuk set approval 'finance AP' type Non Duty pada menu Master 'PIC Approval FA & Tax'`
                    });
                }

                const promises = userFinanceAP.map(async (v) => {            
                    const resPortal = await dbHris("ptl_policy").where("id", 0).first();
                    let token = jwt.sign({ user: v.employee_pk }, process.env.TOKEN, {
                        expiresIn: resPortal.idle_time,
                    });
                    // send mail
                    const mailUser = process.env.EMAILDUMMY != '' ? process.env.EMAILDUMMY : v.employee_email;
                    const totalAmountItem = trxNondutyDetail.reduce((acc, item) => acc + (item.amount || 0), 0);
                    const dataMail = {
                        from: 'Pengajuan Uang Muka System',
                        to: mailUser,
                        subject: 'Pengajuan Uang Muka System - Non Perjalanan Dinas',
                        employee_name_approver: v.employee_name,
                        employee_name: trxNonduty.employee_name,
                        department_name: trxNonduty.department_name,
                        pum_number: trxNonduty.pum_number,
                        um_value: formatRupiah2(totalAmountItem),
                        status_data: status,
                        link: `${process.env.LINK_FRONTEND}/#/pum-pjum/proses-non-perjalanan-dinas-ap-edit/${useEncrypt(String(trxNonduty.id))}`,
                    };

                    let html = await ejs.renderFile("view/pumpjum/mailNonPerjalananDinasFinanceAP.ejs", {
                        data: dataMail,
                    });

                    dataMail.html = html;
                    await sendMailNew(dataMail);
                    // end send mail
                }); await Promise.all(promises);  
            }

            const mailTemplate = status === 'Pending Approval Tax' ? 'mailtoTaxApprover' : 'mailtoFAApprover';
            if (nextNikApprover) {
                payload.approval_fa_tax_nik = nextNikApprover;

                const resPortal = await dbHris("ptl_policy").where("id", 0).first();
                let token = jwt.sign({ user: checkNextApprover.EmployeeId }, process.env.TOKEN, {
                    expiresIn: resPortal.idle_time,
                });
                // send mail
                const mailUser = process.env.EMAILDUMMY != '' ? process.env.EMAILDUMMY : checkNextApprover.OfficialEmail;
                const totalAmountItem = trxNondutyDetail.reduce((acc, item) => acc + (item.amount || 0), 0);
                const dataMail = {
                    from: 'Pengajuan Uang Muka System',
                    to: mailUser,
                    subject: 'Pengajuan Uang Muka System - Non Perjalanan Dinas',
                    employee_name_approver: checkNextApprover.EmployeeName,
                    employee_name: trxNonduty.employee_name,
                    department_name: trxNonduty.department_name,
                    pum_number: trxNonduty.pum_number,
                    um_value: formatRupiah2(totalAmountItem),
                    status_data: status,
                    link: process.env.LINK_FRONTEND + "#/approval-pum-pjum/" + (
                        await encryptString(
                            trxNonduty.id, // id header 
                            checkNextApprover.EmployeeId, // id user approval
                            checkNextApprover.EmployeeNIK, // nik user approval
                            token,
                        )) + "",
                };

                let html = await ejs.renderFile(`view/pumpjum/${mailTemplate}.ejs`, {
                    data: dataMail,
                });

                dataMail.html = html;
                await sendMailNew(dataMail);
                // end send mail

            }

            await query("dbPortalFA.dbo.trx_nonduty_header")
                .where("id", id)
                .update(payload);


            // store history approval
            const payloadHistory = {
                domain: parseInt(trxNonduty.domain || 0),
                pum_number: trxNonduty.pum_number,
                status_data: status_history || status,
                created_by: empid,
                created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            }
            await query("dbPortalFA.dbo.trx_nonduty_approval").insert(payloadHistory);

            await query.commit();
            return res.status(200).json({ message: 'Proses approval berhasil' });
        } else {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal amelakukan approval, silahkan hubungi Tim IT' });
        }
    } catch (error) {
        console.log(error)
        await query.rollback();
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1 ? error.message : 'Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT',
        });
    }
};

// Revision
export const PUMPJUM_NonPerjalananDinasRevision = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            id,
            reason,
        } = req.body;

        // Validate user, and get user_nik
        const user = await dbDbcHris("AppDB_DBC_HRIS.dbo.T_DBC_Employee")
            .where("EmployeeId", req.body.empid)
            .first();
        // const user = await dbDbcHris("dbHRIS_newer.dbo.master_employee")
        //     .where('employee_pk', req.body.empid)
        //     .first();

        if (!user) {
            await query.rollback();
            return res.status(400).json({ message: 'Invalid user, silahkan hubungi Tim IT' });
        }

        const empid = user.EmployeeNIK;
        // const empid = user.employee_id;

        const header = await query("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select("ndt.employee_nik")
            .where("ndt.id",id)
            .first();
        const isOS = /\D/.test(header?.employee_nik);
        const empTable = isOS
            ? `[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[T_EMP_Master_Outsource] as emp`
            : `[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`;
        const empNameColumn = isOS
            ? db.raw("COALESCE(emp.EmployeeName, NULL) as employee_name")
            : db.raw("COALESCE(emp.employee_name, NULL) as employee_name");

        const trxNonduty = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select(
                "ndt.id",
                "ndt.pum_number",
                "ndt.domain",
                "ndt.site",
                "ndt.employee_nik",
                "ndt.department_name",
                "ndt.supplier",
                "ndt.perihal",
                "ndt.payment_method_id",
                "ndt.is_taxable",
                "ndt.um_type_id",
                "ndt.due_date_inv",
                "ndt.gl",
                "ndt.subacc",
                "ndt.prodline",
                "ndt.file_attachment",
                "ndt.feedback_notes",
                "ndt.reason_approver",
                "ndt.status_data",
                "ndt.approval_grade_min",
                "ndt.approval_grade_max",
                "ndt.approval_nik",
                "ndt.approval_fa_tax_min",
                "ndt.approval_fa_tax_max",
                "ndt.approval_fa_tax_nik",
                db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                empNameColumn,
            )
            .leftJoin("dbPortalFA.dbo.users as usr", "ndt.employee_nik", "=", "usr.user_nik")
            .leftJoin("dbPortalFA.dbo.domain as dom", "usr.user_domain", "=", "dom.domain_code")
            .leftJoin(db.raw(empTable), "ndt.employee_nik", "=", `${isOS ? 'emp.EmployeeNIK' : 'emp.employee_id'}`)
            .where("id", id)
            .first();

        if (!trxNonduty) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal melakukan request revisi, silahkan hubungi Tim IT' });
        }

        await query("dbPortalFA.dbo.trx_nonduty_header")
            .where("id", id)
            .update({
                status_data: 'Require Revision',
                feedback_notes: reason,
                updated_by: empid,
                updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                // approval_grade_max: null,
                // approval_grade_min: null,
                // approval_nik: null,
                approval_fa_tax_max: null,
                approval_fa_tax_min: null,
                approval_fa_tax_nik: null,
            });

        // store history approval
        const payloadHistory = {
            domain: parseInt(trxNonduty.domain || 0),
            pum_number: trxNonduty.pum_number,
            status_data: 'Require Revision',
            feedback_notes: reason,
            created_by: empid,
            created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        }
        await query("dbPortalFA.dbo.trx_nonduty_approval").insert(payloadHistory);

        
        const items = await db("dbPortalFA.dbo.trx_nonduty_detail as ndt")
            .select('ndt.*', db.raw("FORMAT(ndt.date, 'dd MMMM yyyy') as tanggal"), db.raw("FORMAT(ndt.date, 'dd/MM/yyyy') as tanggal_raw"))
            .where('ndt.pum_number', trxNonduty.pum_number)
        const totalAmountItem = items.reduce((acc, item) => acc + Number(item.amount || 0), 0);
    
        // send email
        let mailUser = [];
        let mailCc = [];

        let userRequestor = null;
        if (process.env.EMAILDUMMY != '') {
            mailUser = [process.env.EMAILDUMMY];
        } else {
            userRequestor = await db("dbPortalFA.dbo.users")
                .select('user_nik', 'user_site','user_name', 'user_id', 'user_email')
                .where('user_nik', trxNonduty.employee_nik)
                .first();

            if(!userRequestor) {
                await query.rollback();
                return res.status(400).json({ message: 'User requestor data tidak ditemukan, silahkan cek atau tambahkan di master user' });
            }
            const userTo = userRequestor.user_email;
            mailUser = [userTo];
        }

        const promises = mailUser.map(async (user) => {            
            const dataMail = {
                from: 'Pengajuan Uang Muka System',
                to: user,
                cc: mailCc,
                subject: 'Pengajuan Uang Muka System - Non Perjalanan Dinas',
                to_employee_name: trxNonduty.employee_name,
                employee_name: trxNonduty.employee_name,
                department_name: trxNonduty.department_name,
                pum_number: trxNonduty.pum_number,
                um_value: formatRupiah2(totalAmountItem),
                status_data: trxNonduty.status_data,
                feedback_notes: reason,
                link: `${process.env.LINK_FRONTEND}/#/pum-pjum/edit-non-perjalanan-dinas/${useEncrypt(String(trxNonduty.id))}`,
            };

            let html = await ejs.renderFile("view/pumpjum/mailNonPerjalananDinasRevision.ejs", {
                data: dataMail,
            });

            dataMail.html = html;
            await sendMailNew(dataMail);
        });
        await Promise.all(promises);  
        // end send mail

        await query.commit();
        return res.status(200).json({ message: 'Data berhasil diupdate' });
    } catch (error) {
        console.log(error)
        await query.rollback();
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1 ? error.message : 'Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT',
        });
    }
}

// Reject
export const PUMPJUM_NonPerjalananDinasReject = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            id,
            reason,
        } = req.body;

        // Validate user, and get user_nik
        const user = await dbDbcHris("AppDB_DBC_HRIS.dbo.T_DBC_Employee")
            .where("EmployeeId", req.body.empid)
            .first();
        // const user = await dbDbcHris("dbHRIS_newer.dbo.master_employee")
        //     .where('employee_pk', req.body.empid)
        //     .first();

        if (!user) {
            await query.rollback();
            return res.status(400).json({ message: 'Invalid user, silahkan hubungi Tim IT' });
        }

        const empid = user.EmployeeNIK;
        // const empid = user.employee_id;
        
        const header = await query("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select("ndt.employee_nik")
            .where("ndt.id",id)
            .first();
        const isOS = /\D/.test(header?.employee_nik);
        const empTable = isOS
            ? `[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[T_EMP_Master_Outsource] as emp`
            : `[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`;
        const empNameColumn = isOS
            ? db.raw("COALESCE(emp.EmployeeName, NULL) as employee_name")
            : db.raw("COALESCE(emp.employee_name, NULL) as employee_name");

        const trxNonduty = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select(
                "ndt.id",
                "ndt.pum_number",
                "ndt.domain",
                "ndt.site",
                "ndt.employee_nik",
                "ndt.department_name",
                "ndt.supplier",
                "ndt.perihal",
                "ndt.payment_method_id",
                "ndt.is_taxable",
                "ndt.um_type_id",
                "ndt.due_date_inv",
                "ndt.gl",
                "ndt.subacc",
                "ndt.prodline",
                "ndt.file_attachment",
                "ndt.feedback_notes",
                "ndt.reason_approver",
                "ndt.status_data",
                "ndt.approval_grade_min",
                "ndt.approval_grade_max",
                "ndt.approval_nik",
                "ndt.approval_fa_tax_min",
                "ndt.approval_fa_tax_max",
                "ndt.approval_fa_tax_nik",
                db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                empNameColumn,
            )
            .leftJoin("dbPortalFA.dbo.users as usr", "ndt.employee_nik", "=", "usr.user_nik")
            .leftJoin("dbPortalFA.dbo.domain as dom", "usr.user_domain", "=", "dom.domain_code")
            .leftJoin(db.raw(empTable), "ndt.employee_nik", "=", `${isOS ? 'emp.EmployeeNIK' : 'emp.employee_id'}`)
            .where("id", id)
            .first();

        if (!trxNonduty) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal melakukan request revisi, silahkan hubungi Tim IT' });
        }

        await query("dbPortalFA.dbo.trx_nonduty_header")
            .where("id", id)
            .update({
                status_data: 'Rejected',
                feedback_notes: reason,
                updated_by: empid,
                updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            });

        // store history approval
        const payloadHistory = {
            domain: parseInt(trxNonduty.domain || 0),
            pum_number: trxNonduty.pum_number,
            status_data: 'Rejected',
            feedback_notes: reason,
            created_by: empid,
            created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        }
        await query("dbPortalFA.dbo.trx_nonduty_approval").insert(payloadHistory);

        
        const items = await db("dbPortalFA.dbo.trx_nonduty_detail as ndt")
            .select('ndt.*', db.raw("FORMAT(ndt.date, 'dd MMMM yyyy') as tanggal"), db.raw("FORMAT(ndt.date, 'dd/MM/yyyy') as tanggal_raw"))
            .where('ndt.pum_number', trxNonduty.pum_number)
        const totalAmountItem = items.reduce((acc, item) => acc + Number(item.amount || 0), 0);
    
        // send email
        let mailUser = [];
        let mailCc = [];

        let userRequestor = null;
        if (process.env.EMAILDUMMY != '') {
            mailUser = [process.env.EMAILDUMMY];
        } else {
            userRequestor = await db("dbPortalFA.dbo.users")
                .select('user_nik', 'user_site','user_name', 'user_id', 'user_email')
                .where('user_nik', trxNonduty.employee_nik)
                .first();

            if(!userRequestor) {
                await query.rollback();
                return res.status(400).json({ message: 'User requestor data tidak ditemukan, silahkan cek atau tambahkan di master user' });
            }
            const userTo = userRequestor.user_email;
            mailUser = [userTo];
        }

        const promises = mailUser.map(async (user) => {            
            const dataMail = {
                from: 'Pengajuan Uang Muka System',
                to: user,
                cc: mailCc,
                subject: 'Pengajuan Uang Muka System - Non Perjalanan Dinas',
                to_employee_name: trxNonduty.employee_name,
                employee_name: trxNonduty.employee_name,
                department_name: trxNonduty.department_name,
                pum_number: trxNonduty.pum_number,
                um_value: formatRupiah2(totalAmountItem),
                status_data: trxNonduty.status_data,
                feedback_notes: reason,
                link: `${process.env.LINK_FRONTEND}/#/pum-pjum/detail-non-perjalanan-dinas/${useEncrypt(String(trxNonduty.id))}`,
            };

            let html = await ejs.renderFile("view/pumpjum/mailNonPerjalananDinasRejected.ejs", {
                data: dataMail,
            });

            dataMail.html = html;
            await sendMailNew(dataMail);
        });
        await Promise.all(promises);  
        // end send mail

        await query.commit();
        return res.status(200).json({ message: 'Data berhasil diupdate' });
    } catch (error) {
        console.log(error)
        await query.rollback();
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1 ? error.message : 'Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT',
        });
    }
}

export const PUMPJUM_NonPerjalananDinasAPList = async (req, res) => {
    const { rowsPerPage, page } = req.query;

    const domain = req.query.domain || req.body.domain || req.params.domain;
    const sortBy = req.query.sortBy || 'created_date';
    const sort = req.query.descending === "true" ? "desc" : "asc";

    if (!domain) {
        return res.status(400).json({ error: 'Missing domain parameter' });
    }

    try {
        let response;
        
        const siteData = await db("mstr_pic_app")
            .where("employee_id", req.query.empnik)
            .where("type_pum", 'Non Duty')
            .where("type_approval_id", 'AP')
            .first();

        let allowedSites = [];
        if (siteData && siteData.site) {
            try {
                allowedSites = JSON.parse(siteData.site);
            } catch (e) {
                allowedSites = [];
            }
        }

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
                .select(
                    "ndt.id",
                    "ndt.domain",
                    "ndt.pum_number",
                    "ndt.perihal",
                    "ndt.payment_method_id",
                    "ndt.status_data",
                    "ndt.created_by",
                    "ndt.created_date",
                    "pay.method_name",
                    "ndt.department_name",
                    db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                    db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                    db.raw("COALESCE(usr.user_name, NULL) as created_name"),
                    db.raw("CONCAT(ndt.site, ' - ', sit.site_desc ) as site"),
                    db.raw("FORMAT(ndt.created_date, 'dd MMMM yyyy') as requested_at"),
                )
                .leftJoin("dbPortalFA.dbo.users as usr", "ndt.created_by", "=", "usr.user_nik")
                .leftJoin("dbPortalFA.dbo.domain as dom", "ndt.domain", "=", "dom.domain_code")
                .leftJoin('dbPortalFA.dbo.site_mstr as sit', function () {
                    this.on('ndt.site', '=', 'sit.site_code')
                        .andOn('ndt.domain', '=', 'sit.site_domain');
                })
                .leftJoin('dbPortalFA.dbo.mstr_payment_method as pay', function () {
                    this.on('ndt.payment_method_id', '=', 'pay.method_code')
                        .andOn('ndt.domain', '=', 'pay.domain');
                })
                .whereNotNull('pum_number')
                .where('pum_number', '<>', '')
                .whereIn("status_data", ["Approved Tax", "Approved FA", "Processed AP"])
                .where("ndt.domain", domain)
                .modify((query) => {
                    if (req.query.filter) {
                        const search = `%${req.query.filter}%`;
                        query.where(function () {
                            this.orWhere("dom.domain_shortname", "like", search)
                                .orWhere("ndt.pum_number", "like", search)
                                .orWhere("ndt.perihal", "like", search)
                                .orWhere("ndt.status_data", "like", search)
                                .orWhere("ndt.site", "like", search)
                                .orWhere("sit.site_desc", "like", search)
                                .orWhere("pay.method_name", "like", search)
                                .orWhere("usr.user_name", "like", search)
                                ;
                        });
                    }
                })
                .orderBy(sortBy, sort);
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
                .select(
                    "ndt.id",
                    "ndt.domain",
                    "ndt.pum_number",
                    "ndt.perihal",
                    "ndt.payment_method_id",
                    "ndt.status_data",
                    "ndt.created_by",
                    "ndt.created_date",
                    "pay.method_name",
                    "ndt.department_name",
                    db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                    db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                    db.raw("COALESCE(usr.user_name, NULL) as created_name"),
                    db.raw("CONCAT(ndt.site, ' - ', sit.site_desc ) as site"),
                    db.raw("FORMAT(ndt.created_date, 'dd MMMM yyyy') as requested_at"),
                )
                .leftJoin("dbPortalFA.dbo.users as usr", "ndt.created_by", "=", "usr.user_nik")
                .leftJoin("dbPortalFA.dbo.domain as dom", "ndt.domain", "=", "dom.domain_code")
                .leftJoin('dbPortalFA.dbo.site_mstr as sit', function () {
                    this.on('ndt.site', '=', 'sit.site_code')
                        .andOn('ndt.domain', '=', 'sit.site_domain');
                })
                .leftJoin('dbPortalFA.dbo.mstr_payment_method as pay', function () {
                    this.on('ndt.payment_method_id', '=', 'pay.method_code')
                        .andOn('ndt.domain', '=', 'pay.domain');
                })
                .whereNotNull('pum_number')
                .where('pum_number', '<>', '')
                .whereIn("status_data", ["Approved Tax", "Approved FA", "Processed AP", "Created QAD", "Closed"])
                .where("ndt.domain", domain)
                .whereIn("ndt.site", allowedSites)
                .modify(async (query) => {
                    if (req.query.filter) {
                        const search = `%${req.query.filter}%`;
                        query.where(function () {
                            this.orWhere("dom.domain_shortname", "like", search)
                                .orWhere("ndt.pum_number", "like", search)
                                .orWhere("ndt.perihal", "like", search)
                                .orWhere("ndt.status_data", "like", search)
                                .orWhere("ndt.site", "like", search)
                                .orWhere("sit.site_desc", "like", search)
                                .orWhere("pay.method_name", "like", search)
                                .orWhere("usr.user_name", "like", search);
                        });
                    }

                    if (req.query.filter_domain) {
                        query.where(function () {
                            this.where("ndt.domain", req.query.filter_domain);
                        });
                    }

                    if (req.query.filter_dept) {
                        query.where(function () {
                            this.where("ndt.department_id", req.query.filter_dept);
                        });
                    }

                    if (req.query.filter_emp) {
                        query.where(function () {
                            this.where("ndt.created_by", req.query.filter_emp);
                        });
                    }

                    if (req.query.filter_status) {
                        query.where(function () {
                            this.where("ndt.status_data", req.query.filter_status);
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
            message: 'Success',
            data: response,
        });
    } catch (error) {
        console.log(error)
        return res.status(406).json(
            /* { message: error.message } */
            {
                type: 'error',
                message:
                    process.env.DEBUG == 1
                        ? error.message
                        : `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
            }
        );
    }
};

export const PUMPJUM_NonPerjalananDinasAPDetail = async (req, res) => {
    const domain = req.query.domain || req.body.domain || req.params.domain;

    // if (!domain) {
    //     return res.status(400).json({ error: 'Missing domain parameter' });
    // }

    try {
        let response;
        // Validate if request has Query rowsPerPage
        const header = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select("ndt.employee_nik")
            .where("ndt.id", req.query.id)
            .first();
        const isOS = /\D/.test(header?.employee_nik);
        const empTable = isOS
            ? `[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[T_EMP_Master_Outsource] as emp`
            : `[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`;
        const empPositionColumn = isOS
            ? db.raw("COALESCE(emp.PositionName, NULL) as employee_nm_pos")
            : db.raw("COALESCE(emp.employee_nm_pos, NULL) as employee_nm_pos");

        response = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select(
                "ndt.id",
                "ndt.domain",
                "ndt.pum_number",
                "ndt.perihal",
                "ndt.payment_method_id",
                "ndt.status_data",
                "ndt.created_by",
                "ndt.created_date",
                "pay.method_name",
                "ndt.department_name",
                "ndt.is_taxable",
                "ndt.supplier",
                "ndt.um_type_id",
                "ndt.gl",
                "ndt.subacc",
                "ndt.prodline",
                "ndt.file_attachment",
                "ndt.feedback_notes",
                "ndt.reason_approver",
                "ndt.inv_status",
                "ndt.comment",
                "ndt.daybook",
                "ndt.description",
                "ndt.allocation_status",
                "sit.site_code",
                "usr.user_jabatan",
                empPositionColumn,
                "dom.domain_longname",
                "ndt.own_bank_number",
                db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                db.raw("COALESCE(usr.user_name, NULL) as created_name"),
                db.raw("CONCAT(ndt.site, ' - ', sit.site_desc ) as site"),
                db.raw("FORMAT(ndt.created_date, 'dd MMMM yyyy') as requested_at"),
                db.raw("FORMAT(ndt.due_date_inv, 'dd/MM/yyyy') as due_date_inv"),
                db.raw("CONVERT(varchar, ndt.created_date, 120) as created_date_print")
            )
            .leftJoin("dbPortalFA.dbo.users as usr", "ndt.created_by", "=", "usr.user_nik")
            .leftJoin("dbPortalFA.dbo.domain as dom", "ndt.domain", "=", "dom.domain_code")
            .leftJoin("dbPortalFA.dbo.site_mstr as sit", "ndt.site", "=", "sit.site_code")
            .leftJoin("dbPortalFA.dbo.mstr_payment_method as pay", "ndt.payment_method_id", "=", "pay.method_code")
            .leftJoin(db.raw(empTable), "ndt.created_by", "=", `${isOS ? 'emp.EmployeeNIK' : 'emp.employee_id'}`)
            .where('ndt.id', req.query.id)

        return res.status(200).json({
            message: 'Success',
            data: response,
        });
    } catch (error) {
        console.log(error)
        return res.status(406).json(
            /* { message: error.message } */
            {
                type: 'error',
                message:
                    process.env.DEBUG == 1
                        ? error.message
                        : `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
            }
        );
    }
};

export const PUMPJUM_NonPerjalananDinasAPDetailUMTax = async (req, res) => {
    try {
        let response;
        // Validate if request has Query rowsPerPage
        response = await db("dbPortalFA.dbo.trx_nonduty_detail as ndt")
            .select('ndt.*', db.raw("FORMAT(ndt.date, 'dd MMMM yyyy') as tanggal"), db.raw("FORMAT(ndt.date, 'dd/MM/yyyy') as tanggal_raw"))
            .where('ndt.pum_number', req.query.pum_number)

        return res.status(200).json({
            message: 'Success',
            data: response,
        });
    } catch (error) {
        console.log(error)
        return res.status(406).json(
            /* { message: error.message } */
            {
                type: 'error',
                message:
                    process.env.DEBUG == 1
                        ? error.message
                        : `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
            }
        );
    }
};

export const PUMPJUM_NonPerjalananDinasAPDetailUMTaxNew = async (req, res) => {
    try {
        let response;
        // Validate if request has Query rowsPerPage
        response = await db("dbPortalFA.dbo.trx_nonduty_detail_tax as tax")
            .select('tax.*')
            .where('tax.pum_number', req.query.pum_number);

        return res.status(200).json({
            message: 'Success',
            data: response,
        });
    } catch (error) {
        console.log(error)
        return res.status(406).json(
            /* { message: error.message } */
            {
                type: 'error',
                message:
                    process.env.DEBUG == 1
                        ? error.message
                        : `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
            }
        );
    }
};


export const PUMPJUM_NonPerjalananDinasAPPdf = async (req, res) => {
    try {
        const data = req.body;
        handlebars.registerHelper('formatCurrency', function (value) {
            if (!value && value !== 0) return '0';
            return new Intl.NumberFormat('id-ID', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(value);
        });

        handlebars.registerHelper('inc', function (value) {
            return parseInt(value) + 1;
        });

        // Hitung total
        let total = 0;
        data.details.forEach((item, idx) => {
            item.no_data = idx + 1;
            item.amount = Number(item.amount);
            total += item.amount;
        });

        data.total = total;
        data.total_formatted = new Intl.NumberFormat('id-ID').format(total);
        data.terbilang = terbilang(total) + ' Rupiah';

        //approver
        data.approver = await db("dbPortalFA.dbo.trx_nonduty_approval as a")
            .select(
                'c.employee_id', db.raw('dbo.InitCap(c.employee_name) as approver_name'), 'c.employee_nm_pos as approver_position', db.raw("CONVERT(varchar, a.created_date, 120) as approve_date")
            )
            .leftJoin("dbPortalFA.dbo.mstr_pic_app as b", "a.created_by", "=", "b.employee_id")
            .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as c`), "a.created_by", "=", "c.employee_id")
            .orderBy("a.created_date", "asc");

        data.approver_tax = await db("dbPortalFA.dbo.trx_nonduty_approval as a")
            .select(
                'c.employee_id', db.raw('dbo.InitCap(c.employee_name) as approver_name'), 'c.employee_nm_pos as approver_position', db.raw("CONVERT(varchar, a.created_date, 120) as approve_date")
            )
            .leftJoin("dbPortalFA.dbo.mstr_pic_app as b", "a.created_by", "=", "b.employee_id")
            .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as c`), "a.created_by", "=", "c.employee_id")
            .where('b.type_approval_id', 'like', '%Tax%')
            .orderBy("a.created_date", "asc");

        const pdfBuffer = await pdfTemplate.pdfPUMNonPerjalananDinasAP(data);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=${data.on_duty_number}.pdf`);

        res.end(pdfBuffer.data);
    } catch (error) {
        console.log(error)
        return res.status(406).json(
            /* { message: error.message } */
            {
                type: 'error',
                message:
                    process.env.DEBUG == 1
                        ? error.message
                        : `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
            }
        );
    }
};

export const PUMPJUM_NonPerjalananDinasHistoryApproval = async (req, res) => {
    try {
        let query = await db("dbPortalFA.dbo.trx_nonduty_approval as odt")
            .select(
                "odt.pum_number",
                "odt.status_data",
                "odt.feedback_notes",
                "odt.created_date",
                db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                db.raw("COALESCE(emp.employee_name, NULL) as employee_name")
            )
            .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), db.raw("CAST(odt.created_by AS VARCHAR(50))"), "=", "emp.employee_id")
            .leftJoin("dbPortalFA.dbo.users as usr", db.raw("CAST(odt.created_by AS VARCHAR(50))"), "=", "usr.user_nik")
            .leftJoin("dbPortalFA.dbo.domain as dom", "usr.user_domain", "=", "dom.domain_code")
            .where("odt.pum_number", req.query.pum_number)
            .orderBy('odt.created_date', 'asc');

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

export const PUMPJUM_NonPerjalananDinasAPCancel = async (req, res) => {
    const query = await db.transaction();
    try {

        const payloadUpdate = {
            status_data: 'Cancelled',
            feedback_notes: req.body.reason_cancel,
            updated_by: req.body.nik,
            updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        }

        await query("dbPortalFA.dbo.trx_nonduty_header")
            .where("pum_number", req.body.pum_number)
            .update(payloadUpdate);

        // store history approval
        const payloadHistory = {
            domain: req.body.domain,
            pum_number: req.body.pum_number,
            status_data: 'Cancelled',
            feedback_notes: req.body.reason_cancel,
            created_by: req.body.nik,
            created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        }
        await query("dbPortalFA.dbo.trx_nonduty_approval").insert(payloadHistory);

        await query.commit();
        return res.status(200).json({ message: 'Data pengajuan PUM berhasil dibatalkan' });
    } catch (error) {
        console.log(error)
        await query.rollback();
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1 ? error.message : 'Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT',
        });
    }
}

export const PUMPJUM_NonPerjalananDinasAPSave = async (req, res) => {
    const query = await db.transaction();
    try {

        const payloadUpdate = {
            supplier: req.body.supplier_id,
            payment_method_id: req.body.payment_method_id,
            is_taxable: (req.body.is_taxable === '1') ? true : false,
            um_type_id: req.body.um_type_id,
            due_date_inv:  dayjs(req.body.due_date_inv, 'DD/MM/YYYY').format('YYYY-MM-DD HH:mm:ss'),
            perihal: req.body.perihal,
            gl: req.body.gl || null,
            subacc: req.body.subacc || null,
            prodline: req.body.prodline || null,
            daybook: req.body.daybook,
            description: req.body.description,
            own_bank_number: req.body.own_bank_number,
            inv_status: req.body.inv_status,
            allocation_status: req.body.allocation_status,
            comment: req.body.comment,
            updated_by: req.body.nik,
            updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        }

        await query("dbPortalFA.dbo.trx_nonduty_header")
            .where("pum_number", req.body.pum_number)
            .update(payloadUpdate);

        await query.commit();
        return res.status(200).json({ message: 'Data non perjalanan dinas berhasil disimpan' });
    } catch (error) {
        console.log(error)
        await query.rollback();
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1 ? error.message : 'Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT',
        });
    }
}

export const PUMPJUM_NonPerjalananDinasAPUMEdit = async (req, res) => {
    const query = await db.transaction();
    try {

        const payloadUpdate = {
            // date: req.body.um_date,
            no_po: req.body.um_no_po,
            description: req.body.um_description,
            amount: req.body.um_amount,
            updated_by: req.body.nik,
            updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            currency: req.body.um_currency,
        }

        await query("dbPortalFA.dbo.trx_nonduty_detail")
            .where("pum_number", req.body.pum_number)
            .where("id", req.body.um_id)
            .update(payloadUpdate);

        const allDetails = await query("dbPortalFA.dbo.trx_nonduty_detail")
            .select("amount")
            .where("pum_number", req.body.pum_number);

        if (allDetails.length > 0) {
            const totalAmount = allDetails.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    
            const negativeTaxes = await query("dbPortalFA.dbo.trx_nonduty_detail_tax")
                .select("tax_amount", "tarif")
                .where("pum_number", req.body.pum_number)
                .andWhere("tarif", "<", 0);
            if (negativeTaxes.length > 0) {
                const totalNegativeTax = negativeTaxes.reduce((sum, tax) => {
                    return sum + Math.abs(parseFloat(tax.tax_amount || 0));
                }, 0);
                const totalTCAmount = totalAmount - totalNegativeTax;

                await query("dbPortalFA.dbo.trx_nonduty_header")
                    .where("pum_number", req.body.pum_number)
                    .update({
                        total_amount: totalAmount,
                        tc_amount: Math.round(totalTCAmount),
                    });
            } else {
                await query("dbPortalFA.dbo.trx_nonduty_header")
                    .where("pum_number", req.body.pum_number)
                    .update({
                        total_amount: totalAmount,
                        tc_amount: totalAmount,
                    });
            }
        }

        await query.commit();
        return res.status(200).json({ message: 'Data uang muka berhasil diubah' });
    } catch (error) {
        console.log(error)
        await query.rollback();
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1 ? error.message : 'Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT',
        });
    }
}

export const PUMPJUM_NonPerjalananDinasAPUMDelete = async (req, res) => {
    // #swagger.tags = ['PUM']
    /* #swagger.security = [{
                "bearerAuth": []
        }] */
    // #swagger.description = 'Fungsi untuk delete register invoice'
    const query = await db.transaction();
    try {
        const detail = await query("dbPortalFA.dbo.trx_nonduty_detail")
            .select("pum_number")
            .where('id', req.params.id);

        await query("dbPortalFA.dbo.trx_nonduty_detail")
            .where('id', req.params.id)
            .delete();

        const allDetails = await query("dbPortalFA.dbo.trx_nonduty_detail")
            .select("amount")
            .where("pum_number", detail.pum_number);

        if (allDetails.length > 0) {
            const totalAmount = allDetails.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    
            const negativeTaxes = await query("dbPortalFA.dbo.trx_nonduty_detail_tax")
                .select("tax_amount", "tarif")
                .where("pum_number", detail.pum_number)
                .andWhere("tarif", "<", 0);
            if (negativeTaxes.length > 0) {
                const totalNegativeTax = negativeTaxes.reduce((sum, tax) => {
                    return sum + Math.abs(parseFloat(tax.tax_amount || 0));
                }, 0);
                const totalTCAmount = totalAmount - totalNegativeTax;

                await query("dbPortalFA.dbo.trx_nonduty_header")
                    .where("pum_number", detail.pum_number)
                    .update({
                        total_amount: totalAmount,
                        tc_amount: Math.round(totalTCAmount),
                    });
            } else {
                await query("dbPortalFA.dbo.trx_nonduty_header")
                    .where("pum_number", detail.pum_number)
                    .update({
                        total_amount: totalAmount,
                        tc_amount: totalAmount,
                    });
            }
        }

        await query.commit();
        return res.status(200).json({ message: 'Data Uang Muka Berhasil Dihapus' });
    } catch (error) {
        console.log(error);
        await query.rollback();
        return res.status(406).json(/* error */
            {
                type: 'error',
                message: process.env.DEBUG == 1 ? error.message : `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
            });
    }
};

export const PUMPJUM_NoNPerjalananDinasSendToQAD = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            domain,
            pum_number,
            allocation_status,
            comment,
            description,
            due_date_inv,
            gl,
            inv_status,
            is_taxable,
            own_bank_number,
            subacc,
            prodline,
            supplier_id,
            payment_method_id,
            perihal,
            um_type_id,
            daybook,
        } = req.body;

        // Validate user, and get user_nik
        // const user = await db("dbPortalFA.dbo.users")
        //                 .select('user_nik')
        //                 .where('user_id', req.body.empid)
        //                 .first()
        const user = await dbDbcHris("dbHRIS_newer.dbo.master_employee")
            .select('employee_id')
            .where('employee_pk', req.body.empid)
            .first();

        if(!user) {
            await query.rollback();
            return res.status(400).json({ message: 'Invalid user, silahkan hubungi Tim IT' });
        }

        // const empid = user.user_nik;
        const empid = user.employee_id;

        const header = await query("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select("ndt.employee_nik")
            .where('ndt.pum_number', pum_number)
            .first();
        const isOS = /\D/.test(header?.employee_nik);
        const empTable = isOS
            ? `[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[T_EMP_Master_Outsource] as emp`
            : `[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`;
        const empNameColumn = isOS
            ? db.raw("COALESCE(emp.EmployeeName, NULL) as employee_name")
            : db.raw("COALESCE(emp.employee_name, NULL) as employee_name");

        const trxNonduty = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select(
                "ndt.id",
                "ndt.status_data",
                "ndt.domain",
                "ndt.pum_number",
                "ndt.created_date",
                "ndt.employee_nik",
                "ndt.payment_method_id",
                "ndt.department_name",
                "ndt.description",
                "ndt.tc_amount",
                empNameColumn,
            )
            .leftJoin(db.raw(empTable), "ndt.employee_nik", "=", `${isOS ? 'emp.EmployeeNIK' : 'emp.employee_id'}`)
            .where('pum_number', pum_number)
            .first();
                                    
        if (!trxNonduty) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal melakukan penyimpanan data, silahkan hubungi Tim IT' });
        }

        let trxPumNumber = trxNonduty.pum_number || null;
        if (!trxNonduty.pum_number) {
            const genNumber = await generatePumNumberWithLastMasterNumber({ domain: trxNonduty.domain });
            if (!genNumber) {
                await query.rollback();
                return res.status(400).json({ message: 'Gagal melakukan penyimpanan data dan generate number, silahkan hubungi Tim IT' });
            }
            trxPumNumber = genNumber.newNumberFormat;
            await db("dbPortalFA.dbo.mstr_num_pum")
                .where('id', genNumber.id)
                .update({ current_number: genNumber.nextNumber });
        }

        const currentDate = dayjs().format("YYYY-MM-DD HH:mm:ss");
        const payloadUpdate = {
            status_data: 'Created QAD',
            allocation_status,
            supplier: supplier_id,
            due_date_inv:  dayjs(due_date_inv, 'DD/MM/YYYY').format('YYYY-MM-DD HH:mm:ss'),
            is_taxable: (is_taxable === '1') ? true : false,
            gl: gl || null,
            subacc: subacc || null,
            prodline: prodline || null,
            description,
            inv_status,
            payment_method_id: Number(payment_method_id),
            own_bank_number,
            comment,
            perihal,
            um_type_id,
            updated_by: empid,
            updated_date: currentDate,
        }

        if (!trxNonduty.pum_number) {
            payloadUpdate.pum_number = trxPumNumber;
        }

        await query("dbPortalFA.dbo.trx_nonduty_header")
        .where ("pum_number", pum_number)
        .update(payloadUpdate); 

        // store history approval
        const payloadHistory = {
            domain: parseInt(trxNonduty.domain ?? 0),
            pum_number: trxNonduty.pum_number,
            status_data: 'Created QAD',
            created_by: empid,
            created_date: currentDate,
        }
        await query("dbPortalFA.dbo.trx_nonduty_approval").insert(payloadHistory);

        // const items = await db("dbPortalFA.dbo.trx_nonduty_detail as ndt")
        //     .select('ndt.*', db.raw("FORMAT(ndt.date, 'dd MMMM yyyy') as tanggal"), db.raw("FORMAT(ndt.date, 'dd/MM/yyyy') as tanggal_raw"))
        //     .where('ndt.pum_number', trxNonduty.pum_number)
        const items = await db("dbPortalFA.dbo.trx_nonduty_detail_tax as ndt")
            .select('ndt.*')
            .where('ndt.pum_number', trxNonduty.pum_number)
        // const totalAmountItemList = items.reduce((acc, item) => acc + (item.amount || 0), 0);
        // const totalTcAmountItemList = items.reduce((acc, item) => acc + (item.tc_amount || 0), 0);

        const detailItems = await db("dbPortalFA.dbo.trx_nonduty_detail as ndt")
            .select('ndt.*')
            .where('ndt.pum_number', trxNonduty.pum_number);
        const currency = detailItems?.[0]?.currency || 'IDR';

        const currentTrxNonduty = await query("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select("ndt.*")
            .where('pum_number', pum_number)
            .first();
        const totalAmountItemList = currentTrxNonduty.total_amount;
        const totalTcAmountItemList = currentTrxNonduty.tc_amount;

        // store monitoring pum
        const payloadMonitoring = {
            domain: trxNonduty.domain,
            pum_number: trxPumNumber,
            payment_method_id: trxNonduty.payment_method_id,
            type_pum: 'Non Duty',
            keterangan: description,
            employeenik: trxNonduty.employee_nik,
            employeename: trxNonduty.employee_name,
            tanggal_pum: currentDate,
            nominal: currentTrxNonduty.total_amount,
            status: 'OPEN',
            created_at: currentDate,
        }
        await query("dbPortalFA.dbo.monitoring_pum").insert(payloadMonitoring);

        if (payment_method_id === '2') {
            const bankNumber = await db("dbMaster.dbo.qad_supp_own_bank")
                            .select(
                                'id',
                                'suppcode',
                                'suppname',
                                'bank_gl_account',
                                'suppbank_nbr',
                                'ownbank_nbr',
                            )
                            .where('suppcode', supplier_id)
                            .where('ownbank_nbr', own_bank_number)
                            .first();
        
            if (!bankNumber) {
                await query.rollback();
                return res.status(400).json({ message: 'Gagal melakukan penyimpanan data, silahkan hubungi Tim IT' });
            }

            const payloadQad = {
                created_date: dayjs(currentDate).format("YYYY-MM-DD"),
                created_date_month: dayjs(currentDate).format("MM"),
                created_date_year: dayjs(currentDate).format("YYYY"),
                created_date_year_month: dayjs(currentDate).format("YYYYMM"),
                allocation_key: trxPumNumber,
                description,
                allocation_status,
                is_taxable: (is_taxable === '1') ? true : false,
                own_bank_number,
                suppbank_nbr: bankNumber.suppbank_nbr,
                bank_gl_account: bankNumber.bank_gl_account,
                inv_status,
                comment,
                due_date_inv: dayjs(due_date_inv, 'DD/MM/YYYY').format('YYYY-MM-DD'),
                subacc: subacc,
                tc_amount: totalAmountItemList,
                tc_amount_new: totalTcAmountItemList,
                items,
                currency,
            }
            const sendToQad = await inbound_supp_inv_non_perjalanan_dinas(payloadQad);
            if (sendToQad.status === 'error') {
                await query.rollback();
                let message = sendToQad.message ? sendToQad.message : 'Gagal melakukan penyimpanan data dan mengirim ke qad'
                return res.status(400).json({ message });
            }
        } else {
            const payloadQad = {
                created_date: dayjs(currentDate).format("YYYY-MM-DD"),
                created_date_month: dayjs(currentDate).format("MM"),
                created_date_year: dayjs(currentDate).format("YYYY"),
                created_date_year_month: dayjs(currentDate).format("YYYYMM"),
                allocation_key: trxPumNumber,
                description,
                allocation_status,
                tc_amount: totalAmountItemList,
                tc_amount_new: totalTcAmountItemList,
                is_taxable: (is_taxable === '1') ? true : false,
                gl: gl,
                daybook,
            }

            const sendToQad = await inbound_pettycash_non_perjalanan_dinas(payloadQad);
            if (sendToQad.status === 'error') {
                await query.rollback();
                let message = sendToQad.message ? sendToQad.message : 'Gagal melakukan penyimpanan data dan mengirim ke qad'
                return res.status(400).json({ message });
            }
        }

        // send email
        let mailUser = [];
        let mailCc = [];

        let userRequestor = null;
        if (process.env.EMAILDUMMY != '') {
            mailUser = [process.env.EMAILDUMMY];
        } else {
            userRequestor = await db("dbPortalFA.dbo.users")
                .select('user_nik', 'user_site','user_name', 'user_id', 'user_email')
                .where('user_nik', trxNonduty.employee_nik)
                .first();

            if(!userRequestor) {
                await query.rollback();
                return res.status(400).json({ message: 'User requestor data tidak ditemukan, silahkan cek atau tambahkan di master user' });
            }
            const userTo = userRequestor.user_email;
            mailUser = [userTo];
        }

        const promises = mailUser.map(async (user) => {            
            const dataMail = {
                from: 'Pengajuan Uang Muka System',
                to: user,
                cc: mailCc,
                subject: 'Pengajuan Uang Muka System - Non Perjalanan Dinas',
                to_employee_name: trxNonduty.employee_name,
                employee_name: trxNonduty.employee_name,
                department_name: trxNonduty.department_name,
                pum_number: trxNonduty.pum_number,
                um_value: formatRupiah2(totalAmountItemList),
                status_data: trxNonduty.status_data,
                link: `${process.env.LINK_FRONTEND}/#/pum-pjum/detail-non-perjalanan-dinas/${useEncrypt(String(trxNonduty.id))}`,
            };

            let html = await ejs.renderFile("view/pumpjum/mailNonPerjalananDinasSendToQad.ejs", {
                data: dataMail,
            });

            dataMail.html = html;
            await sendMailNew(dataMail);
        });
        await Promise.all(promises);  
        // end send mail

        await query.commit();
        return res.status(200).json({ message: 'Data berhasil diupdate' });
    } catch (error) {
        console.log(error)
        await query.rollback();
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1 ? error.message : 'Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT',
        });
    }
}

// Download attachment Non Perjalanan dinas
export const PUMPJUM_NonPerjalananDinasDownloadAttachment = async (req, res) => {
    try {
        const {
            pum_number,
        } = req.body;

        let query = await db("dbPortalFA.dbo.trx_nonduty_header as odt")
        .select(
            "odt.pum_number",
            "odt.file_attachment",
        )
        .where("pum_number", pum_number)
        .first();

        const attachment = await downloadFileWithParams(query.file_attachment, 'pum-pjum/lamp-non-perjadin');

        res.setHeader("Content-Type", attachment.mimeType);
        res.setHeader("Content-Disposition", `attachment; filename=${attachment.originalName}.jpeg`);

        res.end(attachment.buffer);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Internal server error, please call IT",
        status: false,
        error: error.message,
      });
    }
};

// Create non perjalanan dinas
export const PUMPJUM_NonPerjalananDinasSave = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            domain,
            site,
            employee_nik,
            department_id,
            department_name,
            supplier,
            payment_method_id,
            is_taxable,
            perihal,
            um_type_id,
            due_date_inv,
            gl,
            subacc,
            item_um,
            pum_number,
            prodline,
        } = req.body;
        const dokumen = req.files.upload ? req.files.upload[0].filename : null;

        // Validate user, and get user_nik to assign created_by
        // const user = await db("dbPortalFA.dbo.users")
        //                 .select('user_nik')
        //                 .where('user_id', req.body.empid)
        //                 .first()
        // const user = await dbDbcHris("dbHRIS_newer.dbo.master_employee")
        //     .select('employee_id')
        //     .where('employee_pk', req.body.empid)
        //     .first();
        let isOS = false;
        let user = await dbDbcHris('dbHRIS_newer.dbo.T_EMP_Master_Outsource')
            .where("EmployeeId", req.body.empid)
            .first();
        if (!user) {
            user = await dbDbcHris('AppDB_DBC_HRIS.dbo.T_DBC_Employee')
                .where("EmployeeId", req.body.empid)
                .first();

            isOS = false;
        } else {
            isOS = true;
        }

        if(!user) {
            await query.rollback();
            return res.status(400).json({ message: 'Invalid user, silahkan hubungi Tim IT' });
        }

        const itemUangMuka = JSON.parse(item_um); 
        if (itemUangMuka.length === 0) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal menyimpan data, silahkan hubungi Tim IT' });
        }

        // const empid = user.user_nik;
        // const empid = user.employee_id;
        const empid = user.EmployeeNIK;

        let currentTrxNonDuty = null;
        let currentItemTrxNonDuty = null;
        if (pum_number) {
            currentTrxNonDuty = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
                .select(
                    "ndt.id",
                    "ndt.pum_number",
                    "ndt.domain",
                    "ndt.site",
                    "ndt.employee_nik",
                    "ndt.department_name",
                    "ndt.status_data",
                    db.raw("COALESCE(emp.employee_name, NULL) as employee_name")
                )
                .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), "ndt.employee_nik", "=", "emp.employee_id")
                .where("pum_number", pum_number)
                .first();

            currentItemTrxNonDuty = await db("dbPortalFA.dbo.trx_nonduty_detail as dtl")
                .select('dtl.id')
                .where('dtl.pum_number', pum_number);
        }

        // Check if file exists
        if (dokumen) {
            const localFilePath = `file/${dokumen}`;
            if (!fs.existsSync(localFilePath)) {
                await query.rollback();
                return res.status(400).json({ message: 'Gagal upload, silahkan hubungi Tim IT' });
            }

            await uploadFileWithParams(dokumen, 'pum-pjum/lamp-non-perjadin');
            unlink(`file/${dokumen}`, (err) => {
                if (err) return res.status(406).json({ message: 'Gagal upload, silahkan hubungi Tim IT' });
            });
        }

        let newPumNumber = currentTrxNonDuty && currentTrxNonDuty.pum_number || null;
        if (!newPumNumber) {
            const genNumber = await generatePumNumberWithLastMasterNumber({ domain });
            if (!genNumber) {
                await query.rollback();
                return res.status(400).json({ message: 'Gagal melakukan penyimpanan data dan generate number, silahkan hubungi Tim IT' });
            }
            newPumNumber = genNumber.newNumberFormat;
            await db("dbPortalFA.dbo.mstr_num_pum")
                .where('id', genNumber.id)
                .update({ current_number: genNumber.nextNumber });
        }

        const payload = {
            pum_number: newPumNumber,
            domain,
            site,
            department_id,
            department_name,
            supplier,
            payment_method_id,
            is_taxable,
            perihal,
            um_type_id,
            due_date_inv: dayjs(due_date_inv, 'DD/MM/YYYY').format('YYYY-MM-DDTHH:mm:ss'),
            gl: gl || null,
            subacc: subacc || null,
            prodline: prodline || null,
        }

        if (dokumen) {
            payload.file_attachment = dokumen;
        }
        if (currentTrxNonDuty) {
            payload.updated_by = empid;
            payload.updated_date = dayjs().format("YYYY-MM-DD HH:mm:ss");
            await query("dbPortalFA.dbo.trx_nonduty_header")
                .where ("pum_number", newPumNumber)
                .update(payload); 
    
            const promises = itemUangMuka.map(async (v) => {            
                if (v.id) {
                    const payloadDetail = {
                        pum_number: newPumNumber,
                        date: dayjs(v.date, 'DD/MM/YYYY').format('YYYY-MM-DDTHH:mm:ss'),
                        no_data: v.no_data,
                        no_po: v.no_po || null,
                        description: v.description,
                        currency: v.currency,
                        amount: v.amount,
                        created_by: empid,
                        created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                    }
                    await query("dbPortalFA.dbo.trx_nonduty_detail")
                        .where ("id", v.id)
                        .update(payloadDetail); 
                } else {
                    const payloadDetail = {
                        pum_number: newPumNumber,
                        date: dayjs(v.date, 'DD/MM/YYYY').format('YYYY-MM-DDTHH:mm:ss'),
                        no_data: v.no_data,
                        no_po: v.no_po || null,
                        description: v.description,
                        currency: v.currency,
                        amount: v.amount,
                        created_by: empid,
                        created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                    }
                    await query("dbPortalFA.dbo.trx_nonduty_detail").insert(payloadDetail);
                }
            }); await Promise.all(promises);

            // check and delete jika item dihapus saat mengirim data
            const itemUangMukaIds = itemUangMuka.filter(item => item.id != null).map(item => item.id);
            if (currentItemTrxNonDuty && currentItemTrxNonDuty.length > 0) {
                const idsToDelete = currentItemTrxNonDuty.filter(item => !itemUangMukaIds.includes(item.id)).map(item => item.id);

                if (idsToDelete.length > 0) {
                    await db("dbPortalFA.dbo.trx_nonduty_detail")
                    .whereIn("id", idsToDelete)
                    .delete();
                }
            }
        } else {
            payload.employee_nik = employee_nik;
            payload.status_data = 'Draft';
            payload.created_by = empid;
            payload.created_date = dayjs().format("YYYY-MM-DD HH:mm:ss");
            await query("dbPortalFA.dbo.trx_nonduty_header").insert(payload);
    
            const promises = itemUangMuka.map(async (v) => {            
                const payloadDetail = {
                    pum_number: newPumNumber,
                    date: dayjs(v.date, 'DD/MM/YYYY').format('YYYY-MM-DDTHH:mm:ss'),
                    no_data: v.no_data,
                    no_po: v.no_po || null,
                    description: v.description,
                    currency: v.currency,
                    amount: v.amount,
                    created_by: empid,
                    created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                }
                await query("dbPortalFA.dbo.trx_nonduty_detail").insert(payloadDetail);
            }); await Promise.all(promises);
        }

        // update total amount dan tc amount
        const allDetails = await query("dbPortalFA.dbo.trx_nonduty_detail")
            .select("amount")
            .where("pum_number", newPumNumber);
        
        if (allDetails.length > 0) {
            const totalAmount = allDetails.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    
            const negativeTaxes = await query("dbPortalFA.dbo.trx_nonduty_detail_tax")
                .select("tax_amount", "tarif")
                .where("pum_number", newPumNumber)
                .andWhere("tarif", "<", 0);
            if (negativeTaxes.length > 0) {
                const totalNegativeTax = negativeTaxes.reduce((sum, tax) => {
                    return sum + Math.abs(parseFloat(tax.tax_amount || 0));
                }, 0);
                const totalTCAmount = totalAmount - totalNegativeTax;

                await query("dbPortalFA.dbo.trx_nonduty_header")
                    .where("pum_number", newPumNumber)
                    .update({
                        total_amount: totalAmount,
                        tc_amount: Math.round(totalTCAmount),
                    });
            } else {
                await query("dbPortalFA.dbo.trx_nonduty_header")
                    .where("pum_number", newPumNumber)
                    .update({
                        total_amount: totalAmount,
                        tc_amount: totalAmount,
                    });
            }
        }

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

// check approver
export const PUMPJUM_NonPerjalananDinasCheckToMasterApproval = async (req, res) => {
    try {
        const {
            domain,
            department_id,
            item_um,
            um_type_id,
        } = req.query;

        if (item_um.length === 0) {
            return res.status(400).json({ message: 'Gagal menyimpan data, silahkan hubungi Tim IT' });
        }
        
        const totalAmount = item_um.reduce((acc, item) => acc + Number(item.amount || 0), 0);
        const response =  await db("dbPortalFA.dbo.mstr_amt_app as app")
            .select(
                "app.id",
                "app.domain",
                "app.grade",
                "app.amt_min",
                "app.amt_max",
                "app.department_id",
                db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                db.raw("COALESCE(grd.grade_new, NULL) as grade_new"),
            )
            .leftJoin("dbPortalFA.dbo.domain as dom", "app.domain", "=", "dom.domain_code")
            .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[mapping_grade] as grd`), "app.grade", "=", "grd.grade_name")
            .where('app.domain', domain)
            .where("app.amt_min", "<=", totalAmount)
            .where("app.amt_max", ">=", totalAmount)
            .whereRaw(`
                EXISTS (
                    SELECT 1
                    FROM OPENJSON(app.department_id)
                    WHERE value = ?
                )`, [department_id]
            )
            .whereRaw(`
                EXISTS (
                    SELECT 1
                    FROM OPENJSON(app.um_type_id)
                    WHERE value = ?
                )`, [um_type_id]
            );

        return res.status(200).json({
            message: 'Success',
            data: response,
        });
    } catch (error) {
        console.log(error)
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1 ? error.message : 'Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT',
        });
    }
}

// Sent to approver non perjalanan dinas
export const PUMPJUM_NonPerjalananDinasSentToSuperiorApprover = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            domain,
            site,
            employee_nik,
            department_id,
            department_name,
            supplier,
            payment_method_id,
            is_taxable,
            perihal,
            um_type_id,
            due_date_inv,
            gl,
            subacc,
            item_um,
            approver,
            reason_approver,
            pum_number,
            prodline,
        } = req.body;
        const dokumen = req.files.upload ? req.files.upload[0].filename : null;

        // Validate user, and get user_nik to assign created_by
        let isOS = false;
        let user = await dbDbcHris('dbHRIS_newer.dbo.T_EMP_Master_Outsource as usr')
            .select(
                "usr.EmployeeId",
                "usr.EmployeeNIK",
                "usr.EmployeeName",
                "usr.PositionName",
                db.raw("COALESCE(emp1.EmployeeNIK, NULL) as FirstSuperiorNIK"),
                db.raw("COALESCE(emp2.EmployeeNIK, NULL) as SecondSuperiorNIK"),
            )
            .leftJoin(db.raw(`[${linked_dbDbcHris}].[AppDB_DBC_HRIS].[dbo].[T_DBC_Employee] as emp1`), "usr.FirstSuperiorId", "=", "emp1.EmployeeId")
            .leftJoin(db.raw(`[${linked_dbDbcHris}].[AppDB_DBC_HRIS].[dbo].[T_DBC_Employee] as emp2`), "usr.SecondSuperiorId", "=", "emp2.EmployeeId")
            .where("usr.EmployeeId", req.body.empid)
            .first();
        if (!user) {
            user = await dbDbcHris('AppDB_DBC_HRIS.dbo.T_DBC_Employee')
                .where("EmployeeId", req.body.empid)
                .first();

            isOS = false;
        } else {
            isOS = true;
        }
        // const user = await dbDbcHris("dbHRIS_newer.dbo.master_employee")
        //     .where('employee_pk', req.body.empid)
        //     .first();

        if(!user) {
            await query.rollback();
            return res.status(400).json({ message: 'Invalid user, silahkan hubungi Tim IT' });
        }

        const itemUangMuka = JSON.parse(item_um); 
        if (itemUangMuka.length === 0) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal menyimpan data, silahkan hubungi Tim IT' });
        }

        const empid = user.EmployeeNIK;
        // const empid = user.employee_id;

        let currentTrxNonDuty = null;
        let currentItemTrxNonDuty = null;
        if (pum_number) {
            currentTrxNonDuty = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
                .select(
                    "ndt.id",
                    "ndt.pum_number",
                    "ndt.domain",
                    "ndt.site",
                    "ndt.employee_nik",
                    "ndt.department_name",
                    "ndt.status_data",
                    db.raw("COALESCE(emp.employee_name, NULL) as employee_name")
                )
                .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), "ndt.employee_nik", "=", "emp.employee_id")
                .where("pum_number", pum_number)
                .first();

            currentItemTrxNonDuty = await db("dbPortalFA.dbo.trx_nonduty_detail as dtl")
                .select('dtl.id')
                .where('dtl.pum_number', pum_number);
        }

        // Check if file exists
        if (dokumen) {
            const localFilePath = `file/${dokumen}`;
            if (!fs.existsSync(localFilePath)) {
                await query.rollback();
                return res.status(400).json({ message: 'Gagal upload, silahkan hubungi Tim IT' });
            }

            await uploadFileWithParams(dokumen, 'pum-pjum/lamp-non-perjadin');
            unlink(`file/${dokumen}`, (err) => {
                if (err) return res.status(406).json({ message: 'Gagal upload, silahkan hubungi Tim IT' });
            });
        }

        let newPumNumber = currentTrxNonDuty && currentTrxNonDuty.pum_number || null;
        if (!newPumNumber) {
            const genNumber = await generatePumNumberWithLastMasterNumber({ domain });
            if (!genNumber) {
                await query.rollback();
                return res.status(400).json({ message: 'Gagal melakukan penyimpanan data dan generate number, silahkan hubungi Tim IT' });
            }
            newPumNumber = genNumber.newNumberFormat;
            await db("dbPortalFA.dbo.mstr_num_pum")
                .where('id', genNumber.id)
                .update({ current_number: genNumber.nextNumber });
        }

        const payload = {
            pum_number: newPumNumber,
            domain,
            site,
            employee_nik,
            department_id,
            department_name,
            supplier,
            payment_method_id,
            is_taxable,
            perihal,
            um_type_id,
            due_date_inv: dayjs(due_date_inv, 'DD/MM/YYYY').format('YYYY-MM-DDTHH:mm:ss'),
            gl: gl || null,
            subacc: subacc || null,
            prodline: prodline || null,
        }

        if (dokumen) {
            payload.file_attachment = dokumen;
        }

        if (reason_approver) {
            payload.reason_approver = reason_approver;
        }

        const totalAmountItem = itemUangMuka.reduce((acc, item) => acc + Number(item.amount || 0), 0);
        if (um_type_id === '2' && !isOS) {
            const baseSelect = [
                "emp.EmployeeId",
                "emp.EmployeeNIK",
                "emp.EmployeeName",
                "emp.BusinessUnitCode",
                "emp.BusinessUnitName",
                "emp.PositionId",
                "emp.PositionName",
                "emp.GradeCode",
                "emp.GradeName",
                db.raw("COALESCE(pst.SectionId, NULL) as SectionId"),
                db.raw("COALESCE(pst.SectionCode, NULL) as SectionCode"),
                db.raw("COALESCE(pst.DepartmentId, NULL) as DepartmentId"),
                db.raw("COALESCE(pst.DepartmentCode, NULL) as DepartmentCode"),
                db.raw("COALESCE(pst.DivisionId, NULL) as DivisionId"),
                db.raw("COALESCE(pst.DivisionCode, NULL) as DivisionCode"),
                db.raw("COALESCE(pst.ChiefId, NULL) as ChiefId"),
                db.raw("COALESCE(pst.ChiefCode, NULL) as ChiefCode"),
            ];

            // get current user
            const currentUser = await dbDbcHris("AppDB_DBC_HRIS.dbo.T_DBC_Employee as emp")
                .select(baseSelect)
                .leftJoin(db.raw(`[${linked_dbDbcHris}].[AppDB_DBC_HRIS].[dbo].[T_DBC_Job_Position] as pst`), "emp.PositionId", "=", "pst.PositionId")
                .where("emp.EmployeeNIK", user.EmployeeNIK)
                .first();

            const gradeUser = parseInt(currentUser.GradeCode, 10)
            payload.approval_grade_min = gradeUser;
            payload.approval_grade_max = gradeUser;
            payload.approval_nik = currentUser.EmployeeNIK;
        } else if (approver && approver !== 'null') {
            // if (approver === 'Superior' && !user.employee_spv) {
            if (approver === 'Superior' && !user.FirstSuperiorNIK) {
                await query.rollback();
                return res.status(400).json({ message: 'User approval superior tidak ditemukan' });
            // } else if (approver === 'Above the Superior' && !user.employee_mgr) {
            } else if (approver === 'Above the Superior' && !user.SecondSuperiorNIK) {
                await query.rollback();
                return res.status(400).json({ message: 'User approval Above the superior tidak ditemukan' });
            }
            let nikUserApprover = approver === 'Superior' ? user.FirstSuperiorNIK : user.SecondSuperiorNIK;
            // let nikUserApprover = approver === 'Superior' ? user.employee_spv : user.employee_mgr;
            const userApprover = await dbDbcHris("AppDB_DBC_HRIS.dbo.T_DBC_Employee")
                .where("EmployeeNIK", nikUserApprover)
            .first();
            // const userApprover = await dbDbcHris("dbHRIS_newer.dbo.master_employee")
            //     .where('employee_id', nikUserApprover)
            //     .first();
            if(!userApprover) {
                await query.rollback();
                return res.status(400).json({ message: 'Invalid user, silahkan hubungi Tim IT' });
            }

            payload.approval_grade_min = userApprover.GradeCode.replace(/^0+/, '') || '0';
            payload.approval_grade_max = userApprover.GradeCode.replace(/^0+/, '') || '0';
            payload.approval_nik = userApprover.EmployeeNIK;
            // payload.approval_grade_min = userApprover.employee_grade || '0';
            // payload.approval_grade_max = userApprover.employee_grade || '0';
            // payload.approval_nik = userApprover.employee_id;
        } else {
            const masterApproval =  await db("dbPortalFA.dbo.mstr_amt_app as app")
            .select(
                "app.id",
                "app.domain",
                "app.grade",
                "app.amt_min",
                "app.amt_max",
                "app.department_id",
                db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                db.raw("COALESCE(grd.grade_new, NULL) as grade_new"),
            )
            .leftJoin("dbPortalFA.dbo.domain as dom", "app.domain", "=", "dom.domain_code")
            .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[mapping_grade] as grd`), "app.grade", "=", "grd.grade_name")
            .where('app.domain', domain)
            .where("app.amt_min", "<=", totalAmountItem)
            .where("app.amt_max", ">=", totalAmountItem)
            .whereRaw(`
                EXISTS (
                    SELECT 1
                    FROM OPENJSON(app.department_id)
                    WHERE value = ?
                )`, [department_id]
            )
            .whereRaw(`
                EXISTS (
                    SELECT 1
                    FROM OPENJSON(app.um_type_id)
                    WHERE value = ?
                )`, [um_type_id]
            );

            if(masterApproval.length === 0) {
                await query.rollback();
                return res.status(400).json({ message: 'Master approval user tidak ditemukan, silahkan hubungi Tim IT' });
            }

            const baseSelect = [
                "emp.EmployeeId",
                "emp.EmployeeNIK",
                "emp.EmployeeName",
                "emp.BusinessUnitCode",
                "emp.BusinessUnitName",
                "emp.PositionId",
                "emp.PositionName",
                "emp.GradeCode",
                "emp.GradeName",
                db.raw("COALESCE(pst.SectionId, NULL) as SectionId"),
                db.raw("COALESCE(pst.SectionCode, NULL) as SectionCode"),
                db.raw("COALESCE(pst.DepartmentId, NULL) as DepartmentId"),
                db.raw("COALESCE(pst.DepartmentCode, NULL) as DepartmentCode"),
                db.raw("COALESCE(pst.DivisionId, NULL) as DivisionId"),
                db.raw("COALESCE(pst.DivisionCode, NULL) as DivisionCode"),
                db.raw("COALESCE(pst.ChiefId, NULL) as ChiefId"),
                db.raw("COALESCE(pst.ChiefCode, NULL) as ChiefCode"),
            ];
            // const baseSelect = [
            //     "emp.employee_pk",
            //     "emp.employee_id",
            //     "emp.employee_name",
            //     "emp.employee_bu_id",
            //     "emp.employee_bu_name",
            //     "emp.employee_position_pk",
            //     "emp.employee_nm_pos",
            //     "emp.employee_grade",
            //     "emp.employee_kat_grade",
            //     db.raw("COALESCE(pst.map_sect_pk, NULL) as map_sect_pk"),
            //     db.raw("COALESCE(pst.map_dept_pk, NULL) as map_dept_pk"),
            //     db.raw("COALESCE(pst.map_div_pk, NULL) as map_div_pk"),
            //     db.raw("COALESCE(pst.map_chief_pk, NULL) as map_chief_pk"),
            // ];

            // get current user
            let currentUser = null;
            let skipLoop = false;
            let userNextApprover = null;
            let minLevel = null;
            let maxLevel = null;
            if (isOS) {
                // currentUser = await dbDbcHris("dbHRIS_newer.dbo.T_EMP_Master_Outsource as emp")
                //     .select(baseSelectOS)
                //     .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[mapping_position] as pst`), "emp.PositionId", "=", "pst.map_post_pk")
                //     .where("emp.EmployeeNIK", user.EmployeeNIK)
                //     .first();
                  const empOS = await dbDbcHris("dbHRIS_newer.dbo.T_EMP_Master_Outsource as emp")
                    .select(
                        "emp.EmployeeId",
                        "emp.EmployeeNIK",
                        "emp.EmployeeName",
                        "emp.BusinessUnitCode",
                        "emp.BusinessUnitName",
                        "emp.PositionId",
                        "emp.PositionName",
                        "emp.firstSuperiorId",
                        "emp.secondSuperiorId",
                        db.raw("COALESCE(pst.map_sect_pk, NULL) as map_sect_pk"),
                        db.raw("COALESCE(pst.map_sect_id, NULL) as map_sect_id"),
                    )
                    .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[mapping_position] as pst`), "emp.PositionId", "=", "pst.map_post_pk")
                    .where("emp.EmployeeNIK", user.EmployeeNIK)
                    .first();

                let osMinGrade, osMaxGrade;
                // flow normal
                // if (empOS.map_sect_id) {
                //     const cleanedSectId = empOS.map_sect_id.replace(/\s*\(Outsource\)/g, '');
                //     const posMapping = await dbDbcHris("dbHRIS_newer.dbo.mapping_position")
                //         .select("map_sect_pk", "map_dept_pk", "map_div_pk", "map_chief_pk")
                //         .where("map_sect_id", cleanedSectId)
                //         .first();

                //     if (!posMapping) {
                //         await query.rollback();
                //         return res.status(400).json({ message: "Mapping position untuk user tidak ditemukan" });
                //     }

                //     currentUser = { ...empOS, ...posMapping };

                //     // OS normal, ambil min dan max dari seluruh masterApproval
                //     osMinGrade = masterApproval.reduce((a, b) => a.grade_new < b.grade_new ? a : b).grade_new;
                //     osMaxGrade = masterApproval.reduce((a, b) => a.grade_new > b.grade_new ? a : b).grade_new;
                // }
                // Function to check superior and grade
                const checkSuperior = async (superiorId) => {
                    if (!superiorId) return null;
                    const superior = await dbDbcHris("AppDB_DBC_HRIS.dbo.T_DBC_Employee")
                        .select("GradeCode", "EmployeeId", "EmployeeNIK")
                        .where("EmployeeId", superiorId)
                        .first();
                    if (!superior) return null;
                    const grade = Number(String(superior.GradeCode).replace(/^0+/, ''));
                    const gradeExists = masterApproval.some(approval => approval.grade_new === grade);
                    return gradeExists ? { superior, grade } : null;
                };

                // Check first superior, then second superior
                const validSuperior = await checkSuperior(empOS.firstSuperiorId) || await checkSuperior(empOS.secondSuperiorId);
                
                if (validSuperior) {
                    osMinGrade = validSuperior.grade;
                    osMaxGrade = masterApproval.reduce((a, b) => a.grade_new > b.grade_new ? a : b).grade_new;
                    currentUser = { ...empOS, superiorGradeCode: validSuperior.superior.GradeCode };
                    userNextApprover = validSuperior.superior;
                    skipLoop = true;
                } else {
                    await query.rollback();
                    return res.status(400).json({ message: "Data approval tidak ditemukan atau grade tidak sesuai" });
                }

                // langsung set approver & skip loop
                minLevel = osMinGrade;
                maxLevel = osMaxGrade;
            } else {
                currentUser = await dbDbcHris("AppDB_DBC_HRIS.dbo.T_DBC_Employee as emp")
                    .select(baseSelect)
                    .leftJoin(db.raw(`[${linked_dbDbcHris}].[AppDB_DBC_HRIS].[dbo].[T_DBC_Job_Position] as pst`), "emp.PositionId", "=", "pst.PositionId")
                    .where("emp.EmployeeNIK", user.EmployeeNIK)
                    .first();

                // const currentUser = await dbDbcHris("dbHRIS_newer.dbo.master_employee as emp")
                //     .select(baseSelect)
                //     .leftJoin("dbHRIS_newer.dbo.mapping_position as pst", "emp.employee_position_pk", "=", "pst.map_post_pk")
                //     .where("emp.employee_id", user.employee_id)
                //     .first();

                const gradeCurrentUser = Number(String(currentUser.GradeCode).replace(/^0+/, ''));
                const filtered = masterApproval.filter(item => item.grade_new > gradeCurrentUser);

                if (filtered.length === 0) {
                    await query.rollback();
                    return res.status(400).json({ message: `Master approval user dengan grade diatas ${gradeCurrentUser} tidak ditemukan` });
                }

                minLevel = filtered.reduce((a, b) => a.grade_new < b.grade_new ? a : b).grade_new;
                maxLevel = filtered.reduce((a, b) => a.grade_new > b.grade_new ? a : b).grade_new;
            }

            if (!currentUser) {
                await query.rollback();
                return res.status(400).json({ message: 'Data user tidak ditemukan' });
            }

            if (!skipLoop) {
                for (let gradeCheck = minLevel; gradeCheck <= maxLevel; gradeCheck++) {
                    
                    const userApprover = dbDbcHris("AppDB_DBC_HRIS.dbo.T_DBC_Employee as emp")
                        .select(baseSelect)
                        .leftJoin(db.raw(`[${linked_dbDbcHris}].[AppDB_DBC_HRIS].[dbo].[T_DBC_Job_Position] as pst`), "emp.PositionId", "=", "pst.PositionId")
                        .whereRaw(`
                            RIGHT(emp.GradeCode, LEN(emp.GradeCode) - PATINDEX('%[^0]%', emp.GradeCode + '1') + 1) = ?
                        `, [gradeCheck.toString()])
                        .where("emp.ActiveStatus", "Active");

                    // const userApprover = dbDbcHris("dbHRIS_newer.dbo.master_employee as emp")
                    //     .select(baseSelect)
                    //     .leftJoin("dbHRIS_newer.dbo.mapping_position as pst", "emp.employee_position_pk", "=", "pst.map_post_pk")
                    //     .where("emp.employee_grade", approverMinLevel.grade_new.toString());
    
                    switch (gradeCheck) {
                        case 1:
                        case 2:
                        case 3:
                        case 4:
                            userApprover.where("pst.SectionId", isOS ? currentUser.map_sect_pk : currentUser.SectionId);
                            // userApprover.where("pst.map_sect_pk", currentUser.map_sect_pk);
                            break;
                        case 5:
                            userApprover.where("pst.DepartmentId", isOS ? currentUser.map_dept_pk : currentUser.DepartmentId);
                            // userApprover.where("pst.map_dept_pk", currentUser.map_dept_pk);
                            break;
                        case 6:
                            userApprover.where("pst.DivisionId", isOS ? currentUser.map_div_pk : currentUser.DivisionId);
                            // userApprover.where("pst.map_div_pk", currentUser.map_div_pk);
                            break;
                        case 7:
                            userApprover.where("pst.ChiefId", isOS ? currentUser.map_chief_pk : currentUser.ChiefId);
                            // userApprover.where("pst.map_chief_pk", currentUser.map_chief_pk);
                            break;
                        case 8:
                            userApprover.where("pst.BusinessUnitCode", isOS ? currentUser.employee_bu_id : currentUser.BusinessUnitCode);
                            // userApprover.where("pst.employee_bu_id", currentUser.employee_bu_id);
                            break;
                    }
    
                    const approver = await userApprover.first();
                    if (approver) {
                        userNextApprover = approver;
                        break;
                    }
                }
            }

            if (!userNextApprover) {
                await query.rollback();
                return res.status(400).json({
                    message: `Approval tidak ditemukan, mohon cek pada menu master Amount approval, pada departemen ${department_name} untuk grade antara ${minLevel} - ${maxLevel}`
                });
            }

            payload.approval_grade_min = minLevel;
            payload.approval_grade_max = maxLevel;
            payload.approval_nik = userNextApprover.EmployeeNIK;
            // payload.approval_nik = userNextApprover.employee_id;
        }

        if (currentTrxNonDuty) {
            payload.status_data = ['Draft', 'Require Revision'].includes(currentTrxNonDuty.status_data) ? 'Pending Approval' : currentTrxNonDuty.status_data;
            payload.updated_by = empid;
            payload.updated_date = dayjs().format("YYYY-MM-DD HH:mm:ss");
            await query("dbPortalFA.dbo.trx_nonduty_header")
                .where ("pum_number", newPumNumber)
                .update(payload); 
    
            const promises = itemUangMuka.map(async (v) => {            
                if (v.id) {
                    const payloadDetail = {
                        pum_number: newPumNumber,
                        date: dayjs(v.date, 'DD/MM/YYYY').format('YYYY-MM-DDTHH:mm:ss'),
                        no_data: v.no_data,
                        no_po: v.no_po || null,
                        description: v.description,
                        currency: v.currency,
                        amount: v.amount,
                        created_by: empid,
                        created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                    }
                    await query("dbPortalFA.dbo.trx_nonduty_detail")
                        .where ("id", v.id)
                        .update(payloadDetail); 
                } else {
                    const payloadDetail = {
                        pum_number: newPumNumber,
                        date: dayjs(v.date, 'DD/MM/YYYY').format('YYYY-MM-DDTHH:mm:ss'),
                        no_data: v.no_data,
                        no_po: v.no_po || null,
                        description: v.description,
                        currency: v.currency,
                        amount: v.amount,
                        created_by: empid,
                        created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                    }
                    await query("dbPortalFA.dbo.trx_nonduty_detail").insert(payloadDetail);
                }
            }); await Promise.all(promises);

            // check and delete jika item dihapus saat mengirim data
            const itemUangMukaIds = itemUangMuka.filter(item => item.id != null).map(item => item.id);
            if (currentItemTrxNonDuty && currentItemTrxNonDuty.length > 0) {
                const idsToDelete = currentItemTrxNonDuty.filter(item => !itemUangMukaIds.includes(item.id)).map(item => item.id);

                if (idsToDelete.length > 0) {
                    await db("dbPortalFA.dbo.trx_nonduty_detail")
                    .whereIn("id", idsToDelete)
                    .delete();
                }
            }
        } else {
            payload.status_data = 'Pending Approval';
            payload.created_by = empid;
            payload.created_date = dayjs().format("YYYY-MM-DD HH:mm:ss");
            await query("dbPortalFA.dbo.trx_nonduty_header").insert(payload);
    
            const promises = itemUangMuka.map(async (v) => {            
                const payloadDetail = {
                    pum_number: newPumNumber,
                    date: dayjs(v.date, 'DD/MM/YYYY').format('YYYY-MM-DDTHH:mm:ss'),
                    no_data: v.no_data,
                    no_po: v.no_po || null,
                    description: v.description,
                    currency: v.currency,
                    amount: v.amount,
                    created_by: empid,
                    created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                }
                await query("dbPortalFA.dbo.trx_nonduty_detail").insert(payloadDetail);
            }); await Promise.all(promises);
        }

        // update total amount dan tc amount
        const allDetails = await query("dbPortalFA.dbo.trx_nonduty_detail")
            .select("amount")
            .where("pum_number", newPumNumber);
        if (allDetails.length > 0) {
            const totalAmount = allDetails.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    
            const negativeTaxes = await query("dbPortalFA.dbo.trx_nonduty_detail_tax")
                .select("tax_amount", "tarif")
                .where("pum_number", newPumNumber)
                .andWhere("tarif", "<", 0);
            if (negativeTaxes.length > 0) {
                const totalNegativeTax = negativeTaxes.reduce((sum, tax) => {
                    return sum + Math.abs(parseFloat(tax.tax_amount || 0));
                }, 0);
                const totalTCAmount = totalAmount - totalNegativeTax;

                await query("dbPortalFA.dbo.trx_nonduty_header")
                    .where("pum_number", newPumNumber)
                    .update({
                        total_amount: totalAmount,
                        tc_amount:  Math.round(totalTCAmount),
                    });
            } else {
                await query("dbPortalFA.dbo.trx_nonduty_header")
                    .where("pum_number", newPumNumber)
                    .update({
                        total_amount: totalAmount,
                        tc_amount: totalAmount,
                    });
            }
        }

        // await query.commit();

        const empTable = isOS
            ? `[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[T_EMP_Master_Outsource] as emp`
            : `[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`;
        const empNameColumn = isOS
            ? db.raw("COALESCE(emp.EmployeeName, NULL) as employee_name")
            : db.raw("COALESCE(emp.employee_name, NULL) as employee_name");

        const trxNonduty = await query("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select(
                "ndt.id",
                "ndt.pum_number",
                "ndt.domain",
                "ndt.site",
                "ndt.employee_nik",
                "ndt.department_name",
                "ndt.status_data",
                empNameColumn,
            )
            .leftJoin(db.raw(empTable), "ndt.employee_nik", "=", `${isOS ? 'emp.EmployeeNIK' : 'emp.employee_id'}`)
            .where("pum_number", newPumNumber)
            .first();

        if(!trxNonduty) {
            await query.rollback();
            return res.status(400).json({ message: 'Data tidak ditemukan, silahkan hubungi Tim IT' });
        }

        const currentApproval = await dbDbcHris("AppDB_DBC_HRIS.dbo.T_DBC_Employee")
            .where("EmployeeNIK", payload.approval_nik)
            .first();
        // const currentApproval = await dbDbcHris("dbHRIS_newer.dbo.master_employee")
        //     .where("employee_id", payload.approval_nik)
        //     .first();

        // send mail
        const resPortal = await dbHris("ptl_policy").where("id", 0).first();
        let token = jwt.sign({ user: currentApproval.EmployeeId }, process.env.TOKEN, {
        // let token = jwt.sign({ user: currentApproval.employee_pk }, process.env.TOKEN, {
            expiresIn: resPortal.idle_time,
        });
        const mailUser = process.env.EMAILDUMMY != '' ? process.env.EMAILDUMMY : currentApproval.OfficialEmail;
        // const mailUser = process.env.EMAILDUMMY != '' ? process.env.EMAILDUMMY : currentApproval.employee_email;
        const dataMail = {
            from: 'Pengajuan Uang Muka System',
            to: mailUser,
            subject: 'Pengajuan Uang Muka System - Non Perjalanan Dinas',
            employee_name_approver: currentApproval.EmployeeName,
            employee_name: trxNonduty.employee_name,
            department_name: trxNonduty.department_name,
            pum_number: trxNonduty.pum_number,
            um_value: formatRupiah2(totalAmountItem),
            status_data: trxNonduty.status_data,
            link: process.env.LINK_FRONTEND + "#/approval-pum-pjum/" + (
                await encryptString(
                    trxNonduty.id, // id header 
                    currentApproval.EmployeeId, // id user approval
                    currentApproval.EmployeeNIK, // nik user approval
                    // currentApproval.employee_pk, // id user approval
                    // currentApproval.employee_id, // nik user approval
                    token,
                )) + "",
        };

        let html = await ejs.renderFile("view/pumpjum/mailSuperiorApproval.ejs", {
            data: dataMail,
        });

        dataMail.html = html;
        await sendMailNew(dataMail);
        // end send mail
        
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

// Delete Non perjalanan dinas
export const PUMPJUM_NonPerjalananDinasDelete = async (req, res) => {
    const query = await db.transaction();
    try {
        const { pum_number } = req.query;

        if (!pum_number) {
            return res.status(400).json({ 
                message: 'Non perjalanan dinas pum number are required' 
            });
        }

        const trxNonduty = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select(
                "ndt.id",
                "ndt.pum_number",
                "ndt.domain",
                "ndt.site",
                "ndt.employee_nik",
                "ndt.department_name",
                "ndt.status_data",
                db.raw("COALESCE(emp.employee_name, NULL) as employee_name")
            )
            .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), "ndt.employee_nik", "=", "emp.employee_id")
            .where("pum_number", pum_number)
            .first();

        if(!trxNonduty) {
            await query.rollback();
            return res.status(400).json({ message: 'Data tidak ditemukan, silahkan hubungi Tim IT' });
        }

        if(!['Draft'].includes(trxNonduty.status_data)) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal delete data karena telah di proses, silahkan hubungi Tim IT' });
        }

        // Delete all matching records
        await db("dbPortalFA.dbo.trx_nonduty_header")
            .where("pum_number", pum_number)
            .delete();

        await db("dbPortalFA.dbo.trx_nonduty_detail")
            .where("pum_number", pum_number)
            .delete();

        return res.status(204).json({ message: 'Data berhasil dihapus!'})
    } catch(error){
        console.log(error)
        return res.status(406).json(/* { message: error.message } */
        {
            type:'error',
            message: process.env.DEBUG == 1 ? error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
        });
    }
}

export const PUMPJUM_NonPerjalananDinasGeneratePUMPdf = async (req, res) => {
    try {
        let data = req.body;
        handlebars.registerHelper('formatCurrency', function (value) {
            if (!value && value !== 0) return '0';
            return new Intl.NumberFormat('id-ID', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(value);
        });

        handlebars.registerHelper('inc', function (value) {
            return parseInt(value) + 1;
        });

        const trxNonduty = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select(
                "ndt.id",
                "ndt.domain",
                "ndt.pum_number",
                "ndt.perihal",
                "ndt.payment_method_id",
                "ndt.status_data",
                "ndt.created_by",
                "ndt.created_date",
                "pay.method_name",
                "ndt.department_name",
                "ndt.is_taxable",
                "ndt.supplier",
                "ndt.um_type_id",
                "ndt.gl",
                "ndt.subacc",
                "ndt.prodline",
                "ndt.file_attachment",
                "ndt.feedback_notes",
                "ndt.reason_approver",
                "ndt.inv_status",
                "ndt.comment",
                "ndt.daybook",
                "ndt.description",
                "ndt.allocation_status",
                "sit.site_code",
                "usr.user_jabatan",
                "c.employee_nm_pos",
                "dom.domain_longname",
                "ndt.own_bank_number",
                db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                db.raw("COALESCE(usr.user_name, NULL) as created_name"),
                db.raw("CONCAT(ndt.site, ' - ', sit.site_desc ) as site"),
                db.raw("FORMAT(ndt.created_date, 'dd MMMM yyyy') as requested_at"),
                db.raw("FORMAT(ndt.due_date_inv, 'dd/MM/yyyy') as due_date_inv"),
                db.raw("CONVERT(varchar, ndt.created_date, 120) as created_date_print")
            )
            .leftJoin("dbPortalFA.dbo.users as usr", "ndt.created_by", "=", "usr.user_nik")
            .leftJoin("dbPortalFA.dbo.domain as dom", "ndt.domain", "=", "dom.domain_code")
            .leftJoin("dbPortalFA.dbo.site_mstr as sit", "ndt.site", "=", "sit.site_code")
            .leftJoin("dbPortalFA.dbo.mstr_payment_method as pay", "ndt.payment_method_id", "=", "pay.method_code")
            .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as c`), "ndt.created_by", "=", "c.employee_id")
            .where('ndt.pum_number', data.no_pum)
            .first();

        if (!trxNonduty) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal amelakukan penyimpanan data, silahkan hubungi Tim IT' });
        }

        const getItems = await db("dbPortalFA.dbo.trx_nonduty_detail as dtl")
            .select('dtl.*', db.raw("FORMAT(dtl.date, 'dd MMMM yyyy') as tanggal"), db.raw("FORMAT(dtl.date, 'dd/MM/yyyy') as tanggal_raw"))
            .where('dtl.pum_number', data.no_pum);
        const taxItems = await db("dbPortalFA.dbo.trx_nonduty_detail_tax as tax")
            .select('tax.*')
            .where('tax.pum_number', data.no_pum);
        const jenisPajakSet = new Set(taxItems.map(item => item.jenis_pajak || item.tax_code));
        function formatCurrencyLabel(code) {
            return code === 'IDR' ? 'Rp' : code;
        }
        const currency = formatCurrencyLabel(data?.details?.[0]?.currency || getItems?.[0]?.currency || 'IDR');

        data = {
            ...data,
            department: data.department || trxNonduty.department_name,
            no_pum: data.no_pum,
            perihal: data.perihal || trxNonduty.perihal,
            created_by: data.created_by || ucwords(trxNonduty.created_name),
            created_date: data.created_date || trxNonduty.created_date_print,
            created_position: data.created_position || trxNonduty.employee_nm_pos,
            created_jabatan: data.created_jabatan || trxNonduty.user_jabatan,
            created_depart: data.created_depart || trxNonduty.department_name,
            bank: data.bank || (trxNonduty.payment_method_id === 2) ? 'Yes' : '',
            kas: data.kas || (trxNonduty.payment_method_id === 1) ? 'Yes' : '',
            details: data.details || getItems,
            tax_items: data.tax_items || taxItems,
            domain_longname: data.domain_longname || trxNonduty.domain_longname.toUpperCase(),
            taxable: data.taxable || (trxNonduty.is_taxable) ? 'Yes' : 'No',
            jenis_pajak: data.jenis_pajak || [...jenisPajakSet].join(', '),
            currency,
        }

        // Hitung total
        let total = 0;
        data.details.forEach((item, idx) => {
            item.no_data = idx + 1;
            item.amount = Number(item.amount);
            total += item.amount;
        });

        data.total = total;
        data.total_formatted = new Intl.NumberFormat('id-ID').format(total);
        data.terbilang = terbilang(total) + ' Rupiah';

        //approver
        const subquery = db("dbPortalFA.dbo.trx_nonduty_approval as a")
            .select(
                "a.created_by",
                "a.status_data",
                "a.pum_number",
                "a.created_date",
                db.raw(
                `ROW_NUMBER() OVER(
                    PARTITION BY a.created_by, a.status_data 
                    ORDER BY a.created_date DESC
                ) as rn`
                )
            )
            .where("a.pum_number", data.no_pum)
            .whereIn("a.status_data", [
                "Partially Approved Superior",
                "Fully Approved Superior",
                "Approved FA",
            ])
            .as("x");

        data.approver = await db(subquery)
            .select(
                "c.employee_id",
                db.raw("COALESCE(c.employee_name, NULL) as approver_name"),
                "c.employee_nm_pos as approver_position",
                db.raw("CONVERT(varchar, x.created_date, 120) as approve_date"),
                "x.status_data"
            )
            .leftJoin(
                db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as c`),
                "x.created_by",
                "=",
                "c.employee_id"
            )
            .where("x.rn", 1) // hanya ambil yang row_number = 1 (paling akhir per user+status)
            .orderBy("x.created_date", "asc");

        const subqueryTax = db("dbPortalFA.dbo.trx_nonduty_approval as a")
            .select(
            "a.created_by",
            "a.status_data",
            "a.pum_number",
            "a.created_date",
            db.raw(
            `ROW_NUMBER() OVER(
                PARTITION BY a.created_by, a.status_data
                ORDER BY a.created_date DESC
            ) as rn`
            )
        )
            .where("a.pum_number", data.no_pum)
            .whereIn("a.status_data", ["Pending Approval Tax", "Approved Tax"])
            .as("x");

        data.approver_tax = await db(subqueryTax)
            .select(
                "c.employee_id",
                db.raw("COALESCE(c.employee_name, NULL) as approver_name"),
                "c.employee_nm_pos as approver_position",
                db.raw("CONVERT(varchar, x.created_date, 120) as approve_date"),
                "x.status_data"
            )
            .leftJoin("dbPortalFA.dbo.mstr_pic_app as b", function () {
                this.on("x.created_by", "=", "b.employee_id")
                .andOn("b.type_approval_id", "=", db.raw("'Tax-Approver'"));
            })
            .leftJoin(
                db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as c`),
                "x.created_by",
                "c.employee_id"
            )
            .where("x.rn", 1) // hanya ambil yang terakhir per user + status
            .orderBy("x.created_date", "asc");

        const pdfBuffer = await pdfTemplate.pdfPUMNonPerjalananDinasAP(data);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=${data.on_duty_number}.pdf`);

        res.end(pdfBuffer.data);
    } catch (error) {
        console.log(error)
        return res.status(406).json(
            /* { message: error.message } */
            {
                type: 'error',
                message:
                    process.env.DEBUG == 1
                        ? error.message
                        : `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
            }
        );
    }
};

// Cancel Non Perjalanan dinas
export const PUMPJUM_NonPerjalananDinasCancel = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            domain,
            pum_number,
            cancel_reason,
        } = req.body;

        // Validate user, and get user_nik
        const user = await db("dbPortalFA.dbo.users")
                        .select('user_nik')
                        .where('user_id', req.body.empid)
                        .first()

        if(!user) {
            await query.rollback();
            return res.status(400).json({ message: 'Invalid user, silahkan hubungi Tim IT' });
        }
        const empid = user.user_nik;

        const header = await query("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select("ndt.employee_nik")
            .where('ndt.pum_number', pum_number)
            .first();
        const isOS = /\D/.test(header?.employee_nik);
        const empTable = isOS
            ? `[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[T_EMP_Master_Outsource] as emp`
            : `[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`;
        const empNameColumn = isOS
            ? db.raw("COALESCE(emp.EmployeeName, NULL) as employee_name")
            : db.raw("COALESCE(emp.employee_name, NULL) as employee_name");

        const trxNonduty = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select(
                "ndt.id",
                "ndt.pum_number",
                "ndt.domain",
                "ndt.site",
                "ndt.employee_nik",
                "ndt.department_name",
                "ndt.supplier",
                "ndt.perihal",
                "ndt.payment_method_id",
                "ndt.is_taxable",
                "ndt.um_type_id",
                "ndt.due_date_inv",
                "ndt.gl",
                "ndt.subacc",
                "ndt.prodline",
                "ndt.file_attachment",
                "ndt.feedback_notes",
                "ndt.reason_approver",
                "ndt.status_data",
                "ndt.approval_grade_min",
                "ndt.approval_grade_max",
                "ndt.approval_nik",
                "ndt.approval_fa_tax_min",
                "ndt.approval_fa_tax_max",
                "ndt.approval_fa_tax_nik",
                db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                empNameColumn,
            )
            .leftJoin("dbPortalFA.dbo.users as usr", "ndt.employee_nik", "=", "usr.user_nik")
            .leftJoin("dbPortalFA.dbo.domain as dom", "usr.user_domain", "=", "dom.domain_code")
            .leftJoin(db.raw(empTable), "ndt.employee_nik", "=", `${isOS ? 'emp.EmployeeNIK' : 'emp.employee_id'}`)
            .where("pum_number", pum_number)
            .first();

        if (!trxNonduty) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal melakukan request revisi, silahkan hubungi Tim IT' });
        }

        await query("dbPortalFA.dbo.trx_nonduty_header")
            .where("pum_number", pum_number)
            .update({
                status_data: 'Cancelled',
                feedback_notes: cancel_reason,
                updated_by: empid,
                updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            });

        // store history approval
        const payloadHistory = {
            domain: parseInt(trxNonduty.domain || 0),
            pum_number: trxNonduty.pum_number,
            status_data: 'Cancelled',
            feedback_notes: cancel_reason,
            created_by: empid,
            created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        }
        await query("dbPortalFA.dbo.trx_nonduty_approval").insert(payloadHistory);

        
        const items = await db("dbPortalFA.dbo.trx_nonduty_detail as ndt")
            .select('ndt.*', db.raw("FORMAT(ndt.date, 'dd MMMM yyyy') as tanggal"), db.raw("FORMAT(ndt.date, 'dd/MM/yyyy') as tanggal_raw"))
            .where('ndt.pum_number', trxNonduty.pum_number)
        const totalAmountItem = items.reduce((acc, item) => acc + Number(item.amount || 0), 0);
    
        // send email
        let mailUser = [];
        let mailCc = [];

        let userRequestor = null;
        if (process.env.EMAILDUMMY != '') {
            mailUser = [process.env.EMAILDUMMY];
        } else {
            userRequestor = await db("dbPortalFA.dbo.users")
                .select('user_nik', 'user_site','user_name', 'user_id', 'user_email')
                .where('user_nik', trxNonduty.employee_nik)
                .first();

            if(!userRequestor) {
                await query.rollback();
                return res.status(400).json({ message: 'User requestor data tidak ditemukan, silahkan cek atau tambahkan di master user' });
            }
            const userTo = userRequestor.user_email;
            mailUser = [userTo];
        }

        const promises = mailUser.map(async (user) => {            
            const dataMail = {
                from: 'Pengajuan Uang Muka System',
                to: user,
                cc: mailCc,
                subject: 'Pengajuan Uang Muka System - Non Perjalanan Dinas',
                to_employee_name: trxNonduty.employee_name,
                employee_name: trxNonduty.employee_name,
                department_name: trxNonduty.department_name,
                pum_number: trxNonduty.pum_number,
                um_value: formatRupiah2(totalAmountItem),
                status_data: trxNonduty.status_data,
                feedback_notes: cancel_reason,
                link: `${process.env.LINK_FRONTEND}/#/pum-pjum/detail-non-perjalanan-dinas/${useEncrypt(String(trxNonduty.id))}`,
            };

            let html = await ejs.renderFile("view/pumpjum/mailNonPerjalananDinasCancelled.ejs", {
                data: dataMail,
            });

            dataMail.html = html;
            await sendMailNew(dataMail);
        });
        await Promise.all(promises);  
        // end send mail

        await query.commit();
        return res.status(200).json({ message: 'Data berhasil diupdate' });
    } catch (error) {
        console.log(error)
        await query.rollback();
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1 ? error.message : 'Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT',
        });
    }
}

// Resend notif email
export const PUMPJUM_NonPerjalananDinasResendEmail = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            domain,
            pum_number,
        } = req.body;

        const header = await query("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select("ndt.employee_nik")
            .where('ndt.pum_number', pum_number)
            .first();
        const isOS = /\D/.test(header?.employee_nik);
        const empTable = isOS
            ? `[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[T_EMP_Master_Outsource] as emp`
            : `[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`;
        const empNameColumn = isOS
            ? db.raw("COALESCE(emp.EmployeeName, NULL) as employee_name")
            : db.raw("COALESCE(emp.employee_name, NULL) as employee_name");

        const trxNonduty = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
            .select(
                "ndt.id",
                "ndt.pum_number",
                "ndt.domain",
                "ndt.site",
                "ndt.employee_nik",
                "ndt.department_name",
                "ndt.status_data",
                "ndt.approval_nik",
                empNameColumn,
            )
            .leftJoin(db.raw(empTable), "ndt.employee_nik", "=", `${isOS ? 'emp.EmployeeNIK' : 'emp.employee_id'}`)
            .where("pum_number", pum_number)
            .first();

        if(!trxNonduty) {
            await query.rollback();
            return res.status(400).json({ message: 'Data tidak ditemukan, silahkan hubungi Tim IT' });
        }

        const items = await db("dbPortalFA.dbo.trx_nonduty_detail as ndt")
            .select('ndt.*', db.raw("FORMAT(ndt.date, 'dd MMMM yyyy') as tanggal"), db.raw("FORMAT(ndt.date, 'dd/MM/yyyy') as tanggal_raw"))
            .where('ndt.pum_number', trxNonduty.pum_number)
        const totalAmountItem = items.reduce((acc, item) => acc + Number(item.amount || 0), 0);

        const currentApproval = await dbDbcHris("AppDB_DBC_HRIS.dbo.T_DBC_Employee")
            .where("EmployeeNIK", trxNonduty.approval_nik)
            .first();
        // const currentApproval = await dbDbcHris("dbHRIS_newer.dbo.master_employee")
        //     .where("employee_id", trxNonduty.approval_nik)
        //     .first();

        // send mail
        const resPortal = await dbHris("ptl_policy").where("id", 0).first();
        let token = jwt.sign({ user: currentApproval.EmployeeId }, process.env.TOKEN, {
        // let token = jwt.sign({ user: currentApproval.employee_pk }, process.env.TOKEN, {
            expiresIn: resPortal.idle_time,
        });
        const mailUser = process.env.EMAILDUMMY != '' ? process.env.EMAILDUMMY : currentApproval.OfficialEmail;
        // const mailUser = process.env.EMAILDUMMY != '' ? process.env.EMAILDUMMY : currentApproval.employee_email;
        const dataMail = {
            from: 'Pengajuan Uang Muka System',
            to: mailUser,
            subject: 'Pengajuan Uang Muka System - Non Perjalanan Dinas',
            employee_name_approver: currentApproval.EmployeeName,
            // employee_name_approver: currentApproval.employee_name,
            employee_name: trxNonduty.employee_name,
            department_name: trxNonduty.department_name,
            pum_number: trxNonduty.pum_number,
            um_value: formatRupiah2(totalAmountItem),
            status_data: trxNonduty.status_data,
            link: process.env.LINK_FRONTEND + "#/approval-pum-pjum/" + (
                await encryptString(
                    trxNonduty.id, // id header 
                    currentApproval.EmployeeId, // id user approval
                    currentApproval.EmployeeNIK, // nik user approval
                    // currentApproval.employee_pk, // id user approval
                    // currentApproval.employee_id, // nik user approval
                    token,
                )) + "",
        };

        let html = await ejs.renderFile("view/pumpjum/mailSuperiorApproval.ejs", {
            data: dataMail,
        });

        dataMail.html = html;
        await sendMailNew(dataMail);
        // end send mail
        return res.status(200).json({ message: 'Data berhasil dikirim' });
    } catch (error) {
        console.log(error)
        await query.rollback();
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1 ? error.message : 'Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT',
        });
    }
}

function terbilang(nilai) {
    const angka = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];

    nilai = Math.floor(nilai);

    if (nilai < 12) {
        return angka[nilai];
    } else if (nilai < 20) {
        return terbilang(nilai - 10) + " Belas";
    } else if (nilai < 100) {
        return terbilang(Math.floor(nilai / 10)) + " Puluh " + terbilang(nilai % 10);
    } else if (nilai < 200) {
        return "Seratus " + terbilang(nilai - 100);
    } else if (nilai < 1000) {
        return terbilang(Math.floor(nilai / 100)) + " Ratus " + terbilang(nilai % 100);
    } else if (nilai < 2000) {
        return "Seribu " + terbilang(nilai - 1000);
    } else if (nilai < 1000000) {
        return terbilang(Math.floor(nilai / 1000)) + " Ribu " + terbilang(nilai % 1000);
    } else if (nilai < 1000000000) {
        return terbilang(Math.floor(nilai / 1000000)) + " Juta " + terbilang(nilai % 1000000);
    } else if (nilai < 1000000000000) {
        return terbilang(Math.floor(nilai / 1000000000)) + " Miliar " + terbilang(nilai % 1000000000);
    } else if (nilai < 1000000000000000) {
        return terbilang(Math.floor(nilai / 1000000000000)) + " Triliun " + terbilang(nilai % 1000000000000);
    } else {
        return "Nilai terlalu besar";
    }
}

function ucwords(str) {
  return str
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase());
}

export const syncTax = async (req, res) => {
    const trx = await db.transaction();
    try {
        const pumRows = await trx("dbPortalFA.dbo.trx_nonduty_detail").distinct("pum_number");

        for (const { pum_number } of pumRows) {
            const detailPajakList = await trx("dbPortalFA.dbo.trx_nonduty_detail")
                .select("pum_number", "jenis_pajak", "tarif", "tax_based", "tax_amount", "tax_amount_system")
                .where("pum_number", pum_number)
                .whereNotNull("jenis_pajak")
                .whereNotNull("tarif")
                .whereNotNull("tax_based");

            for (const detail of detailPajakList) {
                const existing = await trx("dbPortalFA.dbo.trx_nonduty_detail_tax")
                    .where("pum_number", detail.pum_number)
                    .andWhere("jenis_pajak", detail.jenis_pajak)
                    .first();

                if (!existing) {
                    await trx("dbPortalFA.dbo.trx_nonduty_detail_tax").insert({
                        pum_number: detail.pum_number,
                        jenis_pajak: detail.jenis_pajak,
                        tarif: detail.tarif,
                        tax_based: detail.tax_based,
                        tax_amount: detail.tax_amount,
                        tax_amount_system: detail.tax_amount_system,
                        created_date: new Date()
                    });
                }
            }

            const allDetails = await trx("dbPortalFA.dbo.trx_nonduty_detail")
                .select("amount")
                .where("pum_number", pum_number);

            const totalAmount = allDetails.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

            const negativeTaxes = await trx("dbPortalFA.dbo.trx_nonduty_detail_tax")
                .select("tax_amount", "tarif")
                .where("pum_number", pum_number)
                .andWhere("tarif", "<", 0);

            const updatePayload = { total_amount: totalAmount };

            if (negativeTaxes.length > 0) {
                const totalNegativeTax = negativeTaxes.reduce((sum, tax) => {
                    return sum + Math.abs(parseFloat(tax.tax_amount || 0));
                }, 0);
                updatePayload.tc_amount = totalAmount - totalNegativeTax;
            } else {
                updatePayload.tc_amount = totalAmount;
            }

            await trx("dbPortalFA.dbo.trx_nonduty_header")
                .where("pum_number", pum_number)
                .update(updatePayload);
        }

        await trx.commit();
        console.log("Sync tax selesai.");
        return res.status(200).json({ message: 'Data berhasil disinkronkan' });

    } catch (error) {
        console.error(error);
        await trx.rollback();
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1 ? error.message : 'Aplikasi sedang mengalami gangguan, silakan hubungi tim IT',
        });
    }
};

export const syncTaxCode = async (req, res) => {
    const trx = await db.transaction();
    try {
        // Ambil semua data dengan tax_code yang null
        const taxRecordsToUpdate = await trx("dbPortalFA.dbo.trx_nonduty_detail_tax")
            .select("id", "jenis_pajak")
            .whereNull("tax_code");

        if (taxRecordsToUpdate.length > 0) {
            // Call WSA untuk mendapatkan semua data tax master
            const args = {
                parDomain: 120,
                parTaxCode: "",
            };
            
            let callWsa;
            let resWsa;
            
            try {
                callWsa = await getWSA(process.env.WSA, "getDBCTaxMstr", args);
                resWsa = callWsa?.tt_tx2_mstr?.tt_tx2_mstrRow || null;

                if (resWsa && Array.isArray(resWsa)) {
                    // Filter dan mapping data dari WSA
                    const mappedWSAData = resWsa
                        .filter(item => item?.tx2_tax_code)
                        .map(item => ({
                            tax_code: item?.tx2_tax_code ? item.tx2_tax_code : null,
                            tax_usage: item?.tx2_tax_usage ? item.tx2_tax_usage : null,
                            tax_type: item?.tx2_tax_type ? item.tx2_tax_type : null,
                            tax_class: item?.tx2_pt_taxc ? item.tx2_pt_taxc : null,
                            tax_acct: item?.tx2_ap_acct ? item.tx2_ap_acct : null,
                        }));

                    // Update setiap record yang tax_code nya null
                    for (const record of taxRecordsToUpdate) {
                        // Cari matching data berdasarkan jenis_pajak === tx2_tax_usage
                        const matchingWSAData = mappedWSAData.find(wsaItem => 
                            wsaItem.tax_usage === record.jenis_pajak
                        );

                        if (matchingWSAData) {
                            await trx("dbPortalFA.dbo.trx_nonduty_detail_tax")
                                .where("id", record.id)
                                .update({
                                    tax_code: matchingWSAData.tax_code,
                                    tax_type: matchingWSAData.tax_type,
                                    tax_class: matchingWSAData.tax_class,
                                    tax_acct: matchingWSAData.tax_acct,
                                });
                        }
                    }
                }
            } catch (wsaError) {
                console.error("Error calling WSA:", wsaError);
                throw wsaError;
            }
        }

        await trx.commit();
        return res.status(200).json({ message: 'Data berhasil disinkronkan' });

    } catch (error) {
        console.error(error);
        await trx.rollback();
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1 ? error.message : 'Aplikasi sedang mengalami gangguan, silakan hubungi tim IT',
        });
    }
};
