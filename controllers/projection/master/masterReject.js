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
export const PJL_MR_uploadexcel = async (req, res) => {
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
      let tahun = item.tahun;
      let jenis_produksi_id = item.jenis_produksi_id;
      let jenis_produksi = item.jenis_produksi;
      let value_reject = item.value_reject;

      // Validasi kolom tidak boleh kosong
      if (!tahun || !jenis_produksi_id || !jenis_produksi || !value_reject) {
        failed.push({
          no: errorCount++,
          item,
          reason: "tahun, Jenis Produksi dan value reject tidak boleh kosong",
        });
        continue;
      }
      // Cek apakah kombinasi domain dan jenis_produksi sudah ada di database

      const existing2 = await db("dbPortalFA.dbo.jenis_produksi")
        .where({ domain, jenis_produksi_id })
        .first();

      if (!existing2) {
        failed.push({
          no: errorCount++,
          item,
          reason: `Jenis Produksi '${jenis_produksi}' di domain '${domain}' tidak ada`,
        });
        continue;
      }
      const existing = await db("dbPortalFA.dbo.reject")
        .where({ domain, jenis_produksi_id, tahun })
        .first();

      if (existing) {
        failed.push({
          no: errorCount++,
          item,
          reason: `Jenis Produksi '${existing2.jenis_produksi}' di domain '${domain}' pada tahun '${tahun}' sudah ada di database`,
        });
        continue;
      }
      // Simpan ke database
      try {
        await db("dbPortalFA.dbo.reject").insert({
          domain: domain,
          tahun: tahun,
          jenis_produksi_id: jenis_produksi_id,
          value_reject: value_reject,
          created_by: created_by,
          created_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        });

        success.push({
          no: errorCount++,
          domain,
          jenis_produksi,
          value_reject,
          tahun,
          created_by,
        });
      } catch (err) {
        failed.push({
          no: errorCount++,
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
}

export const PJL_MR_getdata = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const rowsPerPage = parseInt(req.query.rowsPerPage, 10) || 10;
    const offset = (page - 1) * rowsPerPage;

    let query = db("dbPortalFA.dbo.reject")
      .select(
        "reject.reject_id",
        "reject.domain",
        "reject.jenis_produksi_id",
        "reject.value_reject",
        "reject.tahun",
        "jenis_produksi.jenis_produksi"
      )
      .innerJoin(
        "jenis_produksi",
        "jenis_produksi.jenis_produksi_id",
        "reject.jenis_produksi_id"
      );

    if (req.query.filter) {
        query = query.andWhere(function () {
            this.where("reject.tahun", "like", `%${req.query.filter}%`)
              .orWhere(
                "jenis_produksi.jenis_produksi",
                "like",
                `%${req.query.filter}%`
              )
              .orWhere("reject.value_reject", "like", `%${req.query.filter}%`)
              .orWhere("reject.tahun", "like", `%${req.query.filter}%`);
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
          : "reject.reject_id",
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

export const PJL_MR_add = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk simpan data aplikasi'
  try {
    let hasData = await db("dbPortalFA.dbo.reject")
      .where("jenis_produksi_id", req.body.jenis_produksi_id)
      .where("tahun", req.body.tahun)
      .where("domain", req.body.domain)
      .whereNot("reject_id", req.body.reject_id)
      .first();
    
    const domain = req.body.domain;
    const jenis_produksi_id = req.body.jenis_produksi_id;
    
    const existing2 = await db("dbPortalFA.dbo.jenis_produksi")
      .where({ domain, jenis_produksi_id })
      .first();
      
    if (hasData) {
      return res.status(406).json(
        /* { message: error.message } */
        {
          type: "error",
          message: `${existing2.jenis_produksi} di domain ${req.body.domain} pada tahun ${req.body.tahun} sudah ada`,
        }
      );
    }

    let cekData = await db("dbPortalFA.dbo.reject")
      .where("reject_id", req.body.reject_id)
      .first();
    if (cekData) {
      await db("dbPortalFA.dbo.reject")
        .update({
          domain: req.body.domain,
          jenis_produksi_id: req.body.jenis_produksi_id,
          tahun: req.body.tahun,
          value_reject: req.body.value_reject,
          updated_by: req.body.created_by,
          updated_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        })
        .where("reject_id", req.body.reject_id);
    } else {
      await db("dbPortalFA.dbo.reject").insert({
        domain: req.body.domain,
        jenis_produksi_id: req.body.jenis_produksi_id,
        tahun: req.body.tahun,
        value_reject: req.body.value_reject,
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

export const PJL_MR_delete = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
           "bearerAuth": []
   }] */
  // #swagger.description = 'Fungsi untuk hapus data aplikasi'
  try {
    console.log("Reject ID:", req.params.id);
    await db("dbPortalFA.dbo.reject")
      .where("reject_id", req.params.id)
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

export const PJL_MR_exportdata = async (req, res) => {
  try {
    // Query data dari database
    let query = await db("dbPortalFA.dbo.reject").select(
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

