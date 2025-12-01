import { db } from "../../../config/db.js";
import * as dotenv from 'dotenv' ;
import dayjs from "dayjs";
import xlsx from 'xlsx';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { roundValue } from "../../../helpers/utils.js";

dotenv.config()

// Get list setup material pendukung
export const Projection_listMaterialPendukung = async (req, res) => {
    try {
        let response;

        const {rowsPerPage, page, domain, sortBy, sort} = req.query;

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db("dbPortalFA.dbo.material_pendukung as mp")
            .select(
                'mp.material_pendukung_id',
                'mp.domain',
                'mp.tahun',
                'mp.jenis_produksi_id',
                'jp.jenis_produksi'
            )
            .join('dbPortalFA.dbo.jenis_produksi as jp', 'mp.jenis_produksi_id', '=', 'jp.jenis_produksi_id')
            .where('mp.domain', domain)
            .orderBy(sortBy, sort);
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db("dbPortalFA.dbo.material_pendukung as mp")
            .select(
                'mp.material_pendukung_id',
                'mp.domain',
                'mp.tahun',
                'mp.jenis_produksi_id',
                'jp.jenis_produksi'
            )
            .join('dbPortalFA.dbo.jenis_produksi as jp', 'mp.jenis_produksi_id', '=', 'jp.jenis_produksi_id')
            .where('mp.domain', domain)
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
        return res.status(406).json(/* { message: error.message } */
        {
            type:'error',
            message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
        });
    }
}

// Search setup material pendukung
export const Projection_searchMaterialPendukung = async (req, res) => {
    try {
        let response;

        const {rowsPerPage, page, domain, search } = req.query;

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db("dbPortalFA.dbo.material_pendukung as mp")
            .select(
                'mp.material_pendukung_id',
                'mp.domain',
                'mp.tahun',
                'mp.jenis_produksi_id',
                'jp.jenis_produksi'
            )
            .join('dbPortalFA.dbo.jenis_produksi as jp', 'mp.jenis_produksi_id', '=', 'jp.jenis_produksi_id')
            .where('mp.domain', domain)
            .andWhere('jp.jenis_produksi', 'like', `%${search}%`)
            .orderBy('mp.material_pendukung_id', 'desc');
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db("dbPortalFA.dbo.material_pendukung as mp")
            .select(
                'mp.material_pendukung_id',
                'mp.domain',
                'mp.tahun',
                'mp.jenis_produksi_id',
                'jp.jenis_produksi'
            )
            .join('dbPortalFA.dbo.jenis_produksi as jp', 'mp.jenis_produksi_id', '=', 'jp.jenis_produksi_id')
            .where('mp.domain', domain)
            .andWhere('jp.jenis_produksi', 'like', `%${search}%`)
            .orderBy('mp.material_pendukung_id', 'desc')
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
        return res.status(406).json(/* { message: error.message } */
        {
            type:'error',
            message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
        });
    }
}

// Get detail setup material pendukung
export const Projection_detailMaterialPendukung = async (req, res) => {
    try {
        const {material_pendukung_id} = req.query;

        const response = await db("dbPortalFA.dbo.material_pendukung as mp")
        .select(
            'mp.material_pendukung_id',
            'mp.domain',
            'mp.tahun',
            'mp.jenis_produksi_id',
            'mp.bahan_pembantu',
            'mp.bahan_packaging',
            'mp.bahan_penolong',
            'mp.jasa_maklon',
            'jp.jenis_produksi'
        )
        .join('dbPortalFA.dbo.jenis_produksi as jp', 'mp.jenis_produksi_id', '=', 'jp.jenis_produksi_id')
        .where('mp.material_pendukung_id', material_pendukung_id)
        .first();

        return res.status(200).json({
            message: 'Success',
            data: response
        });
    } catch(error){
        return res.status(406).json(/* { message: error.message } */
        {
            type:'error',
            message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
        });
    }
}

// Get list jenis produksi
export const Projection_listJenisProduksi = async (req, res) => {
    try {
        const {domain, tahun } = req.query;

        const response = await db("dbPortalFA.dbo.jenis_produksi as jp")
        .select(
            'jp.jenis_produksi_id',
            'jp.domain',
            'jp.jenis_produksi',
            'jp.desc'
        )
        .leftJoin('dbPortalFA.dbo.material_pendukung as mp', function() {
            this.on('jp.jenis_produksi_id', '=', 'mp.jenis_produksi_id')
                .andOn('jp.domain', '=', 'mp.domain')
                .andOn('mp.tahun', '=', parseInt(tahun));
        })
        .where('jp.domain', domain)
        .whereNull('mp.jenis_produksi_id') 
        .orderBy('jp.jenis_produksi_id', 'desc');

        return res.status(200).json({
            message: 'Success',
            data: response
        });
    } catch(error){
        console.log(error)
        return res.status(406).json(/* { message: error.message } */
        {
            type:'error',
            message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
        });
    }
}

// Upload excel template Material Pendukung
export const Projection_UploadMaterialPendukung = async (req, res) => {
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

                const jenis = String(transformedRow.Jenis_Produksi).toLowerCase();    
                const code = `${jenis}-${domain}`;  
                
                if (itemCount[code] && jenis !== '' && jenis !== null) {  
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
                    tahun: "",
                    id_jenis_produksi: "",
                    jenis_produksi: "",
                    asumsi_bahan_pembantu: "",
                    asumsi_bahan_packaging: "",
                    asumsi_bahan_penolong_lainnya: "",
                    asumsi_jasa_maklon: "",
                    message: `Gagal Import pada baris (${value.lines.join(', ')}) : [${String(key).split("-")[0]}] Duplicate data.`
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
                        if (transformedRow.Tahun === "" && transformedRow.ID_Jenis_Produksi === "" && transformedRow.Jenis_Produksi === "") return;
                
                        if (transformedRow.Tahun === null || typeof transformedRow.Tahun !== 'number') {
                            errorCounter++;
                            errorText.push(`Gagal Import pada baris (${index + 1}) : [Tahun] kolom wajib diisi.`);
                            if(transformedRow.Tahun < 0){
                                errorCounter++;
                                errorText.push({
                                    baris: index + 1,
                                    tahun: transformedRow.Tahun,
                                    id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                    jenis_produksi: transformedRow.Jenis_Produksi,
                                    asumsi_bahan_pembantu: transformedRow.Asumsi_Bahan_Pembantu,
                                    asumsi_bahan_packaging: transformedRow.Asumsi_Bahan_Packaging,
                                    asumsi_bahan_penolong_lainnya: transformedRow.Asumsi_Bahan_Penolong_Lainnya,
                                    asumsi_jasa_maklon: transformedRow.Asumsi_Jasa_Maklon,
                                    message: `Gagal Import pada baris (${index + 1}) : [Tahun] kolom tidak valid.`
                                });
                            }
                        }

                        if (transformedRow.ID_Jenis_Produksi === null || typeof parseInt(transformedRow.ID_Jenis_Produksi) !== 'number') {
                            errorCounter++;
                            errorText.push({
                                    baris: index + 1,
                                    tahun: transformedRow.Tahun,
                                    id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                    jenis_produksi: transformedRow.Jenis_Produksi,
                                    asumsi_bahan_pembantu: transformedRow.Asumsi_Bahan_Pembantu,
                                    asumsi_bahan_packaging: transformedRow.Asumsi_Bahan_Packaging,
                                    asumsi_bahan_penolong_lainnya: transformedRow.Asumsi_Bahan_Penolong_Lainnya,
                                    asumsi_jasa_maklon: transformedRow.Asumsi_Jasa_Maklon,
                                    message: `Gagal Import pada baris (${index + 1}) : [Jenis Produksi] kolom wajib diisi.`
                            });
                        }
                
                        if (transformedRow.Jenis_Produksi === null || transformedRow.Jenis_Produksi === '' || typeof transformedRow.Jenis_Produksi !== 'string') {
                            errorCounter++;
                            errorText.push({
                                    baris: index + 1,
                                    tahun: transformedRow.Tahun,
                                    id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                    jenis_produksi: transformedRow.Jenis_Produksi,
                                    asumsi_bahan_pembantu: transformedRow.Asumsi_Bahan_Pembantu,
                                    asumsi_bahan_packaging: transformedRow.Asumsi_Bahan_Packaging,
                                    asumsi_bahan_penolong_lainnya: transformedRow.Asumsi_Bahan_Penolong_Lainnya,
                                    asumsi_jasa_maklon: transformedRow.Asumsi_Jasa_Maklon,
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
                            errorText.push(
                                {
                                    baris: index + 1,
                                    tahun: transformedRow.Tahun,
                                    id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                    jenis_produksi: transformedRow.Jenis_Produksi,
                                    asumsi_bahan_pembantu: transformedRow.Asumsi_Bahan_Pembantu,
                                    asumsi_bahan_packaging: transformedRow.Asumsi_Bahan_Packaging,
                                    asumsi_bahan_penolong_lainnya: transformedRow.Asumsi_Bahan_Penolong_Lainnya,
                                    asumsi_jasa_maklon: transformedRow.Asumsi_Jasa_Maklon,
                                    message: `Gagal Import pada baris (${index + 1}) : [${transformedRow.Jenis_Produksi}] tidak dikenal.`
                                }
                            );
                        }

                        if (transformedRow.Asumsi_Bahan_Pembantu && isNaN(parseFloat(String(transformedRow.Asumsi_Bahan_Pembantu).replace(/,/g, '')))) {
                            errorCounter++;
                            errorText.push(
                                {
                                    baris: index + 1,
                                    tahun: transformedRow.Tahun,
                                    id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                    jenis_produksi: transformedRow.Jenis_Produksi,
                                    asumsi_bahan_pembantu: transformedRow.Asumsi_Bahan_Pembantu,
                                    asumsi_bahan_packaging: transformedRow.Asumsi_Bahan_Packaging,
                                    asumsi_bahan_penolong_lainnya: transformedRow.Asumsi_Bahan_Penolong_Lainnya,
                                    asumsi_jasa_maklon: transformedRow.Asumsi_Jasa_Maklon,
                                    message: `Gagal Import pada baris (${index + 1}) : [Asumsi Bahan Pembantu] kolom harus berupa angka atau decimal.`
                                }
                            );
                        }

                        if (transformedRow.Asumsi_Bahan_Packaging && isNaN(parseFloat(String(transformedRow.Asumsi_Bahan_Packaging).replace(/,/g, '')))) {
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                tahun: transformedRow.Tahun,
                                id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                jenis_produksi: transformedRow.Jenis_Produksi,
                                asumsi_bahan_pembantu: transformedRow.Asumsi_Bahan_Pembantu,
                                asumsi_bahan_packaging: transformedRow.Asumsi_Bahan_Packaging,
                                asumsi_bahan_penolong_lainnya: transformedRow.Asumsi_Bahan_Penolong_Lainnya,
                                asumsi_jasa_maklon: transformedRow.Asumsi_Jasa_Maklon,
                                message: `Gagal Import pada baris (${index + 1}) : [Asumsi Bahan Packaging] kolom harus berupa angka atau decimal.`
                            });
                        }

                        if (transformedRow.Asumsi_Bahan_Penolong_Lainnya && isNaN(parseFloat(String(transformedRow.Asumsi_Bahan_Penolong_Lainnya).replace(/,/g, '')))) {
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                tahun: transformedRow.Tahun,
                                id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                jenis_produksi: transformedRow.Jenis_Produksi,
                                asumsi_bahan_pembantu: transformedRow.Asumsi_Bahan_Pembantu,
                                asumsi_bahan_packaging: transformedRow.Asumsi_Bahan_Packaging,
                                asumsi_bahan_penolong_lainnya: transformedRow.Asumsi_Bahan_Penolong_Lainnya,
                                asumsi_jasa_maklon: transformedRow.Asumsi_Jasa_Maklon,
                                message: `Gagal Import pada baris (${index + 1}) : [Asumsi Bahan Penolong Lainnya] kolom harus berupa angka atau decimal.`
                            });
                        }

                        if (transformedRow.Asumsi_Jasa_Maklon && isNaN(parseFloat(String(transformedRow.Asumsi_Jasa_Maklon).replace(/,/g, '')))) {
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                tahun: transformedRow.Tahun,
                                id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                jenis_produksi: transformedRow.Jenis_Produksi,
                                asumsi_bahan_pembantu: transformedRow.Asumsi_Bahan_Pembantu,
                                asumsi_bahan_packaging: transformedRow.Asumsi_Bahan_Packaging,
                                asumsi_bahan_penolong_lainnya: transformedRow.Asumsi_Bahan_Penolong_Lainnya,
                                asumsi_jasa_maklon: transformedRow.Asumsi_Jasa_Maklon,
                                message: `Gagal Import pada baris (${index + 1}) : [Asumsi Jasa Maklon] kolom harus berupa angka atau decimal.`
                            });
                        }

                        if(jenis_produksi){
                            const cekdata = await trx('dbPortalFA.dbo.material_pendukung')
                                .select('material_pendukung_id')
                                .where('domain', domain)
                                .where('jenis_produksi_id', jenis_produksi.jenis_produksi_id)
                                .first();
                    
                            if (cekdata) {
                                errorCounter++;
                                errorText.push(
                                    {
                                        baris: index + 1,
                                        tahun: transformedRow.Tahun,
                                        id_jenis_produksi: transformedRow.ID_Jenis_Produksi,
                                        jenis_produksi: transformedRow.Jenis_Produksi,
                                        asumsi_bahan_pembantu: transformedRow.Asumsi_Bahan_Pembantu,
                                        asumsi_bahan_packaging: transformedRow.Asumsi_Bahan_Packaging,
                                        asumsi_bahan_penolong_lainnya: transformedRow.Asumsi_Bahan_Penolong_Lainnya,
                                        asumsi_jasa_maklon: transformedRow.Asumsi_Jasa_Maklon,
                                        message: `Gagal Import pada baris (${index + 1}) : [${transformedRow.Jenis_Produksi}] sudah ada di database.`
                                    }
                                );
                            }

                            // Prepare valid data for insertion
                            if (!cekdata && jenis_produksi) {
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
            await trx("dbPortalFA.dbo.material_pendukung").insert({
                domain: parseInt(domain),
                tahun: parseInt(item.Tahun),
                jenis_produksi_id: typeof item.ID_Jenis_Produksi !== "number" ? parseInt(item.ID_Jenis_Produksi) : item.ID_Jenis_Produksi,
                bahan_pembantu: roundValue(item.Asumsi_Bahan_Pembantu ?? 0),
                bahan_packaging: roundValue(item.Asumsi_Bahan_Packaging ?? 0),
                bahan_penolong: roundValue(item.Asumsi_Bahan_Penolong_Lainnya ?? 0),
                jasa_maklon: roundValue(item.Asumsi_Jasa_Maklon ?? 0),
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

// Create data Material Pendukung
export const Projection_CreateMaterialPendukung = async (req, res) => {
    const trx = await db.transaction();
    try {
        const {
            tahun,
            jenis_produksi_id,
            asumsi_bahan_packaging,
            asumsi_bahan_pembantu,
            asumsi_bahan_penolong_lainnya,
            asumsi_jasa_maklon,
            domain,
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
            .where('jenis_produksi_id', jenis_produksi_id)
            .first();

        if (!jp) {
            await trx.rollback();
            return res.status(400).json({ message: `[${jp.jenis_produksi}] tidak dikenal` });
        }

        const cekdata = await trx('dbPortalFA.dbo.material_pendukung')
            .select('material_pendukung_id')
            .where('domain', domain)
            .where('tahun', tahun)
            .where('jenis_produksi_id', jenis_produksi_id)
            .first();

        if (cekdata) {
            await trx.rollback();
            return res.status(400).json({ message: `[${jp.jenis_produksi}] sudah ada di database` });
        }

        await trx("dbPortalFA.dbo.material_pendukung").insert({
            domain: parseInt(domain),
            tahun: parseInt(tahun),
            jenis_produksi_id: parseInt(jenis_produksi_id),
            bahan_pembantu: parseInt(asumsi_bahan_pembantu ?? 0),
            bahan_packaging: parseInt(asumsi_bahan_packaging ?? 0),
            bahan_penolong: parseInt(asumsi_bahan_penolong_lainnya ?? 0),
            jasa_maklon: parseInt(asumsi_jasa_maklon ?? 0),
            created_by: parseInt(empid),
            created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        });

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

// Create data Material Pendukung
export const Projection_UpdateMaterialPendukung = async (req, res) => {
    const trx = await db.transaction();
    try {
        const {
            jenis_produksi_id,
            asumsi_bahan_packaging,
            asumsi_bahan_pembantu,
            asumsi_bahan_penolong_lainnya,
            asumsi_jasa_maklon,
            material_pendukung_id,
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

        await trx("dbPortalFA.dbo.material_pendukung")
        .where('material_pendukung_id', material_pendukung_id)
        .update({
            bahan_pembantu: parseInt(asumsi_bahan_pembantu ?? 0),
            bahan_packaging: parseInt(asumsi_bahan_packaging ?? 0),
            bahan_penolong: parseInt(asumsi_bahan_penolong_lainnya ?? 0),
            jasa_maklon: parseInt(asumsi_jasa_maklon ?? 0),
            updated_by: parseInt(empid),
            updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        });

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

// Delete setup material pendukung
export const Projection_DeleteMaterialPendukung = async (req, res) => {
    try {
        const { domain, jenis_produksi_id } = req.query;

        if (!domain || !jenis_produksi_id) {
            return res.status(400).json({ 
                message: 'Domain and Kode Jenis Produksi are required' 
            });
        }

        // Delete all matching records
        await db("dbPortalFA.dbo.material_pendukung")
        .where({ domain, jenis_produksi_id })
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

// Download Tempalte Material Pendukung 
export const Projection_DownloadMaterialPendukung = async (req, res) => {
    try {
      // Define Excel data
      const jenisProduksiData = await db("dbPortalFA.dbo.jenis_produksi").first();

      const data = [
            ["Tahun", "ID Jenis Produksi", "Jenis Produksi", "Asumsi Bahan Pembantu", "Asumsi Bahan Penolong Lainnya", "Asumsi Bahan Packaging", "Asumsi Jasa Maklon"],
            [2024, jenisProduksiData?.jenis_produksi_id ?? null, jenisProduksiData?.jenis_produksi ?? "", 100000, 0, 0, 0],
      ];
  
      // Create a new workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Setup Material Pendukung');
  
      // Set column widths (A-G columns)
      worksheet.columns = [
        { width: 10 }, // Column A (Tahun)
        { width: 20 }, // Column B (ID Jenis Produksi)
        { width: 20 }, // Column C (Jenis Produksi)
        { width: 30 }, // Column D (Asumsi Bahan Pembantu)
        { width: 30 }, // Column E (Asumsi Bahan Penolong Lainnya)
        { width: 30 }, // Column F (Asumsi Bahan Packaging)
        { width: 30 }, // Column G (Asumsi Jasa Maklon)
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
        worksheet.addRow(['', '', '', '', '', '', '']);
      }
  
      // Lock the header row (Row 1)
      const headerRow = worksheet.getRow(1);
      headerRow.height = 25;
  
      // Unlock the rest of the worksheet (rows and columns)
      worksheet.eachRow((row, rowIndex) => {
        if (rowIndex === 1) {
            row.eachCell((cell) => {
                cell.border = border;
            });   
        }
      });
  
      // File name and path
      const filename = `Template-Setup-Material-Pendukung-${Math.floor(Date.now() / 1000)}.xlsx`;
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

// Download Master Jenis Produksi
export const Projection_DownloadJenisProduksi = async (req, res) => {
    try {
        const { domain } = req.query;

        const jenis = await db("dbPortalFA.dbo.jenis_produksi as jp")
        .select(
            'jp.jenis_produksi_id',
            'jp.jenis_produksi',
        )
        .where('jp.domain', domain);

      // Define Excel data
      const data = [
            ["ID", "Jenis Produksi"],
      ];

      jenis.forEach((jp) => {
        data.push([jp.jenis_produksi_id, jp.jenis_produksi])
      })
  
      // Create a new workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Master Jenis Produksi');
  
      // Set column widths (A-B columns)
      worksheet.columns = [
        { width: 10 }, // Column A (ID)
        { width: 30 }, // Column B (Jenis Produksi)
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
            if (cell.value !== null && cell.value !== undefined && cell.value !== '') { 
                cell.border = {
                  top: { style: 'thin' },
                  left: { style: 'thin' },
                  bottom: { style: 'thin' },
                  right: { style: 'thin' }
                };
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
      const filename = `Data-Master-Jenis-Produksi-${Math.floor(Date.now() / 1000)}.xlsx`;
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