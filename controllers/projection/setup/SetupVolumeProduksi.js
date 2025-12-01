import { validationResult } from "express-validator";
import { db, dbMaster } from "../../../config/db.js";
import * as dotenv from "dotenv";
import dayjs from "dayjs";
import xlsx from "xlsx";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

dotenv.config();


// Get List of PNL GL data
// export const PJL_SVP_uploadexcel = async (req, res) => {
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
//       const existing = await db("dbPortalFA.dbo.volume_produksi_pnl")
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
//         await db("dbPortalFA.dbo.volume_produksi_pnl").insert({
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

export const PJL_SVP_uploadexcel = async (req, res) => {
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
    const validData = data.filter((item) => {
      const {
        domain,
        tahun,
        bulan,
        jenis_produksi_id,
        qad_site,
        resep_pnl_id,
        volume_budget,
        volume_proyeksi,
      } = item;

      if (
        !tahun ||
        !bulan ||
        !jenis_produksi_id ||
        !qad_site ||
        !resep_pnl_id
      ) {
        failed.push({ item, reason: "Kolom tidak boleh kosong" });
        return false;
      }

      if (isNaN(Number(volume_budget)) || isNaN(Number(volume_proyeksi))) {
        failed.push({
          item,
          reason: "'budget' dan 'proyeksi' harus berupa angka",
        });
        return false;
      }

      return true;
    });

    // Ambil data valid untuk jenis_produksi_id, domain, dan resep_pnl_id
    const validJenisProduksiIds = await db("jenis_produksi").select(
      "jenis_produksi_id",
      "domain"
    );
    const validResepPnlIds = await dbMaster("qad_bom_mstr").select(
      "bom_parent"
    );

    const validJenisProduksiMap = new Map(
      validJenisProduksiIds.map((item) => [
        `${item.jenis_produksi_id}-${item.domain}`,
        true,
      ])
    );

    const validResepPnlSet = new Set(
      validResepPnlIds.map((item) => item.bom_parent)
    );

    // Filter data berdasarkan validitas jenis_produksi_id, domain, dan resep_pnl_id
    const toInsert = validData.filter((item) => {
      const { jenis_produksi_id, domain, resep_pnl_id } = item;

      const key = `${jenis_produksi_id}-${domain}`;
      if (!validJenisProduksiMap.has(key)) {
        failed.push({
          item,
          reason: `Jenis Produksi ID '${jenis_produksi_id}' dengan domain '${domain}' tidak ditemukan di master jenis produksi.`,
        });
        return false;
      }

      if (!validResepPnlSet.has(resep_pnl_id)) {
        failed.push({
          item,
          reason: `Resep PNL ID '${resep_pnl_id}' tidak valid atau tidak ditemukan di bom parent.`,
        });
        return false;
      }

      return true;
    });

    // Ambil data dari database berdasarkan tahun, bulan, domain, dan gl_id
    const tahunBulanSet = [
      ...new Set(toInsert.map((item) => `${item.tahun}-${item.bulan}`)),
    ];
    const existingRecords = await db("dbPortalFA.dbo.volume_produksi_pnl")
      .whereIn(
        "tahun",
        tahunBulanSet.map((tb) => tb.split("-")[0])
      )
      .whereIn(
        "bulan",
        tahunBulanSet.map((tb) => tb.split("-")[1])
      )
      .select(
        "domain",
        "tahun",
        "bulan",
        "jenis_produksi_id",
        "qad_site",
        "resep_pnl_id"
      );

    // Buat map untuk validasi data yang sudah ada
    const existingMap2 = new Map(
      existingRecords.map((rec) => [
        `${rec.domain}-${rec.tahun}-${rec.bulan}-${rec.jenis_produksi_id}-${rec.qad_site}`,
        true,
      ])
    );

    // Filter data yang valid dan konsisten
    const toInsertFinal = toInsert.filter((item) => {
      const key2 = `${item.domain}-${item.tahun}-${item.bulan}-${item.jenis_produksi_id}-${item.qad_site}`;

      const existingFoh2 = existingMap2.get(key2);

      // Cek apakah kombinasi bulan sudah ada di database
      if (existingFoh2 !== undefined) {
        failed.push({
          item,
          reason: `ID Jenis Produksi '${item.jenis_produksi_id}' di site '${item.qad_site}' di domain '${item.domain}' pada tahun '${item.tahun}' di bulan '${item.bulan}' sudah ada di database`,
        });
        return false;
      }

      return true;
    });

    // Batch insert data
    try {
      if (toInsertFinal.length > 0) {
        // console.log("Data yang akan diinsert:", toInsertFinal);

        await db("dbPortalFA.dbo.volume_produksi_pnl").insert(
          toInsertFinal.map((item) => ({
            domain: item.domain,
            tahun: item.tahun,
            bulan: item.bulan,
            jenis_produksi_id: item.jenis_produksi_id,
            resep_pnl_id: item.resep_pnl_id,
            qad_site: item.qad_site,
            volume_budget: item.volume_budget,
            volume_proyeksi: item.volume_proyeksi,
            created_by: item.created_by,
            created_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          }))
        );
      }
    } catch (err) {
      failed.push({ reason: `Gagal menyimpan ke database: ${err.message}` });
    }

    // Kembalikan laporan hasil upload
    return res.status(201).json({
      message: "Proses upload selesai",
      success: toInsertFinal,
      failed,
    });
  } catch (error) {
    console.error("Error saat memproses data:", error);
    res.status(500).json({ error: "Terjadi kesalahan pada server." });
  }
};




export const PJL_SVP_getdata = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const rowsPerPage = parseInt(req.query.rowsPerPage, 10) || 10;
    const offset = (page - 1) * rowsPerPage;

    let query = db("dbPortalFA.dbo.volume_produksi_pnl")
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

export const PJL_SVP_getdatadetail = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const rowsPerPage = parseInt(req.query.rowsPerPage, 10) || 10;
    const offset = (page - 1) * rowsPerPage;

    let query = db("dbPortalFA.dbo.volume_produksi_pnl")
      .select(
        "volume_produksi_pnl.domain",
        "tahun",
        "volume_produksi_pnl.jenis_produksi_id",
        "jenis_produksi",
        "qad_site",
        "site_desc",
        "resep_pnl_id"
      )
      .join(
        "jenis_produksi",
        "volume_produksi_pnl.jenis_produksi_id",
        "jenis_produksi.jenis_produksi_id"
      )
      .join("site_mstr", "volume_produksi_pnl.qad_site", "site_mstr.site_code")
      .groupBy(
        "volume_produksi_pnl.domain",
        "tahun",
        "volume_produksi_pnl.jenis_produksi_id",
        "jenis_produksi",
        "qad_site",
        "site_desc",
        "resep_pnl_id"
      )
      .where("volume_produksi_pnl.domain", req.query.domain)
      .where("volume_produksi_pnl.tahun", req.query.tahun);

    if (req.query.filter) {
      query = query.andWhere(function () {
        this.where(
          "volume_produksi_pnl.domain",
          "like",
          `%${req.query.filter}%`
        )
          .orWhere("tahun", "like", `%${req.query.filter}%`)
          .orWhere("jenis_produksi", "like", `%${req.query.filter}%`)
          .orWhere("site_desc", "like", `%${req.query.filter}%`)
          .orWhere("resep_pnl_id", "like", `%${req.query.filter}%`);
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

export const PJL_SVP_getdatadetailbygl = async (req, res) => {
  try {
    let query = db("dbPortalFA.dbo.volume_produksi_pnl")
      .select()
      .where("domain", req.query.domain)
      .where("tahun", req.query.tahun)
      .where("jenis_produksi_id", req.query.jenis_produksi_id)
      .where("qad_site", req.query.qad_site)
      .where("resep_pnl_id", req.query.resep_pnl_id);

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

export const PJL_SVP_getdatadetailheader = async (req, res) => {
  try {
    let query = db("dbPortalFA.dbo.volume_produksi_pnl")
      .distinct(
        "volume_produksi_pnl.domain",
        "tahun",
        "jenis_produksi",
        "site_desc",
        "resep_pnl_id"
      )
      .join(
        "jenis_produksi",
        "volume_produksi_pnl.jenis_produksi_id",
        "jenis_produksi.jenis_produksi_id"
      )
      .join("site_mstr", "volume_produksi_pnl.qad_site", "site_mstr.site_code")
      .where("volume_produksi_pnl.domain", req.query.domain)
      .where("tahun", req.query.tahun)
      .where(
        "volume_produksi_pnl.jenis_produksi_id",
        req.query.jenis_produksi_id
      )
      .where("qad_site", req.query.qad_site)
      .where("resep_pnl_id", req.query.resep_pnl_id)
      .first();

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


export const PJL_SVP_getdatabydomain = async (req, res) => {
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

export const PJL_SVP_glaccount = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk get data'
  try {
    const tahun = req.query.tahun;
    const domain = req.query.domain;

    let query = dbMaster("qad_bom_mstr as q");


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

export const PJL_SVP_add = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk simpan data aplikasi'
  try {
    const {
      domain,
      tahun,
      monthsInsert,
      volumeBudget,
      volumeProjection,
      jenis_produksi_id,
      qad_site,
      resep_pnl_id,
      created_by,
      volume_produksi_pnl_id,
    } = req.body;
    // Periksa apakah data sudah ada
    let hasData = await db("dbPortalFA.dbo.volume_produksi_pnl")
      .where("jenis_produksi_id", req.body.jenis_produksi_id)
      .where("qad_site", req.body.qad_site)
      .where("domain", req.body.domain)
      .where("tahun", req.body.tahun)
      .first();

    if (hasData) {
      return res.status(406).json({
        type: "error",
        message: `jenis produksi ${req.body.jenis_produksi_id} di domain ${req.body.domain}, site ${req.body.qad_site} dan tahun ${req.body.tahun} sudah ada`,
      });
    }

    // Persiapkan data untuk dimasukkan berdasarkan monthsInsert
    const insertData = req.body.monthsInsert.map((month) => {
      return {
        domain: req.body.domain,
        tahun: req.body.tahun,
        bulan: month,
        resep_pnl_id: req.body.resep_pnl_id,
        jenis_produksi_id: req.body.jenis_produksi_id,
        qad_site: req.body.qad_site,
        volume_budget:parseFloat(volumeBudget[month]) || 0,
        volume_proyeksi: parseFloat(volumeProjection[month]) || 0,
        created_by: req.body.created_by,
        created_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      };
    });

    // Masukkan data ke database
    await db("dbPortalFA.dbo.volume_produksi_pnl").insert(insertData);

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

export const PJL_SVP_edit = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [ { "bearerAuth": [] } ] */
  // #swagger.description = 'Fungsi untuk simpan data aplikasi'
  try {
    const {
      domain,
      tahun,
      monthsInsert,
      volumeBudget,
      volumeProjection,
      jenis_produksi_id,
      qad_site,
      resep_pnl_id,
      created_by,
      volume_produksi_pnl_id,
    } = req.body;

    // Validasi input
    if (
      (!domain || !jenis_produksi_id || !qad_site || !resep_pnl_id || !tahun || !monthsInsert || !Array.isArray(monthsInsert))
    ) {
      return res.status(406).json({
        type: "error",
        message: "Data tidak lengkap atau format salah.",
      });
    }

    // Gunakan transaction untuk memastikan atomicity
    await db.transaction(async (trx) => {
      // Iterasi melalui monthsInsert untuk menentukan apakah data akan di-insert atau di-update
      for (const month of monthsInsert) {
        const id = volume_produksi_pnl_id[month];

        const data = {
          domain,
          tahun,
          bulan: month,
          jenis_produksi_id,
          qad_site,
          resep_pnl_id,
          volume_budget: parseFloat(volumeBudget[month]) || 0,
          volume_proyeksi: parseFloat(volumeProjection[month]) || 0,
          updated_by: created_by,
          updated_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        };
        console.log(id, data);
        

        if (!id) {
          // Jika volume_produksi_pnl_id null, lakukan insert
          data.created_by = created_by;
          data.created_at = dayjs().format("YYYY-MM-DD HH:mm:ss");
          await trx("dbPortalFA.dbo.volume_produksi_pnl").insert(data);
        } else {
          // Jika volume_produksi_pnl_id ada, lakukan update
          await trx("dbPortalFA.dbo.volume_produksi_pnl").where("volume_produksi_pnl_id", id).update(data);
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


export const PJL_SVP_copy = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk menyalin data berdasarkan tahun dan domain'
  try {
    const cekData = await db("dbPortalFA.dbo.volume_produksi_pnl")
      .where("domain", req.body.domain)
      .where("tahun", req.body.tahun_baru);

    if (cekData.length > 0) {
      return res.status(406).json({
        type: "error",
        message: "Data Sudah ada.",
      });
    }
    // Ambil data berdasarkan domain dan tahun lama
    const allData = await db("dbPortalFA.dbo.volume_produksi_pnl")
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
      jenis_produksi_id: item.jenis_produksi_id,
      qad_site: item.qad_site,
      resep_pnl_id: item.resep_pnl_id,
      volume_budget: item.volume_budget,
      volume_proyeksi: item.volume_proyeksi,
      created_by: req.body.created_by,
      created_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    }));

    // Insert data baru
    await db("dbPortalFA.dbo.volume_produksi_pnl").insert(toInsert);

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

export const PJL_SVP_delete = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
           "bearerAuth": []
   }] */
  // #swagger.description = 'Fungsi untuk hapus data aplikasi'
  try {
    await db("dbPortalFA.dbo.volume_produksi_pnl")
      .where("jenis_produksi_id", req.params.id)
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

export const PJL_SVP_deletetahun = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
           "bearerAuth": []
   }] */
  // #swagger.description = 'Fungsi untuk hapus data aplikasi'
  try {
    await db("dbPortalFA.dbo.volume_produksi_pnl")
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

export const PJL_SVP_exportdata = async (req, res) => {
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

