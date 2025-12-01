import { db, dbDbcHris, dbHris } from '../../../config/db.js';
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import dayjs from 'dayjs';
import {
  formatRupiah2,
  encryptString,
  getWSA,
} from "../../../helpers/utils.js";
import { sendMailNew } from "../../../helpers/mail.js";
import ejs from "ejs";

dotenv.config();

// Get List of Non Perjalanan dinas
export const PUMPJUM_MonitoringPUMPJUM = async (req, res) => {
    const { rowsPerPage, page } = req.query;

    const domain = req.query.domain || req.body.domain || req.params.domain;
    const sortBy = req.query.sortBy || 'created_date';
    const sort = req.query.descending === "true" ? "desc" : "asc";

    if (!domain) {
        return res.status(400).json({ error: 'Missing domain parameter' });
    }

    try {
        const dataAllocation = await db("dbPortalFA.dbo.trx_onduty as to2")
          .select(
            "to2.payment_method_id",
            "to2.description as keterangan",
            "to2.on_duty_value as nominal",
            "to2.allocation_key",
            "to2.inv_status",
            "mpm.method_name as payment_method",
            "employee_name"
          )
          .innerJoin(
            "dbPortalFA.dbo.mstr_payment_method as mpm",
            "to2.payment_method_id",
            "mpm.id"
          )
          .whereNotNull("to2.allocation_key")
          .where("to2.allocation_key", "<>", "")
          .where("to2.allocation_key", "<>", "")
          .unionAll([
            db("dbPortalFA.dbo.trx_nonduty_header as tnh")
              .select(
                "tnh.payment_method_id",
                "tnh.description as keterangan",
                db.raw(
                  `(SELECT SUM(amount) FROM dbPortalFA.dbo.trx_nonduty_detail tnd WHERE tnd.pum_number = tnh.pum_number) as nominal`
                ),
                "tnh.pum_number as allocation_key",
                "tnh.inv_status",
                "mpm.method_name as payment_method",
                "u.user_name as employee_name"
              )
              .innerJoin(
                "dbPortalFA.dbo.mstr_payment_method as mpm",
                "tnh.payment_method_id",
                "mpm.id"
              )
              .innerJoin(
                "dbPortalFA.dbo.users as u",
                "tnh.employee_nik",
                "u.user_nik"
              )
              .whereNotNull("tnh.pum_number")
              .where("tnh.pum_number", "<>", ""),
          ]);

          const mapAllocation = new Map();
          dataAllocation.forEach((item) => {
            mapAllocation.set(item.allocation_key, item);
          });

        //   console.log("mapAllocation", mapAllocation);

          let resWsa = [];
          let args;           
          let callWsa;
          if (req.query.formFilterQad == "Supplier Invoice") {            
            args = {
                parDomain: req.query.formFilterDomain,
                supCode: "",
                noTT: "",
                noInv: "",
                postdatefr: req.query.dateFrom
                ? dayjs(req.query.dateFrom).format("MM/DD/YYYY")
                : null,
                postdateto: req.query.dateTo
                ? dayjs(req.query.dateTo).format("MM/DD/YYYY")
                : null,
            };
            callWsa = await getWSA(process.env.WSA, "getDBCsuppinv", args);
            // console.log(callWsa.tinv.tinvRow);
          }else{            
            args = {
                parDomain: req.query.formFilterDomain,
                itemkey: "",
                postdatefr: req.query.dateFrom
                ? dayjs(req.query.dateFrom).format("MM/DD/YYYY")
                : null,
                postdateto: req.query.dateTo
                ? dayjs(req.query.dateTo).format("MM/DD/YYYY")
                : null,
            };
            callWsa = await getWSA(process.env.WSA, "getDBCPettyCash", args);
            // console.log(callWsa.tt_pettycash.tt_pettycashRow);
          }

          let resGabungan;
          if (req.query.formFilterQad == "Supplier Invoice") {
            resWsa = callWsa.tinv.tinvRow;
            
            resGabungan = resWsa
              .map((item) => {
                // Cari allocation berdasarkan reference
                const found = dataAllocation.find(
                  (d) => d.allocation_key === item.reference
                );

                if (!found) return null; // abaikan jika tidak cocok

                // Gabungkan data
                const gabungan = {
                  ...item,
                  ...found,
                };
                gabungan.pum = gabungan.allocation_key;
                gabungan.tanggalpum = gabungan.postingdate
                  ? dayjs(gabungan.postingdate).format("DD MMM YYYY")
                  : "";
                gabungan.pjum = gabungan.postingdate && gabungan.daybok === 'APINV'
                  ? dayjs(gabungan.postingdate).format("DD MMM YYYY")
                  : "";
                gabungan.penyelesaian_tanggal = "";
                gabungan.keterangan_user = "";
                gabungan.lama = "";
                gabungan.selisih = "";
                gabungan.batas_maksimal = "";
                gabungan.keterangan_tambahan = "";
                gabungan.checklist = "";

                // if (gabungan.inv_status === "AP-NPRelase" && gabungan.daybok === "APDP") {
                //   gabungan.bgapdp = gabungan.voucherno;
                // } else {
                //   gabungan.bgapdp = null;
                // }
                if (gabungan.daybok === "APDP") {
                  gabungan.bgapdp = `${gabungan.daybok}${gabungan.voucherno}`;
                }

                if (gabungan.daybok === "APINV") {
                  gabungan.apinv = `${gabungan.daybok}${gabungan.voucherno}`;
                } else {
                  gabungan.apinv = null;
                }

                if (gabungan.allocation_key && gabungan.pjum) {
                  gabungan.status = "CLOSE";
                } else {
                  gabungan.status = "OPEN";
                }

                return gabungan;
              })
              .filter((item) => item !== null)
              .map((item, idx) => ({
                ...item,
                no: idx + 1
              }));
            
          }else{
            resWsa = callWsa.tt_pettycash.tt_pettycashRow;

            resGabungan = resWsa
              .map((item) => {
                const found = dataAllocation.find((d) => {
                  return d.allocation_key === item.ttallockey;
                });

                if (!found) return null; // abaikan jika tidak cocok

                // Gabungkan data
                const gabungan = {
                  ...item,
                  ...found,
                };

                gabungan.pum = gabungan.allocation_key;
                gabungan.tanggalpum = gabungan.ttpostdate && gabungan.ttdaybook === 'CB'
                  ? dayjs(gabungan.ttpostdate).format("DD MMM YYYY")
                  : "";
                gabungan.pjum = gabungan.ttdaybook === 'CB' && gabungan.ttcredit > 0 && gabungan.ttpostdate
                  ? dayjs(gabungan.ttpostdate).format("DD MMM YYYY")
                  : "";
                gabungan.penyelesaian_tanggal = "";
                gabungan.keterangan_user = "";
                gabungan.lama = "";
                gabungan.selisih = "";
                gabungan.batas_maksimal = "";
                gabungan.keterangan_tambahan = "";
                gabungan.checklist = "";
                gabungan.bgapdp = gabungan.ttdaybook === 'CB' && gabungan.ttcredit < 0 ? `${gabungan.ttdaybook}${gabungan.ttvoucher}` : null;
                gabungan.apinv = gabungan.ttdaybook === 'CB' && gabungan.ttcredit > 0 ? `${gabungan.ttdaybook}${gabungan.ttvoucher}` : null;

                if (gabungan.allocation_key && gabungan.pjum) {
                  gabungan.status = "CLOSE";
                } else {
                  gabungan.status = "OPEN";
                }

                return gabungan;
              })
              .filter((item) => item !== null)
              .map((item, idx) => ({
                ...item,
                no: idx + 1,
              }));
          }
          // console.log(resGabungan);
        //   console.log(callWsa);
        //   resWsa = callWsa.tt_site.tt_siteRow;
        // console.log(callWsa.tinv.tinvRow);
        
        return res.status(200).json({
            message: 'Success',
            data: resGabungan,
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

export const PUMPJUM_MonitoringPUMPJUMNew = async (req, res) => {
    const { rowsPerPage, page } = req.query;

    const domain = req.query.domain || req.body.domain || req.params.domain;
    const sortBy = req.query.sortBy || 'tanggal_pum';
    const sort = req.query.descending === "true" ? "desc" : "asc";

    if (!domain) {
        return res.status(400).json({ error: 'Missing domain parameter' });
    }

    if (!req.query.dateFrom || !req.query.dateTo) {
        return res.status(400).json({ error: 'Missing date parameter' });
    }

    try {
        const response = await db("dbPortalFA.dbo.monitoring_pum as mon")
            .select(
                "mon.*",
            )
            .whereBetween("mon.tanggal_pum", [req.query.dateFrom, req.query.dateTo])
            .modify((query) => {
                if (req.query.formFilterQad) {
                    if (req.query.formFilterQad === 'Supplier Invoice') {
                        query.where('mon.payment_method_id', 2);
                    } else {
                        query.where('mon.payment_method_id', 1);
                    }
                }
                if (domain) {
                    query.where('mon.domain', domain);
                }
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere("mon.pum_number", "like", search)
                            .orWhere("mon.status", "like", search);
                    });
                }
            })
            .orderBy(sortBy, sort);

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

export const PUMPJUM_SyncMonitoringPUMPJUM = async (req, res) => {
    const trx = await db.transaction();
    try {
        // Ambil semua data monitoring (Duty + Non Duty)
        const dataMonitoring = await trx("dbPortalFA.dbo.trx_onduty as to2")
            .select(
                "to2.domain",
                "to2.description as keterangan",
                db.raw("COALESCE(to2.on_duty_value_ap, to2.on_duty_value) as nominal"),
                "to2.pum_number",
                "to2.allocation_key",
                "to2.inv_status",
                "to2.payment_method_id",
                "mpm.method_name as payment_method",
                "to2.employee_nik",
                "to2.employee_name",
                "to2.updated_date as tanggal_pum",
                db.raw("'Duty' as type_pum")
            )
            .innerJoin(
                "dbPortalFA.dbo.mstr_payment_method as mpm",
                "to2.payment_method_id",
                "mpm.id"
            )
            .whereNotNull("to2.allocation_key")
            .where("to2.allocation_key", "<>", "")
            .where("to2.status_data", "Created QAD")
            .unionAll([
                trx("dbPortalFA.dbo.trx_nonduty_header as tnh")
                    .select(
                        "tnh.domain",
                        "tnh.description as keterangan",
                        "tnh.tc_amount as nominal",
                        "tnh.pum_number",
                        "tnh.pum_number as allocation_key",
                        "tnh.inv_status",
                        "tnh.payment_method_id",
                        "mpm.method_name as payment_method",
                        "tnh.employee_nik",
                        "u.user_name as employee_name",
                        "tnh.updated_date as tanggal_pum",
                        db.raw("'Non Duty' as type_pum")
                    )
                    .innerJoin(
                        "dbPortalFA.dbo.mstr_payment_method as mpm",
                        "tnh.payment_method_id",
                        "mpm.id"
                    )
                    .innerJoin(
                        "dbPortalFA.dbo.users as u",
                        "tnh.employee_nik",
                        "u.user_nik"
                    )
                    .whereNotNull("tnh.pum_number")
                    .where("tnh.pum_number", "<>", "")
                    .where("tnh.status_data", "Created QAD")
            ]);

        // Ambil semua pum_number yang sudah ada di monitoring_pum (tanpa pluck)
        const existingRows = await trx("dbPortalFA.dbo.monitoring_pum").select("pum_number");
        const existingPumNumbers = existingRows.map(row => row.pum_number);

        // Filter data baru yang belum ada di DB
        const newData = dataMonitoring.filter(
            (item) => !existingPumNumbers.includes(item.pum_number)
        );

         const mappedData = newData.map(item => ({
            domain: item.domain,
            pum_number: item.pum_number,
            payment_method_id: item.payment_method_id,
            type_pum: item.type_pum,
            keterangan: item.keterangan,
            employeenik: item.employee_nik,
            employeename: item.employee_name,
            tanggal_pum: item.tanggal_pum,
            nominal: item.nominal,
            status: 'OPEN',
            created_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        }));

        // Insert jika ada data baru
        if (mappedData.length > 0) {
            await trx("dbPortalFA.dbo.monitoring_pum").insert(mappedData);
        }

        // Commit transaksi
        await trx.commit();

        return res.status(200).json({
            message: 'Data berhasil disinkronkan',
            inserted: mappedData.length,
            skipped: dataMonitoring.length - mappedData.length,
        });

    } catch (error) {
        console.error(error);
        await trx.rollback();
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1
                ? error.message
                : 'Aplikasi sedang mengalami gangguan, silakan hubungi tim IT',
        });
    }
};

export const PUMPJUM_SyncToQadMonitoringPUMPJUM = async (req, res, isFromScheduler = false) => {
    const trx = await db.transaction();
    try {
        const dataMonitoring = await trx("dbPortalFA.dbo.monitoring_pum")
            .select(
                "pum_number",
                "payment_method_id",
                "tanggal_pum",
                "keterangan",
                "type_pum",
            )
            .where("status", "OPEN")
            .orderBy("tanggal_pum", "asc");
        
        if (!dataMonitoring.length) {
            await trx.commit();
            if (isFromScheduler) {
                return { success: true, message: "Tidak ada data OPEN untuk disinkronkan." };
            } else {
                return res.status(200).json({ message: "Tidak ada data OPEN untuk disinkronkan." });
            }
        }

        const dataSupplier = dataMonitoring.filter((d) => d.payment_method_id === 2);
        const dataPetty = dataMonitoring.filter((d) => d.payment_method_id === 1);

        const fetchWSAData = async (type, dateFrom, dateTo) => {
            let args = {};
            if (type === "Supplier") {
                args = {
                    parDomain: "120",
                    supCode: "",
                    noTT: "",
                    noInv: "",
                    postdatefr: dateFrom ? dayjs(dateFrom).format("MM/DD/YYYY") : null,
                    postdateto: dateTo ? dayjs(dateTo).format("MM/DD/YYYY") : null,
                };
            } else if (type === "Petty") {
                args = {
                    parDomain: "120",
                    itemkey: "",
                    postdatefr: dateFrom ? dayjs(dateFrom).format("MM/DD/YYYY") : null,
                    postdateto: dateTo ? dayjs(dateTo).format("MM/DD/YYYY") : null,
                };
            }
            let method = type === "Supplier" ? "getDBCsuppinv" : "getDBCPettyCash";
            return await getWSA(process.env.WSA, method, args);
        };

        const getRangeDate = (data) => {
            const sorted = data.sort((a, b) => new Date(a.tanggal_pum) - new Date(b.tanggal_pum));
            return [sorted[0]?.tanggal_pum, sorted[sorted.length - 1]?.tanggal_pum];
        };

        const resultGabungan = [];

        // supp inv
        // if (dataSupplier.length > 0) {
        //     const [dateFrom, dateTo] = getRangeDate(dataSupplier);
        //     const callWsa = await fetchWSAData("Supplier", dateFrom, dateTo);
        //     const resWsa = callWsa?.tinv?.tinvRow || [];
        //     console.log(resWsa)
        //     const mapped = resWsa
        //         .map((item) => {
        //             const found = dataSupplier.find((d) => d.pum_number === item.reference);
        //             if (!found) return null;

        //             return {
        //                 // ...item,
        //                 // ...found,
        //                 pum_number: found.pum_number,
        //                 tanggal_pum: item.postingdate && item.daybok === "APDP" ? dayjs(item.postingdate).format("YYYY-MM-DD HH:mm:ss") : null,
        //                 tanggal_pjum: item.postingdate && item.daybok === "APINV" ? dayjs(item.postingdate).format("YYYY-MM-DD HH:mm:ss") : null,
        //                 bukti_apdp: item.daybok === "APDP" ? `${item.daybok}${item.voucherno}` : null,
        //                 bukti_apinv: item.daybok === "APINV" ? `${item.daybok}${item.voucherno}` : null,
        //                 status: item.reference && item.postingdate && item.daybok === "APINV" ? "CLOSE" : "OPEN",
        //                 type_pum: found.type_pum,
        //                 payment_method_id: found.payment_method_id,
        //             };

                                    
        //         })
        //         .filter(Boolean);
        //     resultGabungan.push(...mapped);
        // }

        if (dataSupplier.length > 0) {
            const [dateFrom, dateTo] = getRangeDate(dataSupplier);
            const dateToPlus = dayjs().add(1, 'day').format('YYYY-MM-DD');
            const callWsa = await fetchWSAData("Supplier", dateFrom, dateToPlus);
            const resWsa = callWsa?.tinv?.tinvRow || [];

            const resWsaFiltered = resWsa.filter(item => item.reference);

            // Group data berdasarkan item.reference (pum_number)
            const grouped = {};
            for (const item of resWsaFiltered) {
                const key = item.reference;
                if (!grouped[key]) {
                    grouped[key] = [];
                }
                grouped[key].push(item);
            }

            // Proses masing-masing group berdasarkan reference
            const mapped = Object.keys(grouped).map(reference => {
                const items = grouped[reference];
                const found = dataSupplier.find((d) => d.pum_number === reference);
                if (!found) return null;

                // Ambil item APDP dengan postingdate terbaru (dan voucherno terbesar jika sama)
                const apdpItems = items.filter(i => i.daybok === 'APDP');
                let latestAPDP = null;
                for (const item of apdpItems) {
                    if (!latestAPDP || new Date(item.postingdate) > new Date(latestAPDP.postingdate) ||
                    (new Date(item.postingdate).getTime() === new Date(latestAPDP.postingdate).getTime() && item.voucherno > latestAPDP.voucherno)) {
                        latestAPDP = item;
                    }
                }

                // Ambil item APINV dengan postingdate terbaru (dan voucherno terbesar jika sama)
                const apinvItems = items.filter(i => i.daybok === 'APINV');
                let latestAPINV = null;
                for (const item of apinvItems) {
                    if ( !latestAPINV || new Date(item.postingdate) > new Date(latestAPINV.postingdate) ||
                    (new Date(item.postingdate).getTime() === new Date(latestAPINV.postingdate).getTime() && item.voucherno > latestAPINV.voucherno)) {
                        latestAPINV = item;
                    }
                }

                return {
                    pum_number: reference,
                    tanggal_pum: latestAPDP?.postingdate ? dayjs(latestAPDP.postingdate).format("YYYY-MM-DD HH:mm:ss") : null,
                    bukti_apdp: latestAPDP ? `${latestAPDP.daybok}${latestAPDP.voucherno}` : null,
                    tanggal_pjum: latestAPINV?.postingdate ? dayjs(latestAPINV.postingdate).format("YYYY-MM-DD HH:mm:ss") : null,
                    bukti_apinv: latestAPINV ? `${latestAPINV.daybok}${latestAPINV.voucherno}` : null,
                    status: latestAPINV && latestAPINV.postingdate ? "CLOSE" : "OPEN",
                    type_pum: found.type_pum,
                    payment_method_id: found.payment_method_id,
                };
            }).filter(Boolean);

            resultGabungan.push(...mapped);
        }

        // petty cash
        // if (dataPetty.length > 0) {
        //     const [dateFrom, dateTo] = getRangeDate(dataPetty);
        //     const callWsa = await fetchWSAData("Petty", dateFrom, dateTo);
        //     const resWsa = callWsa?.tt_pettycash?.tt_pettycashRow || [];

        //     const mapped = resWsa
        //         .map((item) => {
        //             const found = dataPetty.find((d) => d.pum_number === item.ttallockey);
        //             if (!found) return null;

        //             return {
        //                 // ...item,
        //                 // ...found,
        //                 pum_number: found.pum_number,
        //                 tanggal_pum: item.ttpostdate && item.ttdaybook === "CB" ? dayjs(item.ttpostdate).format("YYYY-MM-DD HH:mm:ss") : null,
        //                 tanggal_pjum: item.ttdaybook === "CB" && item.ttcredit > 0 && item.ttpostdate
        //                     ? dayjs(item.ttpostdate).format("YYYY-MM-DD HH:mm:ss") : null,
        //                 bukti_apdp: item.ttdaybook === "CB" && item.ttcredit < 0 ? `${item.ttdaybook}${item.ttvoucher}` : null,
        //                 bukti_apinv: item.ttdaybook === "CB" && item.ttcredit > 0 ? `${item.ttdaybook}${item.ttvoucher}` : null,
        //                 status: item.ttallockey && item.ttpostdate && item.ttcredit > 0 ? "CLOSE" : "OPEN",
        //                 type_pum: found.type_pum,
        //             };
        //         })
        //         .filter(Boolean);
        //         // resultGabungan.push({
        //         //     pum_number: 'BB-0090004',
        //         //     tanggal_pjum: null,
        //         //     bukti_apinv: null,
        //         //     status: 'CLOSE',
        //         //     type_pum: 'Duty',
        //         // })
        //     resultGabungan.push(...mapped);
        // }

        if (dataPetty.length > 0) {
            const [dateFrom, dateTo] = getRangeDate(dataPetty);
            const dateToPlus = dayjs().add(1, 'day').format('YYYY-MM-DD');
            const callWsa = await fetchWSAData("Petty", dateFrom, dateToPlus);
            const resWsa = callWsa?.tt_pettycash?.tt_pettycashRow || [];

            // Gabungkan data berdasarkan ttallockey
            const grouped = resWsa.reduce((acc, item) => {
                const key = item.ttallockey;
                if (!acc[key]) acc[key] = [];
                acc[key].push(item);
                return acc;
            }, {});

            const mapped = Object.entries(grouped).map(([ttallockey, items]) => {
                const found = dataPetty.find((d) => d.pum_number === ttallockey);
                if (!found) return null;

                let tanggal_pum = null;
                let tanggal_pjum = null;
                let bukti_apdp = null;
                let bukti_apinv = null;

                for (const item of items) {
                    const isCB = item.ttdaybook?.includes("CB");
                    const postDate = item.ttpostdate ? dayjs(item.ttpostdate).format("YYYY-MM-DD HH:mm:ss") : null;

                    if (isCB && item.ttcredit < 0) {
                        tanggal_pum = postDate;
                        bukti_apdp = `${item.ttdaybook}-${item.ttvoucher}`;
                    }

                    if (isCB && item.ttcredit > 0) {
                        tanggal_pjum = postDate;
                        bukti_apinv = `${item.ttdaybook}-${item.ttvoucher}`;
                    }
                }

                return {
                    pum_number: ttallockey,
                    tanggal_pum,
                    tanggal_pjum,
                    bukti_apdp,
                    bukti_apinv,
                    status: tanggal_pum && tanggal_pjum ? "CLOSE" : "OPEN",
                    type_pum: found.type_pum,
                    payment_method_id: found.payment_method_id,
                };
            }).filter(Boolean);

            resultGabungan.push(...mapped);
        }

        // Update ke database monitoring_pum
        for (const item of resultGabungan) {
            let payload = {};
            if (item.tanggal_pum) {
                payload.tanggal_pum = item.tanggal_pum;
            }
            if (item.bukti_apdp) {
                payload.bukti_apdp = item.bukti_apdp;
            }
            if (item.tanggal_pjum) {
                payload.tanggal_pjum = item.tanggal_pjum;
            }
            if (item.bukti_apinv) {
                payload.bukti_apinv = item.bukti_apinv;
            }
            await trx("dbPortalFA.dbo.monitoring_pum")
                .update({
                    ...payload,
                    // tanggal_pum: item.tanggal_pum,
                    status: item.status,
                    updated_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                })
                .where("pum_number", item.pum_number);
            
            if (item.status === 'CLOSE') {
                if (item.type_pum === 'Duty') {
                    await trx("dbPortalFA.dbo.trx_onduty")
                        .where("pum_number", item.pum_number)
                        .update({ status_data: 'Closed' });
                } else {
                    await trx("dbPortalFA.dbo.trx_nonduty_header")
                        .where("pum_number", item.pum_number)
                        .update({ status_data: 'Closed' });
                }
            }
        }

        await trx.commit();
        if (isFromScheduler) {
            return { success: true, message: "Data monitoring berhasil diperbarui" };
        } else {
            return res.status(200).json(resultGabungan);
        }

    } catch (err) {
        await trx.rollback();
        console.error(err);
        if (!isFromScheduler) {
            return res.status(500).json({
                type: "error",
                message: process.env.DEBUG == 1 ? err.message : "Terjadi kesalahan, silakan hubungi tim IT.",
            });
        }
    }
};
