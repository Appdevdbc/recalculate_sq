import { db } from "../../../config/db.js";
import * as dotenv from 'dotenv' ;
import dayjs from "dayjs";
import xlsx from 'xlsx';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { roundValue } from "../../../helpers/utils.js";

dotenv.config()

// Get list setup kurs
export const Projection_listKurs = async (req, res) => {
    try {
        let response;

        const {rowsPerPage, page, domain} = req.query;

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db("dbPortalFA.dbo.kurs_pnl")
            .select('domain', 'tahun', 'currency')
            .max('kurs_pnl_id as kurs_pnl_id')
            .where('domain', domain)
            .groupBy('tahun', 'domain', 'currency')
            .orderBy('tahun', 'desc');          
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db("dbPortalFA.dbo.kurs_pnl")
            .select('domain', 'tahun', 'currency')
            .max('kurs_pnl_id as kurs_pnl_id') 
            .where('domain', domain)
            .groupBy('tahun', 'domain', 'currency')
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
        return res.status(406).json(/* { message: error.message } */
        {
            type:'error',
            message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
        });
    }
}

// Search setup kurs by currency
export const Projection_searchKurs = async (req, res) => {
    try {
        let response;

        const {rowsPerPage, page, domain, search} = req.query;

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            if(isNaN(parseInt(search))){
                response = await db("dbPortalFA.dbo.kurs_pnl")
                .select('domain', 'tahun', 'currency')
                .where('domain', domain)
                .whereILike('currency', `%${search}%`)
                .groupBy('tahun', 'domain', 'currency')
                .orderBy('tahun', 'desc');
            } else {
                response = await db("dbPortalFA.dbo.kurs_pnl")
                .select('domain', 'tahun', 'currency')
                .where('domain', domain)
                .where('tahun', search)
                .groupBy('tahun', 'domain', 'currency')
                .orderBy('tahun', 'desc');
            }
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            if(isNaN(parseInt(search))){
                response = await db("dbPortalFA.dbo.kurs_pnl")
                .select('domain', 'tahun', 'currency')
                .where('domain', domain)
                .whereILike('currency', `%${search}%`)
                .groupBy('tahun', 'domain', 'currency')
                .orderBy('tahun', 'desc')
                .paginate({
                    perPage: Math.abs(Math.floor(parseInt(rowsPerPage, 10))),
                    currentPage: pages,
                    isLengthAware: true,
                });
            } else {
                response = await db("dbPortalFA.dbo.kurs_pnl")
                .select('domain', 'tahun', 'currency')
                .where('domain', domain)
                .where('tahun', search)
                .groupBy('tahun', 'domain', 'currency')
                .orderBy('tahun', 'desc')
                .paginate({
                    perPage: Math.abs(Math.floor(parseInt(rowsPerPage, 10))),
                    currentPage: pages,
                    isLengthAware: true,
                });
            }
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

// Check existing kurs
export const Projection_checkKurs = async (req, res) => {
    try {
        const {domain, tahun, search} = req.query;

        // Validate if request has Query rowsPerPage
        const response = await db("dbPortalFA.dbo.kurs_pnl")
            .select('kurs_pnl_id')
            .where('domain', domain)
            .where('tahun', tahun)
            .whereRaw('LOWER(currency) = ?', [search.toLowerCase()])
            .first();
        
        if(response){
            return res.status(200).json({
                success: false,
                message: `Currency [${search}] di tahun ${tahun} sudah ada`,
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Currency dapat digunakan',
        });
    } catch(error){
        return res.status(406).json(/* { message: error.message } */
        {
            type:'error',
            message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
        });
    }
}

// Get Detail setup kurs
export const Projection_detailKurs = async (req, res) => {
    try {
        const {domain, tahun, currency, empid} = req.query;

        const response = await db("dbPortalFA.dbo.kurs_pnl")
            .select(
                'kurs_pnl_id', 
                'domain', 
                'tahun', 
                'bulan', 
                'currency', 
                'budget', 
                'proyeksi',
            )
            .where('domain', domain)
            .where('tahun', tahun)
            .where('currency', currency)
            .orderBy('bulan', 'asc');

        const getAdmin = await db("dbPortalFA.dbo.user_access")
            .select('access_admin')
            .where('access_empid', empid)
            .where('access_menu', '/setup_asumsi_price')
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
        return res.status(406).json(/* { message: error.message } */
        {
            type:'error',
            message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
        });
    }
}

// Upload excel template kurs pnl
export const Projection_UploadKurs = async (req, res) => {
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

                const crc = String(transformedRow.Currency).toLowerCase();  
                const tahun = transformedRow.Tahun;
                const bulan = transformedRow.Bulan;
                const code = `${crc}-${tahun}-${bulan}-${domain}`;
                
                if (itemCount[code] && crc !== '' && crc !== null && tahun !== '' && tahun !== null && bulan !== '' && bulan !== null) {  
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
                    currency: String(key).split("-")[0],
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
                        if (transformedRow.Tahun === "" && transformedRow.Bulan === "" && transformedRow.Currency === "" && transformedRow.Budget === "" && transformedRow.Proyeksi === "") return;
                
                        if (transformedRow.Tahun === null || typeof transformedRow.Tahun !== 'number') {
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                tahun: transformedRow.Tahun,
                                bulan: transformedRow.Bulan,
                                currency: transformedRow.Currency,
                                budget: transformedRow.Budget,
                                proyeksi: transformedRow.Proyeksi,
                                message: `Gagal Import pada baris (${index + 1}) : [Tahun] kolom wajib diisi.`
                            });

                            if(transformedRow.Tahun < 0){
                                errorCounter++;
                                errorText.push({
                                    baris: index + 1,
                                    tahun: transformedRow.Tahun,
                                    bulan: transformedRow.Bulan,
                                    currency: transformedRow.Currency,
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
                                currency: transformedRow.Currency,
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
                                currency: transformedRow.Currency,
                                budget: transformedRow.Budget,
                                proyeksi: transformedRow.Proyeksi,
                                message: `Gagal Import pada baris (${index + 1}) : [Bulan] kolom tidak valid.`
                            });
                        }
                
                        if (transformedRow.Currency === null || transformedRow.Currency === '' || typeof transformedRow.Currency !== 'string') {
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                tahun: transformedRow.Tahun,
                                bulan: transformedRow.Bulan,
                                currency: transformedRow.Currency,
                                budget: transformedRow.Budget,
                                proyeksi: transformedRow.Proyeksi,
                                message: `Gagal Import pada baris (${index + 1}) : [Currency] kolom wajib diisi.`
                            });
                        }

                        if (transformedRow.Budget && isNaN(parseFloat(String(transformedRow.Budget).replace(/,/g, '')))) {
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                tahun: transformedRow.Tahun,
                                bulan: transformedRow.Bulan,
                                currency: transformedRow.Currency,
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
                                currency: transformedRow.Currency,
                                budget: transformedRow.Budget,
                                proyeksi: transformedRow.Proyeksi,
                                message: `Gagal Import pada baris (${index + 1}) : [Proyeksi] kolom harus berupa angka atau decimal.`
                            });
                        }

                        if(transformedRow.Tahun !== "" && transformedRow.Bulan !== "" && transformedRow.Currency !== ""){
                            const cekdata = await trx('dbPortalFA.dbo.kurs_pnl')
                            .select('kurs_pnl_id')
                            .where('domain', domain)
                            .where('tahun', transformedRow.Tahun)
                            .where('bulan', transformedRow.Bulan)
                            .whereRaw('LOWER(currency) = ?', [transformedRow.Currency.toLowerCase()])
                            .first();
                    
                            if (cekdata) {
                                errorCounter++;
                                errorText.push({
                                    baris: index + 1,
                                    tahun: transformedRow.Tahun,
                                    bulan: transformedRow.Bulan,
                                    currency: transformedRow.Currency,
                                    budget: transformedRow.Budget,
                                    proyeksi: transformedRow.Proyeksi,
                                    message: `Gagal Import pada baris (${index + 1}) : Currency [${transformedRow.Currency}] pada tahun [${transformedRow.Tahun}] duplicate.`
                                });
                            }
    
                            // Prepare valid data for insertion
                            if (!cekdata) {
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
            await trx("dbPortalFA.dbo.kurs_pnl").insert({
                domain: parseInt(domain),
                tahun: parseInt(item.Tahun),
                bulan: parseInt(item.Bulan),
                currency: item.Currency,
                budget: roundValue(item.Budget ?? 0),
                proyeksi: roundValue(item.Proyeksi ?? 0),
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

// Download Tempalte kurs pnl 
export const Projection_DownloadKurs = async (req, res) => {
    try {
      // Define Excel data
      const data = [
            ["Tahun", "Bulan", "Currency", "Budget", "Proyeksi"],
            [2024, 1, "USD", 1000000, 1500000],
      ];
  
      // Create a new workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Setup Kurs');
  
      // Set column widths (A-E columns)
      worksheet.columns = [
        { width: 10 }, // Column A (Tahun)
        { width: 10 }, // Column B (Bulan)
        { width: 15 }, // Column C (Currency)
        { width: 20 }, // Column D (Budget)
        { width: 20 }, // Column E (Proyeksi)
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
        worksheet.addRow(['', '', '', '', '']);
      }
  
      // Lock the header row (Row 1)
      const headerRow = worksheet.getRow(1);
      headerRow.height = 25;
      headerRow.eachCell((cell,colNumber) => {
        cell.protection = { locked: true };
        cell.border = border;

        if(colNumber <= 3) {
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

// Create data setup kurs
export const Projection_CreateKurs = async (req, res) => {
    const trx = await db.transaction();
    try {
        const {
            tahun,
            currency,
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

        const errors = [];
        await Promise.all(
            bulan.map(async (data) => {
                const cekdata = await trx('dbPortalFA.dbo.kurs_pnl')
                    .select('kurs_pnl_id')
                    .where('domain', domain)
                    .where('tahun', parseInt(tahun))
                    .where('bulan', parseInt(data.id))
                    .where('currency', currency)
                    .first();
    
                if (cekdata) {
                    errors.push(`Currency [${currency}] pada tahun [${tahun}] duplicate for bulan [${data.id}].`);
                    return;
                }

                await trx("dbPortalFA.dbo.kurs_pnl").insert({
                    domain: parseInt(domain),
                    tahun: parseInt(tahun),
                    bulan: parseInt(data.id),
                    currency: currency,
                    budget: parseFloat(data.budget ?? 0),
                    proyeksi: parseFloat(data.projection ?? 0),
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

// Update data setup kurs
export const Projection_UpdateKurs = async (req, res) => {
    const trx = await db.transaction();
    try {
        const { bulan } = req.body;

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

        const errors = [];
        await Promise.all(
            bulan.map(async (data) => {
                const cekdata = await trx('dbPortalFA.dbo.kurs_pnl')
                    .select('kurs_pnl_id')
                    .where('kurs_pnl_id', data.kurs_pnl_id)
                    .first();
    
                if (!cekdata) {
                    errors.push(`Currency [${currency}] pada tahun [${tahun}] bulan [${data.id}] tidak ditemukan.`);
                    return;
                }

                await trx("dbPortalFA.dbo.kurs_pnl")
                .where('kurs_pnl_id', data.kurs_pnl_id)
                .update({
                    budget: parseFloat(data.budget ?? 0),
                    proyeksi: parseFloat(data.proyeksi ?? 0),
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

// Delete data setup kurs 
export const Projection_DeleteKurs = async (req, res) => {
    try {
        const { domain, tahun, currency } = req.query;

        if (!domain || !tahun || !currency ) {
            return res.status(400).json({ 
                message: 'Domain, tahun and currency are required' 
            });
        }

        // Delete all matching records
        await db("dbPortalFA.dbo.kurs_pnl")
        .where({ domain, tahun, currency })
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

// Copy Kurs Data and Create New Kurs
export const Projection_CopyKurs = async (req, res) => {
    const trx = await db.transaction();
    try {
        const { domain, new_tahun, tahun, currency, empid } = req.body;

        const user = await db("dbPortalFA.dbo.users")
            .select("user_nik")
            .where("user_id", empid)
            .first();

        if (!user) {
            await trx.rollback();
            return res.status(400).json({ message: "Invalid user, silahkan hubungi Tim IT" });
        }

        const c_empid = user.user_nik;

        const kursData = await db("dbPortalFA.dbo.kurs_pnl")
            .select(
                "domain",
                "tahun",
                "bulan", 
                "currency", 
                "budget", 
                "proyeksi"
            )
            .where({ tahun, domain, currency });

        await Promise.all(
            kursData.map(async (data) => {
                const cekdata = await trx('dbPortalFA.dbo.kurs_pnl')
                    .select('kurs_pnl_id')
                    .where('domain', domain)
                    .where('tahun', new_tahun)
                    .where('bulan', data.bulan)
                    .where('currency', data.currency)
                    .first();

                if (cekdata) {
                    throw new Error(`Currency [${data.currency}] pada tahun [${data.tahun}] bulan [${data.bulan}] sudah ada.`);
                }

                await trx("dbPortalFA.dbo.kurs_pnl").insert({
                    domain: parseInt(domain, 10),
                    tahun: parseInt(new_tahun, 10),
                    bulan: data.bulan,
                    currency: data.currency,
                    budget: data.budget,
                    proyeksi: data.proyeksi,
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

