import { db } from "../../../config/db.js";
import * as dotenv from "dotenv";
import dayjs from "dayjs";
import xlsx from "xlsx";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import { roundValue } from "../../../helpers/utils.js";

dotenv.config();

// Get list setup asumsi price material
export const Projection_listAsumsiPriceMaterial = async (req, res) => {
  try {
    let response;

    const { rowsPerPage, page, domain } = req.query;

    // Validate if request has Query rowsPerPage
    if (rowsPerPage == null) {
      response = await db("dbPortalFA.dbo.asumsi_price_material as apm")
        .select(
          "apm.asumsi_price_material_id",
          "apm.domain",
          "apm.tahun",
          "apm.component",
          "apm.kurs_id",
          "apm.value_item",
          "kp.currency"
        )
        .join(
          "dbPortalFA.dbo.kurs_pnl as kp",
          "apm.kurs_id",
          "=",
          "kp.kurs_pnl_id"
        )
        .where("apm.domain", domain)
        .orderBy("apm.tahun", "desc");
    } else {
      const pages = Math.abs(Math.floor(parseInt(page)));
      response = await db("dbPortalFA.dbo.asumsi_price_material as apm")
        .select(
          "apm.asumsi_price_material_id",
          "apm.domain",
          "apm.tahun",
          "apm.component",
          "apm.kurs_id",
          "apm.value_item",
          "kp.currency"
        )
        .join(
          "dbPortalFA.dbo.kurs_pnl as kp",
          "apm.kurs_id",
          "=",
          "kp.kurs_pnl_id"
        )
        .where("apm.domain", domain)
        .orderBy("apm.tahun", "desc")
        .paginate({
          perPage: Math.abs(Math.floor(parseInt(rowsPerPage, 10))),
          currentPage: pages,
          isLengthAware: true,
        });
    }

    return res.status(200).json({
      message: "Success",
      data: response,
    });
  } catch (error) {
    return res.status(406).json(
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

// Get list setup asumsi price material
export const Projection_searchAsumsiPriceMaterial = async (req, res) => {
  try {
    let response;

    const { rowsPerPage, page, domain, search } = req.query;

    // Validate if request has Query rowsPerPage
    if (rowsPerPage == null) {
      response = await db("dbPortalFA.dbo.asumsi_price_material as apm")
        .select(
          "apm.domain",
          "apm.tahun",
          "apm.component",
          "apm.kurs_id",
          "apm.value_item",
          "kp.currency"
        )
        .join("dbPortalFA.dbo.kurs_pnl as kp", "apm.kurs_id", "kp.kurs_pnl_id")
        .where("apm.domain", domain)
        .andWhere((qb) => {
          qb.whereILike("apm.component", `%${search}%`).orWhereILike(
            "kp.currency",
            `%${search}%`
          );
        })
        .orderBy("apm.tahun", "desc");
    } else {
      const pages = Math.abs(Math.floor(parseInt(page)));
      response = await db("dbPortalFA.dbo.asumsi_price_material as apm")
        .select(
          "apm.domain",
          "apm.tahun",
          "apm.component",
          "apm.kurs_id",
          "apm.value_item",
          "kp.currency"
        )
        .join("dbPortalFA.dbo.kurs_pnl as kp", "apm.kurs_id", "kp.kurs_pnl_id")
        .where("apm.domain", domain)
        .andWhere((qb) => {
          qb.whereILike("apm.component", `%${search}%`).orWhereILike(
            "kp.currency",
            `%${search}%`
          );
        })
        .orderBy("apm.tahun", "desc")
        .paginate({
          perPage: Math.abs(Math.floor(parseInt(rowsPerPage, 10))),
          currentPage: pages,
          isLengthAware: true,
        });
    }

    return res.status(200).json({
      message: "Success",
      data: response,
    });
  } catch (error) {
    return res.status(406).json(
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

// Get detail setup asumsi price material
export const Projection_detailAsumsiPriceMaterial = async (req, res) => {
  try {
    const { asumsi_price_material_id } = req.query;

    const response = await db("dbPortalFA.dbo.asumsi_price_material as apm")
      .select(
        "apm.asumsi_price_material_id",
        "apm.domain",
        "apm.tahun",
        "apm.component",
        "apm.kurs_id",
        "apm.value_item",
        "kp.currency"
      )
      .join(
        "dbPortalFA.dbo.kurs_pnl as kp",
        "apm.kurs_id",
        "=",
        "kp.kurs_pnl_id"
      )
      .where("apm.asumsi_price_material_id", asumsi_price_material_id)
      .first();

    return res.status(200).json({
      message: "Success",
      data: response,
    });
  } catch (error) {
    return res.status(406).json(
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

// Get list resep pnl
export const Projection_componentAsumsiPriceMaterial = async (req, res) => {
  try {
    const { domain } = req.query;

    const response = await db("dbPortalFA.dbo.resep_pnl as rp")
      .select("rp.domain", "rp.tahun", "rp.component")
      .whereNotExists(function () {
        this.select("*")
          .from("dbPortalFA.dbo.asumsi_price_material as apm")
          .whereRaw("apm.component = rp.component")
          .whereRaw("apm.domain = rp.domain");
      })
      .where("rp.domain", domain)
      // .andWhereRaw("rp.created_at >= DATEADD(day, -14, GETDATE())")
      .orderBy("rp.tahun", "desc");

    return res.status(200).json({
      message: "Success",
      data: response,
    });
  } catch (error) {
    return res.status(406).json(
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

// Get list resep pnl by year
export const Projection_componentResepPnl = async (req, res) => {
  try {
    const { domain } = req.query;

    const response = await db("dbPortalFA.dbo.resep_pnl as rp")
      .select(
        "rp.resep_pnl_id",
        "rp.domain",
        "rp.tahun",
        "rp.component",
        "rp.component_desc"
      )
      .where("rp.domain", domain)
      .orderBy("rp.tahun", "desc");

    return res.status(200).json({
      message: "Success",
      data: response,
    });
  } catch (error) {
    return res.status(406).json(
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

// Upload excel template asumsi price material
export const Projection_UploadAsumsiPriceMaterial = async (req, res) => {
  const trx = await db.transaction();
  try {
    let errorCounter = 0;
    let errorText = [];
    const dokumen = req.files.upload ? req.files.upload[0].filename : null;

    // Validate user, and get user_nik to assign created_by
    const user = await db("dbPortalFA.dbo.users")
      .select("user_nik")
      .where("user_id", req.body.empid)
      .first();

    if (!user) {
      await trx.rollback();
      return res
        .status(400)
        .json({ message: "Invalid user, silahkan hubungi Tim IT" });
    }

    const empid = user.user_nik;
    const domain = req.body.domain;

    // If Dokumen exists
    if (!dokumen) {
      await trx.rollback();
      return res
        .status(400)
        .json({ message: "Gagal upload, silahkan hubungi Tim IT" });
    }

    // Check if file exists
    const filePath = `file/${dokumen}`;
    if (!fs.existsSync(filePath)) {
      await trx.rollback();
      return res
        .status(400)
        .json({ message: "Gagal upload, silahkan hubungi Tim IT" });
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
            const comp = transformedRow.Component;
            const code = `${crc}-${comp}-${tahun}-${domain}`;
            
            if (itemCount[code] && crc !== '' && crc !== null && tahun !== '' && tahun !== null && comp !== '' && comp !== null) {  
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
              tahun: String(key).split("-")[2],
              component: String(key).split("-")[1],
              currency: String(key).split("-")[0],
              value_item: "",
              message: `Gagal Import pada baris (${value.lines.join(', ')}) : [${String(key).split("-")[0]} component ${String(key).split("-")[1]} tahun ${String(key).split("-")[2]}] Duplicate data.`
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
              const transformedKey = key.replace(/\s+/g, "_");
              acc[transformedKey] = row[key];
              return acc;
            }, {});

            // Validation
            if (
              transformedRow.Tahun === "" &&
              transformedRow.Component === "" &&
              transformedRow.Currency === "" &&
              transformedRow.Value_Item === ""
            ) {
              return;
            }

            if (
              transformedRow.Tahun === null ||
              typeof transformedRow.Tahun !== "number"
            ) {
              errorCounter++;
              errorText.push({
                baris: index + 1,
                tahun: transformedRow.Tahun,
                component: transformedRow.Component,
                currency: transformedRow.Currency,
                value_item: transformedRow.Value_Item,
                message: `Gagal Import pada baris (${index + 1}) : [Tahun] kolom wajib diisi.`
              });
              if (transformedRow.Tahun < 0) {
                errorCounter++;
                errorText.push({
                  baris: index + 1,
                  tahun: transformedRow.Tahun,
                  component: transformedRow.Component,
                  currency: transformedRow.Currency,
                  value_item: transformedRow.Value_Item,
                  message: `Gagal Import pada baris (${index + 1}) : [Tahun] kolom tidak valid.`
                });
              }
            }

            if (
              transformedRow.Component === null ||
              transformedRow.Component === "" ||
              typeof String(transformedRow.Component) !== "string"
            ) {
              errorCounter++;
              errorText.push({
                baris: index + 1,
                tahun: transformedRow.Tahun,
                component: transformedRow.Component,
                currency: transformedRow.Currency,
                value_item: transformedRow.Value_Item,
                message: `Gagal Import pada baris (${index + 1}) : [Component] kolom wajib diisi.`
              });
            }

            if (
              transformedRow.Currency === null ||
              transformedRow.Currency === "" ||
              typeof transformedRow.Currency !== "string"
            ) {
              errorCounter++;
              errorText.push({
                baris: index + 1,
                tahun: transformedRow.Tahun,
                component: transformedRow.Component,
                currency: transformedRow.Currency,
                value_item: transformedRow.Value_Item,
                message: `Gagal Import pada baris (${index + 1}) : [Currency] kolom wajib diisi.`
              });
            }

            if (
              transformedRow.Value_Item === null ||
              typeof parseFloat(transformedRow.Value_Item) !== "number"
            ) {
              errorCounter++;
              errorText.push({
                baris: index + 1,
                tahun: transformedRow.Tahun,
                component: transformedRow.Component,
                currency: transformedRow.Currency,
                value_item: transformedRow.Value_Item,
                message: `Gagal Import pada baris (${index + 1}) : [Value Item] kolom wajib diisi.`
              });
            }

            const resep = await trx("dbPortalFA.dbo.resep_pnl")
              .select("resep_pnl_id")
              .whereRaw("LOWER(component) = ?", [
                String(transformedRow.Component).toLowerCase(),
              ])
              .first();

            if (!resep) {
              errorCounter++;
              errorText.push({
                baris: index + 1,
                tahun: transformedRow.Tahun,
                component: transformedRow.Component,
                currency: transformedRow.Currency,
                value_item: transformedRow.Value_Item,
                message: `Gagal Import pada baris (${index + 1}) : [${transformedRow.Component}] tidak dikenal.`
              });
            }

            const kurs = await trx("dbPortalFA.dbo.kurs_pnl")
              .select("kurs_pnl_id")
              .whereRaw("LOWER(currency) = ?", [
                transformedRow.Currency.toLowerCase(),
              ])
              .first();

            if (!kurs) {
              errorCounter++;
              errorText.push({
                baris: index + 1,
                tahun: transformedRow.Tahun,
                component: transformedRow.Component,
                currency: transformedRow.Currency,
                value_item: transformedRow.Value_Item,
                message: `Gagal Import pada baris (${index + 1}) : [${transformedRow.Currency}] tidak dikenal.`
              });
            }

            if (kurs && resep && transformedRow.Tahun !== "" && transformedRow.Component !== "") {
              const cekdata = await trx("dbPortalFA.dbo.asumsi_price_material")
                .select("asumsi_price_material_id")
                .where("domain", domain)
                .where("tahun", transformedRow.Tahun)
                .where("component", transformedRow.Component)
                .where("kurs_id", kurs.kurs_pnl_id)
                .first();

              if (cekdata) {
                errorCounter++;
                errorText.push({
                    baris: index + 1,
                    tahun: transformedRow.Tahun,
                    component: transformedRow.Component,
                    currency: transformedRow.Currency,
                    value_item: transformedRow.Value_Item,
                    message: `Gagal Import pada baris (${index + 1}) : Component [${transformedRow.Component}] dan Currency [${transformedRow.Currency}] pada tahun [${transformedRow.Tahun}] sudah ada.`
                });
              }

              // Prepare valid data for insertion
              if (!cekdata && kurs !== null && resep !== null) {
                transformedRow.kurs_pnl_id = kurs.kurs_pnl_id;
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
      await trx("dbPortalFA.dbo.asumsi_price_material").insert({
        domain: parseInt(domain),
        tahun: parseInt(item.Tahun),
        component: item.Component,
        kurs_id: parseInt(item.kurs_pnl_id),
        value_item: roundValue(item.Value_Item ?? 0),
        created_by: parseInt(empid),
        created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      });
    }

    // Delete uploaded file after successful database insertion
    fs.unlinkSync(filePath);

    await trx.commit();
    return res.status(201).json({ message: "Data berhasil diupload" });
  } catch (error) {
    await trx.rollback();
    return res.status(406).json({
      type: "error",
      message:
        process.env.DEBUG == 1
          ? error.message
          : "Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT",
    });
  }
};

// Download Tempalte asumsi price material
export const Projection_DownloadAsumsiPriceMaterial = async (req, res) => {
  try {
    // Define Excel data
    const data = [
      ["Tahun", "Component", "Currency", "Value Item"],
      [2024, "81010030001", "SGD", 0.9],
    ];

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Setup Asumsi Price");

    // Set column widths (A-D columns)
    worksheet.columns = [
      { width: 10 }, // Column A (Tahun)
      { width: 30 }, // Column B (Component)
      { width: 15 }, // Column C (Currency)
      { width: 20 }, // Column D (Value Item)
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

    for (let i = 0; i < 1000; i++) {
      worksheet.addRow(["", "", "", "", ""]);
    }

    // Lock the header row (Row 1)
    const headerRow = worksheet.getRow(1);
    headerRow.height = 25;
    headerRow.eachCell((cell, colNumber) => {
      cell.protection = { locked: true };
      cell.border = border;

      if (colNumber <= 3) {
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
        };
      } else {
        cell.alignment = {
          horizontal: "right",
          vertical: "middle",
        };
      }
    });

    // Unlock the rest of the worksheet (rows and columns)
    worksheet.eachRow((row, rowIndex) => {
      if (rowIndex > 1) {
        row.eachCell((cell, colNumber) => {
          if (
            cell.value !== null &&
            cell.value !== undefined &&
            cell.value !== ""
          ) {
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            };
          }

          if (colNumber >= 1 && colNumber <= 3) {
            cell.alignment = { horizontal: "center" };
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
    const filename = `Template-Setup-Asumsi-Price-Material-${Math.floor(
      Date.now() / 1000
    )}.xlsx`;
    const filePath = path.resolve("file", filename);

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

// Create asumsi price material
export const Projection_CreateAsumsiPriceMaterial = async (req, res) => {
  const trx = await db.transaction();
  try {
    const { domain, asumsiprice } = req.body;

    // Validate user, and get user_nik to assign created_by
    const user = await db("dbPortalFA.dbo.users")
      .select("user_nik")
      .where("user_id", req.body.empid)
      .first();

    if (!user) {
      await trx.rollback();
      return res
        .status(400)
        .json({ message: "Invalid user, silahkan hubungi Tim IT" });
    }

    const empid = user.user_nik;

    // Insert validated data into the database
    for (const item of asumsiprice) {
      const resep = await trx("dbPortalFA.dbo.resep_pnl")
        .select("resep_pnl_id")
        .whereRaw("LOWER(component) = ?", [
          String(item.component).toLowerCase(),
        ])
        .first();

      if (!resep) {
        await trx.rollback();
        return res
          .status(400)
          .json({ message: `component ${item.component} tidak dikenal.` });
      }

      const kurs = await trx("dbPortalFA.dbo.kurs_pnl")
        .select("kurs_pnl_id")
        .where("kurs_pnl_id", parseInt(item.kurs_id))
        .first();

      if (!kurs) {
        await trx.rollback();
        return res
          .status(400)
          .json({ message: `Kurs ${item.kurs_id} tidak dikenal.` });
      }

      const cekdata = await trx("dbPortalFA.dbo.asumsi_price_material")
        .select("asumsi_price_material_id")
        .where("domain", domain)
        .where("tahun", parseInt(item.tahun))
        .where("component", item.component)
        .where("kurs_id", parseInt(item.kurs_id))
        .first();

      if (cekdata) {
        await trx.rollback();
        return res
          .status(400)
          .json({
            message: `Component [${item.component}] dan Currency [${item.kurs_id}] pada tahun [${item.tahun}] sudah ada.`,
          });
      }

      await trx("dbPortalFA.dbo.asumsi_price_material").insert({
        domain: parseInt(domain),
        tahun: parseInt(item.tahun),
        component: item.component,
        kurs_id: parseInt(item.kurs_id),
        value_item: parseFloat(item.value_item),
        created_by: parseInt(empid),
        created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      });
    }

    await trx.commit();
    return res.status(201).json({ message: "Data berhasil dibuat" });
  } catch (error) {
    await trx.rollback();
    return res.status(406).json({
      type: "error",
      message:
        process.env.DEBUG == 1
          ? error.message
          : "Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT",
    });
  }
};

// Update asumsi price material
export const Projection_UpdateAsumsiPriceMaterial = async (req, res) => {
  const trx = await db.transaction();
  try {
    const { asumsi_price_material_id, value_item } = req.body;

    // Validate user, and get user_nik to assign created_by
    const user = await db("dbPortalFA.dbo.users")
      .select("user_nik")
      .where("user_id", req.body.empid)
      .first();

    if (!user) {
      await trx.rollback();
      return res
        .status(400)
        .json({ message: "Invalid user, silahkan hubungi Tim IT" });
    }

    const empid = user.user_nik;

    // Update validated data into the database
    const cekdata = await trx("dbPortalFA.dbo.asumsi_price_material")
      .select("asumsi_price_material_id")
      .where("asumsi_price_material_id", asumsi_price_material_id)
      .first();

    if (!cekdata) {
      await trx.rollback();
      return res
        .status(404)
        .json({ message: `Data ${asumsi_price_material_id} tidak ditemukan.` });
    }

    await trx("dbPortalFA.dbo.asumsi_price_material")
      .where("asumsi_price_material_id", asumsi_price_material_id)
      .update({
        value_item: parseFloat(value_item),
        updated_by: parseInt(empid),
        updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      });

    await trx.commit();
    return res.status(201).json({ message: "Data berhasil diubah" });
  } catch (error) {
    await trx.rollback();
    return res.status(406).json({
      type: "error",
      message:
        process.env.DEBUG == 1
          ? error.message
          : "Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT",
    });
  }
};

// Delete data asumsi price material
export const Projection_DeleteAsumsiPriceMaterial = async (req, res) => {
  try {
    const { asumsi_price_material_id } = req.query;

    if (!asumsi_price_material_id) {
      return res.status(400).json({
        message: "asumsi_price_material_id are required",
      });
    }

    // Delete all matching records
    await db("dbPortalFA.dbo.asumsi_price_material")
      .where({ asumsi_price_material_id })
      .delete();

    return res.status(204).json({ message: "Data berhasil dihapus!" });
  } catch (error) {
    return res.status(406).json(
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

// Download Master Resep Pnl
export const Projection_DownloadComponentResepPnl = async (req, res) => {
  try {
    const { domain } = req.query;

    const resep = await db("dbPortalFA.dbo.resep_pnl")
      .select("component", "component_desc")
      .where("domain", domain);

    // Define Excel data
    const data = [["Component", "Component Desc"]];

    resep.forEach((rsp) => {
      data.push([rsp.component, rsp.component_desc]);
    });

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Master Component Resep Pnl");

    // Set column widths (A-B columns)
    worksheet.columns = [
      { width: 15 }, // Column A (ID)
      { width: 30 }, // Column B (Jenis Produksi)
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
          if (
            cell.value !== null &&
            cell.value !== undefined &&
            cell.value !== ""
          ) {
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
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
    const filename = `Data-Master-Component-Resep-Pnl-${Math.floor(
      Date.now() / 1000
    )}.xlsx`;
    const filePath = path.resolve("file", filename);

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

// Download Master Currency
export const Projection_DownloadCurrency = async (req, res) => {
  try {
    const { domain } = req.query;

    const currency = await db("dbPortalFA.dbo.kurs_pnl")
      .select("domain", "currency", db.raw("MAX(kurs_pnl_id) as kurs_pnl_id"))
      .where("domain", domain)
      .groupBy("domain", "currency");

    // Define Excel data
    const data = [["Currency"]];

    currency.forEach((crc) => {
      data.push([crc.currency]);
    });

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Currency");

    // Set column widths (A columns)
    worksheet.columns = [
      { width: 15 }, // Column A (Currency)
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
          if (
            cell.value !== null &&
            cell.value !== undefined &&
            cell.value !== ""
          ) {
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
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
    const filename = `Data-Master-Currency-${Math.floor(
      Date.now() / 1000
    )}.xlsx`;
    const filePath = path.resolve("file", filename);

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
