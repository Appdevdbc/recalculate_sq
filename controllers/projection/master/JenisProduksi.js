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
export const PJL_JP_uploadexcel = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk simpan data aplikasi'
  try {
    let data = req.body;
    data = Array.isArray(data) ? data : Object.values(data);

    // Validasi payload: harus array dan tidak boleh kosong
    if (!Array.isArray(data) || data.length === 0) {
      return res
        .status(406)
        .json({ error: "Payload harus berupa array dan tidak boleh kosong." });
    }

    const success = [];
    const failed = [];
    let errorCount = 2; // Menambahkan nomor error mulai dari 2

    // Proses data satu per satu
    for (const item of data) {
      let { domain, created_by } = item;
      let jenis_produksi = item.jenis_produksi.toString();
      let desc = item.desc.toString();

      // Validasi kolom tidak boleh kosong
      if (!jenis_produksi || !desc) {
        failed.push({
          no: errorCount++, // Menambahkan nomor error mulai dari 2
          item,
          reason: "Jenis Produksi dan Deskripsi tidak boleh kosong",
        });
        continue;
      }

      // Cek apakah kombinasi domain dan jenis_produksi sudah ada di database
      const existing = await db("dbPortalFA.dbo.jenis_produksi")
        .where({ domain, jenis_produksi })
        .first();

      if (existing) {
        failed.push({
          no: errorCount++, // Menambahkan nomor error mulai dari 2
          item,
          reason: `Jenis Produksi '${jenis_produksi}' di domain '${domain}' sudah ada di database`,
        });
        continue;
      }

      // Simpan ke database
      try {
        await db("dbPortalFA.dbo.jenis_produksi").insert({
          domain: domain,
          jenis_produksi: jenis_produksi,
          desc: desc,
          created_by: created_by,
          created_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        });

        success.push({
          no: errorCount++,
          domain,
          jenis_produksi,
          desc,
          created_by,
        });
      } catch (err) {
        failed.push({
          no: errorCount++, // Menambahkan nomor error mulai dari 2
          item,
          reason: `Gagal menyimpan ke database: ${err.message}`,
        });
      }
    }

    // Kembalikan laporan hasil upload
    return res.status(201).json({
      message: "Proses upload selesai",
      success, // Data yang berhasil disimpan
      failed, // Data yang gagal disimpan beserta alasannya
    });
  } catch (error) {
    console.error("Error saat memproses data:", error);
    res.status(500).json({ error: "Terjadi kesalahan pada server." });
  }
};

export const PJL_JP_getjenisproduksi = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const rowsPerPage = parseInt(req.query.rowsPerPage, 10) || 10;
    const offset = (page - 1) * rowsPerPage;

    let query = db("dbPortalFA.dbo.jenis_produksi");

    if (req.query.filter) {
        query = query.andWhere(function () {
            this.where("jenis_produksi.domain", "like", `%${req.query.filter}%`)
            .orWhere(
                "jenis_produksi.jenis_produksi",
                "like",
                `%${req.query.filter}%`
            )
            .orWhere("jenis_produksi.desc", "like", `%${req.query.filter}%`);
        })
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
          : "jenis_produksi.jenis_produksi_id",
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


export const PJL_JP_getdatabydomain = async (req, res) => {
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

export const PJL_JP_add = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk simpan data aplikasi'
  try {
    let hasData = await db("dbPortalFA.dbo.jenis_produksi")
      .where("jenis_produksi", req.body.jenis_produksi)
      .where("domain", req.body.domain)
      .whereNot("jenis_produksi_id", req.body.jenis_produksi_id)
      .first();
    if (hasData) {
      return res.status(406).json(
        /* { message: error.message } */
        {
          type: "error",
          message: `${req.body.jenis_produksi} di domain ${req.body.domain} sudah ada`,
        }
      );
    }

    let cekData = await db("dbPortalFA.dbo.jenis_produksi")
      .where("jenis_produksi_id", req.body.jenis_produksi_id)
      .first();
    if (cekData) {
      await db("dbPortalFA.dbo.jenis_produksi")
        .update({
          domain: req.body.domain,
          jenis_produksi: req.body.jenis_produksi,
          desc: req.body.desc,
          updated_by: req.body.created_by,
          updated_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        })
        .where("jenis_produksi_id", req.body.jenis_produksi_id);
    } else {
      await db("dbPortalFA.dbo.jenis_produksi").insert({
        domain: req.body.domain,
        jenis_produksi: req.body.jenis_produksi,
        desc: req.body.desc,
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

export const PJL_JP_delete = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
           "bearerAuth": []
   }] */
  // #swagger.description = 'Fungsi untuk hapus data aplikasi'
  try {
    await db("dbPortalFA.dbo.jenis_produksi")
      .where("jenis_produksi_id", req.params.id)
      .delete();
    return res.json("success");
  } catch (error) {
    // Periksa apakah error disebabkan oleh constraint referensi
    if (
      error.message.includes(
        "The DELETE statement conflicted with the REFERENCE constraint"
      )
    ) {
      return res.status(406).json({
        type: "error",
        message:
          "Data ini sedang digunakan di tabel lain dan tidak dapat dihapus.",
      });
    }

    // Jika error lain, gunakan pesan umum atau pesan debug
    return res.status(406).json({
      type: "error",
      message:
        process.env.DEBUG == 1
          ? error.message
          : `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
    });
  }
};

export const PJL_JP_exportdata = async (req, res) => {
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

