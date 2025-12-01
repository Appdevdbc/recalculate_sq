import { db, dbDbcHris, dbHris, linked_dbDbcHris } from '../../../config/db.js';
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import dayjs from 'dayjs';
import { formatRupiah2, encryptString, useEncrypt } from '../../../helpers/utils.js';
import { sendMailNew } from "../../../helpers/mail.js";
import pdfTemplate from '../../../helpers/pdfTemplate.js';
import handlebars from "handlebars";
import ejs from "ejs";

dotenv.config();

// Get List of Non Perjalanan dinas
export const PUMPJUM_NonPerjalananDinasTaxList = async (req, res) => {
    const { rowsPerPage, page } = req.query;

    const domain = req.query.domain || req.body.domain || req.params.domain;
    const sortBy = req.query.sortBy || 'created_date';
    const sort = req.query.descending === "true" ? "desc" : "asc";

    if (!domain) {
        return res.status(400).json({ error: 'Missing domain parameter' });
    }

    try {
        let response;
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
                "ndt.is_taxable",
                db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                db.raw("COALESCE(usr.user_name, NULL) as created_name"),
            )
            .leftJoin("dbPortalFA.dbo.users as usr", "ndt.created_by", "=", "usr.user_nik")
            .leftJoin("dbPortalFA.dbo.domain as dom", "ndt.domain", "=", "dom.domain_code")
            .where("ndt.domain", domain)
            .where("ndt.is_taxable", 1)
            .modify((query) => {
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere("dom.domain_shortname", "like", search)
                            .orWhere("ndt.perihal", "like", search)
                            .orWhere("ndt.status_data", "like", search)
                            .orWhere("usr.user_name", "like", search)
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
                "ndt.status_data",
                "ndt.created_by",
                "ndt.created_date",
                "ndt.is_taxable",
                db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
                db.raw("COALESCE(usr.user_name, NULL) as created_name"),
            )
            .leftJoin("dbPortalFA.dbo.users as usr", "ndt.created_by", "=", "usr.user_nik")
            .leftJoin("dbPortalFA.dbo.domain as dom", "ndt.domain", "=", "dom.domain_code")
            .where("ndt.domain", domain)
            .where("ndt.is_taxable", 1)
            .whereExists(function () {
                this.select("*")
                    .from("dbPortalFA.dbo.trx_nonduty_approval as appr")
                    .whereRaw("appr.pum_number = ndt.pum_number")
                    .whereIn("appr.status_data", ["Approved Finance Checker", "Pending Approval Tax"]);
            })
            .modify((query) => {
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere("dom.domain_shortname", "like", search)
                            .orWhere("ndt.perihal", "like", search)
                            .orWhere("ndt.status_data", "like", search)
                            .orWhere("usr.user_name", "like", search)
                            .orWhere("ndt.pum_number", "like", search);
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

export const PUMPJUM_NonPerjalananDinasTaxDetail = async (req, res) => {
    const domain = req.query.domain || req.body.domain || req.params.domain;
    try {
        let response;
        // Validate if request has Query rowsPerPage
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

export const PUMPJUM_NonPerjalananDinasTaxSave = async (req, res) => {
    const query = await db.transaction();
    try {
        if (!Array.isArray(req.body.data) || req.body.data.length === 0) {
            return res.status(400).json({ success: false, message: "Data kosong atau tidak valid" });
          }

        const cleanValue = value => {
          const num = parseFloat(value);
          return Number.isInteger(num) ? num.toString() : num.toFixed(2);
        };
        const detailData = await Promise.all(req.body.data.map(async item => {
            const getItem = await db("dbPortalFA.dbo.trx_nonduty_detail as dtl").select('dtl.*').where('dtl.id', item.id).first();
            if (!getItem) {
                await query.rollback();
                return res.status(400).json({ message: 'Item tidak ditemukan' });
            }

            const amount = parseFloat(cleanValue(getItem.amount));
            const tarif = parseFloat(cleanValue(item.tarif));
            const dpp = parseFloat(cleanValue(item.dpp));
            const tax = parseFloat(cleanValue(item.tax));
            const tax_amount_system = parseFloat(((tarif * dpp) / 100).toFixed(2));
            const tcamount = tarif < 0 ? amount - Math.abs(tax) : amount + tax;
            return {
                id: item.id,
                no_data: item.line_item,
                jenis_pajak: item.jenis_pajak,
                tarif,
                dpp,
                tax,
                tax_amount_system,
                tcamount,
                updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            };
        }));

        await Promise.all(
            detailData.map(item =>
                query("dbPortalFA.dbo.trx_nonduty_detail")
                .where("id", item.id)
                .update({
                    no_data: item.no_data,
                    jenis_pajak: item.jenis_pajak,
                    tarif: item.tarif,
                    tax_based: item.dpp,
                    tax_amount: item.tax,
                    tax_amount_system: item.tax_amount_system,
                    tc_amount: Math.round(item.tcamount),
                    updated_date: item.updated_date,
                })
            )
        );
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

const handleActionNonPerjalananDinasTax = async (query, data) => {
    let pum_number = null;
    let totalPotongan = 0;
    const taxList = [];

    const cleanValue = value => {
        const num = parseFloat(value);
        return Number.isInteger(num) ? num.toString() : num.toFixed(2);
    };

    // Update atau insert tax
    await Promise.all(data.map(async item => {
        pum_number = item.pum_number;

        const tarif = parseFloat(cleanValue(item.tarif));
        const dpp = parseFloat(cleanValue(item.dpp));
        const tax = parseFloat(cleanValue(item.tax));
        const tax_amount_system = parseFloat(((tarif * dpp) / 100).toFixed(2));

        const payload = {
            pum_number: item.pum_number,
            jenis_pajak: item.jenis_pajak,
            tarif,
            tax_based: dpp,
            tax_amount: tax,
            tax_amount_system,
            tax_code: item.tax_code,
            tax_type: item.tax_type,
            tax_class: item.tax_class,
            tax_acct: item.tax_acct,
            [item.tax_id ? 'updated_date' : 'created_date']: dayjs().format("YYYY-MM-DD HH:mm:ss")
        };

        if (item.tax_id) {
            await query("dbPortalFA.dbo.trx_nonduty_detail_tax")
                .where("id", item.tax_id)
                .update(payload);
            taxList.push(item.tax_id);
        } else {
            const inserted = await query("dbPortalFA.dbo.trx_nonduty_detail_tax")
                .insert(payload)
                .returning("id");

            const newId = Array.isArray(inserted) ? inserted[0]?.id ?? inserted[0] : inserted;
            taxList.push(newId);
        }

        // Tambahkan ke totalPotongan hanya jika tarif negatif
        if (tarif < 0) {
            totalPotongan += Math.abs(tax);
        }
    }));

    // Hapus tax yang tidak ada dalam payload
    const existingTaxes = await query("dbPortalFA.dbo.trx_nonduty_detail_tax")
        .select("id")
        .where("pum_number", pum_number);

    const existingIds = existingTaxes.map(t => t.id);
    const idsToDelete = existingIds.filter(id => !taxList.includes(id));

    if (idsToDelete.length > 0) {
        await query("dbPortalFA.dbo.trx_nonduty_detail_tax")
        .whereIn("id", idsToDelete)
        .del();
    }

    // Update tc_amount
    const allDetails = await query("dbPortalFA.dbo.trx_nonduty_detail")
            .select("amount")
            .where("pum_number", pum_number);

    if (allDetails.length > 0) {
        const total_amount = allDetails.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

        if (totalPotongan > 0) {
            const tc_amount = Math.round(total_amount - totalPotongan);
            await query("dbPortalFA.dbo.trx_nonduty_header")
                .where("pum_number", pum_number)
                .update({ total_amount, tc_amount });
        } else {
            await query("dbPortalFA.dbo.trx_nonduty_header")
                .where("pum_number", pum_number)
                .update({ total_amount, tc_amount: total_amount });
        }
    } else {
        await query.rollback();
        return res.status(400).json({ message: `Item pada pum number ${pum_number} tidak ditemukan` });
    }

    return { pum_number };
};

export const PUMPJUM_NonPerjalananDinasTaxSaveNew = async (req, res) => {
    const query = await db.transaction();
    try {
        if (!Array.isArray(req.body.data) || req.body.data.length === 0) {
            return res.status(400).json({ success: false, message: "Data kosong atau tidak valid" });
        }

        await handleActionNonPerjalananDinasTax(query, req.body.data);

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

export const PUMPJUM_NonPerjalananDinasDetailUMTax = async (req, res) => {
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

export const PUMPJUM_NonPerjalananDinasDetailUMTaxNew = async (req, res) => {
    try {
        let response;
        // Validate if request has Query rowsPerPage
        response = await db("dbPortalFA.dbo.trx_nonduty_detail_tax as tax")
            .select('tax.*')
            .where('tax.pum_number', req.query.pum_number)

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

export const PUMPJUM_NonPerjalananDinasTaxItemList = async (req, res) => {
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

export const PUMPJUM_NonPerjalananDinasTaxApproval = async (req, res) => {
    const query = await db.transaction();
    try {
        const { id } = req.body;

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

        if (!Array.isArray(req.body.data) || req.body.data.length === 0) {
            return res.status(400).json({ success: false, message: "Data kosong atau tidak valid" });
        }

        // const cleanValue = value => {
        //     const num = parseFloat(value);
        //     return Number.isInteger(num) ? num.toString() : num.toFixed(2);
        // };
        // const detailData = await Promise.all(req.body.data.map(async (item) => {
        //     const getItem = await db("dbPortalFA.dbo.trx_nonduty_detail as dtl").select('dtl.*').where('dtl.id', item.id).first();
        //     if (!getItem) {
        //         await query.rollback();
        //         return res.status(400).json({ message: 'Item tidak ditemukan' });
        //     }

        //     const amount = parseFloat(cleanValue(getItem.amount));
        //     const tarif = parseFloat(cleanValue(item.tarif));
        //     const dpp = parseFloat(cleanValue(item.dpp));
        //     const tax = parseFloat(cleanValue(item.tax));
        //     const tax_amount_system = parseFloat(((tarif * dpp) / 100).toFixed(2));
        //     const tcamount = tarif < 0 ? amount - Math.abs(tax) : amount + tax;

        //     return {
        //         id: item.id,
        //         no_data: item.line_item,
        //         jenis_pajak: item.jenis_pajak,
        //         tarif,
        //         dpp,
        //         tax,
        //         tax_amount_system,
        //         tcamount,
        //         updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        //     };
        // }));

        // await Promise.all(detailData.map(async (item) => {
        //     const payload = {
        //         no_data: item.no_data,
        //         jenis_pajak: item.jenis_pajak,
        //         tarif: item.tarif,
        //         tax_based: item.dpp,
        //         tax_amount: item.tax,
        //         tax_amount_system: item.tax_amount_system,
        //         tc_amount: item.tcamount,
        //         updated_date: item.updated_date,
        //     }
        //     await db("dbPortalFA.dbo.trx_nonduty_detail")
        //     .where("id", item.id)
        //     .update(payload)
        // }));

        await handleActionNonPerjalananDinasTax(query, req.body.data);

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

        const trxNonduty = await query("dbPortalFA.dbo.trx_nonduty_header as ndt")
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
            console.log(trxNonduty, 'TEEEEs')
        if (!trxNonduty) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal amelakukan penyimpanan data, silahkan hubungi Tim IT' });
        }
        if (!['Fully Approved Superior', 'Draft Tax', 'Revision Tax'].includes(trxNonduty.status_data)) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal amelakukan penyimpanan data, silahkan hubungi Tim IT' });
        }

        const trxNondutyDetail = await query("dbPortalFA.dbo.trx_nonduty_detail as dtl")
            .select(
                "dtl.id",
                "dtl.pum_number",
                "dtl.date",
                "dtl.no_data",
                "dtl.no_po",
                "dtl.description",
                "dtl.currency",
                "dtl.amount",
                "dtl.jenis_pajak",
                "dtl.tarif",
                "dtl.tax_based",
                "dtl.tax_amount",
                "dtl.tax_amount_system",
                "dtl.tc_amount",
            )
            .where("dtl.pum_number", trxNonduty.pum_number);
        if (trxNondutyDetail && trxNondutyDetail.length === 0) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal amelakukan penyimpanan data, silahkan hubungi Tim IT' });
        }

        const userTaxAndFaApprover = await query('dbPortalFA.dbo.mstr_pic_app as app')
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
            status_data: 'Pending Approval Tax',
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
};

export const PUMPJUM_NonPerjalananDinasTaxPdf = async (req, res) => {
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

        data.approver_tax = await db("dbPortalFA.dbo.trx_nonduty_approval as a")
            .select(
                'c.employee_id', db.raw('dbo.InitCap(c.employee_name) as approver_name'), 'c.employee_nm_pos as approver_position', db.raw("CONVERT(varchar, a.created_date, 120) as approve_date")
            )
            .leftJoin("dbPortalFA.dbo.mstr_pic_app as b", "a.created_by", "=", "b.employee_id")
            .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as c`), "a.created_by", "=", "c.employee_id")
            .where('b.type_approval_id', 'like', '%Tax%')

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

// Revision
export const PUMPJUM_NonPerjalananDinasTaxRevision = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            id,
            reason,
        } = req.body;
        const user = await dbDbcHris("AppDB_DBC_HRIS.dbo.T_DBC_Employee")
            .where("EmployeeId", req.body.empid)
            .first();
        // const user = await dbDbcHris("dbHRIS_newer.dbo.master_employee")
        //     .where('employee_pk', req.body.empid)
        //     .first();

        if(!user) {
            await query.rollback();
            return res.status(400).json({ message: 'Invalid user, silahkan hubungi Tim IT' });
        }
        const empid = user.EmployeeNIK;
        // const empid = user.employee_id;

        const header = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
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

        const trxNondutyDetail = await db("dbPortalFA.dbo.trx_nonduty_detail as dtl")
            .select(
                "dtl.id",
                "dtl.pum_number",
                "dtl.date",
                "dtl.no_data",
                "dtl.no_po",
                "dtl.description",
                "dtl.currency",
                "dtl.amount",
                "dtl.jenis_pajak",
                "dtl.tarif",
                "dtl.tax_based",
                "dtl.tax_amount",
                "dtl.tax_amount_system",
                "dtl.tc_amount",
            )
            .where("dtl.pum_number", trxNonduty.pum_number);
        if (trxNondutyDetail && trxNondutyDetail.length === 0) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal amelakukan penyimpanan data, silahkan hubungi Tim IT' });
        }

        if (['Pending Approval Tax'].includes(trxNonduty.status_data)) {
            const employeeCurrentApprover = await dbDbcHris("AppDB_DBC_HRIS.dbo.T_DBC_Employee")
                .where("EmployeeNIK", trxNonduty.approval_fa_tax_nik)
                .first();
            // const employeeCurrentApprover = await dbDbcHris("dbHRIS_newer.dbo.master_employee")
            //     .where("employee_id", trxNonduty.approval_fa_tax_nik)
            //     .first();

            if (!employeeCurrentApprover) {
                await query.rollback();
                return res.status(400).json({ message: 'Gagal melakukan request revisi, user tidak ditemukan' });
            }

            const isCurrentApprover = trxNonduty.approval_fa_tax_nik === user.EmployeeNIK;
            // const isCurrentApprover = trxNonduty.approval_fa_tax_nik === user.employee_id;
            if (!isCurrentApprover) {
                await query.rollback();
                return res.status(400).json({ message: 'Gagal melakukan request revisi' });
            }

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

            await query("dbPortalFA.dbo.trx_nonduty_header")
            .where ("id", id)
            .update({
                status_data: 'Revision Tax',
                feedback_notes: reason,
                updated_by: empid, 
                updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            }); 
            
            // store history approval
            const payloadHistory = {
                domain: parseInt(trxNonduty.domain || 0),
                pum_number: trxNonduty.pum_number,
                status_data: 'Revision Tax',
                feedback_notes: reason,
                created_by: empid,
                created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            }
            await query("dbPortalFA.dbo.trx_nonduty_approval").insert(payloadHistory);

            // send mail
            const promises = userTaxOficcer.map(async (v) => {
                const mailUser = process.env.EMAILDUMMY != '' ? process.env.EMAILDUMMY : v.employee_email;
                let totalAmountItem = trxNondutyDetail.reduce((acc, item) => acc + (item.amount || 0), 0);
                const dataMail = {
                    from: 'Pengajuan Uang Muka System',
                    to: mailUser,
                    subject: 'Pengajuan Uang Muka System - Revisi PUM Perjalanan Dinas',
                    employee_name_approver: v.employee_name,
                    employee_name: trxNonduty.employee_name,
                    department_name: trxNonduty.department_name,
                    pum_number: trxNonduty.pum_number,
                    um_value: formatRupiah2(totalAmountItem),
                    status_data: 'Revision Tax',
                    feedback_notes: reason,
                    link: `${process.env.LINK_FRONTEND}/#/pum-pjum/proses-non-perjalanan-dinas-tax-edit/${useEncrypt(String(trxNonduty.id))}`,
                };

                let html = await ejs.renderFile("view/pumpjum/mailNonPerjalananDinasTaxRevision.ejs", {
                    data: dataMail,
                });

                dataMail.html = html;
                await sendMailNew(dataMail);
            }); await Promise.all(promises);
            // end send mail

            await query.commit();
            return res.status(200).json({ message: 'Data berhasil diupdate' });
        } else {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal melakukan request revisi, silahkan hubungi tim IT' });
        }
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
export const PUMPJUM_NonPerjalananDinasTaxReject = async (req, res) => {
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

        if(!user) {
            await query.rollback();
            return res.status(400).json({ message: 'Invalid user, silahkan hubungi Tim IT' });
        }

        const empid = user.EmployeeNIK;
        // const empid = user.employee_id;

        const trxNonduty = await db("dbPortalFA.dbo.trx_nonduty_header")
                                    .select("status_data", "domain", "pum_number", "approval_nik")
                                    .where('id', id)
                                    .first();
                                    
        if (!trxNonduty) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal melakukan reject, silahkan hubungi Tim IT' });
        }

        if (['Pending Approval', 'Partially Approved Superior'].includes(trxNonduty.status_data)) {
            const employeeCurrentApprover = await dbDbcHris("AppDB_DBC_HRIS.dbo.T_DBC_Employee")
                .where("EmployeeNIK", trxNonduty.approval_nik)
                .first();
            // const employeeCurrentApprover = await dbDbcHris("dbHRIS_newer.dbo.master_employee")
            //     .where("employee_id", trxNonduty.approval_nik)
            //     .first();

            if (!employeeCurrentApprover) {
                await query.rollback();
                return res.status(400).json({ message: 'Gagal melakukan reject, silahkan hubungi tim IT' });
            }

            const isCurrentApprover = trxNonduty.approval_nik === user.EmployeeNIK;
            // const isCurrentApprover = trxNonduty.approval_nik === user.employee_id;
            if (!isCurrentApprover) {
                await query.rollback();
                return res.status(400).json({ message: 'Gagal melakukan reject, silahkan hubungi tim IT' });
            }

            await query("dbPortalFA.dbo.trx_nonduty_header")
            .where ("id", id)
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
    
            await query.commit();
            return res.status(200).json({ message: 'Data berhasil diupdate' });
        } else {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal melakukan reject, silahkan hubungi tim IT' });
        }
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