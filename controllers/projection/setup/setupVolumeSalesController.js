import { db } from "../../../config/db.js";
import * as dotenv from 'dotenv' ;
import dayjs from "dayjs";
import xlsx from 'xlsx';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { roundValue } from "../../../helpers/utils.js";

dotenv.config()

// Get list setup volume sales
export const Projection_listVolumeSales = async (req, res) => {
    try {
        let response;

        const {rowsPerPage, page, domain, sortBy, sort} = req.query;

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db("dbPortalFA.dbo.volume_pnl")
            .select('tahun', 'domain')
            .where('domain', domain)
            .groupBy('tahun', 'domain')
            .orderBy(sortBy, sort);
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db("dbPortalFA.dbo.volume_pnl")
            .select('tahun', 'domain')
            .where('domain', domain)
            .groupBy('tahun', 'domain')
            .orderBy(sortBy, sort)
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

// Get detail setup volume sales
export const Projection_viewVolumeSales = async (req, res) => {
    try {
        const { domain, tahun, jenis_produksi_id, empid } = req.query;

        const response = await db("dbPortalFA.dbo.volume_pnl as vp")
        .select(
            'vp.volume_pnl_id',
            'vp.tahun',
            'vp.bulan',
            'vp.jenis_produksi_id',
            'jp.jenis_produksi',
            'vp.volume_budget',
            'vp.volume_proyeksi',
        )
        .join('dbPortalFA.dbo.jenis_produksi as jp', 'vp.jenis_produksi_id', '=', 'jp.jenis_produksi_id')
        .where('vp.domain', domain)
        .where('vp.tahun', tahun)
        .where('vp.jenis_produksi_id', jenis_produksi_id)
        .orderBy('vp.bulan', 'asc');

        const getAdmin = await db("dbPortalFA.dbo.user_access")
        .select('access_admin')
        .where('access_empid', empid)
        .where('access_menu', '/setup_volume_sales/list')
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

// Search data setup volume sales
export const Projection_searchVolumeSales = async (req, res) => {
    try {
        let response;

        const {rowsPerPage, page, domain, search } = req.query;

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db("dbPortalFA.dbo.volume_pnl")
            .select('tahun')
            .where('domain', domain)
            .where('tahun', search)
            .groupBy('tahun')
            .orderBy('tahun', 'desc');
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db("dbPortalFA.dbo.volume_pnl")
            .select('tahun')
            .where('domain', domain)
            .where('tahun', search)
            .groupBy('tahun')
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

// Get detail setup volume sales
export const Projection_detailVolumeSales = async (req, res) => {
    try {
        let response;

        const {rowsPerPage, page, domain, tahun} = req.query;

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db("dbPortalFA.dbo.volume_pnl as vp")
            .select(
                'jp.jenis_produksi',
                'vp.jenis_produksi_id',
                'vp.domain',
                'vp.tahun',
                db.raw('MAX(vp.volume_pnl_id) as volume_pnl_id')
            )
            .join('dbPortalFA.dbo.jenis_produksi as jp', 'vp.jenis_produksi_id', '=', 'jp.jenis_produksi_id')
            .where('vp.domain', domain)
            .where('vp.tahun', tahun)
            .groupBy(
                'jp.jenis_produksi',
                'vp.domain',
                'vp.tahun'
            )
            .orderBy('vp.tahun', 'desc');
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db("dbPortalFA.dbo.volume_pnl as vp")
            .select(
                'jp.jenis_produksi',
                'vp.jenis_produksi_id',
                'vp.domain',
                'vp.tahun',
                db.raw('MAX(vp.volume_pnl_id) as volume_pnl_id')
            )
            .join('dbPortalFA.dbo.jenis_produksi as jp', 'vp.jenis_produksi_id', '=', 'jp.jenis_produksi_id')
            .where('vp.domain', domain)
            .where('vp.tahun', tahun)
            .groupBy(
                'jp.jenis_produksi',
                'vp.jenis_produksi_id',
                'vp.domain',
                'vp.tahun'
            )
            .orderBy('vp.tahun', 'desc')
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

// Search detail setup volume sales
export const Projection_searchDetailVolumeSales = async (req, res) => {
    try {
        let response;

        const {rowsPerPage, page, domain, tahun, search} = req.query;

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db("dbPortalFA.dbo.volume_pnl as vp")
            .select(
                'jp.jenis_produksi',
                'vp.domain',
                'vp.tahun',
                db.raw('MAX(vp.volume_pnl_id) as volume_pnl_id')
            )
            .join('dbPortalFA.dbo.jenis_produksi as jp', 'vp.jenis_produksi_id', '=', 'jp.jenis_produksi_id')
            .where('vp.domain', domain)
            .where('vp.tahun', tahun)
            .andWhere('jp.jenis_produksi', 'like', `%${search}%`)
            .groupBy(
                'jp.jenis_produksi',
                'vp.domain',
                'vp.tahun'
            )
            .orderBy('vp.tahun', 'desc');
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db("dbPortalFA.dbo.volume_pnl as vp")
            .select(
                'jp.jenis_produksi',
                'vp.domain',
                'vp.tahun',
                db.raw('MAX(vp.volume_pnl_id) as volume_pnl_id')
            )
            .join('dbPortalFA.dbo.jenis_produksi as jp', 'vp.jenis_produksi_id', '=', 'jp.jenis_produksi_id')
            .where('vp.domain', domain)
            .where('vp.tahun', tahun)
            .andWhere('jp.jenis_produksi', 'like', `%${search}%`)
            .groupBy(
                'jp.jenis_produksi',
                'vp.domain',
                'vp.tahun'
            )
            .orderBy('vp.tahun', 'desc')
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

// Get list jenis produksi volume sales
export const Projection_listJenisProduksiVolSales = async (req, res) => {
    try {
        const {domain, tahun } = req.query;

        const response = await db("dbPortalFA.dbo.jenis_produksi as jp")
        .select(
            'jp.jenis_produksi_id',
            'jp.domain',
            'jp.jenis_produksi',
            'jp.desc'
        )
        .leftJoin('dbPortalFA.dbo.volume_pnl as vp', function() {
            this.on('jp.jenis_produksi_id', '=', 'vp.jenis_produksi_id')
                .andOn('jp.domain', '=', 'vp.domain')
                .andOn('vp.tahun', '=', parseInt(tahun));
        })
        .where('jp.domain', domain)
        .whereNull('vp.jenis_produksi_id') 
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

// Upload excel template volume sales
export const Projection_UploadVolumeSales = async (req, res) => {
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
                    budget: "",
                    proyeksi: "",
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
                        if (transformedRow.Tahun === "" && transformedRow.Bulan === "" && transformedRow.ID_Jenis_Produksi === "" &&  transformedRow.Jenis_Produksi === "") return;
                
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
                                    budget: transformedRow.Budget,
                                    proyeksi: transformedRow.Proyeksi,
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
                                budget: transformedRow.Budget,
                                proyeksi: transformedRow.Proyeksi,
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
                                budget: transformedRow.Budget,
                                proyeksi: transformedRow.Proyeksi,
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
                                budget: transformedRow.Budget,
                                proyeksi: transformedRow.Proyeksi,
                                message: `Gagal Import pada baris (${index + 1}) : [Bulan] kolom tidak valid.`
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
                                budget: transformedRow.Budget,
                                proyeksi: transformedRow.Proyeksi,
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
                                budget: transformedRow.Budget,
                                proyeksi: transformedRow.Proyeksi,
                                message: `Gagal Import pada baris (${index + 1}) : [${transformedRow.Jenis_Produksi}] tidak dikenal.`
                            });
                        }

                        if (transformedRow.Budget && isNaN(parseFloat(String(transformedRow.Budget).replace(/,/g, '')))) {
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                tahun: transformedRow.Tahun,
                                bulan: transformedRow.Bulan,
                                id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                jenis_produksi: transformedRow.Jenis_Produksi,
                                budget: transformedRow.Budget,
                                proyeksi: transformedRow.Proyeksi,
                                message: `Gagal Import pada baris (${index + 1}) : [Budget] kolom harus berupa angka atau decimal.`
                            });
                        }

                        if (transformedRow.Proyeksi && isNaN(parseFloat(String(transformedRow.Proyeksi).replace(/,/g, '')))) {
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                tahun: transformedRow.Tahun,
                                bulan: transformedRow.Bulan,
                                id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                jenis_produksi: transformedRow.Jenis_Produksi,
                                budget: transformedRow.Budget,
                                proyeksi: transformedRow.Proyeksi,
                                message: `Gagal Import pada baris (${index + 1}) : [Proyeksi] kolom harus berupa angka atau decimal.`
                            });
                        }

                        if(jenis_produksi && transformedRow.Tahun !== "" && transformedRow.Bulan !== ""){
                            const cekdata = await trx('dbPortalFA.dbo.volume_pnl')
                                .select('volume_pnl_id')
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
                                    budget: transformedRow.Budget,
                                    proyeksi: transformedRow.Proyeksi,
                                    message: `Gagal Import pada baris (${index + 1}) : Jenis Produksi [${transformedRow.Jenis_Produksi}] pada tahun [${transformedRow.Tahun}] duplicate.`
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
            await trx("dbPortalFA.dbo.volume_pnl").insert({
                domain: parseInt(domain),
                tahun: parseInt(item.Tahun),
                bulan: parseInt(item.Bulan),
                jenis_produksi_id: parseInt(item.jenis_produksi_id),
                volume_budget: roundValue(item.Budget ?? 0),
                volume_proyeksi: roundValue(item.Proyeksi ?? 0),
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

// Download Tempalte Material Pendukung 
export const Projection_DownloadVolumeSales = async (req, res) => {
    try {
      // Define Excel data
      const jenisProduksiData = await db("dbPortalFA.dbo.jenis_produksi").first();

      const data = [
            ["Tahun", "Bulan", "ID Jenis Produksi", "Jenis Produksi", "Budget", "Proyeksi"],
            [2024, 1, jenisProduksiData?.jenis_produksi_id ?? null, jenisProduksiData?.jenis_produksi ?? "", 0, 0],
            [2024, 2, jenisProduksiData?.jenis_produksi_id ?? null, jenisProduksiData?.jenis_produksi ?? "", 0, 0],
            [2024, 3, jenisProduksiData?.jenis_produksi_id ?? null, jenisProduksiData?.jenis_produksi ?? "", 0, 0],
            [2024, 4, jenisProduksiData?.jenis_produksi_id ?? null, jenisProduksiData?.jenis_produksi ?? "", 0, 0],
            [2024, 5, jenisProduksiData?.jenis_produksi_id ?? null, jenisProduksiData?.jenis_produksi ?? "", 0, 0],
            [2024, 6, jenisProduksiData?.jenis_produksi_id ?? null, jenisProduksiData?.jenis_produksi ?? "", 0, 0],
            [2024, 7, jenisProduksiData?.jenis_produksi_id ?? null, jenisProduksiData?.jenis_produksi ?? "", 0, 0],
            [2024, 8, jenisProduksiData?.jenis_produksi_id ?? null, jenisProduksiData?.jenis_produksi ?? "", 0, 0],
            [2024, 9, jenisProduksiData?.jenis_produksi_id ?? null, jenisProduksiData?.jenis_produksi ?? "", 0, 0],
            [2024, 10, jenisProduksiData?.jenis_produksi_id ?? null, jenisProduksiData?.jenis_produksi ?? "", 0, 0],
            [2024, 11, jenisProduksiData?.jenis_produksi_id ?? null, jenisProduksiData?.jenis_produksi ?? "", 0, 0],
            [2024, 12, jenisProduksiData?.jenis_produksi_id ?? null, jenisProduksiData?.jenis_produksi ?? "", 0, 0],
      ];
  
      // Create a new workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Setup Volume Sales');
  
      // Set column widths (A-F columns)
      worksheet.columns = [
        { width: 10 }, // Column A (Tahun)
        { width: 10 }, // Column B (Bulan)
        { width: 15 }, // Column C (ID Jenis Produksi)
        { width: 15 }, // Column D (Jenis Produksi)
        { width: 20 }, // Column E (Budget)
        { width: 20 }, // Column F (Proyeksi)
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
        worksheet.addRow(['', '', '', '', '', '']);
      }
  
      // Lock the header row (Row 1)
      const headerRow = worksheet.getRow(1);
      headerRow.height = 25;
      headerRow.eachCell((cell) => {
        cell.protection = { locked: true };
        cell.border = border;
      });
  
      // Unlock the rest of the worksheet (rows and columns)
      worksheet.eachRow((row, rowIndex) => {
        if (rowIndex > 1) {
          row.eachCell((cell, colNumber) => {
            if (colNumber >= 1 && colNumber <= 3) {
                cell.alignment = { horizontal: 'center' };
            }
            
            cell.protection = { locked: false };
          });
        }
      });
  
      // Apply sheet protection with only the header locked
      await worksheet.protect('Rucika123', {
        selectLockedCells: true,
        selectUnlockedCells: true, 
      });
  
      // File name and path
      const filename = `Template-Setup-Volume-Sales-${Math.floor(Date.now() / 1000)}.xlsx`;
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

// Create data Volume Sales
export const Projection_CreateVolumeSales = async (req, res) => {
    const trx = await db.transaction();
    try {
        const {
            tahun,
            jenis_produksi_id,
            domain,
            bulan
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
            bulan.map(async (data) => {
                const cekdata = await trx('dbPortalFA.dbo.volume_pnl')
                    .select('volume_pnl_id')
                    .where('domain', domain)
                    .where('tahun', parseInt(tahun))
                    .where('bulan', parseInt(data.id))
                    .where('jenis_produksi_id', parseInt(jenis_produksi_id))
                    .first();
    
                if (cekdata) {
                    errors.push(`Jenis Produksi [${jenis_produksi_id}] pada tahun [${tahun}] duplicate for bulan [${data.id}].`);
                    return;
                }
    
                await trx("dbPortalFA.dbo.volume_pnl").insert({
                    domain: parseInt(domain, 10),
                    tahun: parseInt(tahun, 10),
                    bulan: parseInt(data.id, 10),
                    jenis_produksi_id: parseInt(jenis_produksi_id, 10),
                    volume_budget: parseFloat(data.budget ?? 0),
                    volume_proyeksi: parseFloat(data.projection ?? 0),
                    created_by: parseInt(empid, 10),
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

// Update data Setup Volume Sales
export const Projection_UpdateVolumeSales = async (req, res) => {
    const trx = await db.transaction();
    try {
        const {
            tahun,
            jenis_produksi_id,
            domain,
            bulan
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
            bulan.map(async (data) => {
                const cekdata = await trx('dbPortalFA.dbo.volume_pnl')
                    .select('volume_pnl_id')
                    .where('domain', domain)
                    .where('tahun', parseInt(tahun))
                    .where('bulan', parseInt(data.bulan))
                    .where('jenis_produksi_id', parseInt(jenis_produksi_id))
                    .first();
    
                if (!cekdata) {
                    errors.push(`Jenis Produksi [${jenis_produksi_id}] pada tahun [${tahun}] bulan [${data.id}] tidak ada.`);
                    return;
                }
    
                await trx("dbPortalFA.dbo.volume_pnl")
                .where('volume_pnl_id', data.volume_pnl_id)
                .update({
                    volume_budget: parseFloat(data.volume_budget ?? 0),
                    volume_proyeksi: parseFloat(data.volume_proyeksi ?? 0),
                    updated_by: parseInt(empid, 10),
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

// Delete data sStup Volume Sales
export const Projection_DeleteVolumeSales = async (req, res) => {
    try {
        const { domain, tahun } = req.query;

        if (!domain || !tahun ) {
            return res.status(400).json({ 
                message: 'Domain, tahun and Kode Jenis Produksi are required' 
            });
        }

        // Delete all matching records
        await db("dbPortalFA.dbo.volume_pnl")
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

// Delete data sStup Volume Sales
export const Projection_DeleteVolumeSalesByJenisProduksi = async (req, res) => {
    try {
        const { domain, tahun, jenis_produksi_id } = req.query;

        if (!domain || !tahun || !jenis_produksi_id) {
            return res.status(400).json({ 
                message: 'Domain, tahun and Kode Jenis Produksi are required' 
            });
        }

        // Delete all matching records
        await db("dbPortalFA.dbo.volume_pnl")
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

// Copy Volume Sales Data and Create New Volume Sales
export const Projection_CopyVolumeSales = async (req, res) => {
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

        const volumeSales = await db("dbPortalFA.dbo.volume_pnl")
            .select(
                "domain",
                "tahun",
                "bulan", 
                "jenis_produksi_id", 
                "volume_budget", 
                "volume_proyeksi"
            )
            .where({ tahun, domain });

        await Promise.all(
            volumeSales.map(async (data) => {
                const jp = await trx('dbPortalFA.dbo.jenis_produksi')
                    .select('jenis_produksi')
                    .where('jenis_produksi_id', parseInt(data.jenis_produksi_id))
                    .first();

                if (!jp) {
                    throw new Error(`[${jp.jenis_produksi}] tidak dikenal`);
                }

                const cekdata = await trx('dbPortalFA.dbo.volume_pnl')
                    .select('volume_pnl_id')
                    .where('domain', domain)
                    .where('tahun', new_tahun)
                    .where('bulan', data.bulan)
                    .where('jenis_produksi_id', data.jenis_produksi_id)
                    .first();

                if (cekdata) {
                    throw new Error(`Jenis Produksi [${data.jenis_produksi_id}] pada tahun [${data.tahun}] bulan [${data.bulan}] sudah ada.`);
                }

                await trx("dbPortalFA.dbo.volume_pnl").insert({
                    domain: parseInt(domain, 10),
                    tahun: parseInt(new_tahun, 10),
                    bulan: data.bulan,
                    jenis_produksi_id: data.jenis_produksi_id,
                    volume_budget: data.volume_budget,
                    volume_proyeksi: data.volume_proyeksi,
                    created_by: parseInt(c_empid, 10),
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
