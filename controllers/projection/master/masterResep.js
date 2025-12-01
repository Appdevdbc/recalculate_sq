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
export const PJL_MRp_uploadexcel = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk simpan data aplikasi'
  try {
    const data = req.body;

    // Validasi payload: harus array dan tidak boleh kosong
    if (!Array.isArray(data) || data.length === 0) {
      return res
        .status(406)
        .json({ error: "Payload harus berupa array dan tidak boleh kosong." });
    }

    const success = [];
    const failed = [];

    // Proses data satu per satu
    for (const item of data) {
      let { domain, created_by } = item;
      let tahun = item.tahun;
      let jenis_produksi_id = item.jenis_produksi_id;
      let jenis_produksi = item.jenis_produksi
        ? item.jenis_produksi.toString()
        : "";
      let value_reject = item.value_reject;

      // Validasi kolom tidak boleh kosong
      if (!tahun || !jenis_produksi_id || !jenis_produksi || !value_reject) {
        failed.push({
          item,
          reason: "tahun, Jenis Produksi dan value reject tidak boleh kosong",
        });
        continue;
      }
      // Cek apakah kombinasi domain dan jenis_produksi sudah ada di database

      const existing2 = await db("dbPortalFA.dbo.jenis_produksi")
        .where({ domain, jenis_produksi })
        .first();
        

      if (!existing2) {
        failed.push({
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
          item,
          reason: `Jenis Produksi '${jenis_produksi}' di domain '${domain}' pada tahun '${tahun}' sudah ada di database`,
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
          domain,
          jenis_produksi,
          value_reject,
          tahun,
          created_by,
        });
      } catch (err) {
        failed.push({
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

export const PJL_MRp_getdata = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const rowsPerPage = parseInt(req.query.rowsPerPage, 10) || 10;
    const offset = (page - 1) * rowsPerPage;

    let query = db("dbPortalFA.dbo.resep_pnl")
      .select("domain", "tahun", "site", "bom_code","updated_at")
      .groupBy("domain", "tahun", "site", "bom_code","updated_at");

    if (req.query.filter) {
        query = query.andWhere(function () {
            this.where("domain", "like", `%${req.query.filter}%`)
              .orWhere("tahun", "like", `%${req.query.filter}%`)
              .orWhere("site", "like", `%${req.query.filter}%`)
              .orWhere("bom_code", "like", `%${req.query.filter}%`);
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
          : "resep_pnl.updated_at", // mengganti dengan field langsung tanpa alias
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

export const PJL_MRp_add = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk simpan data aplikasi'
  try {
    const { listComp, domain, tahun, site, bom_code, created_by } = req.body;

    // Validasi apakah listComp ada dan berbentuk array
    if (!Array.isArray(listComp) || listComp.length === 0) {
      return res.status(406).json({
        type: "error",
        message: "Data komponen (listComp) tidak valid atau kosong.",
      });
    }

    // Cek apakah kombinasi domain, tahun, site, bom_code sudah ada
    const hasData = await db("dbPortalFA.dbo.resep_pnl")
      .where({ domain, tahun, site, bom_code })
      .first();

    if (hasData) {
      return res.status(406).json({
        type: "error",
        message: `${bom_code} di domain ${domain} pada tahun ${tahun} sudah ada.`,
      });
    }

    // Siapkan data untuk diinsert
    const insertData = listComp.map((item) => ({
      domain,
      tahun,
      site,
      bom_code,
      parent_item: item.ps_compparent,
      parent_name: item.nmprodparent,
      component: item.ps_compchild,
      component_desc: item.nmprodchild,
      qty_per: item.ps_qty_per,
      created_by,
      created_at: new Date(), // Menggunakan default JavaScript Date
    }));

    // Lakukan insert ke database
    await db("dbPortalFA.dbo.resep_pnl").insert(insertData);

    return res.json({ type: "success", message: "Data berhasil disimpan." });
  } catch (error) {
    console.error("Error saving data:", error);
    return res.status(500).json({
      type: "error",
      message:
        process.env.DEBUG == 1
          ? error.message
          : `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT.`,
    });
  }
};


export const PJL_MRp_edit = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk simpan data aplikasi'
  try {
    let hasData = await db("dbPortalFA.dbo.resep_pnl")
      .where("domain", req.body.domain)
      .where("site", req.body.site)
      .where("tahun", req.body.tahun)
      .where("bom_code", req.body.bom_code)
      .whereNot("resep_pnl_id", req.body.resep_pnl_id)
      .first();
    console.log(hasData);

    if (hasData) {
      return res.status(406).json(
        /* { message: error.message } */
        {
          type: "error",
          message: `${req.body.jenis_produksi} di domain ${req.body.domain} pada tahun ${req.body.tahun} sudah ada`,
        }
      );
    }

    let cekData = await db("dbPortalFA.dbo.reject")
      .where("resep_pnl_id", req.body.resep_pnl_id)
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
        .where("resep_pnl_id", req.body.resep_pnl_id);
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

export const PJL_MRp_delete = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
           "bearerAuth": []
   }] */
  // #swagger.description = 'Fungsi untuk hapus data aplikasi'
  try {
    await db("dbPortalFA.dbo.resep_pnl")
      .where("bom_code", req.params.id)
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


export const PJL_MRp_exportdata = async (req, res) => {
  try {
    // Query data dari database
    let query = await db("dbPortalFA.dbo.resep_pnl").select(
      "resep_pnl_id",
      "domain",
      "tahun",
      "site",
      "bom_code",
      "parent_item",
      "parent_name",
      "component",
      "component_desc",
      "qty_per"
    );

    // Membuat workbook Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Jenis Produksi");

    // Menambahkan header ke worksheet
    worksheet.columns = [
      { header: "Resep PNL ID", key: "resep_pnl_id", width: 15 },
      { header: "Domain", key: "domain", width: 20 },
      { header: "Tahun", key: "tahun", width: 10 },
      { header: "Site", key: "site", width: 15 },
      { header: "BOM Code", key: "bom_code", width: 20 },
      { header: "Parent Item", key: "parent_item", width: 25 },
      { header: "Parent Name", key: "parent_name", width: 30 },
      { header: "Component", key: "component", width: 25 },
      { header: "Component Description", key: "component_desc", width: 35 },
      { header: "Quantity per", key: "qty_per", width: 15 },
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
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=master_resep.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Terjadi kesalahan saat mengekspor data." });
  }
};

export const PJL_MRp_getkoderesep = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk get data'
  try {
    const domain = req.query.domain;

    let query = dbMaster("qad_bom_mstr").where("bom_domain", domain);

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

export const PJL_MRp_getdetailresep = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk get data'
  try {
    const bom_parent = req.query.bom_parent;
    const domain = req.query.domain;

    const query = dbMaster("qad_bom_mstr as a")
      .select(
        "a.bom_parent",
        "b.ps_par",
        "b.ps_comp as ps_compparent",
        "e.nmprod as nmprodparent",
        "c.ps_comp as ps_compchild",
        "d.nmprod as nmprodchild",
        "b.ps_qty_per",
        "c.ps_domain",
        dbMaster.raw("CAST(0 AS BIT) AS status")
      )
      .innerJoin("qad_ps_mstr as b", "a.bom_parent", "b.ps_par")
      .innerJoin("qad_ps_mstr as c", "b.ps_comp", "c.ps_par")
      .innerJoin("qad_product as d", function () {
        this.on("c.ps_comp", "=", "d.idqad").andOn(
          "c.ps_domain",
          "=",
          "d.domain"
        );
      })
      .innerJoin("qad_product as e", function () {
        this.on("b.ps_comp", "=", "e.idqad").andOn(
          "b.ps_domain",
          "=",
          "e.domain"
        );
      })
      .where("a.bom_parent", bom_parent)
      .andWhere("c.ps_domain", domain);
    // .where("c.ps_domain", domain)
    // .limit(50);

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

export const PJL_MRp_getdetailresepbycode = async (req, res) => {
  // #swagger.tags = ['General']
  /* #swagger.security = [{
            "bearerAuth": []
    }] */
  // #swagger.description = 'Fungsi untuk get data'
  try {
    const domain = req.query.domain;
    const bom_code = req.query.bom_code;
    const tahun = req.query.tahun;
    const site = req.query.site;

    const query = db("resep_pnl")
      .where("bom_code", bom_code)
      .andWhere("domain", domain)
      .andWhere("tahun", tahun)
      .andWhere("site", site);
    // .where("c.ps_domain", domain)
    // .limit(50);

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