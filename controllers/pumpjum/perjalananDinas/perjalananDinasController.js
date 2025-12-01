import { validationResult } from 'express-validator';
import { db, dbDbcHris, dbFINHris, linked_dbDbcHris, } from '../../../config/db.js';
import * as dotenv from 'dotenv';
import dayjs from 'dayjs';
import { uploadFileWithParams, downloadFileWithParams } from "../../../helpers/ftp.js";
import { unlink } from 'node:fs';
import fs from 'fs';
import pdfTemplate from '../../../helpers/pdfTemplate.js';
import { terbilang, capitalize, formatRupiah2, encryptString, useEncrypt, formatRupiah } from '../../../helpers/utils.js';
import { sendMailNew } from "../../../helpers/mail.js";
import ejs from "ejs";
import { generatePumNumber, generatePumNumberWithLastMasterNumber } from '../generalController.js';
import { inbound_supp_inv, inbound_pettycash_perjalanan_dinas } from "../../../helpers/inbound.js";
dotenv.config();

// Get List of Perjalanan dinas pengajuan
export const PUMPJUM_PerjalananDinasPengajuanList = async (req, res) => {
    const { rowsPerPage, page, empid } = req.query;
    const domain = req.query.domain || req.body.domain || req.params.domain;
    const type = req.query.type || null;
    const sortBy = req.query.sortBy || 'OnDutyStartDate';
    const sort = req.query.descending === "true" ? "desc" : "asc";

    if (!domain) {
        return res.status(400).json({ error: 'Missing domain parameter' });
    }
    if (!type) {
        return res.status(400).json({ error: 'Missing type parameter' });
    }

    const dbConn = process.env.DB6_DATABASE ? dbFINHris : db;
    const dbname = process.env.DB6_DATABASE ? 'AppDB_FIN_HRIS' : 'dbPortalFA';
    const database = type === 'KARYAWAN' ? `${dbname}.dbo.T_ATT_OnDuty_Declaration`: `${dbname}.dbo.T_ATT_OnDuty_Declaration_OS`;
    try {
        let response;
        let employeeNIKList = [];

        if (type !== 'KARYAWAN') {
            const domainRow = await db('dbPortalFA.dbo.domain')
                .select("domain_shortname")
                .where("domain_code", domain)
                .first();

            if (domainRow) {
                const shortname = domainRow.domain_shortname;
                if (process.env.DB6_DATABASE) {
                    const hrisRows = await dbConn('AppDB_FIN_HRIS.dbo.T_EMP_Employee_OS')
                    .select("EmployeeNIK")
                    .where("BusinessUnitCode", shortname);
                    employeeNIKList = hrisRows.map((row) => row.EmployeeNIK);
                } else {
                    const hrisRows = await dbDbcHris('dbHRIS_newer.dbo.master_employee')
                    .select("employee_id")
                    .where("employee_bu_id", shortname);
                    employeeNIKList = hrisRows.map((row) => row.employee_id);
                }

            }
        }

        const excludedRequestNosRows = await db('dbPortalFA.dbo.trx_onduty')
            .select("on_duty_number")
            .whereIn("status_data", [
                "Pending Proses AP",
                "Cancel",
                "Processed AP",
                "Created QAD",
                "Closed"
            ]);

        const excludedRequestNos = excludedRequestNosRows.map(row => row.on_duty_number);
        const pages = Math.abs(Math.floor(parseInt(page)));
        response = await dbConn(`${database} as att`)
            .select(
                "att.OnDutyRequestNo",
                "att.OnDutyType",
                "att.DDKType",
                "att.EmployeeNIK",
                "att.DivisionName",
                "att.DepartmentName",
                "att.OnDutyStartDate",
                "att.OnDutyClaimValue",
                "att.OnDutyStatus",
                "att.OnDutyClaimItemCode",
                dbConn.raw("CONCAT(att.EmployeeNIK, ' - ', att.EmployeeName) as EmployeeName")
            )
            .where("att.OnDutyStatus", "Fully Approved")
            .where("att.OnDutyClaimItemCode", "ODAL000")
            .modify((query) => {
                if (process.env.START_PENGAJUAN && process.env.START_PENGAJUAN !== '') {
                    query.where("att.OnDutyStartDate", ">=", process.env.START_PENGAJUAN);
                }
                if (excludedRequestNos.length > 0) {
                    query.whereNotIn("att.OnDutyRequestNo", excludedRequestNos);
                }
                if (type === 'KARYAWAN') {
                    query.where("att.EmployeeId", empid);
                } else {
                    if (employeeNIKList.length > 0) {
                        query.whereIn("att.EmployeeNIK", employeeNIKList);
                    } else {
                        query.whereRaw("1 = 0");
                    }
                }

                if (req.query.filter) {
                    query.where(function () {
                        const search = `%${req.query.filter}%`;
                        this.orWhere("att.OnDutyType", "like", search)
                        .orWhere("att.OnDutyRequestNo", "like", search)
                        .orWhere("att.DDKType", "like", search)
                        .orWhere("att.EmployeeNIK", "like", search)
                        .orWhere("att.DivisionName", "like", search)
                        .orWhere("att.OnDutyStatus", "like", search)
                        .orWhere("att.EmployeeName", "like", search)
                        .orWhere("att.OnDutyClaimItemCode", "like", search);
                    });
                }
                if (type === 'OS') {
                    if (req.query.sortBy) {
                        query.orderBy(sortBy, sort);
                    } else {
                        query
                            .orderByRaw("CONCAT(att.EmployeeName, ' - ', att.EmployeeNIK) ASC")
                            .orderBy(sortBy, sort);
                    }
                } else {
                    query.orderBy(sortBy, sort);
                }
            })
            // .orderBy(sortBy, sort)
            .paginate({
                perPage: Math.abs(Math.floor(parseInt(rowsPerPage, 10))),
                currentPage: pages,
                isLengthAware: true,
            });

        const employeeNIKs = [...new Set(response.data.map(item => item.EmployeeNIK))];
        let employeeRows = [];
        let employeeBUIds = [];
        const employeeMap = {};
        if (process.env.DB6_DATABASE) {
            const tablename = type === 'KARYAWAN' ? 'T_EMP_Employee': 'T_EMP_Employee_OS';
            employeeRows = await dbConn(`AppDB_FIN_HRIS.dbo.${tablename}`)
                .select("EmployeeNIK", "BusinessUnitCode")
                .whereIn("EmployeeNIK", employeeNIKs);
                
            employeeRows.forEach(emp => {
                employeeMap[emp.EmployeeNIK] = emp.BusinessUnitCode;
            });
            employeeBUIds = [...new Set(employeeRows.map(emp => emp.BusinessUnitCode))];
        } else {
            employeeRows = await dbDbcHris('dbHRIS_newer.dbo.master_employee')
                .select('employee_id', 'employee_bu_id')
                .whereIn('employee_id', employeeNIKs);

            employeeRows.forEach(emp => {
                employeeMap[emp.employee_id] = emp.employee_bu_id;
            });
            employeeBUIds = [...new Set(employeeRows.map(emp => emp.employee_bu_id))];
        }

        const domainRows = await db('dbPortalFA.dbo.domain')
            .select('domain_shortname', 'domain_code')
            .whereIn('domain_shortname', employeeBUIds);
        const domainMap = {};
        domainRows.forEach(d => {
            domainMap[d.domain_shortname] = d.domain_code;
        });

        let editableIndexes = [];
        let pendingProcess = [];
        let firstItemIndexOnPage = 0;
        let pendingProcessMap = {};
        let editableIndexMap = {};
        let editableRequestNoMap = {};

        if (type === 'KARYAWAN') {
            const employee = await dbDbcHris('dbHRIS_newer.dbo.master_employee')
                .select('employee_id', 'employee_bu_id')
                .where('employee_pk', empid)
                .first();

            pendingProcess = await db('dbPortalFA.dbo.trx_onduty')
                .select('on_duty_number', 'created_by', 'classification', 'status_data')
                .where('created_by', employee.employee_id)
                .where('classification', 'KARYAWAN')
                .whereIn('status_data', ['Draft', 'Pending Proses AP', 'Processed AP', 'Require Revision', 'Created QAD']);

            const pendingCount = pendingProcess.filter(v => ['Pending Proses AP', 'Processed AP', 'Require Revision', 'Created QAD'].includes(v.status_data)).length;

            const totalData = response.pagination.total ?? 0;
            const rowsPerPage = response.pagination.perPage ?? 10;
            const currentPage = pages ?? 1;

            const idxLast = totalData - 1;
            const idxSecondLast = totalData - 2;
            if (totalData > 0) {
                if (pendingCount === 0 && totalData >= 2) {
                editableIndexes = [idxSecondLast, idxLast];
                } else if (pendingCount === 1) {
                editableIndexes = [idxLast];
                } else if (pendingCount === 0 && totalData === 1) {
                    editableIndexes = [idxLast];
                }
            }

            firstItemIndexOnPage = (currentPage - 1) * rowsPerPage;
        } else {
            const allData = await dbConn(`${database} as att`)
                .select("att.OnDutyRequestNo", "att.EmployeeNIK", "att.OnDutyStartDate")
                .where("att.OnDutyStatus", "Fully Approved")
                .where("att.OnDutyClaimItemCode", "ODAL000")
                .modify((query) => {
                    if (process.env.START_PENGAJUAN && process.env.START_PENGAJUAN !== '') {
                        query.where("att.OnDutyStartDate", ">=", process.env.START_PENGAJUAN);
                    }
                    if (excludedRequestNos.length > 0) {
                        query.whereNotIn("att.OnDutyRequestNo", excludedRequestNos);
                    }
                    if (employeeNIKList.length > 0) {
                        query.whereIn("att.EmployeeNIK", employeeNIKList);
                    } else {
                        query.whereRaw("1 = 0");
                    }

                    if (req.query.filter) {
                        query.where(function () {
                            const search = `%${req.query.filter}%`;
                            this.orWhere("att.OnDutyType", "like", search)
                                .orWhere("att.OnDutyRequestNo", "like", search)
                                .orWhere("att.DDKType", "like", search)
                                .orWhere("att.EmployeeNIK", "like", search)
                                .orWhere("att.DivisionName", "like", search)
                                .orWhere("att.OnDutyStatus", "like", search)
                                .orWhere("att.EmployeeName", "like", search)
                                .orWhere("att.OnDutyClaimItemCode", "like", search);
                        });
                    }
                });

            const grouped = {};

            allData.forEach(item => {
                if (!grouped[item.EmployeeNIK]) grouped[item.EmployeeNIK] = [];
                grouped[item.EmployeeNIK].push(item);
            });

            const trxRows = await db('dbPortalFA.dbo.trx_onduty')
                .select('on_duty_number', 'employee_nik', 'created_by', 'classification', 'status_data')
                .where('classification', 'OS')
                .whereIn('employee_nik', employeeNIKList)
                .whereIn('status_data', ['Draft', 'Pending Proses AP', 'Processed AP', 'Require Revision', 'Created QAD']);

            trxRows.forEach(row => {
                if (!pendingProcessMap[row.employee_nik]) pendingProcessMap[row.employee_nik] = [];
                pendingProcessMap[row.employee_nik].push(row);
            });

            for (const empNik in grouped) {
                const rows = grouped[empNik];
                const trx = pendingProcessMap[empNik] || [];

                const filteredPending = trx.filter(r =>
                    ['Pending Proses AP', 'Processed AP', 'Require Revision', 'Created QAD'].includes(r.status_data)
                );

                const sorted = [...rows].sort((a, b) =>
                    new Date(a.OnDutyStartDate) - new Date(b.OnDutyStartDate)
                );

                const editableReqNos = [];
                if (filteredPending.length === 0 && sorted.length >= 2) {
                    editableReqNos.push(sorted[0].OnDutyRequestNo, sorted[1].OnDutyRequestNo);
                } else if (filteredPending.length === 0 && sorted.length === 1) {
                    editableReqNos.push(sorted[0].OnDutyRequestNo);
                } else if (filteredPending.length === 1 && sorted.length >= 1) {
                    editableReqNos.push(sorted[0].OnDutyRequestNo);
                }

                editableRequestNoMap[empNik] = editableReqNos;
            }
        }

        response.data = response.data.map((item, idx) => {
            const buId = employeeMap[item.EmployeeNIK];
            const domainCode = buId ? domainMap[buId] : null;

            let isDraft = false;
            let isEditable = false;
            let status_data = null;

            if (type === 'KARYAWAN') {
                isDraft = pendingProcess.some(v =>
                    v.on_duty_number === item.OnDutyRequestNo &&
                    v.status_data === 'Draft'
                );
                isEditable = editableIndexes.includes(firstItemIndexOnPage + idx);

                const match = pendingProcess.find(v =>
                    v.on_duty_number === item.OnDutyRequestNo
                );
                status_data = match ? match.status_data : null;
            } else {
                const trx = pendingProcessMap[item.EmployeeNIK] || [];
                isDraft = trx.some(v =>
                    v.on_duty_number === item.OnDutyRequestNo &&
                    v.status_data === 'Draft'
                );
                const editableList = editableRequestNoMap[item.EmployeeNIK] || [];
                isEditable = editableList.includes(item.OnDutyRequestNo);

                const match = trx.find(v =>
                    v.on_duty_number === item.OnDutyRequestNo
                );
                status_data = match ? match.status_data : null;
            }

            return {
                ...item,
                domain_shortname: buId || null,
                domain_code: domainCode || null,
                isEdit: isDraft || isEditable,
                status_data,
            };
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

// Get List of Perjalanan dinas proses pengajuan
export const PUMPJUM_PerjalananDinasProsesPengajuanList = async (req, res) => {
    const { rowsPerPage, page } = req.query;

    const domain = req.query.domain || req.body.domain || req.params.domain;
    const type = req.query.type || null;
    const sortBy = req.query.sortBy || 'created_date';
    const sort = req.query.descending === "true" ? "desc" : "asc";

    if (!domain) {
        return res.status(400).json({ error: 'Missing domain parameter' });
    }

    if (!type) {
        return res.status(400).json({ error: 'Missing type parameter' });
    }

    try {
        let response;

        const dbConn = process.env.DB6_DATABASE ? dbFINHris : db;

        let currentUser = null;
        if (type === 'KARYAWAN') {
            currentUser = await db("dbPortalFA.dbo.users")
                .select('user_nik')
                .where('user_id', req.query.empid)
                .first();

            if (!currentUser) {
                return res.status(400).json({ message: 'Invalid user, silahkan hubungi Tim IT' });
            }
        }

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db("dbPortalFA.dbo.trx_onduty as odt")
            .select(
                "odt.on_duty_number",
                "odt.on_duty_type",
                "odt.dkk_type",
                "odt.employee_nik",
                "odt.employee_name",
                "odt.division_name",
                "odt.department_name",
                "odt.on_duty_start_date",
                "odt.on_duty_value",
                "odt.on_duty_status",
                "odt.on_duty_claim_remark",
                "odt.status_data",
                db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
            )
            // .leftJoin("dbPortalFA.dbo.users as usr", "odt.employee_nik", "=", "usr.user_nik")
            // .leftJoin("dbPortalFA.dbo.domain as dom", "usr.user_domain", "=", "dom.domain_code")
            
            .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as usr`), "odt.employee_nik", "=", "usr.employee_id")
            .leftJoin("dbPortalFA.dbo.domain as dom", "usr.employee_bu_id", "=", "dom.domain_shortname")
            .where("odt.status_data", "Pending Proses AP")
            .where("odt.classification", type)
            .modify(async (query) => {
                if (type === 'KARYAWAN') {
                    const user = await db("dbPortalFA.dbo.users")
                                    .select('user_nik')
                                    .where('user_id', req.query.empid)
                                    .first()

                    if(!user) {
                        await query.rollback();
                        return res.status(400).json({ message: 'Invalid user, silahkan hubungi Tim IT' });
                    }
                    query.where("odt.employee_nik", user.user_nik);
                }
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere("odt.on_duty_type", "like", search)
                            .orWhere("odt.on_duty_number", "like", search)
                            .orWhere("odt.dkk_type", "like", search)
                            .orWhere("odt.employee_nik", "like", search)
                            .orWhere("odt.employee_name", "like", search)
                            .orWhere("odt.division_name", "like", search)
                            .orWhere("odt.department_name", "like", search)
                            .orWhere("odt.status_data", "like", search)
                            .orWhere("dom.domain_shortname", "like", search);
                    });
                }
            })
            .orderBy(sortBy, sort);
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db("dbPortalFA.dbo.trx_onduty as odt")
            .select(
                "odt.on_duty_number",
                "odt.on_duty_type",
                "odt.dkk_type",
                "odt.employee_nik",
                "odt.employee_name",
                "odt.division_name",
                "odt.department_name",
                "odt.on_duty_start_date",
                "odt.on_duty_value",
                "odt.on_duty_status",
                "odt.on_duty_claim_remark",
                "odt.status_data",
                // db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                // db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
            )
            // .leftJoin("dbPortalFA.dbo.users as usr", "odt.employee_nik", "=", "usr.user_nik")
            // .leftJoin("dbPortalFA.dbo.domain as dom", "usr.user_domain", "=", "dom.domain_code")
            
            // .innerJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as usr`), "odt.employee_nik", "=", "usr.employee_id")
            // .innerJoin("dbPortalFA.dbo.domain as dom", "usr.employee_bu_id", "=", "dom.domain_shortname")
            .whereIn("odt.status_data", ["Pending Proses AP", "Processed AP", "Created QAD", "Cancel", "Closed"])
            .where("odt.classification", type)
            .modify(async (query) => {
                if (type === 'KARYAWAN') {
                    query.where("odt.employee_nik", currentUser.user_nik);
                }
                if (req.query.filter_domain) {
                    query.where(function () {
                        this.where("odt.domain", req.query.filter_domain);
                    });
                }
                if (req.query.filter_status) {
                    query.where(function () {
                        this.where("odt.status_data", req.query.filter_status);
                    });
                }
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere("odt.on_duty_type", "like", search)
                            .orWhere("odt.on_duty_number", "like", search)
                            .orWhere("odt.dkk_type", "like", search)
                            .orWhere("odt.employee_nik", "like", search)
                            .orWhere("odt.employee_name", "like", search)
                            .orWhere("odt.division_name", "like", search)
                            .orWhere("odt.department_name", "like", search)
                            .orWhere("odt.status_data", "like", search)
                            // .orWhere("dom.domain_shortname", "like", search);
                    });
                }
            })
            .orderBy(sortBy, sort)
            .paginate({
                perPage: Math.abs(Math.floor(parseInt(rowsPerPage, 10))),
                currentPage: pages,
                isLengthAware: true,
            });

            const employeeNIKs = [...new Set(response.data.map(item => item.employee_nik))];
            let employeeRows = [];
            let employeeBUIds = [];
            const employeeMap = {};
            if (process.env.DB6_DATABASE) {
                const tablename = type === 'KARYAWAN' ? 'T_EMP_Employee': 'T_EMP_Employee_OS';
                employeeRows = await dbConn(`AppDB_FIN_HRIS.dbo.${tablename}`)
                    .select("EmployeeNIK", "BusinessUnitCode")
                    .whereIn("EmployeeNIK", employeeNIKs);
                    
                employeeRows.forEach(emp => {
                    employeeMap[emp.EmployeeNIK] = emp.BusinessUnitCode;
                });
                employeeBUIds = [...new Set(employeeRows.map(emp => emp.BusinessUnitCode))];
            } else {
                employeeRows = await dbDbcHris('dbHRIS_newer.dbo.master_employee')
                    .select('employee_id', 'employee_bu_id')
                    .whereIn('employee_id', employeeNIKs);

                employeeRows.forEach(emp => {
                    employeeMap[emp.employee_id] = emp.employee_bu_id;
                });
                employeeBUIds = [...new Set(employeeRows.map(emp => emp.employee_bu_id))];
            }

            const domainRows = await db('dbPortalFA.dbo.domain')
                .select('domain_shortname', 'domain_code')
                .whereIn('domain_shortname', employeeBUIds);
            const domainMap = {};
            domainRows.forEach(d => {
                domainMap[d.domain_shortname] = d.domain_code;
            });

            response.data = response.data.map(item => {
                const buId = employeeMap[item.employee_nik];
                const domainCode = buId ? domainMap[buId] : null;

                return {
                    ...item,
                    domain_shortname: buId || null,
                    domain_code: domainCode || null,
                };
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

// Get Detail of Perjalanan dinas
export const PUMPJUM_PerjalananDinasDetail = async (req, res) => {
    try {
    const type = req.query.type || null;
    if (!type) {
        return res.status(400).json({ error: 'Missing type parameter' });
    }
    const dbConn = process.env.DB6_DATABASE ? dbFINHris : db;
    const dbname = process.env.DB6_DATABASE ? 'AppDB_FIN_HRIS' : 'dbPortalFA';
    const database = type === 'KARYAWAN' ? `${dbname}.dbo.T_ATT_OnDuty_Declaration`: `${dbname}.dbo.T_ATT_OnDuty_Declaration_OS`;

    const OnDutyRequestNo = req.query.OnDutyRequestNo;

    let queryTrxOnduty = await db("dbPortalFA.dbo.trx_onduty as odt")
    .select(
      db.raw("COALESCE(odt.on_duty_number, NULL) as OnDutyRequestNo"),
      db.raw("COALESCE(odt.on_duty_type, NULL) as OnDutyType"),
      db.raw("COALESCE(odt.employee_nik, NULL) as EmployeeNIK"),
      db.raw("COALESCE(odt.employee_name, NULL) as EmployeeName"),
      db.raw("COALESCE(odt.division_name, NULL) as DivisionName"),
      db.raw("COALESCE(odt.department_name, NULL) as DepartmentName"),
      db.raw("COALESCE(odt.on_duty_start_date, NULL) as OnDutyStartDate"),
      db.raw("COALESCE(odt.on_duty_end_date, NULL) as OnDutyEndDate"),
      db.raw("COALESCE(odt.on_duty_value, NULL) as OnDutyClaimValue"),
      db.raw("COALESCE(odt.on_duty_status, NULL) as OnDutyStatus"),
      db.raw("COALESCE(odt.on_duty_claim_remark, NULL) as OnDutyClaimItemCode"),
      db.raw("COALESCE(odt.on_duty_approved_by, NULL) as LastStatusBy"),
      db.raw("COALESCE(odt.dkk_type, NULL) as DDKType"),
      db.raw("COALESCE(odt.on_duty_days, NULL) as OnDutyDays"),
      db.raw("COALESCE(odt.on_duty_destination, NULL) as OnDutyDestination"),
      db.raw("COALESCE(odt.file_attachment, NULL) as file_attachment"),
      db.raw("COALESCE(odt.feedback_notes, NULL) as feedback_notes"),
      db.raw("COALESCE(odt.acknowledged_by, NULL) as acknowledged_by"),
      db.raw("COALESCE(odt.approved_hr_by, NULL) as approved_hr_by"),
    //   db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
    //   db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
      db.raw("COALESCE(emp.employee_name, NULL) as on_duty_approved_by_name")
    )    
    // .innerJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as usr`), "odt.employee_nik", "=", "usr.employee_id")
    // .innerJoin("dbPortalFA.dbo.domain as dom", "usr.employee_bu_id", "=", "dom.domain_shortname")
    .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), "odt.on_duty_approved_by", "=", "emp.employee_id")
    .where("on_duty_number", OnDutyRequestNo)
    .first();
    if (queryTrxOnduty) {
        let employeeRows = null;
        if (process.env.DB6_DATABASE) {
            const tablename = type === 'KARYAWAN' ? 'T_EMP_Employee': 'T_EMP_Employee_OS';
            employeeRows = await dbConn(`AppDB_FIN_HRIS.dbo.${tablename}`)
                .select("EmployeeNIK", "BusinessUnitCode")
                .where("EmployeeNIK", queryTrxOnduty.EmployeeNIK)
                .first();
        } else {
            employeeRows = await dbDbcHris('dbHRIS_newer.dbo.master_employee')
                .select('employee_id', 'employee_bu_id')
                .where('employee_id', queryTrxOnduty.EmployeeNIK)
                .first();
        }

        if (employeeRows) {
            const domainRow = await db('dbPortalFA.dbo.domain')
                .select("domain_code", "domain_shortname")
                .where("domain_shortname", employeeRows.BusinessUnitCode)
                .first();
            queryTrxOnduty = {
                ...queryTrxOnduty,
                domain_code: domainRow ? domainRow.domain_code : null,
                domain_shortname: domainRow ? domainRow.domain_shortname : null,
            }
        }

        return res.json({
            message: "success",
            status: true,
            data: queryTrxOnduty,
          });
    }

    let query = await dbConn(`${database} as att`)
    .select(
        "att.OnDutyRequestNo",
        "att.OnDutyType",
        "att.EmployeeNIK",
        "att.EmployeeName",
        "att.DivisionName",
        "att.DepartmentName",
        "att.OnDutyStartDate",
        "att.OnDutyEndDate",
        "att.OnDutyClaimValue",
        "att.OnDutyStatus",
        "att.OnDutyClaimItemCode",
        "att.LastStatusBy",
        "att.DDKType",
        "att.OnDutyDays",
        "att.OnDutyDestination",
    )
    .where("OnDutyRequestNo", OnDutyRequestNo)
    .first();

    if (!query) {
        return res.status(400).json({ message: 'Data tidak ditemukan' });
    }

    let employeeBU = null;
    let buShortname = null;
    let domain = null;
    if (process.env.DB6_DATABASE) {
        const tablename = type === 'KARYAWAN' ? 'T_EMP_Employee': 'T_EMP_Employee_OS';
        employeeBU = await dbConn(`AppDB_FIN_HRIS.dbo.${tablename}`)
            .select("EmployeeNIK", "BusinessUnitCode")
            .where("EmployeeNIK", query.EmployeeNIK)
            .first();
        buShortname = employeeBU ? employeeBU.BusinessUnitCode : null;
    } else {
        employeeBU = await dbDbcHris('dbHRIS_newer.dbo.master_employee')
            .select('employee_id', 'employee_bu_id')
            .where('employee_id', query.EmployeeNIK)
            .first();
        buShortname = employeeBU ? employeeBU.employee_bu_id : null;
    }

    if (buShortname) {
        domain = await db('dbPortalFA.dbo.domain')
            .select("domain_code", "domain_shortname")
            .where("domain_shortname", buShortname)
            .first();
    }
    
    let approvedBy = null;
    if (query.LastStatusBy) {
        if (process.env.DB6_DATABASE) {
            const tablename = type === 'KARYAWAN' ? 'T_EMP_Employee': 'T_EMP_Employee';
            approvedBy = await dbConn(`AppDB_FIN_HRIS.dbo.${tablename}`)
                .select("EmployeeName")
                .where("EmployeeNIK", query.EmployeeNIK)
                .first();
            approvedBy = approvedBy ? approvedBy.EmployeeName : null;
        } else {
            approvedBy = await dbDbcHris('dbHRIS_newer.dbo.master_employee')
                .select('employee_name')
                .where('employee_id', query.LastStatusBy)
                .first();
            approvedBy = approvedBy ? approvedBy.employee_name : null;
        }
    }

    query = {
        ...query,
        domain_code: domain ? domain.domain_code : null,
        domain_shortname: domain ? domain.domain_shortname : null,
        on_duty_approved_by_name: approvedBy || null,
    };

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

// Get Detail of Proses Perjalanan dinas
export const PUMPJUM_PerjalananDinasProsesDetail = async (req, res) => {
    try {
      const on_duty_number = req.query.on_duty_number;

      let query = await db("dbPortalFA.dbo.trx_onduty as odt")
      .select(
        "odt.pum_number",
        "odt.on_duty_number",
        "odt.on_duty_type",
        "odt.dkk_type",
        "odt.employee_nik",
        "odt.employee_name",
        "odt.division_name",
        "odt.department_name",
        "odt.on_duty_start_date",
        "odt.on_duty_end_date",
        "odt.on_duty_value",
        "odt.on_duty_status",
        "odt.on_duty_claim_remark",
        "odt.on_duty_approved_by",
        "odt.on_duty_days",
        "odt.on_duty_destination",
        "odt.status_data",
        "odt.file_attachment",
        "odt.feedback_notes",
        "odt.classification",
        "odt.allocation_key",
        "odt.supplier_id",
        "odt.due_date_inv",
        "odt.payment_method_id",
        "odt.is_taxable",
        "odt.gl",
        "odt.subacc",
        "odt.inv_status",
        "odt.allocation_status",
        "odt.on_duty_value_ap",
        "odt.description",
        "odt.comment",
        "odt.own_bank_number",
        "odt.acknowledged_by",
        "odt.approved_hr_by",
        "qgl.gl_desc",
        "sub.subacc_desc",
        "pmn.method_name",
        db.raw("COALESCE(sup.vd_sort, NULL) as supplier_desc"),
        // db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
        // db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
        // db.raw("COALESCE(emp.employee_name, NULL) as on_duty_approved_by_name")
      )
    //   .leftJoin("dbPortalFA.dbo.users as usr", "odt.employee_nik", "=", "usr.user_nik")
    //   .leftJoin("dbPortalFA.dbo.domain as dom", "usr.user_domain", "=", "dom.domain_code")
    //   .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), "odt.on_duty_approved_by", "=", "emp.employee_id")
      .leftJoin("dbPortalFA.dbo.qad_gl as qgl", "odt.gl", "=", "qgl.gl_code")
      .leftJoin("dbPortalFA.dbo.qad_subacc as sub", "odt.subacc", "=", "sub.subacc_code")
      .leftJoin("dbPortalFA.dbo.mstr_payment_method as pmn", "odt.payment_method_id", "=", "pmn.method_code")
      .leftJoin("dbMaster.dbo.qad_supplier as sup", "odt.supplier_id", "=", "sup.vd_addr")
      .where("on_duty_number", on_duty_number)
      .first();
    
      if (query) {
          let employeeBU = null;
          let buShortname = null;
          let domain = null;
          if (process.env.DB6_DATABASE) {
              const tablename = query.classification === 'KARYAWAN' ? 'T_EMP_Employee': 'T_EMP_Employee_OS';
              employeeBU = await dbFINHris(`AppDB_FIN_HRIS.dbo.${tablename}`)
                  .select("EmployeeNIK", "BusinessUnitCode")
                  .where("EmployeeNIK", query.employee_nik)
                  .first();
              buShortname = employeeBU ? employeeBU.BusinessUnitCode : null;
          } else {
              employeeBU = await dbDbcHris('dbHRIS_newer.dbo.master_employee')
                  .select('employee_id', 'employee_bu_id')
                  .where('employee_id', query.employee_nik)
                  .first();
              buShortname = employeeBU ? employeeBU.employee_bu_id : null;
          }
      
          if (buShortname) {
              domain = await db('dbPortalFA.dbo.domain')
                  .select("domain_code", "domain_shortname")
                  .where("domain_shortname", buShortname)
                  .first();
          }
          
          let approvedBy = null;
          if (query.LastStatusBy) {
              if (process.env.DB6_DATABASE) {
                  const tablename = query.classification === 'KARYAWAN' ? 'T_EMP_Employee': 'T_EMP_Employee';
                  approvedBy = await dbFINHris(`AppDB_FIN_HRIS.dbo.${tablename}`)
                      .select("EmployeeName")
                      .where("EmployeeNIK", query.EmployeeNIK)
                      .first();
                  approvedBy = approvedBy ? approvedBy.EmployeeName : null;
              } else {
                  approvedBy = await dbDbcHris('dbHRIS_newer.dbo.master_employee')
                      .select('employee_name')
                      .where('employee_id', query.LastStatusBy)
                      .first();
                  approvedBy = approvedBy ? approvedBy.employee_name : null;
              }
          }
      
          query = {
              ...query,
              domain_code: domain ? domain.domain_code : null,
              domain_shortname: domain ? domain.domain_shortname : null,
              on_duty_approved_by_name: approvedBy || null,
          };
      }
  
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

// Save Perjalanan dinas
export const PUMPJUM_PerjalananDinasSave = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            domain,
            on_duty_number,
        } = req.body;

        const dokumen = req.files.upload ? req.files.upload[0].filename : null;
        const type = req.body.type || null;

        if (!type) {
            return res.status(400).json({ error: 'Missing type parameter' });
        }

        const dbConn = process.env.DB6_DATABASE ? dbFINHris : db;
        const dbname = process.env.DB6_DATABASE ? 'AppDB_FIN_HRIS' : 'dbPortalFA';
        const databaseName = type === 'KARYAWAN' ? `${dbname}.dbo.T_ATT_OnDuty_Declaration`: `${dbname}.dbo.T_ATT_OnDuty_Declaration_OS`;

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

        const trxOnduty = await db("dbPortalFA.dbo.trx_onduty")
                                    .select("status_data", "file_attachment", "employee_nik", "classification")
                                    .where('on_duty_number', on_duty_number)
                                    .first();
        if (trxOnduty && trxOnduty.status_data !== 'Draft') {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal insert, data telah di proses' });
        }
       
        // Check if file exists
        if (!trxOnduty || (trxOnduty && !trxOnduty.file_attachment)) {
            const localFilePath = `file/${dokumen}`;
            if (!fs.existsSync(localFilePath)) {
                await query.rollback();
                return res.status(400).json({ message: 'Gagal upload, silahkan hubungi Tim IT' });
            }
        }

        let getOnDutyDeclaration = await dbConn(`${databaseName} as att`)
        .select(
            "att.OnDutyRequestNo",
            "att.OnDutyType",
            "att.EmployeeNIK",
            "att.EmployeeName",
            "att.DivisionName",
            "att.DepartmentName",
            "att.OnDutyStartDate",
            "att.OnDutyEndDate",
            "att.OnDutyClaimValue",
            "att.OnDutyStatus",
            "att.OnDutyClaimItemCode",
            "att.LastStatusBy",
            "att.DDKType",
            "att.OnDutyDays",
            "att.OnDutyDestination",
            "att.OnDutyClaimRemark",
        )
        .where("OnDutyRequestNo", on_duty_number)
        .first();

        if (!getOnDutyDeclaration) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal insert, silahkan hubungi Tim IT' });
        }

        let employeeInfo = null;
        let buShortname = null;
        let getdomain = null;
        let map_div_id = null;
        let map_dept_id = null;
        if (process.env.DB6_DATABASE) {
            const tablename = type === 'KARYAWAN' ? 'T_EMP_Employee': 'T_EMP_Employee_OS';
            employeeInfo = await dbFINHris(`AppDB_FIN_HRIS.dbo.${tablename}`)
                .select("EmployeeNIK", "BusinessUnitCode", "DivisionCode", "DepartmentCode")
                .where("EmployeeNIK", getOnDutyDeclaration.EmployeeNIK)
                .first();
            buShortname = employeeInfo ? employeeInfo.BusinessUnitCode : null;
            
            if (employeeInfo) {
                map_div_id = employeeInfo ? employeeInfo.DivisionCode : null;
                map_dept_id = employeeInfo ? employeeInfo.DepartmentCode : null;
            }
        } else {
            employeeInfo = await dbDbcHris('dbHRIS_newer.dbo.master_employee')
                .select('employee_id', 'employee_bu_id', 'employee_position_pk')
                .where('employee_id', getOnDutyDeclaration.EmployeeNIK)
                .first();
            buShortname = employeeInfo ? employeeInfo.employee_bu_id : null;

            if (employeeInfo && employeeInfo.employee_position_pk) {
                const positionMapping = await dbDbcHris('dbHRIS_newer.dbo.mapping_position')
                    .select('map_div_id', 'map_dept_id')
                    .where('map_post_pk', employeeInfo.employee_position_pk)
                    .first();
                if (positionMapping) {
                    if (positionMapping.map_div_id) {
                        const division = await dbDbcHris('dbHRIS_newer.dbo.master_division')
                        .select('div_id', 'div_idreal')
                        .where('div_id', positionMapping.map_div_id)
                        .first();
                        map_div_id = division ? division.div_idreal : null;
                    }
                    if (positionMapping.map_dept_id) {
                        const department = await dbDbcHris('dbHRIS_newer.dbo.master_department')
                        .select('dept_id', 'dept_idreal')
                        .where('dept_id', positionMapping.map_dept_id)
                        .first();
                        map_dept_id = department ? department.dept_idreal : null;
                    }
                }
            }
        }

        if (buShortname) {
            getdomain = await db('dbPortalFA.dbo.domain')
                .select("domain_code", "domain_shortname")
                .where("domain_shortname", buShortname)
                .first();
        }

        getOnDutyDeclaration = {
            ...getOnDutyDeclaration,
            domain_code: getdomain ? getdomain.domain_code : null,
            domain_shortname: getdomain ? getdomain.domain_shortname : null,
            division_id: map_div_id,
            department_id: map_dept_id,
        };

        if (dokumen) {
            await uploadFileWithParams(dokumen, 'pum-pjum/lamp-perjadin');
            unlink(`file/${dokumen}`, (err) => {
                if (err) return res.status(406).json({ message: 'Gagal upload, silahkan hubungi Tim IT' });
            });
        }

        if (trxOnduty) {
            const payloadUpdate = {
                status_data: 'Draft',
                updated_by: empid, 
                updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            }
            if (dokumen) {
                payloadUpdate.file_attachment = dokumen;
            }
            if(type === 'OS') {
                payloadUpdate.acknowledged_by = req.body.acknowledged_by;
                payloadUpdate.approved_hr_by = req.body.approved_hr_by;
            }
            await query("dbPortalFA.dbo.trx_onduty")
            .where ("on_duty_number", on_duty_number)
            .update(payloadUpdate); 
        } else {
            const payload = {
                domain: parseInt(getOnDutyDeclaration.domain_code ?? 0),
                on_duty_number: getOnDutyDeclaration.OnDutyRequestNo,
                on_duty_type: getOnDutyDeclaration.OnDutyType,
                employee_nik: getOnDutyDeclaration.EmployeeNIK,
                employee_name: getOnDutyDeclaration.EmployeeName,
                division_name: getOnDutyDeclaration.DivisionName,
                department_name: getOnDutyDeclaration.DepartmentName,
                on_duty_status: getOnDutyDeclaration.OnDutyStatus,
                on_duty_approved_by: getOnDutyDeclaration.LastStatusBy,
                dkk_type: getOnDutyDeclaration.DDKType,
                on_duty_value: getOnDutyDeclaration.OnDutyClaimValue,
                on_duty_start_date: dayjs(getOnDutyDeclaration.OnDutyStartDate).format("YYYY-MM-DD HH:mm:ss"),
                on_duty_end_date: dayjs(getOnDutyDeclaration.OnDutyEndDate).format("YYYY-MM-DD HH:mm:ss"),
                on_duty_days: getOnDutyDeclaration.OnDutyDays,
                on_duty_destination: getOnDutyDeclaration.OnDutyDestination,
                on_duty_claim_remark: getOnDutyDeclaration.OnDutyClaimRemark,
                classification: type,
                status_data: 'Draft',
                created_by: empid,
                created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                division_id: getOnDutyDeclaration.division_id,
                department_id: getOnDutyDeclaration.department_id,
            }

            if (dokumen) {
                payload.file_attachment = dokumen;
            }
            if(type === 'OS') {
                payload.acknowledged_by = req.body.acknowledged_by;
                payload.approved_hr_by = req.body.approved_hr_by;
            }
            await query("dbPortalFA.dbo.trx_onduty").insert(payload);
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

// Cancel Perjalanan dinas
export const PUMPJUM_PerjalananDinasCancel = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            domain,
            on_duty_number,
            cancel_reason,
        } = req.body;
        const type = req.body.type || null;

        if (!type) {
            return res.status(400).json({ error: 'Missing type parameter' });
        }

        const dbConn = process.env.DB6_DATABASE ? dbFINHris : db;
        const dbname = process.env.DB6_DATABASE ? 'AppDB_FIN_HRIS' : 'dbPortalFA';
        const databaseName = type === 'KARYAWAN' ? `${dbname}.dbo.T_ATT_OnDuty_Declaration`: `${dbname}.dbo.T_ATT_OnDuty_Declaration_OS`;

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

        const trxOnduty = await db("dbPortalFA.dbo.trx_onduty")
                                    .select("status_data", "created_by")
                                    .where('on_duty_number', on_duty_number)
                                    .first();
        if (trxOnduty && !['Draft', 'Pending Proses AP'].includes(trxOnduty.status_data)) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal melakukan cancel, data telah di proses' });
        }

        let getOnDutyDeclaration = await dbConn(`${databaseName} as att`)
        .select(
            "att.OnDutyRequestNo",
            "att.OnDutyType",
            "att.EmployeeNIK",
            "att.EmployeeName",
            "att.DivisionName",
            "att.DepartmentName",
            "att.OnDutyStartDate",
            "att.OnDutyEndDate",
            "att.OnDutyClaimValue",
            "att.OnDutyStatus",
            "att.OnDutyClaimItemCode",
            "att.LastStatusBy",
            "att.DDKType",
            "att.OnDutyDays",
            "att.OnDutyDestination",
            "att.OnDutyClaimRemark",
        )
        .where("OnDutyRequestNo", on_duty_number)
        .first();

        if (!getOnDutyDeclaration) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal melakukan cancel, silahkan hubungi Tim IT' });
        }
        
        let employeeInfo = null;
        let buShortname = null;
        let getdomain = null;
        let map_div_id = null;
        let map_dept_id = null;
        if (process.env.DB6_DATABASE) {
            const tablename = type === 'KARYAWAN' ? 'T_EMP_Employee': 'T_EMP_Employee_OS';
            employeeInfo = await dbFINHris(`AppDB_FIN_HRIS.dbo.${tablename}`)
                .select("EmployeeNIK", "BusinessUnitCode", "DivisionCode", "DepartmentCode")
                .where("EmployeeNIK", getOnDutyDeclaration.EmployeeNIK)
                .first();
            buShortname = employeeInfo ? employeeInfo.BusinessUnitCode : null;
            
            if (employeeInfo) {
                map_div_id = employeeInfo ? employeeInfo.DivisionCode : null;
                map_dept_id = employeeInfo ? employeeInfo.DepartmentCode : null;
            }
        } else {
            employeeInfo = await dbDbcHris('dbHRIS_newer.dbo.master_employee')
                .select('employee_id', 'employee_bu_id', 'employee_position_pk')
                .where('employee_id', getOnDutyDeclaration.EmployeeNIK)
                .first();
            buShortname = employeeInfo ? employeeInfo.employee_bu_id : null;

            if (employeeInfo && employeeInfo.employee_position_pk) {
                const positionMapping = await dbDbcHris('dbHRIS_newer.dbo.mapping_position')
                    .select('map_div_id', 'map_dept_id')
                    .where('map_post_pk', employeeInfo.employee_position_pk)
                    .first();
                if (positionMapping) {
                    if (positionMapping.map_div_id) {
                        const division = await dbDbcHris('dbHRIS_newer.dbo.master_division')
                        .select('div_id', 'div_idreal')
                        .where('div_id', positionMapping.map_div_id)
                        .first();
                        map_div_id = division ? division.div_idreal : null;
                    }
                    if (positionMapping.map_dept_id) {
                        const department = await dbDbcHris('dbHRIS_newer.dbo.master_department')
                        .select('dept_id', 'dept_idreal')
                        .where('dept_id', positionMapping.map_dept_id)
                        .first();
                        map_dept_id = department ? department.dept_idreal : null;
                    }
                }
            }
        }

        if (buShortname) {
            getdomain = await db('dbPortalFA.dbo.domain')
                .select("domain_code", "domain_shortname")
                .where("domain_shortname", buShortname)
                .first();
        }

        getOnDutyDeclaration = {
            ...getOnDutyDeclaration,
            domain_code: getdomain ? getdomain.domain_code : null,
            domain_shortname: getdomain ? getdomain.domain_shortname : null,
            division_id: map_div_id,
            department_id: map_dept_id,
        };

        if (trxOnduty) {
            await query("dbPortalFA.dbo.trx_onduty")
            .where ("on_duty_number", on_duty_number)
            .update({
                status_data: 'Cancel',
                feedback_notes: cancel_reason,
                updated_by: empid, 
                updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            }); 
            if (trxOnduty.status_data !== 'Cancel') {
                // store history approval
                const payloadHistory = {
                    domain: parseInt(getOnDutyDeclaration.domain_code ?? 0),
                    on_duty_number: getOnDutyDeclaration.OnDutyRequestNo,
                    status_data: 'Cancel',
                    feedback_notes: cancel_reason,
                    created_by: empid,
                    created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                }
                await query("dbPortalFA.dbo.trx_onduty_approval").insert(payloadHistory);
            }
        } else {
            const payload = {
                domain: parseInt(getOnDutyDeclaration.domain_code ?? 0),
                on_duty_number: getOnDutyDeclaration.OnDutyRequestNo,
                on_duty_type: getOnDutyDeclaration.OnDutyType,
                employee_nik: getOnDutyDeclaration.EmployeeNIK,
                employee_name: getOnDutyDeclaration.EmployeeName,
                division_name: getOnDutyDeclaration.DivisionName,
                department_name: getOnDutyDeclaration.DepartmentName,
                on_duty_status: getOnDutyDeclaration.OnDutyStatus,
                on_duty_approved_by: getOnDutyDeclaration.LastStatusBy,
                dkk_type: getOnDutyDeclaration.DDKType,
                on_duty_value: getOnDutyDeclaration.OnDutyClaimValue,
                on_duty_start_date: dayjs(getOnDutyDeclaration.OnDutyStartDate).format("YYYY-MM-DD HH:mm:ss"),
                on_duty_end_date: dayjs(getOnDutyDeclaration.OnDutyEndDate).format("YYYY-MM-DD HH:mm:ss"),
                on_duty_days: getOnDutyDeclaration.OnDutyDays,
                on_duty_destination: getOnDutyDeclaration.OnDutyDestination,
                on_duty_claim_remark: getOnDutyDeclaration.OnDutyClaimRemark,
                classification: type,
                status_data: 'Cancel',
                feedback_notes: cancel_reason,
                created_by: empid,
                created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                division_id: getOnDutyDeclaration.division_id,
                department_id: getOnDutyDeclaration.department_id,
            }
            await query("dbPortalFA.dbo.trx_onduty").insert(payload);

            // store history approval
            const payloadHistory = {
                domain: parseInt(getOnDutyDeclaration.domain_code ?? 0),
                on_duty_number: getOnDutyDeclaration.OnDutyRequestNo,
                status_data: 'Cancel',
                feedback_notes: cancel_reason,
                created_by: empid,
                created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            }
            await query("dbPortalFA.dbo.trx_onduty_approval").insert(payloadHistory);
        }

        // send mail
        let mailUser = [];
        let mailCc = [];
        let userRequestor = null;
        if (process.env.EMAILDUMMY != '') {
            mailUser = [process.env.EMAILDUMMY];
        } else {
            const usernik = trxOnduty ? trxOnduty.created_by : empid;
            userRequestor = await db("dbPortalFA.dbo.users")
                .select('user_nik', 'user_site', 'user_id', 'user_email', 'user_name')
                .where('user_nik', usernik)
                .first();

            if(!userRequestor) {
                await query.rollback();
                return res.status(400).json({ message: 'User requestor data tidak ditemukan, silahkan hubungi Tim IT' });
            }

            // const sites = await db("dbPortalFA.dbo.user_site as ust")
            //     .select("ust.usite_site")
            //     .innerJoin("dbPortalFA.dbo.application as app", function () {
            //         this.on("ust.usite_appid", "=", "app.app_id");
            //     })
            //     .where("ust.usite_domain", getOnDutyDeclaration.domain_code)
            //     .where("ust.usite_userid", userRequestor.user_id)
            //     .where("app.app_name", "Pengajuan Uang Muka");

            // if(sites.length === 0) {
            //     await query.rollback();
            //     return res.status(400).json({ message: 'User requestor site tidak ditemukan, silahkan update sites pada user requestor' });
            // }

            // const userSites = sites.map(item => item.usite_site);
            const getPicApproval = await db('dbPortalFA.dbo.mstr_pic_app as app')
                .select(
                    'app.id',
                    'app.domain',
                    'app.site',
                    'app.type_pum',
                    'app.type_approval_id',
                    'app.employee_id',
                    'app.level',
                    "emp.employee_name",
                    "emp.employee_jabatan",
                    "emp.employee_email"
                )
                .where('app.domain', getOnDutyDeclaration.domain_code)
                .where('app.type_pum', 'On Duty')
                .where('app.type_approval_id', 'AP')
                // .whereRaw(`EXISTS (SELECT 1 FROM OPENJSON(app.site) WHERE value IN (${userSites.map(() => '?').join(',')}))`, userSites)
                .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), "app.employee_id", "=", "emp.employee_id")
                .orderBy('app.level');
            
            const picApproval = getPicApproval.map(item => item.employee_email);
            mailUser = getOnDutyDeclaration.EmployeeNIK === empid ? [userRequestor.user_email] : picApproval;
            mailCc = getOnDutyDeclaration.EmployeeNIK === empid ? picApproval : [userRequestor.user_email];
        }

        const promises = mailUser.map(async (user) => {            
            const dataMail = {
                from: 'Pengajuan Uang Muka System',
                to: user,
                cc: mailCc,
                subject: 'Pengajuan Uang Muka System - PUM Perjalanan Dinas',
                to_employee_name: getOnDutyDeclaration.EmployeeNIK === empid ? 'Team Finance AP' : userRequestor?.user_name,
                employee_name: getOnDutyDeclaration.EmployeeName,
                division_name: getOnDutyDeclaration.DivisionName,
                department_name: getOnDutyDeclaration.DepartmentName,
                on_duty_number: getOnDutyDeclaration.OnDutyRequestNo,
                on_duty_value: formatRupiah2(getOnDutyDeclaration.OnDutyClaimValue),
                feedback_notes: cancel_reason,
                link: `${process.env.LINK_FRONTEND}/#/pum-pjum/detail-perjalanan-dinas-${type === 'OS' ? 'os' : 'karyawan'}/${useEncrypt(getOnDutyDeclaration.OnDutyRequestNo)}`,
            };

            let html = await ejs.renderFile("view/pumpjum/mailPerjalananDinasCanceled.ejs", {
                data: dataMail,
            });

            dataMail.html = html;
            await sendMailNew(dataMail);
        });
        await Promise.all(promises);  
        // end send mail

        await query.commit();
        return res.status(200).json({ message: 'Data berhasil dicancel' });
    } catch (error) {
        console.log(error)
        await query.rollback();
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1 ? error.message : 'Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT',
        });
    }
}

// Save and sent to FA Perjalanan dinas
export const PUMPJUM_PerjalananDinasSaveAndSentToFA = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            domain,
            on_duty_number,
        } = req.body;
        const dokumen = req.files.upload ? req.files.upload[0].filename : null;
        const type = req.body.type || null;

        if (!type) {
            return res.status(400).json({ error: 'Missing type parameter' });
        }

        const dbConn = process.env.DB6_DATABASE ? dbFINHris : db;
        const dbname = process.env.DB6_DATABASE ? 'AppDB_FIN_HRIS' : 'dbPortalFA';
        const databaseName = type === 'KARYAWAN' ? `${dbname}.dbo.T_ATT_OnDuty_Declaration`: `${dbname}.dbo.T_ATT_OnDuty_Declaration_OS`;

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

        const trxOnduty = await db("dbPortalFA.dbo.trx_onduty")
                                    .select("status_data", "file_attachment")
                                    .where('on_duty_number', on_duty_number)
                                    .first();
        if (trxOnduty && !['Draft', 'Require Revision'].includes(trxOnduty.status_data)) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal insert, data telah di proses' });
        }

        // Check if file exists
        if (!trxOnduty || (trxOnduty && !trxOnduty.file_attachment)) {
            const localFilePath = `file/${dokumen}`;
            if (!fs.existsSync(localFilePath)) {
                await query.rollback();
                return res.status(400).json({ message: 'Gagal upload, silahkan hubungi Tim IT' });
            }
        }

        let getOnDutyDeclaration = await dbConn(`${databaseName} as att`)
        .select(
            "att.OnDutyRequestNo",
            "att.OnDutyType",
            "att.EmployeeNIK",
            "att.EmployeeName",
            "att.DivisionName",
            "att.DepartmentName",
            "att.OnDutyStartDate",
            "att.OnDutyEndDate",
            "att.OnDutyClaimValue",
            "att.OnDutyStatus",
            "att.OnDutyClaimItemCode",
            "att.LastStatusBy",
            "att.DDKType",
            "att.OnDutyDays",
            "att.OnDutyDestination",
            "att.OnDutyClaimRemark",
        )
        .where("OnDutyRequestNo", on_duty_number)
        .first();

        if (!getOnDutyDeclaration) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal insert, silahkan hubungi Tim IT' });
        }

        let employeeInfo = null;
        let buShortname = null;
        let getdomain = null;
        let map_div_id = null;
        let map_dept_id = null;
        if (process.env.DB6_DATABASE) {
            const tablename = type === 'KARYAWAN' ? 'T_EMP_Employee': 'T_EMP_Employee_OS';
            employeeInfo = await dbFINHris(`AppDB_FIN_HRIS.dbo.${tablename}`)
                .select("EmployeeNIK", "BusinessUnitCode", "DivisionCode", "DepartmentCode")
                .where("EmployeeNIK", getOnDutyDeclaration.EmployeeNIK)
                .first();
            buShortname = employeeInfo ? employeeInfo.BusinessUnitCode : null;
            
            if (employeeInfo) {
                map_div_id = employeeInfo ? employeeInfo.DivisionCode : null;
                map_dept_id = employeeInfo ? employeeInfo.DepartmentCode : null;
            }
        } else {
            employeeInfo = await dbDbcHris('dbHRIS_newer.dbo.master_employee')
                .select('employee_id', 'employee_bu_id', 'employee_position_pk')
                .where('employee_id', getOnDutyDeclaration.EmployeeNIK)
                .first();
            buShortname = employeeInfo ? employeeInfo.employee_bu_id : null;

            if (employeeInfo && employeeInfo.employee_position_pk) {
                const positionMapping = await dbDbcHris('dbHRIS_newer.dbo.mapping_position')
                    .select('map_div_id', 'map_dept_id')
                    .where('map_post_pk', employeeInfo.employee_position_pk)
                    .first();
                if (positionMapping) {
                    if (positionMapping.map_div_id) {
                        const division = await dbDbcHris('dbHRIS_newer.dbo.master_division')
                        .select('div_id', 'div_idreal')
                        .where('div_id', positionMapping.map_div_id)
                        .first();
                        map_div_id = division ? division.div_idreal : null;
                    }
                    if (positionMapping.map_dept_id) {
                        const department = await dbDbcHris('dbHRIS_newer.dbo.master_department')
                        .select('dept_id', 'dept_idreal')
                        .where('dept_id', positionMapping.map_dept_id)
                        .first();
                        map_dept_id = department ? department.dept_idreal : null;
                    }
                }
            }
        }

        if (buShortname) {
            getdomain = await db('dbPortalFA.dbo.domain')
                .select("domain_code", "domain_shortname")
                .where("domain_shortname", buShortname)
                .first();
        }

        getOnDutyDeclaration = {
            ...getOnDutyDeclaration,
            domain_code: getdomain ? getdomain.domain_code : null,
            domain_shortname: getdomain ? getdomain.domain_shortname : null,
            division_id: map_div_id,
            department_id: map_dept_id,
        };
        
        if (dokumen) {
            await uploadFileWithParams(dokumen, 'pum-pjum/lamp-perjadin');
            unlink(`file/${dokumen}`, (err) => {
                if (err) return res.status(406).json({ message: 'Gagal upload, silahkan hubungi Tim IT' });
            });
        }

        if (trxOnduty) {
            const payloadUpdate = {
                status_data: 'Pending Proses AP',
                updated_by: empid, 
                updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            }
            if (dokumen) {
                payloadUpdate.file_attachment = dokumen;
            }
            if(type === 'OS') {
                payloadUpdate.acknowledged_by = req.body.acknowledged_by;
                payloadUpdate.approved_hr_by = req.body.approved_hr_by;
            }
            await query("dbPortalFA.dbo.trx_onduty")
            .where ("on_duty_number", on_duty_number)
            .update(payloadUpdate); 

            if (trxOnduty.status_data !== 'Pending Proses AP') {
                // store history approval
                const payloadHistory = {
                    domain: parseInt(getOnDutyDeclaration.domain_code ?? 0),
                    on_duty_number: getOnDutyDeclaration.OnDutyRequestNo,
                    status_data: 'Pending Proses AP',
                    created_by: empid,
                    created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                }
                await query("dbPortalFA.dbo.trx_onduty_approval").insert(payloadHistory);
            }
        } else {
            const payload = {
                domain: parseInt(getOnDutyDeclaration.domain_code ?? 0),
                on_duty_number: getOnDutyDeclaration.OnDutyRequestNo,
                on_duty_type: getOnDutyDeclaration.OnDutyType,
                employee_nik: getOnDutyDeclaration.EmployeeNIK,
                employee_name: getOnDutyDeclaration.EmployeeName,
                division_name: getOnDutyDeclaration.DivisionName,
                department_name: getOnDutyDeclaration.DepartmentName,
                on_duty_status: getOnDutyDeclaration.OnDutyStatus,
                on_duty_approved_by: getOnDutyDeclaration.LastStatusBy,
                dkk_type: getOnDutyDeclaration.DDKType,
                on_duty_value: getOnDutyDeclaration.OnDutyClaimValue,
                on_duty_start_date: dayjs(getOnDutyDeclaration.OnDutyStartDate).format("YYYY-MM-DD HH:mm:ss"),
                on_duty_end_date: dayjs(getOnDutyDeclaration.OnDutyEndDate).format("YYYY-MM-DD HH:mm:ss"),
                on_duty_days: getOnDutyDeclaration.OnDutyDays,
                on_duty_destination: getOnDutyDeclaration.OnDutyDestination,
                on_duty_claim_remark: getOnDutyDeclaration.OnDutyClaimRemark,
                classification: type,
                status_data: 'Pending Proses AP',
                created_by: empid,
                created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                division_id: getOnDutyDeclaration.division_id,
                department_id: getOnDutyDeclaration.department_id,
            }
            if (dokumen) {
                payload.file_attachment = dokumen;
            }
            if(type === 'OS') {
                payload.acknowledged_by = req.body.acknowledged_by;
                payload.approved_hr_by = req.body.approved_hr_by;
            }
            await query("dbPortalFA.dbo.trx_onduty").insert(payload);

            // store history approval
            const payloadHistory = {
                domain: parseInt(getOnDutyDeclaration.domain_code ?? 0),
                on_duty_number: getOnDutyDeclaration.OnDutyRequestNo,
                status_data: 'Pending Proses AP',
                created_by: empid,
                created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            }
            await query("dbPortalFA.dbo.trx_onduty_approval").insert(payloadHistory);
        }

        // send mail
        let mailUser = [];
        let mailCc = [];

        if (process.env.EMAILDUMMY != '') {
            mailUser = [process.env.EMAILDUMMY];
        } else {
            const userRequestor = await db("dbPortalFA.dbo.users")
                .select('user_nik', 'user_site', 'user_name', 'user_id', 'user_email')
                .where('user_nik', empid)
                .first();

            if(!userRequestor) {
                await query.rollback();
                return res.status(400).json({ message: 'User requestor data tidak ditemukan, silahkan hubungi Tim IT' });
            }

            // const sites = await db("dbPortalFA.dbo.user_site as ust")
            //     .select("ust.usite_site")
            //     .innerJoin("dbPortalFA.dbo.application as app", function () {
            //         this.on("ust.usite_appid", "=", "app.app_id");
            //     })
            //     .where("ust.usite_domain", getOnDutyDeclaration.domain_code)
            //     .where("ust.usite_userid", userRequestor.user_id)
            //     .where("app.app_name", "Pengajuan Uang Muka");

            // if(sites.length === 0) {
            //     await query.rollback();
            //     return res.status(400).json({ message: 'User requestor site tidak ditemukan, silahkan update sites pada user requestor' });
            // }

            // const userSites = sites.map(item => item.usite_site);
            const getPicApproval = await db('dbPortalFA.dbo.mstr_pic_app as app')
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
                    "emp.employee_email"
                )
                .where('app.domain', getOnDutyDeclaration.domain_code)
                .where('app.type_pum', 'On Duty')
                .where('app.type_approval_id', 'AP')
                // .whereRaw(`EXISTS (SELECT 1 FROM OPENJSON(app.site) WHERE value IN (${userSites.map(() => '?').join(',')}))`, userSites)
                .leftJoin("dbPortalFA.dbo.domain as dom", "app.domain", "=", "dom.domain_code")
                .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), "app.employee_id", "=", "emp.employee_id")
                .orderBy('app.level');
            mailUser = getPicApproval.map(item => item.employee_email);
            mailCc = [userRequestor.user_email];
        }

        const promises = mailUser.map(async (user) => {            
            const dataMail = {
                from: 'Pengajuan Uang Muka System',
                to: user,
                cc: mailCc,
                subject: 'Pengajuan Uang Muka System - Perjalanan Dinas',
                employee_name: getOnDutyDeclaration.EmployeeName,
                division_name: getOnDutyDeclaration.DivisionName,
                department_name: getOnDutyDeclaration.DepartmentName,
                on_duty_number: getOnDutyDeclaration.OnDutyRequestNo,
                on_duty_value: formatRupiah2(getOnDutyDeclaration.OnDutyClaimValue),
                link: `${process.env.LINK_FRONTEND}/#/pum-pjum/edit-proses-perjalanan-dinas/${useEncrypt(getOnDutyDeclaration.OnDutyRequestNo)}`,
            };
            let html = await ejs.renderFile("view/pumpjum/mailPerjalananDinasKaryawanPendingAP.ejs", {
                data: dataMail,
            });
    
            dataMail.html = html;
            await sendMailNew(dataMail);
        });
        await Promise.all(promises);  
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

// Resend to FA Perjalanan dinas
export const PUMPJUM_PerjalananDinasResendEmailToFA = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            domain,
            on_duty_number,
        } = req.body;
        const type = req.body.type || null;

        if (!type) {
            return res.status(400).json({ error: 'Missing type parameter' });
        }
        const dbConn = process.env.DB6_DATABASE ? dbFINHris : db;
        const dbname = process.env.DB6_DATABASE ? 'AppDB_FIN_HRIS' : 'dbPortalFA';
        const databaseName = type === 'KARYAWAN' ? `${dbname}.dbo.T_ATT_OnDuty_Declaration`: `${dbname}.dbo.T_ATT_OnDuty_Declaration_OS`;

        // Validate user, and get user_nik
        const user = await db("dbPortalFA.dbo.users")
                        .select('user_nik')
                        .where('user_id', req.body.empid)
                        .first()

        if(!user) {
            await query.rollback();
            return res.status(400).json({ message: 'Invalid user, silahkan hubungi Tim IT' });
        }

        const trxOnduty = await db("dbPortalFA.dbo.trx_onduty")
                                    .select("status_data", "created_by")
                                    .where('on_duty_number', on_duty_number)
                                    .first();
        if (trxOnduty && !['Pending Proses AP'].includes(trxOnduty.status_data)) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal mengirim email, data telah di proses' });
        }

        let getOnDutyDeclaration = await dbConn(`${databaseName} as att`)
        .select(
            "att.OnDutyRequestNo",
            "att.OnDutyType",
            "att.EmployeeNIK",
            "att.EmployeeName",
            "att.DivisionName",
            "att.DepartmentName",
            "att.OnDutyStartDate",
            "att.OnDutyEndDate",
            "att.OnDutyClaimValue",
            "att.OnDutyStatus",
            "att.OnDutyClaimItemCode",
            "att.LastStatusBy",
            "att.DDKType",
            "att.OnDutyDays",
            "att.OnDutyDestination",
            "att.OnDutyClaimRemark",
        )
        .where("OnDutyRequestNo", on_duty_number)
        .first();

        if (!getOnDutyDeclaration) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal mengirim email, data telah di proses' });
        }

        let employeeInfo = null;
        let buShortname = null;
        let getdomain = null;
        let map_div_id = null;
        let map_dept_id = null;
        if (process.env.DB6_DATABASE) {
            const tablename = type === 'KARYAWAN' ? 'T_EMP_Employee': 'T_EMP_Employee_OS';
            employeeInfo = await dbFINHris(`AppDB_FIN_HRIS.dbo.${tablename}`)
                .select("EmployeeNIK", "BusinessUnitCode", "DivisionCode", "DepartmentCode")
                .where("EmployeeNIK", getOnDutyDeclaration.EmployeeNIK)
                .first();
            buShortname = employeeInfo ? employeeInfo.BusinessUnitCode : null;
            
            if (employeeInfo) {
                map_div_id = employeeInfo ? employeeInfo.DivisionCode : null;
                map_dept_id = employeeInfo ? employeeInfo.DepartmentCode : null;
            }
        } else {
            employeeInfo = await dbDbcHris('dbHRIS_newer.dbo.master_employee')
                .select('employee_id', 'employee_bu_id', 'employee_position_pk')
                .where('employee_id', getOnDutyDeclaration.EmployeeNIK)
                .first();
            buShortname = employeeInfo ? employeeInfo.employee_bu_id : null;

            if (employeeInfo && employeeInfo.employee_position_pk) {
                const positionMapping = await dbDbcHris('dbHRIS_newer.dbo.mapping_position')
                    .select('map_div_id', 'map_dept_id')
                    .where('map_post_pk', employeeInfo.employee_position_pk)
                    .first();
                if (positionMapping) {
                    if (positionMapping.map_div_id) {
                        const division = await dbDbcHris('dbHRIS_newer.dbo.master_division')
                        .select('div_id', 'div_idreal')
                        .where('div_id', positionMapping.map_div_id)
                        .first();
                        map_div_id = division ? division.div_idreal : null;
                    }
                    if (positionMapping.map_dept_id) {
                        const department = await dbDbcHris('dbHRIS_newer.dbo.master_department')
                        .select('dept_id', 'dept_idreal')
                        .where('dept_id', positionMapping.map_dept_id)
                        .first();
                        map_dept_id = department ? department.dept_idreal : null;
                    }
                }
            }
        }

        if (buShortname) {
            getdomain = await db('dbPortalFA.dbo.domain')
                .select("domain_code", "domain_shortname")
                .where("domain_shortname", buShortname)
                .first();
        }

        getOnDutyDeclaration = {
            ...getOnDutyDeclaration,
            domain_code: getdomain ? getdomain.domain_code : null,
            domain_shortname: getdomain ? getdomain.domain_shortname : null,
            division_id: map_div_id,
            department_id: map_dept_id,
        };

        // send mail
        let mailUser = [];
        let mailCc = [];

        if (process.env.EMAILDUMMY != '') {
            mailUser = [process.env.EMAILDUMMY];
        } else {
            const userRequestor = await db("dbPortalFA.dbo.users")
                .select('user_nik', 'user_site', 'user_name', 'user_id', 'user_email')
                .where('user_nik', trxOnduty.created_by)
                .first();

            if(!userRequestor) {
                await query.rollback();
                return res.status(400).json({ message: 'User requestor data tidak ditemukan, silahkan hubungi Tim IT' });
            }

            // const sites = await db("dbPortalFA.dbo.user_site as ust")
            //     .select("ust.usite_site")
            //     .innerJoin("dbPortalFA.dbo.application as app", function () {
            //         this.on("ust.usite_appid", "=", "app.app_id");
            //     })
            //     .where("ust.usite_domain", getOnDutyDeclaration.domain_code)
            //     .where("ust.usite_userid", userRequestor.user_id)
            //     .where("app.app_name", "Pengajuan Uang Muka");

            // if(sites.length === 0) {
            //     await query.rollback();
            //     return res.status(400).json({ message: 'User requestor site tidak ditemukan, silahkan update sites pada user requestor' });
            // }

            // const userSites = sites.map(item => item.usite_site);
            const getPicApproval = await db('dbPortalFA.dbo.mstr_pic_app as app')
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
                    "emp.employee_email"
                )
                .where('app.domain', getOnDutyDeclaration.domain_code)
                .where('app.type_pum', 'On Duty')
                .where('app.type_approval_id', 'AP')
                // .whereRaw(`EXISTS (SELECT 1 FROM OPENJSON(app.site) WHERE value IN (${userSites.map(() => '?').join(',')}))`, userSites)
                .leftJoin("dbPortalFA.dbo.domain as dom", "app.domain", "=", "dom.domain_code")
                .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), "app.employee_id", "=", "emp.employee_id")
                .orderBy('app.level');
            mailUser = getPicApproval.map(item => item.employee_email);
            mailCc = [userRequestor.user_email];
        }

        const promises = mailUser.map(async (user) => {            
            const dataMail = {
                from: 'Pengajuan Uang Muka System',
                to: user,
                cc: mailCc,
                subject: 'Pengajuan Uang Muka System - Perjalanan Dinas',
                employee_name: getOnDutyDeclaration.EmployeeName,
                division_name: getOnDutyDeclaration.DivisionName,
                department_name: getOnDutyDeclaration.DepartmentName,
                on_duty_number: getOnDutyDeclaration.OnDutyRequestNo,
                on_duty_value: formatRupiah2(getOnDutyDeclaration.OnDutyClaimValue),
                link: `${process.env.LINK_FRONTEND}/#/pum-pjum/edit-proses-perjalanan-dinas/${useEncrypt(getOnDutyDeclaration.OnDutyRequestNo)}`,
            };
    
            let html = await ejs.renderFile("view/pumpjum/mailPerjalananDinasKaryawanPendingAP.ejs", {
                data: dataMail,
            });
    
            dataMail.html = html;
            await sendMailNew(dataMail);
        });
        await Promise.all(promises);  
        // end send mail

        await query.commit();
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

// Generate PDF PUM Perjalanan dinas
export const PUMPJUM_PerjalananDinasGeneratePUMPdf = async (req, res) => {
    try {
        const {
            on_duty_number,
        } = req.body;
        console.log(on_duty_number)
        let query = await db("dbPortalFA.dbo.trx_onduty as odt")
        .select(
            "odt.on_duty_number",
            "odt.on_duty_type",
            "odt.dkk_type",
            "odt.employee_nik",
            "odt.employee_name",
            "odt.division_name",
            "odt.department_name",
            "odt.on_duty_start_date",
            "odt.on_duty_end_date",
            "odt.on_duty_value",
            "odt.on_duty_status",
            "odt.on_duty_claim_remark",
            "odt.on_duty_approved_by",
            "odt.on_duty_days",
            "odt.on_duty_destination",
            "odt.status_data",
            "odt.file_attachment",
            "odt.feedback_notes",
            "odt.pum_number",
            "odt.acknowledged_by",
            "odt.approved_hr_by",
            "odt.classification",
            "dom.domain_code",
            "dom.domain_shortname",
            "emp.employee_name as on_duty_approved_by_name",
            "emp.employee_nm_pos as on_duty_approved_by_pos"
        )
        .leftJoin("dbPortalFA.dbo.users as usr", "odt.employee_nik", "=", "usr.user_nik")
        .leftJoin("dbPortalFA.dbo.domain as dom", "usr.user_domain", "=", "dom.domain_code")
        .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), "odt.on_duty_approved_by", "=", "emp.employee_id")
        .where("on_duty_number", on_duty_number)
        .first();

        const terbilaValue = query.on_duty_value ? terbilang(query.on_duty_value) : 0;
        query.on_duty_value_terbilang = capitalize(terbilaValue);
        query.on_duty_value = formatRupiah(query.on_duty_value);
        query.on_duty_start_date = query.on_duty_start_date ? dayjs(query.on_duty_start_date).format("DD-MMM-YYYY") : '-';
        query.on_duty_end_date = query.on_duty_end_date ? dayjs(query.on_duty_end_date).format("DD-MMM-YYYY") : '-';
        const pdfBuffer = await pdfTemplate.pdfPUMPerjalananDinas(query);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=${query.on_duty_number}.pdf`);

        res.end(pdfBuffer.data);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Internal server error, please call IT",
        status: false,
        error: error.message,
      });
    }
};

// Get List of Proses Perjalanan dinas karyawan list
export const PUMPJUM_PerjalananDinasKaryawanProsesList = async (req, res) => {
    const { rowsPerPage, page } = req.query;

    const domain = req.query.domain || req.body.domain || req.params.domain;
    const sortBy = req.query.sortBy || 'created_date';
    const sort = req.query.descending === "true" ? "desc" : "asc";

    if (!domain) {
        return res.status(400).json({ error: 'Missing domain parameter' });
    }

    try {
        let response;

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db("dbPortalFA.dbo.trx_onduty as odt")
            .select(
                "odt.on_duty_number",
                "odt.on_duty_type",
                "odt.dkk_type",
                "odt.employee_nik",
                "odt.employee_name",
                "odt.division_name",
                "odt.department_name",
                "odt.on_duty_start_date",
                "odt.on_duty_value",
                "odt.on_duty_status",
                "odt.on_duty_claim_remark",
                "odt.status_data",
                "odt.classification",
                db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
            )
            .leftJoin("dbPortalFA.dbo.users as usr", "odt.employee_nik", "=", "usr.user_nik")
            .leftJoin("dbPortalFA.dbo.domain as dom", "usr.user_domain", "=", "dom.domain_code")
            .where("dom.domain_code", domain)
            .modify((query) => {
                if (req.query.filter_domain) {
                    query.where(function () {
                        this.where("odt.domain", req.query.filter_domain);
                    });
                }
                if (req.query.filter_status) {
                    query.where(function () {
                        this.where("odt.status_data", req.query.filter_status);
                    });
                }
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere("odt.on_duty_type", "like", search)
                            .orWhere("odt.on_duty_number", "like", search)
                            .orWhere("odt.dkk_type", "like", search)
                            .orWhere("odt.employee_nik", "like", search)
                            .orWhere("odt.employee_name", "like", search)
                            .orWhere("odt.division_name", "like", search)
                            .orWhere("odt.department_name", "like", search)
                            .orWhere("odt.status_data", "like", search)
                            .orWhere("dom.domain_shortname", "like", search);
                    });
                }
            })
            .orderBy(sortBy, sort);
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db("dbPortalFA.dbo.trx_onduty as odt")
            .select(
                "odt.on_duty_number",
                "odt.on_duty_type",
                "odt.dkk_type",
                "odt.employee_nik",
                "odt.employee_name",
                "odt.division_name",
                "odt.department_name",
                "odt.on_duty_start_date",
                "odt.on_duty_value",
                "odt.on_duty_status",
                "odt.on_duty_claim_remark",
                "odt.status_data",
                "odt.classification",
                // db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
                // db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
            )
            // .leftJoin("dbPortalFA.dbo.users as usr", "odt.employee_nik", "=", "usr.user_nik")
            // .leftJoin("dbPortalFA.dbo.domain as dom", "usr.user_domain", "=", "dom.domain_code")
            .where("odt.domain", domain)
            .modify((query) => {
                if (req.query.filter_domain) {
                    query.where(function () {
                        this.where("odt.domain", req.query.filter_domain);
                    });
                }
                if (req.query.filter_status) {
                    query.where(function () {
                        this.where("odt.status_data", req.query.filter_status);
                    });
                }
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere("odt.on_duty_type", "like", search)
                            .orWhere("odt.on_duty_number", "like", search)
                            .orWhere("odt.dkk_type", "like", search)
                            .orWhere("odt.employee_nik", "like", search)
                            .orWhere("odt.employee_name", "like", search)
                            .orWhere("odt.division_name", "like", search)
                            .orWhere("odt.department_name", "like", search)
                            .orWhere("odt.status_data", "like", search)
                            // .orWhere("dom.domain_shortname", "like", search);
                    });
                }
            })
            .orderBy(sortBy, sort)
            .paginate({
                perPage: Math.abs(Math.floor(parseInt(rowsPerPage, 10))),
                currentPage: pages,
                isLengthAware: true,
            });

            const employeeNIKs = [...new Set(response.data.map(item => item.employee_nik))];
            let employeeRows = [];
            let employeeBUIds = [];
            const employeeMap = {};
            if (process.env.DB6_DATABASE) {
                employeeRows = await dbFINHris("AppDB_FIN_HRIS.dbo.T_EMP_Employee as emp")
                .select("emp.EmployeeNIK", "emp.BusinessUnitCode")
                .whereIn("emp.EmployeeNIK", employeeNIKs)
                .unionAll([
                dbFINHris("AppDB_FIN_HRIS.dbo.T_EMP_Employee_OS as emp_os")
                    .select("emp_os.EmployeeNIK", "emp_os.BusinessUnitCode")
                    .whereIn("emp_os.EmployeeNIK", employeeNIKs)
                ]);
                    
                employeeRows.forEach(emp => {
                    employeeMap[emp.EmployeeNIK] = emp.BusinessUnitCode;
                });
                employeeBUIds = [...new Set(employeeRows.map(emp => emp.BusinessUnitCode))];
            } else {
                employeeRows = await dbDbcHris('dbHRIS_newer.dbo.master_employee')
                    .select('employee_id', 'employee_bu_id')
                    .whereIn('employee_id', employeeNIKs);

                employeeRows.forEach(emp => {
                    employeeMap[emp.employee_id] = emp.employee_bu_id;
                });
                employeeBUIds = [...new Set(employeeRows.map(emp => emp.employee_bu_id))];
            }

            const domainRows = await db('dbPortalFA.dbo.domain')
                .select('domain_shortname', 'domain_code')
                .whereIn('domain_shortname', employeeBUIds);
            const domainMap = {};
            domainRows.forEach(d => {
                domainMap[d.domain_shortname] = d.domain_code;
            });
            
            response.data = response.data.map(item => {
                const buId = employeeMap[item.employee_nik];
                const domainCode = buId ? domainMap[buId] : null;

                return {
                    ...item,
                    domain_shortname: buId || null,
                    domain_code: domainCode || null,
                };
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

// Revision Perjalanan dinas karyawan
export const PUMPJUM_PerjalananDinasKaryawanRevision = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            domain,
            on_duty_number,
            reason,
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

        const trxOnduty = await db("dbPortalFA.dbo.trx_onduty as odt")
                                    .select(
                                        "odt.status_data",
                                        "odt.domain",
                                        "odt.pum_number",
                                        "odt.on_duty_number",
                                        "odt.employee_nik",
                                        "odt.employee_name",
                                        "odt.division_name",
                                        "odt.department_name",
                                        "odt.on_duty_type",
                                        "odt.on_duty_value",
                                        "odt.on_duty_value_ap",
                                        "odt.feedback_notes",
                                        "odt.classification",
                                        "odt.created_by",
                                    )
                                    .where("on_duty_number", on_duty_number)
                                    .first();
                                    
        if (!trxOnduty) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal melakukan request revisi, silahkan hubungi Tim IT' });
        }

        if (!['Pending Proses AP', 'Processed AP'].includes(trxOnduty.status_data)) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal melakukan request revisi, data telah di proses' });
        }

        await query("dbPortalFA.dbo.trx_onduty")
        .where ("on_duty_number", on_duty_number)
        .update({
            status_data: 'Require Revision',
            feedback_notes: reason,
            updated_by: empid, 
            updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        }); 

        // store history approval
        const payloadHistory = {
            domain: parseInt(trxOnduty.domain ?? 0),
            on_duty_number: trxOnduty.on_duty_number,
            status_data: 'Require Revision',
            feedback_notes: reason,
            created_by: empid,
            created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        }
        await query("dbPortalFA.dbo.trx_onduty_approval").insert(payloadHistory);

        // send mail
        let mailUser = [];
        let mailCc = [];

        let userCreator = null;
        let userRequestor = null;
        if (process.env.EMAILDUMMY != '') {
            mailUser = [process.env.EMAILDUMMY];
        } else {
            userRequestor = await db("dbPortalFA.dbo.users")
                .select('user_nik', 'user_site','user_name', 'user_id', 'user_email')
                .where('user_nik', trxOnduty.created_by)
                .first();

            if(!userRequestor) {
                await query.rollback();
                return res.status(400).json({ message: 'User requestor data tidak ditemukan, silahkan hubungi Tim IT' });
            }

            // if (trxOnduty.classification === 'OS') {
            //     userCreator = await db("dbPortalFA.dbo.users")
            //         .select('user_nik', 'user_site', 'user_name', 'user_id', 'user_email')
            //         .where('user_nik', trxOnduty.created_by)
            //         .first();
    
            //     if(!userCreator) {
            //         await query.rollback();
            //         return res.status(400).json({ message: 'User requestor data tidak ditemukan, silahkan hubungi Tim IT' });
            //     }
            // }

            // const sites = await db("dbPortalFA.dbo.user_site as ust")
            //     .select("ust.usite_site")
            //     .innerJoin("dbPortalFA.dbo.application as app", function () {
            //         this.on("ust.usite_appid", "=", "app.app_id");
            //     })
            //     .where("ust.usite_domain", trxOnduty.domain)
            //     .where("ust.usite_userid", userRequestor.user_id)
            //     .where("app.app_name", "Pengajuan Uang Muka");

            // if(sites.length === 0) {
            //     await query.rollback();
            //     return res.status(400).json({ message: 'User requestor site tidak ditemukan, silahkan update sites pada user requestor' });
            // }

            // const userSites = sites.map(item => item.usite_site);
            const getPicApproval = await db('dbPortalFA.dbo.mstr_pic_app as app')
                .select(
                    'app.id',
                    'app.domain',
                    'app.site',
                    'app.type_pum',
                    'app.type_approval_id',
                    'app.employee_id',
                    'app.level',
                    "emp.employee_name",
                    "emp.employee_jabatan",
                    "emp.employee_email"
                )
                .where('app.domain', trxOnduty.domain)
                .where('app.type_pum', 'On Duty')
                .where('app.type_approval_id', 'AP')
                // .whereRaw(`EXISTS (SELECT 1 FROM OPENJSON(app.site) WHERE value IN (${userSites.map(() => '?').join(',')}))`, userSites)
                .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), "app.employee_id", "=", "emp.employee_id")
                .orderBy('app.level');

            // const userTo = trxOnduty.classification === 'OS' ? userCreator.user_email :  userRequestor.user_email;
            const userTo = userRequestor.user_email;
            mailUser = [userTo];
            mailCc = getPicApproval.map(item => item.employee_email);
        }

        const promises = mailUser.map(async (user) => {            
            const dataMail = {
                from: 'Pengajuan Uang Muka System',
                to: user,
                cc: mailCc,
                subject: 'Pengajuan Uang Muka System - Revisi PUM Perjalanan Dinas',
                // to_employee_name: trxOnduty.classification === 'OS' ? userCreator?.user_name || '' : userRequestor?.user_name || '',
                to_employee_name: userRequestor?.user_name || '',
                employee_name: trxOnduty.employee_name,
                division_name: trxOnduty.division_name,
                department_name: trxOnduty.department_name,
                on_duty_number: trxOnduty.on_duty_number,
                on_duty_value: formatRupiah2(trxOnduty.on_duty_value_ap || trxOnduty.on_duty_value),
                link: `${process.env.LINK_FRONTEND}/#/pum-pjum/edit-perjalanan-dinas-${trxOnduty.classification === 'OS' ? 'os' : 'karyawan'}/${useEncrypt(trxOnduty.on_duty_number)}`,
            };

            let html = await ejs.renderFile("view/pumpjum/mailPerjalananDinasRevision.ejs", {
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

// Save proses AP Perjalanan dinas karyawan
export const PUMPJUM_PerjalananDinasKaryawanSaveProsesAP = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            domain,
            on_duty_number,
            allocation_key,
            allocation_status,
            comment,
            description,
            due_date_inv,
            gl,
            inv_status,
            is_taxable,
            on_duty_value_ap,
            own_bank_number,
            payment_method_id,
            pum_number,
            subacc,
            supplier_id
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

        const trxOnduty = await db("dbPortalFA.dbo.trx_onduty")
                                    .select("status_data", "domain", "pum_number", "on_duty_number")
                                    .where('on_duty_number', on_duty_number)
                                    .first();
                                    
        if (!trxOnduty) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal melakukan penyimpanan data, silahkan hubungi Tim IT' });
        }

        if (!['Pending Proses AP', 'Processed AP'].includes(trxOnduty.status_data)) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal melakukan penyimpanan data, data telah di proses' });
        }

        let trxPumNumber = trxOnduty.pum_number || null;
        if (!trxOnduty.pum_number) {
            const genNumber = await generatePumNumberWithLastMasterNumber({ domain: trxOnduty.domain });
            if (!genNumber) {
                await query.rollback();
                return res.status(400).json({ message: 'Gagal melakukan penyimpanan data dan generate number, silahkan hubungi Tim IT' });
            }
            trxPumNumber = genNumber.newNumberFormat;
            await db("dbPortalFA.dbo.mstr_num_pum")
                .where('id', genNumber.id)
                .update({ current_number: genNumber.nextNumber });
        }

        const payloadUpdate = {
            status_data: 'Processed AP',
            allocation_status,
            comment,
            description,
            due_date_inv,
            gl: gl || null,
            inv_status,
            is_taxable,
            on_duty_value_ap,
            own_bank_number,
            payment_method_id,
            pum_number,
            subacc: subacc || null,
            supplier_id,
            updated_by: empid, 
            updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        }

        if (!trxOnduty.pum_number) {
            payloadUpdate.pum_number = trxPumNumber;
            payloadUpdate.allocation_key = trxPumNumber;
        }

        await query("dbPortalFA.dbo.trx_onduty")
        .where ("on_duty_number", on_duty_number)
        .update(payloadUpdate); 

        // store history approval
        const payloadHistory = {
            domain: parseInt(trxOnduty.domain ?? 0),
            on_duty_number: trxOnduty.on_duty_number,
            status_data: 'Processed AP',
            created_by: empid,
            created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        }
        await query("dbPortalFA.dbo.trx_onduty_approval").insert(payloadHistory);

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

// Save proses AP and send to QAD Perjalanan dinas karyawan
export const PUMPJUM_PerjalananDinasKaryawanSendToQAD = async (req, res) => {
    const query = await db.transaction();
    try {
        const {
            domain,
            on_duty_number,
            allocation_status,
            comment,
            description,
            due_date_inv,
            gl,
            inv_status,
            is_taxable,
            on_duty_value_ap,
            own_bank_number,
            payment_method_id,
            subacc,
            supplier_id
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

        const trxOnduty = await db("dbPortalFA.dbo.trx_onduty as odt")
                                    .select(
                                        "odt.status_data",
                                        "odt.domain",
                                        "odt.pum_number",
                                        "odt.created_date",
                                        "odt.created_by",
                                        "odt.employee_nik",
                                        "odt.classification",
                                        "odt.on_duty_number",
                                        "odt.on_duty_type",
                                        "odt.payment_method_id",
                                        "odt.employee_name",
                                        "odt.division_name",
                                        "odt.department_name",
                                        "odt.on_duty_value_ap",
                                        "odt.on_duty_value",
                                    )
                                    .where("odt.on_duty_number", on_duty_number)
                                    .first();
                                    
        if (!trxOnduty) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal melakukan penyimpanan data, silahkan hubungi Tim IT' });
        }

        if (!['Pending Proses AP', 'Processed AP'].includes(trxOnduty.status_data)) {
            await query.rollback();
            return res.status(400).json({ message: 'Gagal melakukan penyimpanan data, data telah di proses' });
        }

        let isCanceled = false;
        const dbConn = process.env.DB6_DATABASE ? dbFINHris : db;
        const dbname = process.env.DB6_DATABASE ? 'AppDB_FIN_HRIS' : 'dbPortalFA';
        const tbCancelName = trxOnduty.classification === 'KARYAWAN' ? 'T_ATT_OnDuty_Cancellation_Request' : 'T_ATT_OnDuty_Cancellation_Request_OS';
        const check = await dbConn(`${dbname}.dbo.${tbCancelName}`)
                                .select("OnDutyRequestNo")
                                .where('OnDutyRequestNo', on_duty_number)
                                .first();
        if (check) {
            isCanceled = true;
        }
        if (isCanceled) {
            const payloadUpdate = {
                status_data: 'Cancel',
                feedback_notes: 'Cancel by system',
                updated_by: empid, 
                updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            }

            await query("dbPortalFA.dbo.trx_onduty")
            .where ("on_duty_number", on_duty_number)
            .update(payloadUpdate); 

            // store history approval
            const payloadHistory = {
                domain: parseInt(trxOnduty.domain ?? 0),
                on_duty_number: trxOnduty.on_duty_number,
                status_data: 'Cancel',
                created_by: empid,
                created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            }
            await query("dbPortalFA.dbo.trx_onduty_approval").insert(payloadHistory);
            
            await query.commit();
            return res.status(200).json({ message: 'Data pada system FIN HRIS telah tercancel, Pengajuan telah tercancel' });
        }

        let trxPumNumber = trxOnduty.pum_number || null;
        if (!trxOnduty.pum_number) {
            const genNumber = await generatePumNumberWithLastMasterNumber({ domain: trxOnduty.domain });
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
            comment,
            description,
            due_date_inv,
            gl: gl || null,
            inv_status,
            is_taxable,
            on_duty_value_ap,
            own_bank_number,
            payment_method_id,
            subacc: subacc || null,
            supplier_id,
            updated_by: empid, 
            updated_date: currentDate,
        }

        if (!trxOnduty.pum_number) {
            payloadUpdate.pum_number = trxPumNumber;
            payloadUpdate.allocation_key = trxPumNumber;
        }

        await query("dbPortalFA.dbo.trx_onduty")
        .where ("on_duty_number", on_duty_number)
        .update(payloadUpdate); 

        // store history approval
        const payloadHistory = {
            domain: parseInt(trxOnduty.domain ?? 0),
            on_duty_number: trxOnduty.on_duty_number,
            status_data: 'Created QAD',
            created_by: empid,
            created_date: currentDate,
        }
        await query("dbPortalFA.dbo.trx_onduty_approval").insert(payloadHistory);

        // store monitoring pum
        const payloadMonitoring = {
            domain: trxOnduty.domain,
            pum_number: trxPumNumber,
            payment_method_id: payment_method_id,
            type_pum: 'Duty',
            keterangan: description,
            employeenik: trxOnduty.employee_nik,
            employeename: trxOnduty.employee_name,
            tanggal_pum: currentDate,
            nominal: on_duty_value_ap,
            status: 'OPEN',
            created_at: currentDate,
        }
        await query("dbPortalFA.dbo.monitoring_pum").insert(payloadMonitoring);

        if (payment_method_id === 2) {
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
                on_duty_value_ap,
                is_taxable,
                own_bank_number,
                suppbank_nbr: bankNumber.suppbank_nbr,
                bank_gl_account: bankNumber.bank_gl_account,
                inv_status,
                comment,
                due_date_inv: dayjs(due_date_inv).format("YYYY-MM-DD"),
                subacc,
            }

            const sendToQad = await inbound_supp_inv(payloadQad, 'perjalananDinas');
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
                on_duty_value_ap,
                gl,
            }

            const sendToQad = await inbound_pettycash_perjalanan_dinas(payloadQad);
            if (sendToQad.status === 'error') {
                await query.rollback();
                let message = sendToQad.message ? sendToQad.message : 'Gagal melakukan penyimpanan data dan mengirim ke qad'
                return res.status(400).json({ message });
            }
        }

        // send mail
        let mailUser = [];
        let mailCc = [];

        let userCreator = null;
        let userRequestor = null;
        if (process.env.EMAILDUMMY != '') {
            mailUser = [process.env.EMAILDUMMY];
        } else {
            userRequestor = await db("dbPortalFA.dbo.users")
                .select('user_nik', 'user_site', 'user_name', 'user_id', 'user_email')
                .where('user_nik', trxOnduty.created_by)
                .first();

            if(!userRequestor) {
                await query.rollback();
                return res.status(400).json({ message: 'User requestor data tidak ditemukan, silahkan hubungi Tim IT' });
            }

            // if (trxOnduty.classification === 'OS') {
            //     userCreator = await db("dbPortalFA.dbo.users")
            //         .select('user_nik', 'user_site', 'user_name', 'user_id', 'user_email')
            //         .where('user_nik', trxOnduty.created_by)
            //         .first();
    
            //     if(!userCreator) {
            //         await query.rollback();
            //         return res.status(400).json({ message: 'User requestor data tidak ditemukan, silahkan hubungi Tim IT' });
            //     }
            // }

            // const sites = await db("dbPortalFA.dbo.user_site as ust")
            //     .select("ust.usite_site")
            //     .innerJoin("dbPortalFA.dbo.application as app", function () {
            //         this.on("ust.usite_appid", "=", "app.app_id");
            //     })
            //     .where("ust.usite_domain", trxOnduty.domain)
            //     .where("ust.usite_userid", userRequestor.user_id)
            //     .where("app.app_name", "Pengajuan Uang Muka");

            // if(sites.length === 0) {
            //     await query.rollback();
            //     return res.status(400).json({ message: 'User requestor site tidak ditemukan, silahkan update sites pada user requestor' });
            // }

            // const userSites = sites.map(item => item.usite_site);
            const getPicApproval = await db('dbPortalFA.dbo.mstr_pic_app as app')
                .select(
                    'app.id',
                    'app.domain',
                    'app.site',
                    'app.type_pum',
                    'app.type_approval_id',
                    'app.employee_id',
                    'app.level',
                    "emp.employee_name",
                    "emp.employee_jabatan",
                    "emp.employee_email"
                )
                .where('app.domain', trxOnduty.domain)
                .where('app.type_pum', 'On Duty')
                .where('app.type_approval_id', 'AP')
                // .whereRaw(`EXISTS (SELECT 1 FROM OPENJSON(app.site) WHERE value IN (${userSites.map(() => '?').join(',')}))`, userSites)
                .leftJoin(db.raw(`[${linked_dbDbcHris}].[dbHRIS_newer].[dbo].[master_employee] as emp`), "app.employee_id", "=", "emp.employee_id")
                .orderBy('app.level');

            // const userTo = trxOnduty.classification === 'OS' ? userCreator.user_email :  userRequestor.user_email;
            const userTo = userRequestor.user_email;
            mailUser = [userTo];
            mailCc = getPicApproval.map(item => item.employee_email);
        }

        const promises = mailUser.map(async (user) => {            
            const dataMail = {
                from: 'Pengajuan Uang Muka System',
                to: user,
                cc: mailCc,
                subject: 'Pengajuan Uang Muka System - PUM Perjalanan Dinas',
                // to_employee_name: trxOnduty.classification === 'OS' ? userCreator?.user_name :  userRequestor?.user_name,
                to_employee_name: userRequestor?.user_name,
                employee_name: trxOnduty.employee_name,
                division_name: trxOnduty.division_name,
                department_name: trxOnduty.department_name,
                on_duty_number: trxOnduty.on_duty_number,
                on_duty_value: formatRupiah2(trxOnduty.on_duty_value_ap || trxOnduty.on_duty_value),
                link: `${process.env.LINK_FRONTEND}/#/pum-pjum/detail-perjalanan-dinas-${trxOnduty.classification === 'OS' ? 'os' : 'karyawan'}/${useEncrypt(trxOnduty.on_duty_number)}`,
            };

            let html = await ejs.renderFile("view/pumpjum/mailPerjalananDinasSendToQad.ejs", {
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

export const PUMPJUM_PerjalananDinasHistoryApproval = async (req, res) => {
    try {
      const on_duty_number = req.query.on_duty_number;

      let query = await db("dbPortalFA.dbo.trx_onduty_approval as odt")
      .select(
        "odt.on_duty_number",
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
      .where("odt.on_duty_number", on_duty_number)
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

// Download attachment Perjalanan dinas
export const PUMPJUM_PerjalananDinasDownloadAttachment = async (req, res) => {
    try {
        const {
            on_duty_number,
        } = req.body;

        let query = await db("dbPortalFA.dbo.trx_onduty as odt")
        .select(
            "odt.on_duty_number",
            "odt.on_duty_type",
            "odt.file_attachment",
        )
        .where("on_duty_number", on_duty_number)
        .first();

        const attachment = await downloadFileWithParams(query.file_attachment, 'pum-pjum/lamp-perjadin');

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
