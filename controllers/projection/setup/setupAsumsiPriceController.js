import { db } from "../../../config/db.js";
import * as dotenv from 'dotenv' ;
import dayjs from "dayjs";
import xlsx from 'xlsx';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { roundValue } from "../../../helpers/utils.js";

dotenv.config()

// Get list setup asumsi price
export const Projection_listAsumsiPrice = async (req, res) => {
    try {
        let response;

        const {rowsPerPage, page, domain} = req.query;

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db("dbPortalFA.dbo.asumsi_price_pnl")
            .select('domain', 'tahun')
            .where('domain', domain)
            .groupBy('tahun', 'domain')
            .orderBy('tahun', 'desc');
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db("dbPortalFA.dbo.asumsi_price_pnl")
            .select('domain', 'tahun')
            .where('domain', domain)
            .groupBy('tahun', 'domain')
            .orderBy('tahun', 'desc')
            .paginate({
                perPage: Math.abs(Math.floor(parseInt(rowsPerPage, 10))),
                currentPage: pages,
                isLengthAware: true,
            });
        }

        return res.status(200).json({
            message: 'Success',
            data: response
        });
    } catch(error){
        return res.status(406).json(
        {
            type:'error',
            message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
        });
    }
}

// Get list setup asumsi price
export const Projection_searchAsumsiPrice = async (req, res) => {
    try {
        let response;

        const {rowsPerPage, page, domain, search} = req.query;

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db("dbPortalFA.dbo.asumsi_price_pnl")
            .select('domain', 'tahun')
            .where('domain', domain)
            .where('tahun', search)
            .groupBy('tahun', 'domain')
            .orderBy('tahun', 'desc');
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db("dbPortalFA.dbo.asumsi_price_pnl")
            .select('domain', 'tahun')
            .where('domain', domain)
            .where('tahun', search)
            .groupBy('tahun', 'domain')
            .orderBy('tahun', 'desc')
            .paginate({
                perPage: Math.abs(Math.floor(parseInt(rowsPerPage, 10))),
                currentPage: pages,
                isLengthAware: true,
            });
        }

        return res.status(200).json({
            message: 'Success',
            data: response
        });
    } catch(error){
        return res.status(406).json(
        {
            type:'error',
            message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
        });
    }
}

// Get list setup asumsi price by year
export const Projection_listAsumsiPriceByYear = async (req, res) => {
    try {
        let response;

        const {rowsPerPage, page, domain, tahun} = req.query;

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db("dbPortalFA.dbo.asumsi_price_pnl as app")
            .select(
                'jp.jenis_produksi',
                'app.jenis_produksi_id',
                'app.domain',
                'app.tahun',
                db.raw('MAX(app.asumsi_price_pnl_id) as asumsi_price_pnl_id')
            )
            .join('dbPortalFA.dbo.jenis_produksi as jp', 'app.jenis_produksi_id', '=', 'jp.jenis_produksi_id')
            .where('app.domain', domain)
            .where('app.tahun', tahun)
            .groupBy(
                'jp.jenis_produksi',
                'app.jenis_produksi_id',
                'app.domain',
                'app.tahun'
            )
            .orderBy('app.tahun', 'desc');
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db("dbPortalFA.dbo.asumsi_price_pnl as app")
            .select(
                'jp.jenis_produksi',
                'app.jenis_produksi_id',
                'app.domain',
                'app.tahun',
                db.raw('MAX(app.asumsi_price_pnl_id) as asumsi_price_pnl_id')
            )
            .join('dbPortalFA.dbo.jenis_produksi as jp', 'app.jenis_produksi_id', '=', 'jp.jenis_produksi_id')
            .where('app.domain', domain)
            .where('app.tahun', tahun)
            .groupBy(
                'jp.jenis_produksi',
                'app.jenis_produksi_id',
                'app.domain',
                'app.tahun'
            )
            .orderBy('app.tahun', 'desc')
            .paginate({
                perPage: Math.abs(Math.floor(parseInt(rowsPerPage, 10))),
                currentPage: pages,
                isLengthAware: true,
            });
        }

        return res.status(200).json({
            message: 'Success',
            data: response
        });
    } catch(error){
        return res.status(406).json(
        {
            type:'error',
            message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
        });
    }
}

// Search setup asumsi price by year
export const Projection_searchAsumsiPriceByYear = async (req, res) => {
    try {
        let response;

        const {rowsPerPage, page, domain, tahun, search} = req.query;

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db("dbPortalFA.dbo.asumsi_price_pnl as app")
            .select(
                'jp.jenis_produksi',
                'app.jenis_produksi_id',
                'app.domain',
                'app.tahun',
                db.raw('MAX(app.asumsi_price_pnl_id) as asumsi_price_pnl_id')
            )
            .join('dbPortalFA.dbo.jenis_produksi as jp', 'app.jenis_produksi_id', '=', 'jp.jenis_produksi_id')
            .where('app.domain', domain)
            .where('app.tahun', tahun)
            .andWhere('jp.jenis_produksi', 'like', `%${search}%`)
            .groupBy(
                'jp.jenis_produksi',
                'app.jenis_produksi_id',
                'app.domain',
                'app.tahun'
            )
            .orderBy('app.tahun', 'desc');
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db("dbPortalFA.dbo.asumsi_price_pnl as app")
            .select(
                'jp.jenis_produksi',
                'app.jenis_produksi_id',
                'app.domain',
                'app.tahun',
                db.raw('MAX(app.asumsi_price_pnl_id) as asumsi_price_pnl_id')
            )
            .join('dbPortalFA.dbo.jenis_produksi as jp', 'app.jenis_produksi_id', '=', 'jp.jenis_produksi_id')
            .where('app.domain', domain)
            .where('app.tahun', tahun)
            .andWhere('jp.jenis_produksi', 'like', `%${search}%`)
            .groupBy(
                'jp.jenis_produksi',
                'app.jenis_produksi_id',
                'app.domain',
                'app.tahun'
            )
            .orderBy('app.tahun', 'desc')
            .paginate({
                perPage: Math.abs(Math.floor(parseInt(rowsPerPage, 10))),
                currentPage: pages,
                isLengthAware: true,
            });
        }

        return res.status(200).json({
            message: 'Success',
            data: response
        });
    } catch(error){
        return res.status(406).json(
        {
            type:'error',
            message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
        });
    }
}

// Get detail setup asumsi price
export const Projection_detailAsumsiPriceByJenis = async (req, res) => {
    try {
        const {domain, tahun, jenis_produksi_id, empid} = req.query;

        const response = await db("dbPortalFA.dbo.asumsi_price_pnl as app")
        .select(
            'jp.jenis_produksi',
            'app.jenis_produksi_id',
            'app.domain',
            'app.tahun',
            'app.bulan',
            'app.asumsi_price_pnl_id',
            'app.avg_price_budget',
            'app.avg_price_proyeksi',
            'app.diskon_budget',
            'app.diskon_proyeksi',
            'app.hpp_budget',
            'app.hpp_proyeksi',
        )
        .join('dbPortalFA.dbo.jenis_produksi as jp', 'app.jenis_produksi_id', '=', 'jp.jenis_produksi_id')
        .where('app.domain', domain)
        .where('app.tahun', tahun)
        .where('app.jenis_produksi_id', jenis_produksi_id)
        .orderBy('app.bulan', 'asc');

        const getAdmin = await db("dbPortalFA.dbo.user_access")
            .select('access_admin')
            .where('access_empid', empid)
            .where('access_menu', '/setup_asumsi_price/list')
            .first();

        const isAdmin = getAdmin && getAdmin.access_admin == 1 ? true : false;
        
        const currentMonth = dayjs().month() + 1;
        const currentYear = dayjs().year();

        response.forEach((data) => {
            if(tahun === currentYear){
                if(data.bulan < currentMonth && !isAdmin) data.isLocked = true;
                else data.isLocked = false;
            } else if(tahun < currentYear) {
                if(!isAdmin) data.isLocked = true;
                else data.isLocked = false;
            }  else {
                data.isLocked = false;
            }
        })

        return res.status(200).json({
            message: 'Success',
            data: response
        });
    } catch(error){
        return res.status(406).json(
        {
            type:'error',
            message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
        });
    }
}

// Get list jenis produksi volume sales
export const Projection_listJenisProduksiAsumsiPrice = async (req, res) => {
    try {
        const {domain, tahun } = req.query;

        const response = await db("dbPortalFA.dbo.jenis_produksi as jp")
        .select(
            'jp.jenis_produksi_id',
            'jp.domain',
            'jp.jenis_produksi',
            'jp.desc'
        )
        .leftJoin('dbPortalFA.dbo.asumsi_price_pnl as app', function() {
            this.on('jp.jenis_produksi_id', '=', 'app.jenis_produksi_id')
                .andOn('jp.domain', '=', 'app.domain')
                .andOn('app.tahun', '=', parseInt(tahun));
        })
        .where('jp.domain', domain)
        .whereNull('app.jenis_produksi_id') 
        .orderBy('jp.jenis_produksi_id', 'desc');

        return res.status(200).json({
            message: 'Success',
            data: response
        });
    } catch(error){
        return res.status(406).json(
        {
            type:'error',
            message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
        });
    }
}

// Create data asumsi price
export const Projection_CreateAsumsiPrice = async (req, res) => {
    const trx = await db.transaction();
    try {
        const {
            tahun,
            jenis_produksi_id,
            domain,
            asumsi
        } = req.body;

        // Validate user, and get user_nik to assign created_by
        const user = await db("dbPortalFA.dbo.users")
                        .select('user_nik')
                        .where('user_id', req.body.empid)
                        .first()

        if(!user) {
            await trx.rollback();
            return res.status(400).json({ message: 'Invalid user, silahkan hubungi Tim IT' });
        }

        const empid = user.user_nik;

        const jp = await trx('dbPortalFA.dbo.jenis_produksi')
            .select('jenis_produksi')
            .where('jenis_produksi_id', parseInt(jenis_produksi_id))
            .first();

        if (!jp) {
            await trx.rollback();
            return res.status(400).json({ message: `[${jp.jenis_produksi}] tidak dikenal` });
        }

        const errors = [];
        await Promise.all(
            asumsi.map(async (item) => {
                const cekdata = await trx('dbPortalFA.dbo.asumsi_price_pnl')
                    .select('asumsi_price_pnl_id')
                    .where('domain', domain)
                    .where('tahun', parseInt(tahun))
                    .where('bulan', parseInt(item.bulan))
                    .where('jenis_produksi_id', parseInt(jenis_produksi_id))
                    .first();
    
                if (cekdata) {
                    errors.push(`Jenis Produksi [${jenis_produksi_id}] pada tahun [${tahun}] duplicate for bulan [${item.bulan}].`);
                    return;
                }
    
                await trx("dbPortalFA.dbo.asumsi_price_pnl").insert({
                    domain: parseInt(domain),
                    tahun: parseInt(tahun),
                    bulan: parseInt(item.bulan),
                    jenis_produksi_id: jenis_produksi_id,
                    avg_price_budget: parseFloat(item.avgPriceBudget ?? 0),
                    avg_price_proyeksi: parseFloat(item.avgPriceProject ?? 0),
                    diskon_budget: parseFloat(item.discountBudget ?? 0),
                    diskon_proyeksi: parseFloat(item.discountProject ?? 0),
                    hpp_budget: parseFloat(item.hppBudget ?? 0),
                    hpp_proyeksi: parseFloat(item.hppProject ?? 0),
                    created_by: parseInt(empid),
                    created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                });
            })
        );

        if (errors.length > 0) {
            await trx.rollback();
            return res.status(400).json({ message: errors });
        }

        await trx.commit();
        return res.status(201).json({ message: 'Data berhasil dibuat' });
    } catch (error) {
        await trx.rollback();
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1 ? error.message : 'Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT',
        });
    }
}

// Update data asumsi price
export const Projection_UpdateAsumsiPrice = async (req, res) => {
    const trx = await db.transaction();
    try {
        const {
            jenis_produksi_id,
            asumsi
        } = req.body;

        // Validate user, and get user_nik to assign created_by
        const user = await db("dbPortalFA.dbo.users")
                        .select('user_nik')
                        .where('user_id', req.body.empid)
                        .first()

        if(!user) {
            await trx.rollback();
            return res.status(400).json({ message: 'Invalid user, silahkan hubungi Tim IT' });
        }

        const empid = user.user_nik;

        const jp = await trx('dbPortalFA.dbo.jenis_produksi')
            .select('jenis_produksi')
            .where('jenis_produksi_id', parseInt(jenis_produksi_id))
            .first();

        if (!jp) {
            await trx.rollback();
            return res.status(400).json({ message: `[${jp.jenis_produksi}] tidak dikenal` });
        }

        const errors = [];
        await Promise.all(
            asumsi.map(async (item) => {
                await trx("dbPortalFA.dbo.asumsi_price_pnl")
                .where('asumsi_price_pnl_id', item.asumsi_price_pnl_id)
                .update({
                    avg_price_budget: parseFloat(item.avg_price_budget ?? 0),
                    avg_price_proyeksi: parseFloat(item.avg_price_proyeksi ?? 0),
                    diskon_budget: parseFloat(item.diskon_budget ?? 0),
                    diskon_proyeksi: parseFloat(item.diskon_proyeksi ?? 0),
                    hpp_budget: parseFloat(item.hpp_budget ?? 0),
                    hpp_proyeksi: parseFloat(item.hpp_proyeksi ?? 0),
                    updated_by: parseInt(empid),
                    updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                });
            })
        );

        if (errors.length > 0) {
            await trx.rollback();
            return res.status(400).json({ message: errors });
        }

        await trx.commit();
        return res.status(201).json({ message: 'Data berhasil diubah' });
    } catch (error) {
        await trx.rollback();
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1 ? error.message : 'Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT',
        });
    }
}

// Upload excel template asumsi price
export const Projection_UploadAsumsiPrice = async (req, res) => {
    const trx = await db.transaction();
    try {
        let errorCounter = 0;
        let errorText = [];
        const dokumen = req.files.upload ? req.files.upload[0].filename : null;

        // Validate user, and get user_nik to assign created_by
        const user = await db("dbPortalFA.dbo.users")
                        .select('user_nik')
                        .where('user_id', req.body.empid)
                        .first()

        if(!user) {
            await trx.rollback();
            return res.status(400).json({ message: 'Invalid user, silahkan hubungi Tim IT' });
        }

        const empid = user.user_nik;
        const domain = req.body.domain;

        // If Dokumen exists
        if(!dokumen) {
            await trx.rollback();
            return res.status(400).json({ message: 'Gagal upload, silahkan hubungi Tim IT' });
        }

        // Check if file exists
        const filePath = `file/${dokumen}`;
        if (!fs.existsSync(filePath)) {
            await trx.rollback();
            return res.status(400).json({ message: 'Gagal upload, silahkan hubungi Tim IT' });
        }

        // Read XLSX file
        const file = xlsx.readFile(filePath);
        let data = [];
        const sheets = file.SheetNames;

        // Validasi data duplicate
        const itemCount = {}; 
    
        sheets.forEach((sheetName) => {  
            const temp = xlsx.utils.sheet_to_json(file.Sheets[sheetName]);
    
            temp.forEach((row, index) => {
                const transformedRow = Object.keys(row).reduce((acc, key) => {
                    const transformedKey = key.replace(/\s+/g, '_');
                    acc[transformedKey] = row[key];
                    return acc;
                }, {});

                if(transformedRow.Tahun !== '' && transformedRow.Bulan !== '' && transformedRow.Jenis_Produksi !== ''){
                    const id_jenis = String(transformedRow.ID_Jenis_Produksi); 
                    const tahun = transformedRow.Tahun;
                    const bulan = transformedRow.Bulan;
                    const code = `${id_jenis}-${tahun}-${bulan}-${domain}`;
                    
                    if (itemCount[code] && id_jenis !== null && id_jenis !== null && tahun !== '' && tahun !== null && bulan !== '' && bulan !== null) {  
                        itemCount[code].count++;
                        itemCount[code].lines.push(index + 1);
                    } else {  
                        itemCount[code] = { count: 1, lines: [index + 1] };
                    } 
                }
            }) 
        });  
            
        // Memeriksa kode yang muncul lebih dari sekali  
        for (const [key, value] of Object.entries(itemCount)) {  
            if (value.count > 1) {  
                errorCounter++;  
                errorText.push({
                    baris: value.lines.join(', '),
                    tahun: String(key).split("-")[1],
                    bulan: String(key).split("-")[2],
                    id_jenis_produksi: String(key).split("-")[0],
                    jenis_produksi: "",
                    avg_price_budget: "",
                    avg_price_proyeksi: "",
                    diskon_budget: "",
                    diskon_proyeksi: "",
                    hpp_budget: "",
                    hpp_proyeksi: "",
                    message: `Gagal Import pada baris (${value.lines.join(', ')}) : [${String(key).split("-")[0]} tahun ${String(key).split("-")[1]} bulan ${String(key).split("-")[2]}] Duplicate data.`
                });  
            }  
        } 

        // Process each sheet
        await Promise.all(
            sheets.map(async (sheetName) => {
                const temp = xlsx.utils.sheet_to_json(file.Sheets[sheetName]);

                // Process rows within the sheet
                await Promise.all(
                    temp.map(async (row, index) => {
                        // Transform keys with spaces to underscore format
                        const transformedRow = Object.keys(row).reduce((acc, key) => {
                            const transformedKey = key.replace(/\s+/g, '_');
                            acc[transformedKey] = row[key];
                            return acc;
                        }, {});

                        // Validation 
                        if (transformedRow.Tahun === "" && 
                            transformedRow.Bulan === "" &&
                            transformedRow.ID_Jenis_Produksi === "" && 
                            transformedRow.Jenis_Produksi === "" && 
                            transformedRow.Avg_Price_Budget === "" && 
                            transformedRow.Avg_Price_Proyeksi === "") {
                                return;
                            }
                
                        if (transformedRow.Tahun === null || typeof transformedRow.Tahun !== 'number') {
                            errorCounter++;
                            errorText.push(`Gagal Import pada baris (${index + 1}) : [Tahun] kolom wajib diisi.`);
                            if(transformedRow.Tahun < 0){
                                errorCounter++;
                                errorText.push({
                                    baris: index + 1,
                                    tahun: transformedRow.Tahun,
                                    bulan: transformedRow.Bulan,
                                    id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                    jenis_produksi: transformedRow.Jenis_Produksi,
                                    avg_price_budget: transformedRow.Avg_Price_Budget,
                                    avg_price_proyeksi: transformedRow.Avg_Price_Proyeksi,
                                    diskon_budget: transformedRow.Diskon_Budget,
                                    diskon_proyeksi: transformedRow.Diskon_Proyeksi,
                                    hpp_budget: transformedRow.HPP_Budget,
                                    hpp_proyeksi: transformedRow.HPP_Proyeksi,
                                    message: `Gagal Import pada baris (${index + 1}) : [Tahun] kolom tidak valid.`
                                });
                            }
                        }

                        if (transformedRow.Bulan === null || typeof transformedRow.Bulan !== 'number') {
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                tahun: transformedRow.Tahun,
                                bulan: transformedRow.Bulan,
                                id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                jenis_produksi: transformedRow.Jenis_Produksi,
                                avg_price_budget: transformedRow.Avg_Price_Budget,
                                avg_price_proyeksi: transformedRow.Avg_Price_Proyeksi,
                                diskon_budget: transformedRow.Diskon_Budget,
                                diskon_proyeksi: transformedRow.Diskon_Proyeksi,
                                hpp_budget: transformedRow.HPP_Budget,
                                hpp_proyeksi: transformedRow.HPP_Proyeksi,
                                message: `Gagal Import pada baris (${index + 1}) : [Bulan] kolom wajib diisi.`
                            });    
                        }
                
                        if(transformedRow.Bulan > 12 || transformedRow.Bulan < 0){
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                tahun: transformedRow.Tahun,
                                bulan: transformedRow.Bulan,
                                id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                jenis_produksi: transformedRow.Jenis_Produksi,
                                avg_price_budget: transformedRow.Avg_Price_Budget,
                                avg_price_proyeksi: transformedRow.Avg_Price_Proyeksi,
                                diskon_budget: transformedRow.Diskon_Budget,
                                diskon_proyeksi: transformedRow.Diskon_Proyeksi,
                                hpp_budget: transformedRow.HPP_Budget,
                                hpp_proyeksi: transformedRow.HPP_Proyeksi,
                                message: `Gagal Import pada baris (${index + 1}) : [Bulan] kolom tidak valid.`
                            });
                        }

                        if (transformedRow.ID_Jenis_Produksi === null || typeof parseInt(transformedRow.Jenis_Produksi) !== 'number') {
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                tahun: transformedRow.Tahun,
                                bulan: transformedRow.Bulan,
                                id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                jenis_produksi: transformedRow.Jenis_Produksi,
                                avg_price_budget: transformedRow.Avg_Price_Budget,
                                avg_price_proyeksi: transformedRow.Avg_Price_Proyeksi,
                                diskon_budget: transformedRow.Diskon_Budget,
                                diskon_proyeksi: transformedRow.Diskon_Proyeksi,
                                hpp_budget: transformedRow.HPP_Budget,
                                hpp_proyeksi: transformedRow.HPP_Proyeksi,
                                message: `Gagal Import pada baris (${index + 1}) : [Jenis Produksi] kolom wajib diisi.`
                            });
                        }

                        if (transformedRow.Jenis_Produksi === null || transformedRow.Jenis_Produksi === '' || typeof transformedRow.Jenis_Produksi !== 'string') {
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                tahun: transformedRow.Tahun,
                                bulan: transformedRow.Bulan,
                                id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                jenis_produksi: transformedRow.Jenis_Produksi,
                                avg_price_budget: transformedRow.Avg_Price_Budget,
                                avg_price_proyeksi: transformedRow.Avg_Price_Proyeksi,
                                diskon_budget: transformedRow.Diskon_Budget,
                                diskon_proyeksi: transformedRow.Diskon_Proyeksi,
                                hpp_budget: transformedRow.HPP_Budget,
                                hpp_proyeksi: transformedRow.HPP_Proyeksi,
                                message: `Gagal Import pada baris (${index + 1}) : [Jenis Produksi] kolom wajib diisi.`
                            });
                        }

                        const jenisproduksi_id = typeof transformedRow.ID_Jenis_Produksi !== "number" ? parseInt(transformedRow.ID_Jenis_Produksi) : transformedRow.ID_Jenis_Produksi;

                        const jenis_produksi = await trx('dbPortalFA.dbo.jenis_produksi')
                            .select('jenis_produksi_id')
                            .where('jenis_produksi_id', jenisproduksi_id)
                            .first();
                
                        if (!jenis_produksi) {
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                tahun: transformedRow.Tahun,
                                bulan: transformedRow.Bulan,
                                id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                jenis_produksi: transformedRow.Jenis_Produksi,
                                avg_price_budget: transformedRow.Avg_Price_Budget,
                                avg_price_proyeksi: transformedRow.Avg_Price_Proyeksi,
                                diskon_budget: transformedRow.Diskon_Budget,
                                diskon_proyeksi: transformedRow.Diskon_Proyeksi,
                                hpp_budget: transformedRow.HPP_Budget,
                                hpp_proyeksi: transformedRow.HPP_Proyeksi,
                                message: `Gagal Import pada baris (${index + 1}) : [${transformedRow.Jenis_Produksi}] tidak dikenal.`
                            });
                        }

                        if (transformedRow.Avg_Price_Budget === null || typeof transformedRow.Avg_Price_Budget !== 'number' || isNaN(parseFloat(String(transformedRow.Avg_Price_Budget).replace(/,/g, '')))) {
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                tahun: transformedRow.Tahun,
                                bulan: transformedRow.Bulan,
                                id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                jenis_produksi: transformedRow.Jenis_Produksi,
                                avg_price_budget: transformedRow.Avg_Price_Budget,
                                avg_price_proyeksi: transformedRow.Avg_Price_Proyeksi,
                                diskon_budget: transformedRow.Diskon_Budget,
                                diskon_proyeksi: transformedRow.Diskon_Proyeksi,
                                hpp_budget: transformedRow.HPP_Budget,
                                hpp_proyeksi: transformedRow.HPP_Proyeksi,
                                message: `Gagal Import pada baris (${index + 1}) : [Avg Price Budget] kolom harus berupa angka atau decimal.`
                            });
                        }

                        if (transformedRow.Avg_Price_Proyeksi === null || typeof transformedRow.Avg_Price_Proyeksi !== 'number' || isNaN(parseFloat(String(transformedRow.Avg_Price_Proyeksi).replace(/,/g, '')))) {
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                tahun: transformedRow.Tahun,
                                bulan: transformedRow.Bulan,
                                id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                jenis_produksi: transformedRow.Jenis_Produksi,
                                avg_price_budget: transformedRow.Avg_Price_Budget,
                                avg_price_proyeksi: transformedRow.Avg_Price_Proyeksi,
                                diskon_budget: transformedRow.Diskon_Budget,
                                diskon_proyeksi: transformedRow.Diskon_Proyeksi,
                                hpp_budget: transformedRow.HPP_Budget,
                                hpp_proyeksi: transformedRow.HPP_Proyeksi,
                                message: `Gagal Import pada baris (${index + 1}) : [Avg Price Proyeksi] kolom harus berupa angka atau decimal.`
                            });
                        }

                        if (transformedRow.Diskon_Budget === null || typeof transformedRow.Diskon_Budget !== 'number' || isNaN(parseFloat(String(transformedRow.Diskon_Budget).replace(/,/g, '')))) {
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                tahun: transformedRow.Tahun,
                                bulan: transformedRow.Bulan,
                                id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                jenis_produksi: transformedRow.Jenis_Produksi,
                                avg_price_budget: transformedRow.Avg_Price_Budget,
                                avg_price_proyeksi: transformedRow.Avg_Price_Proyeksi,
                                diskon_budget: transformedRow.Diskon_Budget,
                                diskon_proyeksi: transformedRow.Diskon_Proyeksi,
                                hpp_budget: transformedRow.HPP_Budget,
                                hpp_proyeksi: transformedRow.HPP_Proyeksi,
                                message: `Gagal Import pada baris (${index + 1}) : [Diskon Budget] kolom harus berupa angka atau decimal.`
                            });
                        }

                        if (transformedRow.Diskon_Proyeksi === null || typeof transformedRow.Diskon_Proyeksi !== 'number' || isNaN(parseFloat(String(transformedRow.Diskon_Proyeksi).replace(/,/g, '')))) {
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                tahun: transformedRow.Tahun,
                                bulan: transformedRow.Bulan,
                                id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                jenis_produksi: transformedRow.Jenis_Produksi,
                                avg_price_budget: transformedRow.Avg_Price_Budget,
                                avg_price_proyeksi: transformedRow.Avg_Price_Proyeksi,
                                diskon_budget: transformedRow.Diskon_Budget,
                                diskon_proyeksi: transformedRow.Diskon_Proyeksi,
                                hpp_budget: transformedRow.HPP_Budget,
                                hpp_proyeksi: transformedRow.HPP_Proyeksi,
                                message: `Gagal Import pada baris (${index + 1}) : [Diskon Proyeksi] kolom harus berupa angka atau decimal.`
                            });
                        }

                        if (transformedRow.HPP_Budget && isNaN(parseFloat(String(transformedRow.HPP_Budget).replace(/,/g, '')))) {
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                tahun: transformedRow.Tahun,
                                bulan: transformedRow.Bulan,
                                id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                jenis_produksi: transformedRow.Jenis_Produksi,
                                avg_price_budget: transformedRow.Avg_Price_Budget,
                                avg_price_proyeksi: transformedRow.Avg_Price_Proyeksi,
                                diskon_budget: transformedRow.Diskon_Budget,
                                diskon_proyeksi: transformedRow.Diskon_Proyeksi,
                                hpp_budget: transformedRow.HPP_Budget,
                                hpp_proyeksi: transformedRow.HPP_Proyeksi,
                                message: `Gagal Import pada baris (${index + 1}) : [HPP Budget] kolom harus berupa angka atau decimal.`
                            });
                        }

                        if (transformedRow.HPP_Proyeksi && isNaN(parseFloat(String(transformedRow.HPP_Proyeksi).replace(/,/g, '')))) {
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                tahun: transformedRow.Tahun,
                                bulan: transformedRow.Bulan,
                                id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                jenis_produksi: transformedRow.Jenis_Produksi,
                                avg_price_budget: transformedRow.Avg_Price_Budget,
                                avg_price_proyeksi: transformedRow.Avg_Price_Proyeksi,
                                diskon_budget: transformedRow.Diskon_Budget,
                                diskon_proyeksi: transformedRow.Diskon_Proyeksi,
                                hpp_budget: transformedRow.HPP_Budget,
                                hpp_proyeksi: transformedRow.HPP_Proyeksi,
                                message: `Gagal Import pada baris (${index + 1}) : [HPP Proyeksi] kolom harus berupa angka atau decimal.`
                            });
                        }

                        if(jenis_produksi && transformedRow.Tahun !== "" && transformedRow.Bulan !== ""){
                            const cekdata = await trx('dbPortalFA.dbo.asumsi_price_pnl')
                            .select('asumsi_price_pnl_id')
                            .where('domain', domain)
                            .where('tahun', transformedRow.Tahun)
                            .where('bulan', transformedRow.Bulan)
                            .where('jenis_produksi_id', jenis_produksi.jenis_produksi_id)
                            .first();
                    
                            if (cekdata) {
                                errorCounter++;
                                errorText.push({
                                    baris: index + 1,
                                    tahun: transformedRow.Tahun,
                                    bulan: transformedRow.Bulan,
                                    id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                    jenis_produksi: transformedRow.Jenis_Produksi,
                                    avg_price_budget: transformedRow.Avg_Price_Budget,
                                    avg_price_proyeksi: transformedRow.Avg_Price_Proyeksi,
                                    diskon_budget: transformedRow.Diskon_Budget,
                                    diskon_proyeksi: transformedRow.Diskon_Proyeksi,
                                    hpp_budget: transformedRow.HPP_Budget,
                                    hpp_proyeksi: transformedRow.HPP_Proyeksi,
                                    message: `Gagal Import pada baris (${index + 1}) : Currency [${transformedRow.Jenis_Produksi}] pada tahun [${transformedRow.Tahun}] duplicate.`
                                });
                            }

                            // Prepare valid data for insertion
                            if (!cekdata && jenis_produksi) {
                                transformedRow.jenis_produksi_id = jenis_produksi.jenis_produksi_id;
                                data.push(transformedRow);
                            }
                        }
                    })
                );
            })
        );

        // Handle validation errors
        if (errorCounter > 0) {
            fs.unlinkSync(filePath);

            await trx.rollback();
            return res.status(400).json(errorText);
        }

        // Insert validated data into the database
        for (const item of data) {
            await trx("dbPortalFA.dbo.asumsi_price_pnl").insert({
                domain: parseInt(domain),
                tahun: parseInt(item.Tahun),
                bulan: parseInt(item.Bulan),
                jenis_produksi_id: item.jenis_produksi_id,
                avg_price_budget: roundValue(item.Avg_Price_Budget ?? 0),
                avg_price_proyeksi: roundValue(item.Avg_Price_Proyeksi ?? 0),
                diskon_budget: roundValue(item.Diskon_Budget ?? 0),
                diskon_proyeksi: roundValue(item.Diskon_Proyeksi ?? 0),
                hpp_budget: roundValue(item.HPP_Budget ?? 0),
                hpp_proyeksi: roundValue(item.HPP_Proyeksi ?? 0),
                created_by: parseInt(empid),
                created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            });
        }

        // Delete uploaded file after successful database insertion
        fs.unlinkSync(filePath);

        await trx.commit();
        return res.status(201).json({ message: 'Data berhasil diupload' });
    } catch (error) {
        await trx.rollback();
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1 ? error.message : 'Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT',
        });
    }
}

// Download Tempalte asumsi price
export const Projection_DownloadAsumsiPrice = async (req, res) => {
    try {
      // Define Excel data
      const jenisProduksiData = await db("dbPortalFA.dbo.jenis_produksi").first();

      const data = [
            ["Tahun", "Bulan", "ID Jenis Produksi", "Jenis Produksi", "Avg Price Budget", "Avg Price Proyeksi", "Diskon Budget", "Diskon Proyeksi", "HPP Budget", "HPP Proyeksi"],
            [2024, 1, jenisProduksiData?.jenis_produksi_id ?? null, jenisProduksiData?.jenis_produksi ?? "", 1400000, 1500000, 10, 10, 0, 0],
      ];
  
      // Create a new workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Setup Asumsi Price');
  
      // Set column widths (A-J columns)
      worksheet.columns = [
        { width: 10 }, // Column A (Tahun)
        { width: 10 }, // Column B (Bulan)
        { width: 15 }, // Column C (ID Jenis Produksi)
        { width: 15 }, // Column D (Jenis Produksi)
        { width: 20 }, // Column E (Avg Price Budget)
        { width: 20 }, // Column F (Avg Price Proyeksi)
        { width: 15 }, // Column G (Diskon Budget)
        { width: 15 }, // Column H (Diskon Proyeksi)
        { width: 20 }, // Column I (HPP Budget)
        { width: 20 }, // Column J (HPP Proyeksi)
      ];
  
      // Add rows to the worksheet
      const border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
  
      // Add rows to the worksheet
      data.forEach((row, rowIndex) => worksheet.addRow(row));
  
      for (let i = 0; i < 1000; i++) {
        worksheet.addRow(['', '', '', '', '', '', '', '', '', '']);
      }
  
      // Lock the header row (Row 1)
      const headerRow = worksheet.getRow(1);
      headerRow.height = 25;
      headerRow.eachCell((cell,colNumber) => {
        cell.border = border;

        if(colNumber <= 4) {
            cell.alignment = {
                horizontal: 'center',
                vertical: 'middle',
            };
        } else {
            cell.alignment = {
                horizontal: 'right',
                vertical: 'middle',
            };
        }
      });
  
      // Unlock the rest of the worksheet (rows and columns)
      worksheet.eachRow((row, rowIndex) => {
        if (rowIndex > 1) {
          row.eachCell((cell, colNumber) => {
            if (colNumber >= 1 && colNumber <= 3) {
                cell.alignment = { horizontal: 'center' };
            }
          });
        }
      });
  
      // File name and path
      const filename = `Template-Setup-Asumsi-Price-${Math.floor(Date.now() / 1000)}.xlsx`;
      const filePath = path.resolve('file', filename);
  
      // Write the workbook to a file
      await workbook.xlsx.writeFile(filePath);
  
      // Send the file to the client
      return res.status(200).download(filePath, filename, (err) => {
        if (err) {
          return res.status(500).send("Error downloading the file.");
        }
  
        // Clean up the file after download
        fs.unlinkSync(filePath);
      });
    } catch (error) {
      console.error("Error generating Excel file:", error);
      return res.status(500).send("Failed to download Excel file");
    }
};

// Delete data asumsi price
export const Projection_DeleteAsumsiPrice = async (req, res) => {
    try {
        const { domain, tahun } = req.query;

        if (!domain || !tahun) {
            return res.status(400).json({ 
                message: 'Domain, tahun are required' 
            });
        }

        // Delete all matching records
        await db("dbPortalFA.dbo.asumsi_price_pnl")
        .where({ domain, tahun })
        .delete();

        return res.status(204).json({ message: 'Data berhasil dihapus!'})
    } catch(error){
        return res.status(406).json(
        {
            type:'error',
            message: process.env.DEBUG == 1 ? error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
        });
    }
}

// Delete data asumsi price
export const Projection_DeleteAsumsiPriceByJenis = async (req, res) => {
    try {
        const { domain, tahun, jenis_produksi_id } = req.query;

        if (!domain || !tahun || !jenis_produksi_id) {
            return res.status(400).json({ 
                message: 'Domain, tahun and Jenis Produksi are required' 
            });
        }

        // Delete all matching records
        await db("dbPortalFA.dbo.asumsi_price_pnl")
        .where({ domain, tahun, jenis_produksi_id })
        .delete();

        return res.status(204).json({ message: 'Data berhasil dihapus!'})
    } catch(error){
        return res.status(406).json(
        {
            type:'error',
            message: process.env.DEBUG == 1 ? error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
        });
    }
}

// Copy Asumsi Price Data and Create New Asumsi Price
export const Projection_CopyAsumsiPrice = async (req, res) => {
    const trx = await db.transaction();
    try {
        const { domain, new_tahun, tahun, empid } = req.body;

        const user = await db("dbPortalFA.dbo.users")
            .select("user_nik")
            .where("user_id", empid)
            .first();

        if (!user) {
            await trx.rollback();
            return res.status(400).json({ message: "Invalid user, silahkan hubungi Tim IT" });
        }

        const c_empid = user.user_nik;

        const asumsiPrice = await db("dbPortalFA.dbo.asumsi_price_pnl")
            .select(
                "domain",
                "tahun",
                "bulan", 
                "jenis_produksi_id", 
                "avg_price_budget", 
                "avg_price_proyeksi",
                "diskon_budget",
                "diskon_proyeksi",
                "hpp_budget",
                "hpp_proyeksi",
            )
            .where({ tahun, domain });

        await Promise.all(
            asumsiPrice.map(async (data) => {
                const cekdata = await trx('dbPortalFA.dbo.asumsi_price_pnl')
                    .select('asumsi_price_pnl_id')
                    .where('domain', domain)
                    .where('tahun', new_tahun)
                    .where('bulan', data.bulan)
                    .where('jenis_produksi_id', data.jenis_produksi_id)
                    .first();

                if (cekdata) {
                    throw new Error(`Currency [${data.jenis_produksi_id}] pada tahun [${data.tahun}] bulan [${data.bulan}] sudah ada.`);
                }

                await trx("dbPortalFA.dbo.asumsi_price_pnl").insert({
                    domain: parseInt(domain),
                    tahun: parseInt(new_tahun),
                    bulan: data.bulan,
                    jenis_produksi_id: data.jenis_produksi_id,
                    avg_price_budget: data.avg_price_budget,
                    avg_price_proyeksi: data.avg_price_proyeksi,
                    diskon_budget: data.diskon_budget,
                    diskon_proyeksi: data.diskon_proyeksi,
                    hpp_budget: data.hpp_budget,
                    hpp_proyeksi: data.hpp_proyeksi,
                    created_by: parseInt(c_empid),
                    created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                });
            })
        );

        await trx.commit();
        return res.status(201).json({ message: 'Data berhasil disalin' });
    } catch (error) {
        await trx.rollback();
        return res.status(406).json({
            type: 'error',
            message: process.env.DEBUG == 1 ? error.message : `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
        });
    }
}

