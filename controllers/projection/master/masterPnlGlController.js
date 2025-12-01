import { validationResult } from "express-validator";
import { db } from "../../../config/db.js";
import * as dotenv from "dotenv";
import dayjs from "dayjs";
import xlsx from "xlsx";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

dotenv.config();

// Get List of PNL GL data
export const Projection_ListPnlGl = async (req, res) => {
  try {
    let response;

    const { rowsPerPage, page, domain, sortBy, sort } = req.query;

    // Validate if request has Query rowsPerPage
    if (rowsPerPage == null) {
      response = await db("dbPortalFA.dbo.pnl_gl")
        .select(
          "domain",
          "tahun",
          "tipe",
          db.raw("MAX(pnl_gl_id) AS pnl_gl_id")
        )
        .groupBy("domain", "tahun", "tipe")
        .where("domain", domain)
        .orderBy(sortBy, sort);
    } else {
      const pages = Math.abs(Math.floor(parseInt(page)));
      response = await db("dbPortalFA.dbo.pnl_gl")
        .select(
          "domain",
          "tahun",
          "tipe",
          db.raw("MAX(pnl_gl_id) AS pnl_gl_id")
        )
        .groupBy("domain", "tahun", "tipe")
        .where("domain", domain)
        .orderBy(sortBy, sort)
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
      /* { message: error.message } */
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

// Search data master PNL GL
export const Projection_searchPnlGl = async (req, res) => {
  try {
    let response;

    const { rowsPerPage, page, domain, search, sortBy, sort } = req.query;

    // Validate if request has Query rowsPerPage
    if (rowsPerPage == null) {
      response = await db("dbPortalFA.dbo.pnl_gl")
        .select(
          "domain",
          "tahun",
          "tipe",
          db.raw("MAX(pnl_gl_id) AS pnl_gl_id")
        )
        .groupBy("domain", "tahun", "tipe")
        .where("domain", domain)
        .whereILike("tipe", `%${search}%`)
        .orderBy(sortBy, sort);
    } else {
      const pages = Math.abs(Math.floor(parseInt(page)));
      response = await db("dbPortalFA.dbo.pnl_gl")
        .select(
          "domain",
          "tahun",
          "tipe",
          db.raw("MAX(pnl_gl_id) AS pnl_gl_id")
        )
        .groupBy("domain", "tahun", "tipe")
        .where("domain", domain)
        .whereILike("tipe", `%${search}%`)
        .orderBy(sortBy, sort)
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
      /* { message: error.message } */
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

// Get Detail of PNL GL Data
export const Projection_DetailPnlGl = async (req, res) => {
  try {
    const { tahun, tipe, domain, rowsPerPage, page, sortBy, sort } = req.query;

    let response;
    if (rowsPerPage == null) {
      response = await db("dbPortalFA.dbo.pnl_gl as pnl")
        .select(
          "pnl.pnl_gl_id",
          "pnl.[domain]",
          "pnl.tipe",
          "pnl.tahun",
          "pnl.[desc]",
          "pnl.kode_pnl_id",
          "qad.gl_code",
          "qad.gl_desc",
          "kp.detail"
        )
        .join("dbPortalFA.dbo.qad_gl as qad", "pnl.gl_id", "=", "qad.gl_code")
        .join(
          "dbPortalFA.dbo.kode_pnl as kp",
          "pnl.kode_pnl_id",
          "=",
          "kp.kode_pnl_id"
        )
        .where("pnl.tahun", tahun)
        .where("pnl.tipe", tipe)
        .where("pnl.[domain]", domain)
        .orderBy(sortBy, sort);
    } else {
      const pages = Math.abs(Math.floor(parseInt(page)));

      // Count total row
      const totalRowsQuery = await db("dbPortalFA.dbo.pnl_gl as pnl")
        .select(
          db.raw("COUNT(*) OVER () as total")
        )
        .join("dbPortalFA.dbo.qad_gl as qad", "pnl.gl_id", "=", "qad.gl_code")
        .join(
          "dbPortalFA.dbo.kode_pnl as kp",
          "pnl.kode_pnl_id",
          "=",
          "kp.kode_pnl_id"
        )
        .where("pnl.tahun", tahun)
        .where("pnl.tipe", tipe)
        .where("pnl.[domain]", domain)
        .groupBy(
          "pnl.[domain]",
          "pnl.tipe",
          "pnl.tahun",
          "pnl.kode_pnl_id",
          "kp.detail"
        );

      const totalRows = totalRowsQuery.length;
      
      // Get list data
      const resp = await db
      .select(
        "subquery.pnl_gl_id",
        "subquery.[domain]",
        "subquery.tipe",
        "subquery.tahun",
        "subquery.[desc]",
        "subquery.kode_pnl_id",
        "subquery.gl_code",
        "subquery.gl_desc",
        "subquery.detail"
      )
      .from(function () {
        this.select(
          "pnl.pnl_gl_id",
          "pnl.[domain]",
          "pnl.tipe",
          "pnl.tahun",
          "pnl.[desc]",
          "pnl.kode_pnl_id",
          "qad.gl_code",
          "qad.gl_desc",
          "kp.detail",
          db.raw(
            "ROW_NUMBER() OVER (PARTITION BY pnl.[domain], pnl.tipe, pnl.tahun, pnl.kode_pnl_id ORDER BY pnl.pnl_gl_id ASC) AS row_num"
          )
        )
          .from("dbPortalFA.dbo.pnl_gl as pnl")
          .join("dbPortalFA.dbo.qad_gl as qad", "pnl.gl_id", "=", "qad.gl_code")
          .join(
            "dbPortalFA.dbo.kode_pnl as kp",
            "pnl.kode_pnl_id",
            "=",
            "kp.kode_pnl_id"
          )
          .where("pnl.tahun", tahun)
          .where("pnl.tipe", tipe)
          .where("pnl.[domain]", domain)
          .as("subquery");
      })
      .where("subquery.row_num", 1)
      .orderBy(sortBy, sort) 
      .limit(Math.abs(Math.floor(parseInt(rowsPerPage))))
      .offset((pages - 1) * Math.abs(Math.floor(parseInt(rowsPerPage))));

      // Calculate pagination info
      const totalPages = Math.ceil(totalRows / rowsPerPage);
      const pagination = {
        total: totalRows,
        lastPage: totalPages,
        prevPage: pages > 1 ? pages - 1 : null,
        nextPage: pages < totalPages ? pages + 1 : null,
        perPage: rowsPerPage,
        currentPage: pages,
        from: (pages - 1) * rowsPerPage,
        to: pages * rowsPerPage > totalRows ? totalRows : pages * rowsPerPage,
      };

      // Return response with paginated data and pagination details
      response = {
        data: resp,
        pagination: pagination,
      };
    }

    return res.status(200).json({
      message: "Success",
      data: response,
    });
  } catch (error) {
    return res.status(406).json(
      /* { message: error.message } */
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

// Search data detail msater PNL GL
export const Projection_searchDetailPnlGl = async (req, res) => {
  try {
    const { tahun, tipe, domain, rowsPerPage, page, search, sortBy, sort } =
      req.query;

    // Handle pagination
    const pages = rowsPerPage
      ? Math.abs(Math.floor(parseInt(page || 1)))
      : null;
    const limit = rowsPerPage
      ? Math.abs(Math.floor(parseInt(rowsPerPage)))
      : null;
    const offset = limit ? (pages - 1) * limit : null;

    // Count total rows for pagination
    const totalRowsQuery = await db("dbPortalFA.dbo.pnl_gl as pnl")
      .join("dbPortalFA.dbo.qad_gl as qad", "pnl.gl_id", "=", "qad.gl_code")
      .join(
        "dbPortalFA.dbo.kode_pnl as kp",
        "pnl.kode_pnl_id",
        "=",
        "kp.kode_pnl_id"
      )
      .where("pnl.tahun", tahun)
      .where("pnl.tipe", tipe)
      .where("pnl.[domain]", domain)
      .andWhereILike("kp.detail", `%${search || ""}%`)
      .count("pnl.pnl_gl_id as total");

    const totalRows = totalRowsQuery[0]?.total || 0;

    // Fetch paginated data
    let dataQuery = await db("dbPortalFA.dbo.pnl_gl as pnl")
      .select(
        db.raw("MIN(pnl.pnl_gl_id) as pnl_gl_id"),
        "pnl.[domain]",
        "pnl.tipe",
        "pnl.tahun",
        db.raw("MIN(pnl.[desc]) as [desc]"),
        "pnl.kode_pnl_id",
        db.raw("MIN(qad.gl_code) as gl_code"),
        db.raw("MIN(qad.gl_desc) as gl_desc"),
        "kp.detail",
        db.raw("COUNT(pnl.pnl_gl_id) as total")
      )
      .join("dbPortalFA.dbo.qad_gl as qad", "pnl.gl_id", "=", "qad.gl_code")
      .join(
        "dbPortalFA.dbo.kode_pnl as kp",
        "pnl.kode_pnl_id",
        "=",
        "kp.kode_pnl_id"
      )
      .where("pnl.tahun", tahun)
      .where("pnl.tipe", tipe)
      .where("pnl.[domain]", domain)
      .andWhereILike("kp.detail", `%${search || ""}%`)
      .groupBy(
        "pnl.[domain]",
        "pnl.tipe",
        "pnl.tahun",
        "pnl.kode_pnl_id",
        "kp.detail"
      )
      .orderBy(sortBy, sort)
      .modify((queryBuilder) => {
        if (limit && offset !== null) {
          queryBuilder.limit(limit).offset(offset);
        }
      });

    // Calculate pagination info
    const totalPages = limit ? Math.ceil(totalRows / limit) : 1;
    const pagination = limit
      ? {
          total: totalRows,
          lastPage: totalPages,
          prevPage: pages > 1 ? pages - 1 : null,
          nextPage: pages < totalPages ? pages + 1 : null,
          perPage: limit,
          currentPage: pages,
          from: (pages - 1) * limit,
          to: pages * limit > totalRows ? totalRows : pages * limit,
        }
      : null;

    return res.status(200).json({
      message: "Success",
      data: {
        data: dataQuery,
        pagination: pagination,
      },
    });
  } catch (error) {
    return res.status(406).json({
      type: "error",
      message:
        process.env.DEBUG === "1"
          ? error.message
          : "Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT",
    });
  }
};

// Get List of PNL GL Data by Kode PNL
export const Projection_listPnlGlByKodePnl = async (req, res) => {
  try {
    const { tahun, tipe, domain, kode_pnl, rowsPerPage, page } = req.query;

    let response;
    if (rowsPerPage == null) {
      response = await db("dbPortalFA.dbo.pnl_gl as pnl")
        .select(
          "pnl.pnl_gl_id",
          "pnl.domain",
          "pnl.tipe",
          "pnl.tahun",
          "pnl.desc",
          "kp.kode_pnl_id",
          "qad.gl_code",
          "qad.gl_desc",
          "kp.detail"
        )
        .join("dbPortalFA.dbo.qad_gl as qad", "pnl.gl_id", "=", "qad.gl_code")
        .join(
          "dbPortalFA.dbo.kode_pnl as kp",
          "pnl.kode_pnl_id",
          "=",
          "kp.kode_pnl_id",
          "and",
          "pnl.domain",
          "=",
          "qad.domain"
        )
        .where("pnl.tahun", tahun)
        .where("pnl.tipe", tipe)
        .where("pnl.domain", domain)
        .where("pnl.kode_pnl_id", kode_pnl);
    } else {
      const pages = Math.abs(Math.floor(parseInt(page)));
      response = await db("dbPortalFA.dbo.pnl_gl as pnl")
        .select(
          "pnl.pnl_gl_id",
          "pnl.domain",
          "pnl.tipe",
          "pnl.tahun",
          "pnl.desc",
          "kp.kode_pnl_id",
          "qad.gl_code",
          "qad.gl_desc",
          "kp.detail"
        )
        .join("dbPortalFA.dbo.qad_gl as qad", "pnl.gl_id", "=", "qad.gl_code")
        .join(
          "dbPortalFA.dbo.kode_pnl as kp",
          "pnl.kode_pnl_id",
          "=",
          "kp.kode_pnl_id",
          "and",
          "pnl.domain",
          "=",
          "qad.domain"
        )
        .where("pnl.tahun", tahun)
        .where("pnl.tipe", tipe)
        .where("pnl.domain", domain)
        .where("pnl.kode_pnl_id", kode_pnl)
        .orderBy("kode_pnl_id", "asc")
        .paginate({
          perPage: Math.abs(Math.floor(parseInt(rowsPerPage))),
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
      /* { message: error.message } */
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

// Get List of Kode PNL
export const Projection_ListPnl = async (req, res) => {
  try {
    const response = await db("dbPortalFA.dbo.kode_pnl").select(
      "kode_pnl_id",
      "domain",
      "detail"
    );

    return res.status(200).json({
      message: "Success",
      data: response,
    });
  } catch (error) {
    return res.status(406).json(
      /* { message: error.message } */
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

// Get List of GL Accounts
export const Projection_ListGLAccount = async (req, res) => {
  try {
    const response = await db("dbPortalFA.dbo.qad_gl").select(
      "gl_code",
      "gl_desc"
    );

    return res.status(200).json({
      message: "Success",
      data: response,
    });
  } catch (error) {
    return res.status(406).json(
      /* { message: error.message } */
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

// Upload PNL GL template
export const Projection_UploadPnlGl = async (req, res) => {
  const trx = await db.transaction();
  try {
    let errorCounter = 0;
    let errorText = [];
    const dokumen = req.files.upload ? req.files.upload[0].filename : null;

    // If Dokumen not exists
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

    // Validate user, and get user_nik to assign created_by
    const user = await db("dbPortalFA.dbo.users")
      .select("user_nik")
      .where("user_id", req.body.empid)
      .first();

    if (!user) {
      fs.unlinkSync(filePath);
      await trx.rollback();
      return res
        .status(400)
        .json({ message: "Invalid user, silahkan hubungi Tim IT" });
    }

    const empid = user.user_nik;

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

          const glcode = String(transformedRow.GL_Code).toLowerCase()
          const kode = String(transformedRow.Kode_Pnl).toLowerCase();  
          const tipe = transformedRow.Tipe;  
          const tahun = transformedRow.Tahun;  
          const code = `${kode}-${glcode}-${tipe}-${tahun}`;  
        
          if (itemCount[code] && kode !== '' && kode !== null && glcode !== '' && glcode !== null && tipe !== '' && tipe !== null && tahun !== '' && tahun !== null) {  
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
              tipe: String(key).split("-")[2],
              tahun: String(key).split("-")[3],
              kode_pnl: String(key).split("-")[0],
              gl_code: String(key).split("-")[1],
              message: `Gagal Import pada baris (${value.lines.join(', ')}) : Kode Pnl [${String(key).split("-")[0]}], GL Code [${String(key).split("-")[1]}] Duplicate data.`
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
            const transformedRow = Object.keys(row).reduce((acc, key) => {
                const transformedKey = key.replace(/\s+/g, '_');
                acc[transformedKey] = row[key];
                return acc;
            }, {});

            // Validation
            if (
              transformedRow.Tahun == "" &&
              transformedRow.Tipe == "" &&
              transformedRow.ID_Kode_Pnl == "" &&
              transformedRow.Kode_Pnl == "" &&
              transformedRow.GL_Code == ""
            ) return;

            if (transformedRow.Tahun === null || typeof transformedRow.Tahun !== "number") {
              errorCounter++;
              errorText.push({
                baris: index + 1,
                tipe: transformedRow.Tipe,
                tahun: transformedRow.Tahun,
                kode_pnl: transformedRow.Kode_Pnl,
                gl_code: transformedRow.GL_Code,
                message: `Gagal Import pada baris (${index + 1}) : [Tahun] kolom wajib diisi.`
              });
              if (transformedRow.Tahun < 0) {
                errorCounter++;
                errorText.push({
                  baris: index + 1,
                  tipe: transformedRow.Tipe,
                  tahun: transformedRow.Tahun,
                  kode_pnl: transformedRow.Kode_Pnl,
                  gl_code: transformedRow.GL_Code,
                  message: `Gagal Import pada baris (${index + 1}) : [Tahun] kolom tidak valid.`
                });
              }
            }
            if (
              transformedRow.Tipe === null ||
              transformedRow.Tipe === "" ||
              typeof transformedRow.Tipe !== "string"
            ) {
              errorCounter++;
              errorText.push({
                baris: index + 1,
                tipe: transformedRow.Tipe,
                tahun: transformedRow.Tahun,
                kode_pnl: transformedRow.Kode_Pnl,
                gl_code: transformedRow.GL_Code,
                message: `Gagal Import pada baris (${index + 1}) : [Tipe] kolom wajib diisi.`
              });
            }
            if (
              transformedRow.ID_Kode_Pnl === null ||
              transformedRow.ID_Kode_Pnl === "" ||
              typeof parseInt(transformedRow.ID_Kode_Pnl) !== "number"
            ) {
              errorCounter++;
              errorText.push({
                baris: index + 1,
                tipe: transformedRow.Tipe,
                tahun: transformedRow.Tahun,
                kode_pnl: transformedRow.Kode_Pnl,
                gl_code: transformedRow.GL_Code,
                message: `Gagal Import pada baris (${index + 1}) : [ID Kode PNL] kolom wajib diisi.`
              });
            }
            if (
              transformedRow.Kode_Pnl === null ||
              transformedRow.Kode_Pnl === "" ||
              typeof transformedRow.Kode_Pnl !== "string"
            ) {
              errorCounter++;
              errorText.push({
                baris: index + 1,
                tipe: transformedRow.Tipe,
                tahun: transformedRow.Tahun,
                kode_pnl: transformedRow.Kode_Pnl,
                gl_code: transformedRow.GL_Code,
                message: `Gagal Import pada baris (${index + 1}) : [Kode PNL] kolom wajib diisi.`
              });
            }

            if (transformedRow.GL_Code === null || typeof parseInt(transformedRow.GL_Code) !== "number") {
              errorCounter++;
              errorText.push({
                baris: index + 1,
                tipe: transformedRow.Tipe,
                tahun: transformedRow.Tahun,
                kode_pnl: transformedRow.Kode_Pnl,
                gl_code: transformedRow.GL_Code,
                message: `Gagal Import pada baris (${index + 1}) : [GL Code] kolom wajib diisi.`
              });
            }

            let gl_account = null;
            if(transformedRow.GL_Code !== ""){
              gl_account = await trx("dbPortalFA.dbo.qad_gl")
                .select("gl_code")
                .whereRaw("LOWER(gl_code) = ?", [
                  String(transformedRow.GL_Code || "").toLowerCase(),
                ])
                .first();

              if (!gl_account) {
                errorCounter++;
                errorText.push(
                  {
                    baris: index + 1,
                    tipe: transformedRow.Tipe,
                    tahun: transformedRow.Tahun,
                    kode_pnl: transformedRow.Kode_Pnl,
                    gl_code: transformedRow.GL_Code,
                    message: `Gagal Import pada baris (${index + 1}) : GL Account [${transformedRow.GL_Code}] tidak ada pada master GL mohon isi kode GL yang sesuai.`
                  });
              }
            }

            if (String(transformedRow.Desc).length > 100) {
              errorCounter++;
              errorText.push({
                baris: index + 1,
                tipe: transformedRow.Tipe,
                tahun: transformedRow.Tahun,
                kode_pnl: transformedRow.Kode_Pnl,
                gl_code: transformedRow.GL_Code,
                message: `Gagal Import pada baris (${index + 1}) : Panjang desc character melebihi 100 character.`
              });
            }

            const kodepnl_id = typeof transformedRow !== "number" ? parseInt(transformedRow.ID_Kode_Pnl) : transformedRow.ID_Kode_Pnl;

            const kode_pnl = await trx("dbPortalFA.dbo.kode_pnl")
              .select("kode_pnl_id")
              .where("kode_pnl_id", kodepnl_id)
              .first();

            if (!kode_pnl) {
              errorCounter++;
              errorText.push({
                  baris: index + 1,
                  tipe: transformedRow.Tipe,
                  tahun: transformedRow.Tahun,
                  kode_pnl: transformedRow.Kode_Pnl,
                  gl_code: transformedRow.GL_Code,
                  message: `Gagal Import pada baris (${index + 1}) : Kode PNL [${transformedRow.Kode_Pnl}] tidak sesuai, mohon isi kode pnl yang sesuai.`
              });
            }

            if (row.Tipe && row.Tahun && kode_pnl && gl_account){
              const cekdata = await trx("dbPortalFA.dbo.pnl_gl")
                .select("pnl_gl_id")
                .where("tipe", transformedRow.Tipe)
                .where("tahun", transformedRow.Tahun)
                .where("kode_pnl_id", kode_pnl?.kode_pnl_id)
                .where("gl_id", transformedRow.GL_Code)
                .first();

              if (cekdata) {
                errorCounter++;
                errorText.push({
                  baris: index + 1,
                  tipe: transformedRow.Tipe,
                  tahun: transformedRow.Tahun,
                  kode_pnl: transformedRow.Kode_Pnl,
                  gl_code: transformedRow.GL_Code,
                  message: `Baris Ke [${index + 1}] Error data sudah ada`
                });
              }

              // Prepare valid data for insertion
              if (!cekdata && kode_pnl && gl_account) {
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
      await trx("dbPortalFA.dbo.pnl_gl").insert({
        domain: parseInt(req.body.domain),
        tipe: item.Tipe,
        tahun: parseInt(item.Tahun),
        kode_pnl_id: parseInt(item.ID_Kode_Pnl),
        gl_id: parseInt(item.GL_Code),
        desc: item.Desc,
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

// Create PNL GL
export const Projection_CreatePnlGl = async (req, res) => {
  const trx = await db.transaction();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await trx.rollback();
      return res.status(400).json({ errors: errors.array() });
    }

    const { pnl_gl, tahun, tipe, domain, empid } = req.body;

    // Validate user
    const user = await db("dbPortalFA.dbo.users")
      .select("user_nik")
      .where("user_id", empid)
      .first();

    if (!user) {
      await trx.rollback();
      return res
        .status(400)
        .json({ message: "Invalid user, silahkan hubungi Tim IT" });
    }

    const c_empid = user.user_nik;

    // Check existing data
    const pnlData = await db("dbPortalFA.dbo.pnl_gl")
      .select("domain", "tipe", "tahun", "desc", "kode_pnl_id", "gl_id")
      .where({ tahun, tipe, domain })
      .orderBy("kode_pnl_id", 'asc');

    let fdesc = null;
    if(pnlData.length > 0) fdesc = pnlData[0].desc;

    // Determine data that want to insert
    const toInsert = pnl_gl.filter(
      (pnl) =>
        !pnlData.some(
          (item) =>
            item.domain === pnl.domain &&
            item.tipe === pnl.tipe &&
            item.tahun === pnl.tahun &&
            parseInt(item.kode_pnl_id) === pnl.kode_pnl_id &&
            parseInt(item.gl_id) === pnl.gl_code
        )
    );

    // Determine data that need to delete
    // const toDelete = pnlData.filter(
    //   (item) =>
    //     !pnl_gl.some(
    //       (pnl) =>
    //         item.domain === pnl.domain &&
    //         item.tipe === pnl.tipe &&
    //         item.tahun === pnl.tahun &&
    //         parseInt(item.kode_pnl_id) === pnl.kode_pnl_id &&
    //         parseInt(item.gl_id) === pnl.gl_code
    //     )
    // );

    // Insert new data
    if (toInsert.length > 0) {
      const insertData = toInsert.map((data) => ({
        domain: data.domain,
        tipe: data.tipe,
        tahun,
        kode_pnl_id: data.kode_pnl_id,
        gl_id: data.gl_code,
        desc: fdesc || data.desc,
        created_by: c_empid,
        created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      }));

      await trx("dbPortalFA.dbo.pnl_gl").insert(insertData);
    }

    // Delete data that not send back by the request
    // if (toDelete.length > 0) {
    //   await Promise.all(
    //     toDelete.map((item) =>
    //       trx("dbPortalFA.dbo.pnl_gl")
    //         .where({
    //           domain: item.domain,
    //           tipe: item.tipe,
    //           tahun: item.tahun,
    //           kode_pnl_id: item.kode_pnl_id,
    //           gl_id: item.gl_id,
    //         })
    //         .delete()
    //     )
    //   );
    // }

    // Commit transaction
    await trx.commit();
    return res.status(201).json({ message: "Berhasil Membuat PNL GL" });
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

// Edit PNL GL
export const Projection_EditPnlGl = async (req, res) => {
  const trx = await db.transaction();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await trx.rollback();
      return res.status(400).json({ errors: errors.array() });
    }

    const { pnl_gl, tahun, tipe, domain, empid, kode_pnl_id } = req.body;

    // Validate user
    const user = await db("dbPortalFA.dbo.users")
      .select("user_nik")
      .where("user_id", empid)
      .first();

    if (!user) {
      await trx.rollback();
      return res
        .status(400)
        .json({ message: "Invalid user, silahkan hubungi Tim IT" });
    }

    const c_empid = user.user_nik;

    // Check existing data
    const pnlData = await db("dbPortalFA.dbo.pnl_gl")
      .select("domain", "tipe", "tahun", "kode_pnl_id", "gl_id")
      .where({ tahun, tipe, domain, kode_pnl_id });

    // Determine data that want to insert
    const toInsert = pnl_gl.filter(
      (pnl) =>
        !pnlData.some(
          (item) =>
            item.domain === pnl.domain &&
            item.tipe === pnl.tipe &&
            item.tahun === pnl.tahun &&
            parseInt(item.kode_pnl_id) === pnl.kode_pnl_id &&
            parseInt(item.gl_id) === pnl.gl_code
        )
    );

    // Determine data that need to delete
    // const toDelete = pnlData.filter(
    //   (item) =>
    //     !pnl_gl.some(
    //       (pnl) =>
    //         item.domain === pnl.domain &&
    //         item.tipe === pnl.tipe &&
    //         item.tahun === pnl.tahun &&
    //         parseInt(item.kode_pnl_id) === pnl.kode_pnl_id &&
    //         parseInt(item.gl_id) === pnl.gl_code
    //     )
    // );

    // Insert new data
    if (toInsert.length > 0) {
      const insertData = toInsert.map((data) => ({
        domain: data.domain,
        tipe: data.tipe,
        tahun,
        kode_pnl_id: data.kode_pnl_id,
        gl_id: data.gl_code,
        desc: data.desc,
        created_by: c_empid,
        created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      }));

      await trx("dbPortalFA.dbo.pnl_gl").insert(insertData);
    }

    // Delete data that not send back by the request
    // if (toDelete.length > 0) {
    //   await Promise.all(
    //     toDelete.map((item) =>
    //       trx("dbPortalFA.dbo.pnl_gl")
    //         .where({
    //           domain: item.domain,
    //           tipe: item.tipe,
    //           tahun: item.tahun,
    //           kode_pnl_id: item.kode_pnl_id,
    //           gl_id: item.gl_id,
    //         })
    //         .delete()
    //     )
    //   );
    // }

    // Commit transaction
    await trx.commit();
    return res.status(201).json({ message: "Berhasil Update PNL GL" });
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

// Delete PNL GL in Edit Page
export const Projection_DeletePnlGlEditPage = async (req, res) => {
  try {
    const { pnl_gl_id } = req.query;

    // Delete all matching records
    await db("dbPortalFA.dbo.pnl_gl").where({ pnl_gl_id }).delete();

    return res.status(204).json({ message: "Data berhasil dihapus!" });
  } catch (error) {
    return res.status(406).json(
      /* { message: error.message } */
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

// Copy PNL GL Data and Create New PNL GL
export const Projection_CopyPnlGl = async (req, res) => {
  const trx = await db.transaction();
  try {
    const { domain, new_tahun, tahun, tipe, empid } = req.body;

    const user = await db("dbPortalFA.dbo.users")
      .select("user_nik")
      .where("user_id", empid)
      .first();

    if (!user) {
      await trx.rollback();
      return res
        .status(400)
        .json({ message: "Invalid user, silahkan hubungi Tim IT" });
    }

    const c_empid = user.user_nik;

    const pnlData = await db("dbPortalFA.dbo.pnl_gl")
      .select("domain", "tipe", "tahun", "kode_pnl_id", "gl_id", "desc")
      .where({ tahun, tipe, domain });

    await Promise.all(
      pnlData.map(async (data) => {
        const kode_pnl = await trx("dbPortalFA.dbo.kode_pnl")
          .select("kode_pnl_id")
          .where("kode_pnl_id", data.kode_pnl_id)
          .first();

        if (!kode_pnl) {
          throw new Error(`Kode PNL tidak valid ${data.kode_pnl_id}`);
        }

        const gl_data = await trx("dbPortalFA.dbo.qad_gl")
          .select("gl_code")
          .where("gl_code", data.gl_id)
          .first();

        if (!gl_data) {
          throw new Error(`GL Code tidak valid ${data.gl_id}`);
        }

        const cekdata = await trx("dbPortalFA.dbo.pnl_gl")
          .select("pnl_gl_id")
          .where("domain", domain)
          .where("tipe", data.tipe)
          .where("tahun", new_tahun)
          .where("kode_pnl_id", data.kode_pnl_id)
          .where("gl_id", data.gl_id)
          .first();

        if (cekdata) {
          throw new Error(
            `Master PNL GL tahun ${new_tahun} - ${data.tipe} sudah ada`
          );
        }

        await trx("dbPortalFA.dbo.pnl_gl").insert({
          domain: domain,
          tipe: data.tipe,
          tahun: new_tahun,
          kode_pnl_id: kode_pnl.kode_pnl_id,
          gl_id: data.gl_id,
          desc: data.desc,
          created_by: c_empid,
          created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        });
      })
    );

    await trx.commit();
    return res.status(201).json({ message: "Data berhasil disalin" });
  } catch (error) {
    await trx.rollback();
    return res.status(406).json({
      type: "error",
      message:
        process.env.DEBUG == 1
          ? error.message
          : `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
    });
  }
};

// Update PNL GL
export const Projection_UpdatePnlGl = async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array(),
      });
    }

    const { pnl_gl_id, domain, tipe, tahun, kode_pnl_id, gl_id, desc, empid } =
      req.body;

    await db("dbPortalFA.dbo.pnl_gl")
      .where("pnl_gl_id", pnl_gl_id)
      .update({
        domain: domain,
        tipe: tipe,
        tahun: tahun,
        kode_pnl_id: kode_pnl_id,
        gl_id: gl_id,
        desc: desc,
        updated_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        updated_by: empid,
      });

    return res.status(200).json({ message: "Data berhasil diupdate" });
  } catch (error) {
    return res.status(406).json(
      /* { message: error.message } */
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

// Delete PNL GL
export const Projection_DeletePnlGl = async (req, res) => {
  try {
    const { domain, tahun, tipe } = req.query;

    if (!domain || !tahun || !tipe) {
      return res.status(400).json({
        message: "Domain, tahun, and tipe are required",
      });
    }

    // Delete all matching records
    await db("dbPortalFA.dbo.pnl_gl").where({ domain, tahun, tipe }).delete();

    return res.status(204).json({ message: "Data berhasil dihapus!" });
  } catch (error) {
    return res.status(406).json(
      /* { message: error.message } */
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

// Delete PNL GL by Kode Pnl
export const Projection_DeletePnlGlByKodePnl = async (req, res) => {
  try {
    const { domain, tahun, tipe, kode_pnl_id } = req.query;

    if (!domain || !tahun || !tipe || !kode_pnl_id) {
      return res.status(400).json({
        message: "Domain, tahun, tipe dan kode_pnl_id are required",
      });
    }

    // Delete all matching records
    await db("dbPortalFA.dbo.pnl_gl")
      .where({ domain, tahun, tipe, kode_pnl_id })
      .delete();

    return res.status(204).json({ message: "Data berhasil dihapus!" });
  } catch (error) {
    return res.status(406).json(
      /* { message: error.message } */
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

// Download Master PNL GL Template
export const Projection_DownloadTemplate = async (req, res) => {
  try {
    // Define Excel data
    const data = [
      ["Tahun", "Tipe", "ID Kode Pnl", "Kode Pnl", "Desc", "GL Code"],
      [2024, "Budget", 1, "Penjualan Bruto", "Budget Penjualan", 3000000],
    ];

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Master PNL GL");

    // Set column widths (A-F columns)
    worksheet.columns = [
      { width: 10 }, // Column A (Tahun)
      { width: 15 }, // Column B (Tipe)
      { width: 15 }, // Column C (ID Kode Pnl)
      { width: 30 }, // Column D (Kode Pnl)
      { width: 40 }, // Column E (Desc)
      { width: 15 }, // Column F (GL Code)
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
      worksheet.addRow(["", "", "", "", "", ""]);
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
    await worksheet.protect("Rucika123", {
      selectLockedCells: true,
      selectUnlockedCells: true,
    });

    // File name and path
    const filename = `Template-Master-PNL-GL-${Math.floor(
      Date.now() / 1000
    )}.xlsx`;
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

// Download Master Kode Pnl
export const Projection_DownloadMasterKodePNL = async (req, res) => {
  try {
    const kode_pnl = await db("dbPortalFA.dbo.kode_pnl")
    .select("kode_pnl_id", "detail")

    const data = [
      ["ID", "Kode PNL"]
    ];

    kode_pnl.forEach((pnl) => {
      data.push([pnl.kode_pnl_id, pnl.detail])
    })

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Master Kode PNL");

    // Set column widths (A-B columns)
    worksheet.columns = [
      { width: 10 }, // Column A (ID)
      { width: 40 }, // Column B (Kode PNL)
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
    const filename = `Data-Master-Kode-PNL.xlsx`;
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

// Download Master GL Code
export const Projection_DownloadMasterGLCode = async (req, res) => {
  try {
    const glcode = await db("dbPortalFA.dbo.qad_gl")
    .select("gl_code", "gl_desc")

    const data = [
      ["GL Code", "Description"]
    ];

    glcode.forEach((gl) => {
      data.push([gl.gl_code, gl.gl_desc])
    })

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Master GL Code");

    // Set column widths (A-B columns)
    worksheet.columns = [
      { width: 10 }, // Column A (ID)
      { width: 25 }, // Column B (Kode PNL)
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
    const filename = `Data-Master-GL-Code.xlsx`;
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
