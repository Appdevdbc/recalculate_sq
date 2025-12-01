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
// export const PJL_OP_uploadexcel = async (req, res) => {
//   // #swagger.tags = ['General']
//   /* #swagger.security = [{
//             "bearerAuth": []
//     }] */
//   // #swagger.description = 'Fungsi untuk simpan data aplikasi'
//   try {
//     const data = req.body;

//     // Validasi payload: harus array dan tidak boleh kosong
//     if (!Array.isArray(data) || data.length === 0) {
//       return res
//         .status(406)
//         .json({ error: "Payload harus berupa array dan tidak boleh kosong." });
//     }

//     const success = [];
//     const failed = [];

//     // Proses data satu per satu
//     for (const item of data) {
//       let { domain, created_by } = item;
//       let tahun = item.tahun;
//       let bulan = item.bulan;
//       let gl_id = item.gl_id;
//       let foh = item.foh;
//       let budget = item.budget;
//       let proyeksi = item.proyeksi;


//       // Validasi kolom tidak boleh kosong
//       if (!tahun) {
//         failed.push({
//           item,
//           reason: "Tahun dan Deskripsi tidak boleh kosong",
//         });
//         continue;
//       }
//       if (!bulan) {
//         failed.push({
//           item,
//           reason: "Bulan tidak boleh kosong",
//         });
//         continue;
//       }
//       if (!gl_id) {
//         failed.push({
//           item,
//           reason: "GL Account tidak boleh kosong",
//         });
//         continue;
//       }
//       if (!budget) {
//         failed.push({
//           item,
//           reason: "Budget tidak boleh kosong",
//         });
//         continue;
//       }
//       if (!proyeksi) {
//         failed.push({
//           item,
//           reason: "Proyeksi tidak boleh kosong",
//         });
//         continue;
//       }

      

//       // Cek apakah kombinasi domain dan jenis_produksi sudah ada di database
//       const existing = await db("dbPortalFA.dbo.opex")
//         .where({ domain, tahun, bulan, gl_id })
//         .first();

//       if (existing) {
//         failed.push({
//           item,
//           reason: `GL Account '${gl_id}' di domain '${domain}' pada tahun '${tahun}' di bulan '${bulan}' sudah ada di database`,
//         });
//         continue;
//       }

//       // Simpan ke database
//       try {
//         await db("dbPortalFA.dbo.opex").insert({
//           domain: domain,
//           tahun: tahun,
//           bulan: bulan,
//           gl_id: gl_id,
//           foh: foh,
//           budget: budget,
//           proyeksi: proyeksi,
//           created_by: created_by,
//           created_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
//         });

//         success.push({
//           domain,
//           tahun,
//           bulan,
//           gl_id,
//           created_by,
//         });
//       } catch (err) {
//         failed.push({
//           item,
//           reason: `Gagal menyimpan ke database: ${err.message}`,
//         });
//       }
//     }

//     // Kembalikan laporan hasil upload
//     return res.status(201).json({
//       message: "Proses upload selesai",
//       success, // Data yang berhasil disimpan
//       failed, // Data yang gagal disimpan beserta alasannya
//     });
//   } catch (error) {
//     console.error("Error saat memproses data:", error);
//     res.status(500).json({ error: "Terjadi kesalahan pada server." });
//   }
// }

export const PJL_OP_uploadexcel = async (req, res) => {
  try {
    let data = req.body;
    data = Array.isArray(data) ? data : Object.values(data);

    // Validasi payload: harus array dan tidak boleh kosong
    if (!Array.isArray(data) || data.length === 0) {
      return res
        .status(406)
        .json({ error: "Payload harus berupa array dan tidak boleh kosong." });
    }

    const failed = [];
    let errorCount = 2;
    const validData = data.filter((item) => {
      const { domain, tahun, bulan, gl_id, budget, proyeksi } = item;
      console.log("item, ", item);
      if (!tahun || !bulan || !gl_id) {
        failed.push({
          no: errorCount++,
          item,
          reason: "Kolom tidak boleh kosong",
        });
        return false;
      }
      if (isNaN(Number(budget)) || isNaN(Number(proyeksi))) {
        failed.push({
          no: errorCount++,
          item,
          reason: "'budget' dan 'proyeksi' harus berupa angka",
        });
        return false;
      }
      return true;
    });

    // Ambil data dari database berdasarkan tahun, bulan, domain, dan gl_id
    const tahunBulanSet = [
      ...new Set(validData.map((item) => `${item.tahun}-${item.bulan}`)),
    ];
    const existingRecords = await db("dbPortalFA.dbo.opex")
      .whereIn(
        "tahun",
        tahunBulanSet.map((tb) => tb.split("-")[0])
      )
      .whereIn(
        "bulan",
        tahunBulanSet.map((tb) => tb.split("-")[1])
      )
      .select("domain", "tahun", "bulan", "gl_id", "foh");

    // Buat map untuk validasi data yang sudah ada
    const existingMap = new Map(
      existingRecords.map((rec) => [
        `${rec.domain}-${rec.tahun}-${rec.gl_id}`,
        rec.foh,
      ])
    );

    const existingMap2 = new Map(
      existingRecords.map((rec) => [
        `${rec.domain}-${rec.tahun}-${rec.bulan}-${rec.gl_id}`,
        rec.foh,
      ])
    );

    // Map untuk menyimpan FOH pertama berdasarkan kombinasi domain, tahun, dan gl_id
    const fohReferenceMap = new Map();

    // Filter data yang valid dan konsisten
    const toInsert = validData.filter((item) => {
      const key = `${item.domain}-${item.tahun}-${item.gl_id}`;
      const key2 = `${item.domain}-${item.tahun}-${item.bulan}-${item.gl_id}`;

      // Tetapkan nilai FOH pertama sebagai referensi
      if (!fohReferenceMap.has(key)) {
        const existingFoh = existingMap.get(key);
        fohReferenceMap.set(
          key,
          existingFoh !== undefined ? existingFoh : item.foh
        );
      }

      const fohReference = fohReferenceMap.get(key);
      const existingFoh2 = existingMap2.get(key2); // Cek apakah data sudah ada di bulan tertentu

      // Validasi konsistensi FOH
      if (item.foh !== fohReference) {
        failed.push({
          no: errorCount++,
          item,
          reason: `Nilai FOH untuk kombinasi '${key}' harus konsisten. Nilai referensi: ${
            fohReference ? "TRUE" : "FALSE"
          }, nilai baru: ${item.foh ? "TRUE" : "FALSE"}`,
        });
        return false;
      }

      // Cek apakah kombinasi bulan sudah ada di database
      if (existingFoh2 !== undefined) {
        failed.push({
          no: errorCount++,
          item,
          reason: `GL Account '${item.gl_id}' di domain '${item.domain}' pada tahun '${item.tahun}' di bulan '${item.bulan}' sudah ada di database`,
        });
        return false;
      }      
      errorCount++;
      return true;
    });

    // Batch insert data
    try {
      if (toInsert.length > 0) {
        await db("dbPortalFA.dbo.opex").insert(
          toInsert.map((item) => ({
            domain: item.domain,
            tahun: item.tahun,
            bulan: item.bulan,
            gl_id: item.gl_id,
            foh: item.foh,
            budget: item.budget,
            proyeksi: item.proyeksi,
            created_by: item.created_by,
            created_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          }))
        );
      }
    } catch (err) {
      failed.push({
        reason: `Gagal menyimpan ke database: ${err.message}`,
      });
    }

    // Kembalikan laporan hasil upload
    return res.status(201).json({
      message: "Proses upload selesai",
      success: toInsert,
      failed,
    });
  } catch (error) {
    console.error("Error saat memproses data:", error);
    res.status(500).json({ error: "Terjadi kesalahan pada server." });
  }
};




export const PJL_OP_getdata = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const rowsPerPage = parseInt(req.query.rowsPerPage, 10) || 10;
    const offset = (page - 1) * rowsPerPage;

    let query = db("dbPortalFA.dbo.opex")
      .select("domain", "tahun")
      .groupBy("domain", "tahun");

    if (req.query.filter) {
      query = query.andWhere(function () {
        this.where("domain", "like", `%${req.query.filter}%`)
          .orWhere("tahun", "like", `%${req.query.filter}%` );
      });
    }

    // Hitung total rows untuk pagination
    const totalRowsQuery = await query;
    const totalRows = totalRowsQuery.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage);
    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 ? page - 1 : null;

    // Query untuk mendapatkan hasil dengan pagination
    const result = await query
      .limit(rowsPerPage)
      .offset(offset)
      .orderBy(
        !["asc", "desc", "No", undefined].includes(req.query.sortBy)
          ? req.query.sortBy
          : "tahun",
        req.query.descending === "false" ? "asc" : "desc"
      );

    // Mengirimkan response
    res.json({
      message: "success",
      status: true,
      data: result,
      pagination: {
        total: totalRows,
        lastPage: totalPages,
        prevPage: prevPage,
        nextPage: nextPage,
        perPage: rowsPerPage,
        currentPage: page,
        from: offset,
        to: offset + result.length,
      },
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

export const PJL_OP_getdatadetail = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const rowsPerPage = parseInt(req.query.rowsPerPage, 10) || 10;
    const offset = (page - 1) * rowsPerPage;

    let query = db("dbPortalFA.dbo.opex")
      .select("domain", "tahun", "gl_id", "foh", "qad_gl.gl_desc")
      .join("qad_gl", "opex.gl_id", "qad_gl.gl_code")
      .groupBy("domain", "tahun", "gl_id", "foh", "qad_gl.gl_desc")
      .where("domain", req.query.domain)
      .where("tahun", req.query.tahun);

    if (req.query.filter) {
      query = query.andWhere(function () {
        this.where("gl_id", "like", `%${req.query.filter}%`).orWhere(
          "qad_gl.gl_desc",
          "like",
          `%${req.query.filter}%`
        );
      });
    }

    // Hitung total rows untuk pagination
    const totalRowsQuery = await query;
    const totalRows = totalRowsQuery.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage);
    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 ? page - 1 : null;

    // Query untuk mendapatkan hasil dengan pagination
    const result = await query
      .limit(rowsPerPage)
      .offset(offset)
      .orderBy(
        !["asc", "desc", "No", undefined].includes(req.query.sortBy)
          ? req.query.sortBy
          : "tahun",
        req.query.descending === "false" ? "asc" : "desc"
      );

    // Mengirimkan response
    res.json({
      message: "success",
      status: true,
      data: result,
      pagination: {
        total: totalRows,
        lastPage: totalPages,
        prevPage: prevPage,
        nextPage: nextPage,
        perPage: rowsPerPage,
        currentPage: page,
        from: offset,
        to: offset + result.length,
      },
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

export const PJL_OP_getdatadetailbygl = async (req, res) => {
  try {
    let query = db("dbPortalFA.dbo.opex")
      .where("domain", req.query.domain)
      .where("tahun", req.query.tahun)
      .where("gl_id", req.query.gl_id);

     const result = await query;

    // Mengirimkan response
    res.json({
      message: "success",
      status: true,
      data: result,
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


export const PJL_OP_getdatabydomain = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk get data'
  try {
    const domain = req.query.domain;

    let query = db("dbPortalFA.dbo.jenis_produksi").where(
      "jenis_produksi.domain",
      domain
    );

    const result = await query;

    // Mengirimkan response
    res.json({
      message: "success",
      status: true,
      data: result,
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

export const PJL_OP_glaccount = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk get data'
  try {
    const tahun = req.query.tahun;
    const domain = req.query.domain;

    let query = db("dbPortalFA.dbo.qad_gl as q").whereNotExists(function () {
      this.select("*")
        .from("opex as o")
        .whereRaw("o.gl_id = q.gl_code")
        .andWhere("o.tahun", tahun) // Filter tahun
        .andWhere("o.domain", domain); // Filter domain
    });

    console.log(query.toString());


    const result = await query;

    // Mengirimkan response
    res.json({
      message: "success",
      status: true,
      data: result,
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

export const PJL_OP_add = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk simpan data aplikasi'
  try {
    // Periksa apakah data sudah ada
    let hasData = await db("dbPortalFA.dbo.opex")
      .where("gl_id", req.body.gl_id)
      .where("domain", req.body.domain)
      .where("tahun", req.body.tahun)
      .first();

    if (hasData) {
      return res.status(406).json({
        type: "error",
        message: `${req.body.gl_id} di domain ${req.body.domain} dan tahun ${req.body.tahun} sudah ada`,
      });
    }

    // Persiapkan data untuk dimasukkan berdasarkan monthsInsert
    const insertData = req.body.monthsInsert.map((month) => {
      return {
        domain: req.body.domain,
        tahun: req.body.tahun,
        bulan: month,
        gl_id: req.body.gl_id,
        budget: parseFloat(req.body.opexBudget[month]) || 0,
        proyeksi: parseFloat(req.body.opexProjection[month]) || 0,
        foh: req.body.foh ? 1 : 0, // Konversi ke tipe data bit
        created_by: req.body.created_by,
        created_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      };
    });

    // Masukkan data ke database
    await db("dbPortalFA.dbo.opex").insert(insertData);

    return res.json("sukses");
  } catch (error) {
    return res.status(406).json({
      type: "error",
      message:
        process.env.DEBUG == 1
          ? error.message
          : `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
    });
  }
};

export const PJL_OP_edit = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [ { "bearerAuth": [] } ] */
  // #swagger.description = 'Fungsi untuk simpan data aplikasi'
  try {
    const {
      gl_id,
      domain,
      tahun,
      monthsInsert,
      opexBudget,
      opexProjection,
      foh,
      created_by,
      opex_id,
    } = req.body;

    // Validasi input
    if (
      !gl_id ||
      !domain ||
      !tahun ||
      !monthsInsert ||
      !Array.isArray(monthsInsert)
    ) {
      return res.status(400).json({
        type: "error",
        message: "Data tidak lengkap atau format salah.",
      });
    }

    // Gunakan transaction untuk memastikan atomicity
    await db.transaction(async (trx) => {
      // Iterasi melalui monthsInsert untuk menentukan apakah data akan di-insert atau di-update
      for (const month of monthsInsert) {
        const id = opex_id[month];

        const data = {
          domain,
          tahun,
          bulan: month,
          gl_id,
          budget: parseFloat(opexBudget[month]) || 0,
          proyeksi: parseFloat(opexProjection[month]) || 0,
          foh: foh ? 1 : 0, // Konversi ke tipe data bit
          updated_by: created_by,
          updated_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        };

        if (!id) {
          // Jika opex_id null, lakukan insert
          data.created_by = created_by;
          data.created_at = dayjs().format("YYYY-MM-DD HH:mm:ss");
          await trx("dbPortalFA.dbo.opex").insert(data);
        } else {
          // Jika opex_id ada, lakukan update
          await trx("dbPortalFA.dbo.opex").where("opex_id", id).update(data);
        }
      }
    });

    return res.json({
      type: "success",
      message: "Data berhasil disimpan.",
    });
  } catch (error) {
    return res.status(500).json({
      type: "error",
      message:
        process.env.DEBUG == 1
          ? error.message
          : "Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT.",
    });
  }
};


export const PJL_OP_copy = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk menyalin data berdasarkan tahun dan domain'
  try {
    const cekData = await db("dbPortalFA.dbo.opex")
      .where("domain", req.body.domain)
      .where("tahun", req.body.tahun_baru);

    if (cekData.length > 0) {
      return res.status(406).json({
        type: "error",
        message: "Data Sudah ada.",
      });
    }
    // Ambil data berdasarkan domain dan tahun lama
    const allData = await db("dbPortalFA.dbo.opex")
      .where("domain", req.body.domain)
      .where("tahun", req.body.tahun)
      .orderBy("tahun", "asc")
      .orderBy("bulan", "asc");

    if (allData.length === 0) {
      return res.status(404).json({
        type: "error",
        message: "Data tidak ditemukan.",
      });
    }
    console.log(allData);
    

    // Siapkan data baru untuk di-insert
    const toInsert = allData.map((item) => ({
      domain: item.domain,
      tahun: req.body.tahun_baru,
      bulan: item.bulan,
      gl_id: item.gl_id,
      foh: item.foh,
      budget: item.budget,
      proyeksi: item.proyeksi,
      created_by: req.body.created_by,
      created_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    }));

    // Insert data baru
    await db("dbPortalFA.dbo.opex").insert(toInsert);

    return res.json("sukses");
  } catch (error) {
    return res.status(406).json({
      type: "error",
      message:
        process.env.DEBUG == 1
          ? error.message
          : "Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT",
    });
  }
};


export const PJL_OP_delete = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
           "bearerAuth": []
   }] */
  // #swagger.description = 'Fungsi untuk hapus data aplikasi'
  try {
    await db("dbPortalFA.dbo.opex")
      .where("gl_id", req.params.id)
      .where("tahun", req.params.tahun)
      .where("domain", req.params.domain)
      .delete();
    return res.json("success");
  } catch (error) {
    return res.status(406).json(
      /* error.message */
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

export const PJL_OP_deletetahun = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
           "bearerAuth": []
   }] */
  // #swagger.description = 'Fungsi untuk hapus data aplikasi'
  try {
    await db("dbPortalFA.dbo.opex")
      .where("tahun", req.params.tahun)
      .where("domain", req.params.domain)
      .delete();
    return res.json("success");
  } catch (error) {
    return res.status(406).json(
      /* error.message */
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

export const PJL_OP_exportdata = async (req, res) => {
  try {
    // Query data dari database
    let query = await db("dbPortalFA.dbo.jenis_produksi").select(
      "jenis_produksi_id",
      "domain",
      "jenis_produksi",
      "desc"
    );

    // Membuat workbook Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Jenis Produksi");

    // Menambahkan header ke worksheet
    worksheet.columns = [
      { header: "ID", key: "jenis_produksi_id", width: 15 },
      { header: "Domain", key: "domain", width: 20 },
      { header: "Jenis Produksi", key: "jenis_produksi", width: 25 },
      { header: "Deskripsi", key: "desc", width: 30 },
    ];

    // Menambahkan data ke worksheet
    query.forEach((row) => {
      worksheet.addRow({
        jenis_produksi_id: row.jenis_produksi_id,
        domain: row.domain,
        jenis_produksi: row.jenis_produksi,
        desc: row.desc,
      });
    });

    // Mengatur header response dan mengirim file Excel
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Jenis_Produksi.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Terjadi kesalahan saat mengekspor data." });
  }
};

