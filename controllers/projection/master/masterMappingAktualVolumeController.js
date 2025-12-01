import { db } from "../../../config/db.js";
import * as dotenv from 'dotenv' ;
import dayjs from "dayjs";
import xlsx from 'xlsx';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

dotenv.config()

// Get list master mapping actual volume
export const Projection_listMappingAktualVolume = async (req, res) => {
    try {
        let response;

        const {rowsPerPage, page, domain, sortBy, sort} = req.query;

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db("dbPortalFA.dbo.map_aktual_vol")
            .select(
                'map_aktual_vol_id',
                'domain',
                'group_product',
                'kategori',
            )
            .where('domain', domain)
            .orderBy(sortBy, sort);
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db("dbPortalFA.dbo.map_aktual_vol")
            .select(
                'map_aktual_vol_id',
                'domain',
                'group_product',
                'kategori',
            )
            .where('domain', domain)
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

// Get list master mapping actual volume
export const Projection_searchMappingAktualVolume = async (req, res) => {
    try {
        let response;

        const {
            rowsPerPage, 
            page, 
            domain, 
            search, 
            sortBy, 
            sort
        } = req.query;

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db("dbPortalFA.dbo.map_aktual_vol")
            .select(
                'map_aktual_vol_id',
                'domain',
                'group_product',
                'kategori',
            )
            .where('domain', domain)
            .andWhere(builder => {
                builder.whereILike('group_product', `%${search}%`)
                       .orWhereILike('kategori', `%${search}%`);
            })
            .orderBy(sortBy, sort);
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db("dbPortalFA.dbo.map_aktual_vol")
            .select(
                'map_aktual_vol_id',
                'domain',
                'group_product',
                'kategori',
            )
            .where('domain', domain)
            .andWhere(builder => {
                builder.whereILike('group_product', `%${search}%`)
                    .orWhereILike('kategori', `%${search}%`);
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

// Get detail master mapping actual volume
export const Projection_detailMappingAktualVolume = async (req, res) => {
    try {
        const {map_aktual_vol_id} = req.query;
        
        const response = await db("dbPortalFA.dbo.map_aktual_vol")
        .select(
            'map_aktual_vol_id',
            'domain',
            'group_product',
            'kategori',
        )
        .where('map_aktual_vol_id', map_aktual_vol_id)
        .first();

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

// Get list of group product
export const Projection_listGroupProduct = async (req, res) => {
    try {
        const response = await db("dbMaster.dbo.qad_product as qad")
        .select("qad.[group] as group_product")
        .max("qad.id as max_id")
        .whereNotExists(function () {
            this.select(1)
                .from("dbPortalFA.dbo.map_aktual_vol as map")
                .whereRaw("qad.[group] = map.group_product");
        })
        .whereNotNull("qad.[group]")
        .whereRaw("qad.[group] <> ''")
        .groupBy("qad.[group]");

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

// Upload Mapping Actual Volume template
export const Projection_UploadMapActualVolume = async (req, res) => {
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

                const group = String(transformedRow.Group_Produk || "").toLowerCase();  
                const code = `${group}-${domain}`;  
  
                if (itemCount[code] && group !== '' && group !== null) {  
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
                    group: "",
                    kategori: "",
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
                        if (transformedRow.Group_Produk === "" && transformedRow.Group_Kategori === "") return;
                
                        if (transformedRow.Group_Produk === null || transformedRow.Group_Produk === '') {
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                group: transformedRow.Group_Produk,
                                kategori: transformedRow.Group_Kategori,
                                message: `Gagal Import pada baris (${index + 1}) : [Group Produk] kolom wajib diisi.`
                            });
                        }
                
                        if (transformedRow.Group_Kategori === null || transformedRow.Group_Kategori === '' || typeof transformedRow.Group_Kategori !== 'string') {
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                group: transformedRow.Group_Produk,
                                kategori: transformedRow.Group_Kategori,
                                message: `Gagal Import pada baris (${index + 1}) : [Group Kategori] kolom wajib diisi.`
                            });
                
                            if (String(transformedRow.Group_Kategori).length > 100) {
                                errorCounter++;
                                errorText.push({
                                    baris: index + 1,
                                    group: transformedRow.Group_Produk,
                                    kategori: transformedRow.Group_Kategori,
                                    message: `Gagal Import pada baris (${index + 1}) : [Group Kategori] maksimal 100 char.`
                                });
                            }
                        }
                
                        const kode_group = await trx('dbMaster.dbo.qad_product')
                            .select('group')
                            .whereRaw('LOWER([group]) = ?', [String(transformedRow.Group_Produk || "").toLowerCase()])
                            .first();
                
                        if (!kode_group) {
                            errorCounter++;
                            errorText.push({
                                baris: index + 1,
                                group: transformedRow.Group_Produk,
                                kategori: transformedRow.Group_Kategori,
                                message: `Gagal Import pada baris (${index + 1}) : [${transformedRow.Group_Produk}] tidak dikenal.`
                            });
                        }
                
                        if(transformedRow.Group_Produk !== ""){
                            const cekdata = await trx('dbPortalFA.dbo.map_aktual_vol')
                                .select('map_aktual_vol_id')
                                .where('domain', domain)
                                .whereRaw('LOWER(group_product) = ?', [String(transformedRow.Group_Produk).toLowerCase()])
                                .first();
                    
                            if (cekdata) {
                                errorCounter++;
                                errorText.push({
                                    baris: index + 1,
                                    group: transformedRow.Group_Produk,
                                    kategori: transformedRow.Group_Kategori,
                                    message: `Gagal Import pada baris (${index + 1}) : [${transformedRow.Group_Produk}] sudah ada di database.`
                                });
                            }
                    
                            // Prepare valid data for insertion
                            if (!cekdata && kode_group) {
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
            await trx("dbPortalFA.dbo.map_aktual_vol").insert({
                domain: parseInt(domain),
                group_product: item.Group_Produk,
                kategori: item.Group_Kategori,
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

// Create Master Mapping Actual Volume
export const Projection_CreateMapActualVolume = async (req, res) => {
    const trx = await db.transaction();
    try {
        const { domain, group_product, kategori } = req.body;

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

        const kode_group = await trx('dbMaster.dbo.qad_product')
            .select('group')
            .where('group', group_product)
            .first();

        if (!kode_group) {
            await trx.rollback();
            return res.status(400).json({ message: `Kode group ${group_product} tidak dikenal.` });
        }

        const cekdata = await trx('dbPortalFA.dbo.map_aktual_vol')
            .select('map_aktual_vol_id')
            .where('domain', domain)
            .where('group_product', group_product)
            .first();

        if (cekdata) {
            await trx.rollback();
            return res.status(400).json({ message: `Kode group ${group_product} sudah ada di database.` });
        }

        // Insert validated data into the database
        await trx("dbPortalFA.dbo.map_aktual_vol").insert({
            domain: parseInt(domain),
            group_product: group_product,
            kategori: kategori,
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

// Update Master Mapping Actual Volume
export const Projection_UpdateMapActualVolume = async (req, res) => {
    const trx = await db.transaction();
    try {
        const { domain, group_product, kategori, empid } = req.body;

        // Input validation
        if (!domain || !group_product || !kategori || !empid) {
            console.error("Missing required fields:", { domain, group_product, kategori, empid });
            await trx.rollback();
            return res.status(400).json({ message: 'All fields are required.' });
        }

        // Validate user and get user_nik
        const user = await trx("dbPortalFA.dbo.users")
            .select('user_nik')
            .where('user_id', empid)
            .first();

        if (!user) {
            await trx.rollback();
            return res.status(400).json({ message: 'Invalid user, silahkan hubungi Tim IT' });
        }

        const userNik = user.user_nik;

        // Validate group_product
        const kode_group = await trx('dbMaster.dbo.qad_product')
            .select('group')
            .where('group', group_product)
            .first();

        if (!kode_group) {
            await trx.rollback();
            return res.status(400).json({ message: `Kode group ${group_product} tidak dikenal.` });
        }

        // Validate if data exists
        const checkData = await trx("dbPortalFA.dbo.map_aktual_vol")
            .select("map_aktual_vol_id")
            .where("group_product", group_product)
            .where("domain", domain)
            .first()

        if (!checkData) {
            await trx.rollback();
            return res.status(404).json({ message: `Kode group ${group_product} tidak dikenal.` });
        }

        // Update validated data into the database
        const updateResult = await trx("dbPortalFA.dbo.map_aktual_vol")
            .where("map_aktual_vol_id", checkData.map_aktual_vol_id)
            .update({
                kategori,
                updated_by: parseInt(userNik, 10),
                updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            });

        if (!updateResult) {
            await trx.rollback();
            return res.status(400).json({ message: "Update gagal, data tidak ditemukan atau tidak berubah." });
        }

        await trx.commit();
        return res.status(200).json({ message: 'Data berhasil diupdate' });
    } catch (error) {
        await trx.rollback();
        return res.status(500).json({
            type: 'error',
            message: process.env.DEBUG === "1" ? error.message : 'Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT',
        });
    }
}

// Delete Master Mapping Actual Volume
export const Projection_DeleteMapActualVolume = async (req, res) => {
    try {
        const { domain, group_product } = req.query;

        if (!domain || !group_product) {
            return res.status(400).json({ 
                message: 'Domain and group are required' 
            });
        }

        // Delete all matching records
        await db("dbPortalFA.dbo.map_aktual_vol")
        .where({ domain, group_product })
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

// Download Master Mapping Actual Volume
export const Projection_DownloadMapActualVolume = async (req, res) => {
    try {
      // Define Excel data
      const data = [
            ["Group Produk", "Group Kategori"],
            ["c020", "PIPA"],
      ];
  
      // Create a new workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Master Mapping Actual Volume');
  
      // Set column widths (A-B columns)
      worksheet.columns = [
        { width: 15 }, // Column A (Group Produk)
        { width: 30 }, // Column B (Group Kategori)
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
      headerRow.eachCell((cell) => {
        cell.protection = { locked: true };
        cell.border = border;
      });
  
      // Unlock the rest of the worksheet (rows and columns)
      worksheet.eachRow((row, rowIndex) => {
        if (rowIndex > 1) {
          row.eachCell((cell) => {
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
      const filename = `Template-Master-MapActualVolume-${Math.floor(Date.now() / 1000)}.xlsx`;
      const filePath = path.resolve('file', filename);
  
      // Write the workbook to a file
      await workbook.xlsx.writeFile(filePath);
  
      // Send the file to the client
      return res.status(200).download(filePath, filename, (err) => {
        if (err) {
          console.error("Error while downloading the file:", err);
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

// Download Master GL Code
export const Projection_DownloadMasterGroupProduct = async (req, res) => {
  try {
    const group = await db("dbMaster.dbo.qad_product as qad")
    .select("qad.[group] as group_product", db.raw("MAX(qad.id) as max_id"))
    .whereRaw("qad.[group] <> ''")
    .groupBy("qad.[group]");


    const data = [
      ["Group Product"]
    ];

    group.forEach((gp) => {
      data.push([gp.group_product])
    })

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Master Group Product");

    // Set column widths (A columns)
    worksheet.columns = [
      { width: 30 }, // Column A (Group Product)
    ];

    // Add rows to the worksheet
    const border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
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
    await worksheet.protect("Rucika123", {
      selectLockedCells: true,
      selectUnlockedCells: true,
    });

    // File name and path
    const filename = `Data-Master-Group-Product.xlsx`;
    const filePath = path.resolve("file", filename);

    // Write the workbook to a file
    await workbook.xlsx.writeFile(filePath);

    // Send the file to the client
    return res.status(200).download(filePath, filename, (err) => {
      if (err) {
        console.error("Error while downloading the file:", err);
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