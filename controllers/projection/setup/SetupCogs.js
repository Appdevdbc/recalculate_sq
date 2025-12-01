import { validationResult } from "express-validator";
import { db } from "../../../config/db.js";
import * as dotenv from "dotenv";
import dayjs from "dayjs";
import xlsx from "xlsx";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

dotenv.config();


export const PJL_COGS_uploadexcel = async (req, res) => {
  try {
    const data = req.body;

    // Validasi payload
    if (!Array.isArray(data) || data.length === 0) {
      return res
        .status(406)
        .json({ error: "Payload harus berupa array dan tidak boleh kosong." });
    }

    const failed = [];
    const validData = data.filter((item) => {
      const { domain, tahun, bulan, gl_id, budget, proyeksi } = item;
      console.log("item, ", item);
      if (!tahun || !bulan || !gl_id) {
        failed.push({ item, reason: "Kolom tidak boleh kosong" });
        return false;
      }
      if (isNaN(Number(budget)) || isNaN(Number(proyeksi))) {
        failed.push({
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
    const existingRecords = await db("dbPortalFA.dbo.begin_cogs_pnl")
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
          item,
          reason: `GL Account '${item.gl_id}' di domain '${item.domain}' pada tahun '${item.tahun}' di bulan '${item.bulan}' sudah ada di database`,
        });
        return false;
      }

      return true;
    });

    // Batch insert data
    try {
      if (toInsert.length > 0) {
        await db("dbPortalFA.dbo.begin_cogs_pnl").insert(
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
      failed.push({ reason: `Gagal menyimpan ke database: ${err.message}` });
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




export const PJL_COGS_getdata = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const rowsPerPage = parseInt(req.query.rowsPerPage, 10) || 10;
    const offset = (page - 1) * rowsPerPage;

    let query = db("dbPortalFA.dbo.begin_cogs_pnl")
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

export const PJL_COGS_getdatadetail = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const rowsPerPage = parseInt(req.query.rowsPerPage, 10) || 10;
    const offset = (page - 1) * rowsPerPage;

    let query = db("dbPortalFA.dbo.begin_cogs_pnl")
      .where("domain", req.query.domain)
      .where("tahun", req.query.tahun);

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

export const PJL_COGS_getdatadetailbygl = async (req, res) => {
  try {
    let query = db("dbPortalFA.dbo.begin_cogs_pnl")
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


export const PJL_COGS_getdatabydomain = async (req, res) => {
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

export const PJL_COGS_glaccount = async (req, res) => {
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

const convertToDecimal = (value) => {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
};

export const PJL_COGS_add = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk simpan data aplikasi'
  try {
    if (
      !Array.isArray(req.body.monthsInsert) ||
      req.body.monthsInsert.length === 0 ||
      typeof req.body.domain !== "string" ||
      typeof req.body.tahun !== "number"
    ) {
      return res.status(400).json({ error: "Invalid input data." });
    }
    // Periksa apakah data sudah ada
    let hasData = await db("dbPortalFA.dbo.begin_cogs_pnl")
      .where("domain", req.body.domain)
      .where("tahun", req.body.tahun)
      .first();

    if (hasData) {
      return res.status(406).json({
        type: "error",
        message: `Data di domain ${req.body.domain} dan tahun ${req.body.tahun} sudah ada`,
      });
    }

    // Persiapkan data untuk dimasukkan berdasarkan monthsInsert
    const insertData = req.body.monthsInsert.map((month) => {
      return {
        domain: req.body.domain,
        tahun: parseInt(req.body.tahun, 10),
        bulan: month,
        volume_budget: convertToDecimal(req.body.volumeBudget[month]),
        volume_proyeksi: convertToDecimal(req.body.volumeProyeksi[month]),
        value_budget: convertToDecimal(req.body.valueBudget[month]),
        value_proyeksi: convertToDecimal(req.body.valueProyeksi[month]),
        created_by: req.body.created_by,
        created_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      };
    });
    console.log("Insert Data:", insertData);
    // Masukkan data ke database
    await db("dbPortalFA.dbo.begin_cogs_pnl").insert(insertData);

    return res.json("sukses");
  } catch (error) {
    console.error("Error Details:", error);
    return res.status(406).json({
      type: "error",
      message:
        process.env.DEBUG == 1
          ? error.message
          : `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
    });
  }
};

export const PJL_COGS_edit = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [ { "bearerAuth": [] } ] */
  // #swagger.description = 'Fungsi untuk simpan data aplikasi'
  try {
    const {
      domain,
      tahun,
      monthsInsert,
      volumeBudget,
      valueBudget,
      volumeProyeksi,
      valueProyeksi,
      created_by,
      begin_cogs_pnl_id,
    } = req.body;

    // Validasi input
    if (!domain || !tahun || !monthsInsert || !Array.isArray(monthsInsert)) {
      return res.status(406).json({
        type: "error",
        message: "Data tidak lengkap atau format salah.",
      });
    }

    // Gunakan transaction untuk memastikan atomicity
    await db.transaction(async (trx) => {
      // Iterasi melalui monthsInsert untuk menentukan apakah data akan di-insert atau di-update
      for (const month of monthsInsert) {
        const id = begin_cogs_pnl_id[month];

        const data = {
          domain,
          tahun,
          bulan: month,
          volume_budget: convertToDecimal(volumeBudget[month]),
          volume_proyeksi: convertToDecimal(volumeProyeksi[month]),
          value_budget: convertToDecimal(valueBudget[month]),
          value_proyeksi: convertToDecimal(valueProyeksi[month]),
          updated_by: created_by,
          updated_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        };
        console.log(id, data);

        if (!id) {
          // Jika begin_cogs_pnl_id null, lakukan insert
          data.created_by = created_by;
          data.created_at = dayjs().format("YYYY-MM-DD HH:mm:ss");
          await trx("dbPortalFA.dbo.begin_cogs_pnl").insert(data);
        } else {
          // Jika begin_cogs_pnl_id ada, lakukan update
          await trx("dbPortalFA.dbo.begin_cogs_pnl")
            .where("begin_cogs_pnl_id", id)
            .update(data);
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


export const PJL_COGS_copy = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk menyalin data berdasarkan tahun dan domain'
  try {
    const cekData = await db("dbPortalFA.dbo.begin_cogs_pnl")
      .where("domain", req.body.domain)
      .where("tahun", req.body.tahun_baru);

    if (cekData.length > 0) {
      return res.status(406).json({
        type: "error",
        message: "Data Sudah ada.",
      });
    }
    // Ambil data berdasarkan domain dan tahun lama
    const allData = await db("dbPortalFA.dbo.begin_cogs_pnl")
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
      volume_budget: item.volume_budget,
      volume_proyeksi: item.volume_proyeksi,
      value_budget: item.value_budget,
      value_proyeksi: item.value_proyeksi,
      created_by: req.body.created_by,
      created_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    }));

    // Insert data baru
    await db("dbPortalFA.dbo.begin_cogs_pnl").insert(toInsert);

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


export const PJL_COGS_delete = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
           "bearerAuth": []
   }] */
  // #swagger.description = 'Fungsi untuk hapus data aplikasi'
  try {
    await db("dbPortalFA.dbo.begin_cogs_pnl")
      .where("domain", req.params.domain)
      .where("tahun", req.params.tahun)
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

export const PJL_COGS_exportdata = async (req, res) => {
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

export const PJL_COGS_getvolumebudget = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk mendapatkan data volume budget'

  try {
    const { domain, tahun, bulan: startBulan, nilai: startNilai } = req.query;

    if (!domain || !tahun || !startBulan || !startNilai) {
      return res.status(400).json({
        message:
          "Parameter 'domain', 'tahun', 'bulan', dan 'nilai' harus diisi",
        status: false,
      });
    }

    const volumeBudget = {};
    const volumeBudgetDetail = {};
    let nilai = parseFloat(startNilai);
    const bulanTerakhir = 12; // Bulan terakhir dalam satu tahun kalender.
    let bulans = parseInt(startBulan)+1;

    // Loop dari bulan yang diberikan sampai akhir tahun.
    for (let bulan = bulans; bulan <= bulanTerakhir; bulan++) {
      // Query pertama: volume_budget dari `volume_produksi_pnl`
      const sumVolumeBudget = await db("volume_produksi_pnl")
        .where({ tahun, bulan })
        .sum("volume_budget as total")
        .first();

      // Query kedua: volume_budget berdasarkan jenis_produksi
      const sumJenisProduksi = await db("volume_pnl as vp")
        .join(
          "jenis_produksi as jp",
          "vp.jenis_produksi_id",
          "jp.jenis_produksi_id"
        )
        .where("vp.tahun", tahun)
        .where("vp.bulan", bulan)
        .whereIn("jp.jenis_produksi", [
          "PVC RETAIL",
          "PVC JIS",
          "FITTING IM",
          "RUGLUE",
          "PVC SNI",
          "PIPA Exoplast",
          "PIPA PE",
          "Pipa TIGRIS",
          "PIPA KELEN GREY",
          "FITTING TIGRIS",
          "FITTING KELEN GREY",
        ])
        .sum("vp.volume_budget as total")
        .first();

      const totalSumVolumeBudget = parseFloat(sumVolumeBudget?.total || 0);
      const totalSumJenisProduksi = parseFloat(sumJenisProduksi?.total || 0);

      // Hitung volumeBudget untuk bulan ini
      const hasil = nilai + totalSumVolumeBudget - totalSumJenisProduksi;
      console.log("bulan",bulan,"nilai", nilai, "totalSumVolumeBudget", totalSumVolumeBudget, "totalSumJenisProduksi", totalSumJenisProduksi);
      
      volumeBudget[bulan] = hasil;
      volumeBudgetDetail[
        bulan
      ] = `rumus : nilai : ${nilai} + totalSumVolumeBudget : ${totalSumVolumeBudget} - totalSumJenisProduksiBudget : ${totalSumJenisProduksi}`;

      // Update nilai untuk bulan selanjutnya
      nilai = hasil;
    }

    // Mengirimkan hasil dalam response
    res.json({
      message: "success",
      status: true,
      data: volumeBudget,
      detail: volumeBudgetDetail,
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

export const PJL_COGS_getvolumeproyeksi = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk mendapatkan data volume budget'

  try {
    const { domain, tahun, bulan: startBulan, nilai: startNilai } = req.query;

    if (!domain || !tahun || !startBulan || !startNilai) {
      return res.status(400).json({
        message:
          "Parameter 'domain', 'tahun', 'bulan', dan 'nilai' harus diisi",
        status: false,
      });
    }

    const volumeBudget = {};
    const volumeBudgetDetail = {};
    let nilai = parseFloat(startNilai);
    const bulanTerakhir = 12; // Bulan terakhir dalam satu tahun kalender.
    let bulans = parseInt(startBulan) + 1;

    // Loop dari bulan yang diberikan sampai akhir tahun.
    for (let bulan = bulans; bulan <= bulanTerakhir; bulan++) {
      // Query pertama: volume_budget dari `volume_produksi_pnl`
      const sumVolumeBudget = await db("volume_produksi_pnl")
        .where({ tahun, bulan })
        .sum("volume_proyeksi as total")
        .first();

      // Query kedua: volume_budget berdasarkan jenis_produksi
      const sumJenisProduksi = await db("volume_pnl as vp")
        .join(
          "jenis_produksi as jp",
          "vp.jenis_produksi_id",
          "jp.jenis_produksi_id"
        )
        .where("vp.tahun", tahun)
        .where("vp.bulan", bulan)
        .whereIn("jp.jenis_produksi", [
          "PVC RETAIL",
          "PVC JIS",
          "FITTING IM",
          "RUGLUE",
          "PVC SNI",
          "PIPA Exoplast",
          "PIPA PE",
          "Pipa TIGRIS",
          "PIPA KELEN GREY",
          "FITTING TIGRIS",
          "FITTING KELEN GREY",
        ])
        .sum("vp.volume_proyeksi as total")
        .first();

      const totalSumVolumeBudget = parseFloat(sumVolumeBudget?.total || 0);
      const totalSumJenisProduksi = parseFloat(sumJenisProduksi?.total || 0);

      // Hitung volumeBudget untuk bulan ini
      const hasil = nilai + totalSumVolumeBudget - totalSumJenisProduksi;
      volumeBudgetDetail[
        bulan
      ] = `rumus : nilai : ${nilai} + totalSumVolumeProyeksi : ${totalSumVolumeBudget} - totalSumJenisProduksiProyeksi : ${totalSumJenisProduksi}`;
      console.log(
        "bulan",
        bulan,
        "nilai",
        nilai,
        "totalSumVolumeBudget",
        totalSumVolumeBudget,
        "totalSumJenisProduksi",
        totalSumJenisProduksi
      );

      volumeBudget[bulan] = hasil;

      // Update nilai untuk bulan selanjutnya
      nilai = hasil;
    }

    // Mengirimkan hasil dalam response
    res.json({
      message: "success",
      status: true,
      data: volumeBudget,
      detail: volumeBudgetDetail,
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

export const PJL_COGS_getvaluebudget = async (req, res) => {
  try {
    const { domain, tahun, bulan: startBulan, nilai: startNilai } = req.query;

    if (!domain || !tahun || !startBulan || !startNilai) {
      return res.status(400).json({
        message:
          "Parameter 'domain', 'tahun', 'bulan', dan 'nilai' harus diisi",
        status: false,
      });
    }

    const volumeBudget = {};
    const volumeBudgetDetail = {};
    const volumeBudgetDetail2 = {};
    const volumeBudgetDetail3 = {};
    let nilai = parseFloat(startNilai);
    const bulanTerakhir = 12;
    let bulans = parseInt(startBulan) + 1;
    let sumMaterialPendukung = await db("material_pendukung")
      .where("tahun", tahun)
      .select(
        db.raw(
          "SUM(bahan_pembantu + bahan_packaging + bahan_penolong + jasa_maklon) as total"
        )
      )
      .first();

    for (let bulan = bulans; bulan <= bulanTerakhir; bulan++) {
      // Query 1: Mengambil total asumsi harga material
      const asumsiPriceMaterial = await db.raw(
        `
        SELECT SUM(apm.value_item * kp.budget) AS total 
        FROM asumsi_price_material apm 
        JOIN kurs_pnl kp ON apm.kurs_id = kp.kurs_pnl_id 
        WHERE apm.tahun = ? AND kp.bulan = ?
      `,
        [tahun, bulan]
      );

      const asumsiTotal = asumsiPriceMaterial[0]?.total || 0;

      // Query 2: Menghitung volume produksi
      const produksiData = await db.raw(
        `
        SELECT 
          SUM(vpp.volume_budget) AS volume_budget, 
          SUM(vpp.volume_budget * r.value_reject) AS total,
          COALESCE(
            (SELECT SUM(rp.qty_per) 
            FROM resep_pnl rp 
            WHERE rp.bom_code = vpp.resep_pnl_id), 
            0
          ) AS bom_code
        FROM 
          volume_produksi_pnl vpp
          INNER JOIN reject r ON vpp.jenis_produksi_id = r.jenis_produksi_id 
        WHERE 
          vpp.tahun = ? 
          AND vpp.bulan = ? 
          AND r.tahun = ?
        GROUP BY vpp.resep_pnl_id;
      `,
        [tahun, bulan, tahun]
      );

      let produksiTotal = 0;
      for (const row of produksiData) {
        produksiTotal += (row.total + row.volume_budget) * row.bom_code;
      }

      const sumJenisProduksi1 = await db("volume_produksi_pnl as vp")
        .join(
          "jenis_produksi as jp",
          "vp.jenis_produksi_id",
          "jp.jenis_produksi_id"
        )
        .where("vp.tahun", tahun)
        .where("vp.bulan", bulan)
        .whereIn("jp.jenis_produksi", [
          "PVC SNI Lok & Safe",
          "PVC SNI Lite",
          "PIPA APOLLO/Exoplast",
          "FITTING TIGRIS/PPR",
          "FITTING KELEN",
          "Fitting IM NON MI",
          "Fitting IM METAL INSERT",
          "RUGLUE",
        ])
        .sum("vp.volume_budget as total")
        .first();

      const sumFOH = await db("opex")
        .where("tahun", tahun)
        .where("bulan", bulan)
        .where("foh", 1)
        .sum("budget as total")
        .first();

      const sumOpex = await db("opex")
        .where("tahun", tahun)
        .where("bulan", bulan)
        .whereIn("gl_id", ["6180001", "6180002", "6180099"])
        .sum("budget as total")
        .first();

      // Hitung Available for Sales Value
      const rawMaterial = asumsiTotal * produksiTotal;
      const bahanPembantu =
        sumJenisProduksi1?.total || 0 + sumMaterialPendukung?.total || 0;
      const hasilAValue =
        nilai + (rawMaterial + bahanPembantu + sumFOH?.total  + sumOpex?.total);

      //COGS Value
      const sumVolumeBudget = await db("volume_produksi_pnl")
        .where({ tahun, bulan })
        .sum("volume_proyeksi as total")
        .first();

      const sumJenisProduksi = await db("volume_pnl as vp")
        .join(
          "jenis_produksi as jp",
          "vp.jenis_produksi_id",
          "jp.jenis_produksi_id"
        )
        .where("vp.tahun", tahun)
        .where("vp.bulan", bulan)
        .whereIn("jp.jenis_produksi", [
          "PVC RETAIL",
          "PVC JIS",
          "FITTING IM",
          "RUGLUE",
          "PVC SNI",
          "PIPA Exoplast",
          "PIPA PE",
          "Pipa TIGRIS",
          "PIPA KELEN GREY",
          "FITTING TIGRIS",
          "FITTING KELEN GREY",
        ])
        .sum("vp.volume_proyeksi as total")
        .first();

      const totalSumVolumeBudget = nilai + parseFloat(sumVolumeBudget?.total || 0);
      const totalSumJenisProduksi = parseFloat(sumJenisProduksi?.total || 0);

      // Hitung volumeBudget untuk bulan ini
      const hasilCOGS = (hasilAValue / totalSumVolumeBudget) * totalSumJenisProduksi;
      const hasil = hasilAValue - hasilCOGS;
      volumeBudget[bulan] = parseFloat(hasil.toFixed(2));
      volumeBudgetDetail[
        bulan
      ] = `rumus : Available for Sales Value : nilai : ${nilai} + Budget COGM : (rawMaterial : ${rawMaterial} + bahanPembantu : + ${bahanPembantu} + sumFOH : ${sumFOH?.total} + Box/Material Insert/Karet : ${sumOpex?.total})`;
      volumeBudgetDetail2[
        bulan
      ] = `rumus : COGS Value : Available for sales Value : ${hasilAValue} / Available for sales volume : (nilai : ${nilai} + totalSumVolumeBudget : ${sumVolumeBudget?.total} = ${totalSumVolumeBudget}) * totalSumJenisProduksi : ${totalSumJenisProduksi}`;
      console.log("bulan", bulan, "rawMaterial = ++", parseFloat(hasil.toFixed(2)), hasilAValue, hasilCOGS);
      volumeBudgetDetail3[
        bulan
      ] = `rumus : Available for sales Value ${hasilAValue} - COGS Value :  ${hasilCOGS} = ${hasil.toFixed(
        2
      )}`;
        // Update nilai untuk iterasi berikutnya
        nilai = parseFloat(hasil.toFixed(2));
    }

    res.json({
      message: "success",
      status: true,
      data: volumeBudget,
      detail: volumeBudgetDetail,
      detail2: volumeBudgetDetail2,
      detail3: volumeBudgetDetail3,
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

export const PJL_COGS_getvalueproyeksi = async (req, res) => {
  try {
    console.log();
    
    const { domain, tahun, bulan: startBulan, nilai: startNilai } = req.query;

    if (!domain || !tahun || !startBulan || !startNilai) {
      return res.status(400).json({
        message:
          "Parameter 'domain', 'tahun', 'bulan', dan 'nilai' harus diisi",
        status: false,
      });
    }

    const volumeBudget = {};
    const volumeBudgetDetail = {};
    const volumeBudgetDetail2 = {};
    const volumeBudgetDetail3 = {};
    let nilai = parseFloat(startNilai);
    const bulanTerakhir = 12;
    let bulans = parseInt(startBulan) + 1;
    let sumMaterialPendukung = await db("material_pendukung")
      .where("tahun", tahun)
      .select(
        db.raw(
          "SUM(bahan_pembantu + bahan_packaging + bahan_penolong + jasa_maklon) as total"
        )
      )
      .first();

    for (let bulan = bulans; bulan <= bulanTerakhir; bulan++) {
      // Query 1: Mengambil total asumsi harga material
      const asumsiPriceMaterial = await db.raw(
        `
        SELECT SUM(apm.value_item * kp.proyeksi) AS total 
        FROM asumsi_price_material apm 
        JOIN kurs_pnl kp ON apm.kurs_id = kp.kurs_pnl_id 
        WHERE apm.tahun = ? AND kp.bulan = ?
      `,
        [tahun, bulan]
      );
      console.log("asumsiPriceMaterial", asumsiPriceMaterial[0]?.total);
      
      const asumsiTotal = asumsiPriceMaterial[0]?.total || 1;

      // Query 2: Menghitung volume produksi
      const produksiData = await db.raw(
        `
        SELECT 
          SUM(vpp.volume_proyeksi) AS volume_proyeksi, 
          SUM(vpp.volume_proyeksi * r.value_reject) AS total,
          COALESCE(
            (SELECT SUM(rp.qty_per) 
            FROM resep_pnl rp 
            WHERE rp.bom_code = vpp.resep_pnl_id), 
            0
          ) AS bom_code
        FROM 
          volume_produksi_pnl vpp
          INNER JOIN reject r ON vpp.jenis_produksi_id = r.jenis_produksi_id 
        WHERE 
          vpp.tahun = ? 
          AND vpp.bulan = ? 
          AND r.tahun = ?
        GROUP BY vpp.resep_pnl_id;
      `,
        [tahun, bulan, tahun]
      );

      let produksiTotal = 0;
      for (const row of produksiData) {
        produksiTotal += (row.total + row.volume_proyeksi) * row.bom_code;
      }
      console.log("produksiTotal", produksiTotal);
      

      const sumJenisProduksi1 = await db("volume_produksi_pnl as vp")
        .join(
          "jenis_produksi as jp",
          "vp.jenis_produksi_id",
          "jp.jenis_produksi_id"
        )
        .where("vp.tahun", tahun)
        .where("vp.bulan", bulan)
        .whereIn("jp.jenis_produksi", [
          "PVC SNI Lok & Safe",
          "PVC SNI Lite",
          "PIPA APOLLO/Exoplast",
          "FITTING TIGRIS/PPR",
          "FITTING KELEN",
          "Fitting IM NON MI",
          "Fitting IM METAL INSERT",
          "RUGLUE",
        ])
        .sum("vp.volume_proyeksi as total")
        .first();

      const sumFOH = await db("opex")
        .where("tahun", tahun)
        .where("bulan", bulan)
        .where("foh", 1)
        .sum("proyeksi as total")
        .first();

      const sumOpex = await db("opex")
        .where("tahun", tahun)
        .where("bulan", bulan)
        .whereIn("gl_id", ["6180001", "6180002", "6180099"])
        .sum("proyeksi as total")
        .first();

      // Hitung Available for Sales Value
      const rawMaterial = asumsiTotal * produksiTotal;
      const bahanPembantu =
        sumJenisProduksi1?.total || 0 + sumMaterialPendukung?.total || 0;
      const hasilAValue =
        nilai + (rawMaterial + bahanPembantu + sumFOH?.total + sumOpex?.total);
        console.log("hasilAValue", hasilAValue);
        

      //COGS Value
      const sumVolumeBudget = await db("volume_produksi_pnl")
        .where({ tahun, bulan })
        .sum("volume_proyeksi as total")
        .first();

      const sumJenisProduksi = await db("volume_pnl as vp")
        .join(
          "jenis_produksi as jp",
          "vp.jenis_produksi_id",
          "jp.jenis_produksi_id"
        )
        .where("vp.tahun", tahun)
        .where("vp.bulan", bulan)
        .whereIn("jp.jenis_produksi", [
          "PVC RETAIL",
          "PVC JIS",
          "FITTING IM",
          "RUGLUE",
          "PVC SNI",
          "PIPA Exoplast",
          "PIPA PE",
          "Pipa TIGRIS",
          "PIPA KELEN GREY",
          "FITTING TIGRIS",
          "FITTING KELEN GREY",
        ])
        .sum("vp.volume_proyeksi as total")
        .first();

      const totalSumVolumeBudget =
        nilai + parseFloat(sumVolumeBudget?.total || 0);
      const totalSumJenisProduksi = parseFloat(sumJenisProduksi?.total || 0);
      
    console.log("nilai", rawMaterial, bahanPembantu, sumFOH?.total, sumOpex?.total, 'total', (nilai + rawMaterial + bahanPembantu + sumFOH?.total + sumOpex?.total));

      // Hitung volumeBudget untuk bulan ini
      const hasilCOGS =
        (hasilAValue / totalSumVolumeBudget) * totalSumJenisProduksi;
      const hasil = hasilAValue - hasilCOGS;
      volumeBudget[bulan] = parseFloat(hasil.toFixed(2));
      volumeBudgetDetail[
        bulan
      ] = `rumus : Available for Sales Value : nilai : ${nilai} + Budget COGM : (rawMaterial : ${rawMaterial} + bahanPembantu : + ${bahanPembantu} + sumFOH : ${sumFOH?.total} + Box/Material Insert/Karet : ${sumOpex?.total})`;
      volumeBudgetDetail2[
        bulan
      ] = `rumus : COGS Value : Available for sales Value : ${hasilAValue} / Available for sales volume : (nilai : ${nilai} + totalSumVolumeBudget : ${sumVolumeBudget?.total} = ${totalSumVolumeBudget}) * totalSumJenisProduksi : ${totalSumJenisProduksi}`;
      console.log("bulan", bulan, "rawMaterial = ++", parseFloat(hasil.toFixed(2)), hasilAValue, hasilCOGS);
      volumeBudgetDetail3[
        bulan
      ] = `rumus : Available for sales Value ${hasilAValue} - COGS Value :  ${hasilCOGS} = ${hasil.toFixed(
        2
      )}`;
      console.log(
        "bulan",
        bulan,
        "rawMaterial = ++",
        parseFloat(hasil.toFixed(2)),
        hasilAValue,
        hasilCOGS
      );

      // Update nilai untuk iterasi berikutnya
      nilai = parseFloat(hasil.toFixed(2));
    }

    res.json({
      message: "success",
      status: true,
      data: volumeBudget,
      detail: volumeBudgetDetail,
      detail2: volumeBudgetDetail2,
      detail3: volumeBudgetDetail3,
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


