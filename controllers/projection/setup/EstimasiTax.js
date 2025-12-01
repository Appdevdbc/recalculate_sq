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
// export const PJL_ET_uploadexcel = async (req, res) => {
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
//       const existing = await db("dbPortalFA.dbo.estimasi_tax")
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
//         await db("dbPortalFA.dbo.estimasi_tax").insert({
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

export const PJL_ET_uploadexcel = async (req, res) => {
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
        kode_pnl_id,
        tipe,
        detail,
        value,
      } = item;

      if (
        !tahun ||
        !kode_pnl_id
      ) {
        failed.push({ item, reason: "Kolom tidak boleh kosong" });
        return false;
      }

      if (isNaN(Number(value))) {
        failed.push({
          item,
          reason: "'Volume' harus berupa angka",
        });
        return false;
      }

      return true;
    });

    // Ambil data valid untuk kode_pnl_id, domain, dan resep_pnl_id
    const validResepPnlIds = await db("kode_pnl").select("kode_pnl_id");

    const validResepPnlSet = new Set(
      validResepPnlIds.map((item) => item.kode_pnl_id)
    );

    // Filter data berdasarkan validitas kode_pnl_id, domain, dan resep_pnl_id
    const toInsert = validData.filter((item) => {
      const { kode_pnl_id, domain, tahun } = item;

      if (!validResepPnlSet.has(kode_pnl_id)) {
        failed.push({
          item,
          reason: `Resep PNL ID '${kode_pnl_id}' tidak valid atau tidak ditemukan di data kode pnl.`,
        });
        return false;
      }

      return true;
    });

    // Ambil data dari database berdasarkan tahun, bulan, domain, dan gl_id
    const tahunBulanSet = [
      ...new Set(toInsert.map((item) => `${item.tahun}`)),
    ];
    const existingRecords = await db("dbPortalFA.dbo.estimasi_tax")
      .whereIn(
        "tahun",
        tahunBulanSet.map((tb) => tb.split("-")[0])
      )
      .select(
        "domain",
        "tahun",
        "kode_pnl_id",
      );

    // Buat map untuk validasi data yang sudah ada
    const existingMap2 = new Map(
      existingRecords.map((rec) => [
        `${rec.domain}-${rec.tahun}-${rec.kode_pnl_id}`,
        true,
      ])
    );

    // Filter data yang valid dan konsisten
    const toInsertFinal = toInsert.filter((item) => {
      const key2 = `${item.domain}-${item.tahun}-${item.kode_pnl_id}`;

      const existingFoh2 = existingMap2.get(key2);

      // Cek apakah kombinasi bulan sudah ada di database
      if (existingFoh2 !== undefined) {
        failed.push({
          item,
          reason: `Kode Resep '${item.kode_pnl_id}' di domain '${item.domain}' pada tahun '${item.tahun}' sudah ada di database`,
        });
        return false;
      }

      return true;
    });

    // Batch insert data
    try {
      if (toInsertFinal.length > 0) {
        // console.log("Data yang akan diinsert:", toInsertFinal);

        await db("dbPortalFA.dbo.estimasi_tax").insert(
          toInsertFinal.map((item) => ({
            domain: item.domain,
            tahun: item.tahun,
            kode_pnl_id: item.kode_pnl_id,
            tipe: item.tipe,
            detail: item.detail,
            value: item.value,
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




export const PJL_ET_getdata = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const rowsPerPage = parseInt(req.query.rowsPerPage, 10) || 10;
    const offset = (page - 1) * rowsPerPage;

    let query = db("dbPortalFA.dbo.estimasi_tax")
      .select("domain", "tahun", "tipe")
      .groupBy("domain", "tahun", "tipe");

    if (req.query.filter) {
      query = query.andWhere(function () {
        this.where("domain", "like", `%${req.query.filter}%`)
          .orWhere("tahun", "like", `%${req.query.filter}%`)
          .orWhere("tipe", "like", `%${req.query.filter}%`);
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

export const PJL_ET_getdatadetail = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const rowsPerPage = parseInt(req.query.rowsPerPage, 10) || 10;
    const offset = (page - 1) * rowsPerPage;

    let query = db("dbPortalFA.dbo.estimasi_tax")
      .select(
        "estimasi_tax.estimasi_tax_id",
        "estimasi_tax.domain",
        "estimasi_tax.tahun",
        "estimasi_tax.kode_pnl_id",
        "estimasi_tax.value",
        "kode_pnl.tipe",
        "kode_pnl.group",
        "kode_pnl.detail"
      )
      .join("kode_pnl", "estimasi_tax.kode_pnl_id", "kode_pnl.kode_pnl_id")
      .where("estimasi_tax.domain", req.query.domain)
      .where("estimasi_tax.tahun", req.query.tahun)
      .where("estimasi_tax.tipe", req.query.tipe);

    if (req.query.filter) {
      query = query.andWhere(function () {
        this.where("estimasi_tax.domain", "like", `%${req.query.filter}%`)
          .orWhere("estimasi_tax.tahun", "like", `%${req.query.filter}%`)
          .orWhere("kode_pnl.tipe", "like", `%${req.query.filter}%`)
          .orWhere("kode_pnl.detail", "like", `%${req.query.filter}%`);
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
          : "kode_pnl.tipe",
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

export const PJL_ET_getdatadetailbygl = async (req, res) => {
  try {
    let query = db("dbPortalFA.dbo.estimasi_tax")
      .select()
      .where("domain", req.query.domain)
      .where("tahun", req.query.tahun)
      .where("kode_pnl_id", req.query.kode_pnl_id)
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

export const PJL_ET_getdatadetailheader = async (req, res) => {
  try {
    let query = db("dbPortalFA.dbo.estimasi_tax")
      .distinct(
        "volume_produksi_pnl.domain",
        "tahun",
        "jenis_produksi",
        "site_desc",
        "resep_pnl_id"
      )
      .join(
        "jenis_produksi",
        "volume_produksi_pnl.kode_pnl_id",
        "jenis_produksi.kode_pnl_id"
      )
      .join("site_mstr", "volume_produksi_pnl.qad_site", "site_mstr.site_code")
      .where("volume_produksi_pnl.domain", req.query.domain)
      .where("tahun", req.query.tahun)
      .where(
        "volume_produksi_pnl.kode_pnl_id",
        req.query.kode_pnl_id
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


export const PJL_ET_getdatabydomain = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk get data'
  try {
    const domain = req.query.domain;

    let query = db("dbPortalFA.dbo.estimasi_tax").where(
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

export const PJL_ET_glaccount = async (req, res) => {
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

export const PJL_ET_kodepnldetail = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk get data'
  try {
    const tipe = req.query.tipe;
    const domain = req.query.domain;

    let query = db("dbPortalFA.dbo.kode_pnl")
      .select("kode_pnl_id", "tipe", "detail")
      .where("group", "TAX")
      .where("tipe", tipe)
      .where("domain", domain);

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

export const PJL_ET_add = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk simpan data aplikasi'
  try {
    const { domain, tahun, estimasi_tax_id, kode_pnl_id, value, created_by } =
      req.body;

    // Validasi input
    if (
      !domain ||
      !tahun ||
      !kode_pnl_id ||
      !value ||
      !created_by
    ) {
      return res.status(406).json({
        type: "error",
        message: "Data tidak lengkap atau format salah.",
      });
    }

    let hasData = await db("dbPortalFA.dbo.estimasi_tax")
      .where("kode_pnl_id", req.body.kode_pnl_id)
      .where("domain", req.body.domain)
      .where("tahun", req.body.tahun)
      .whereNot("estimasi_tax_id", req.body.estimasi_tax_id)
      .first();

      let pnl = db("dbPortalFA.dbo.kode_pnl")
        .select("kode_pnl_id", "detail")
        .where("kode_pnl_id", req.body.kode_pnl_id)
        .first();

      const resultpnl = await pnl;

    if (hasData) {
      return res.status(406).json(
        /* { message: error.message } */
        {
          type: "error",
          message: `tipe ${req.body.tipe} dengan detail ${resultpnl.detail} di domain ${req.body.domain} pada tahun ${req.body.tahun} sudah ada`,
        }
      );
    }

    let cekData = await db("dbPortalFA.dbo.estimasi_tax")
      .where("estimasi_tax_id", req.body.estimasi_tax_id)
      .first();
    if (cekData) {
      await db("dbPortalFA.dbo.estimasi_tax")
        .update({
          value: parseFloat(req.body.value),
          updated_by: req.body.created_by,
          updated_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        })
        .where("estimasi_tax_id", req.body.estimasi_tax_id);
    } else {
      let pnldet = await db("dbPortalFA.dbo.kode_pnl")
        .where("kode_pnl_id", req.body.kode_pnl_id)
        .first();
      await db("dbPortalFA.dbo.estimasi_tax").insert({
        domain: req.body.domain,
        tahun: req.body.tahun,
        kode_pnl_id: req.body.kode_pnl_id,
        tipe: req.body.tipe,
        detail: pnldet.detail,
        value: parseFloat(req.body.value),
        created_by: req.body.created_by,
        created_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      });
    }

    return res.json("sukses");
  } catch (error) {
    return res.status(406).json(
      /* error */
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

export const PJL_ET_edit = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [ { "bearerAuth": [] } ] */
  // #swagger.description = 'Fungsi untuk simpan data aplikasi'
  try {
    const {
      domain,
      tahun,
      estimasi_tax_id,
      kode_pnl_id,
      value,
      created_by,
    } = req.body;

    // Validasi input
    if (
      (!domain
      || !tahun
      || !estimasi_tax_id
      || !kode_pnl_id
      || !value
      || !created_by)
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
          kode_pnl_id,
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
          await trx("dbPortalFA.dbo.estimasi_tax").insert(data);
        } else {
          // Jika volume_produksi_pnl_id ada, lakukan update
          await trx("dbPortalFA.dbo.estimasi_tax").where("volume_produksi_pnl_id", id).update(data);
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


export const PJL_ET_copy = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk menyalin data berdasarkan tahun dan domain'
  try {
    const cekData = await db("dbPortalFA.dbo.estimasi_tax")
      .where("domain", req.body.domain)
      .where("tahun", req.body.tahun_baru)
      .where("tipe", req.body.tipe);

    if (cekData.length > 0) {
      return res.status(406).json({
        type: "error",
        message: "Data Sudah ada.",
      });
    }
    // Ambil data berdasarkan domain dan tahun lama
    const allData = await db("dbPortalFA.dbo.estimasi_tax")
      .where("domain", req.body.domain)
      .where("tahun", req.body.tahun)
      .where("tipe", req.body.tipe)
      .orderBy("tahun", "asc")
      .orderBy("kode_pnl_id", "asc");

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
      kode_pnl_id: item.kode_pnl_id,
      tipe: item.tipe,
      detail: item.detail,
      value: item.value,
      created_by: req.body.created_by,
      created_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    }));

    // Insert data baru
    await db("dbPortalFA.dbo.estimasi_tax").insert(toInsert);

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


export const PJL_ET_delete = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
           "bearerAuth": []
   }] */
  // #swagger.description = 'Fungsi untuk hapus data aplikasi'
  try {
    await db("dbPortalFA.dbo.estimasi_tax")
      .where("estimasi_tax_id", req.params.id)
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

export const PJL_ET_deletetahun = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
           "bearerAuth": []
   }] */
  // #swagger.description = 'Fungsi untuk hapus data aplikasi'
  try {
    await db("dbPortalFA.dbo.estimasi_tax")
      .where("tipe", req.params.tipe)
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

export const PJL_ET_exportdata = async (req, res) => {
  try {
    // Query data dari database
    let query = await db("dbPortalFA.dbo.kode_pnl").select(
      "kode_pnl_id",
      "tipe",
      "detail"
    ).where("group", "TAX");

    // Tambahkan kolom dengan nilai tetap
    const currentYear = new Date().getFullYear();
    query = query.map((row) => ({
      tahun: currentYear, // Tambahkan tahun sekarang
      ...row,
      value: 0, // Tambahkan nilai 0
    }));

    // Membuat workbook Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Kode PNL");

    // Menambahkan header ke worksheet
    worksheet.columns = [
      { header: "Tahun", key: "tahun", width: 10 },
      { header: "Kode PNL ID", key: "kode_pnl_id", width: 15 },
      { header: "Tipe", key: "tipe", width: 20 },
      { header: "Detail", key: "detail", width: 25 },
      { header: "Value", key: "value", width: 10 },
    ];

    // Menambahkan data ke worksheet
    query.forEach((row) => {
      worksheet.addRow(row);
    });

    // Mengatur header response dan mengirim file Excel
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=Kode_PNL.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Terjadi kesalahan saat mengekspor data." });
  }
};


