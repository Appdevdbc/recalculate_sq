import { validationResult } from "express-validator";
import { db } from "../../../config/db.js";
import * as dotenv from "dotenv";
import dayjs from "dayjs";
import xlsx from "xlsx";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

dotenv.config();

// Get List of Kode PNL data
export const Projection_ListKodePnl = async (req, res) => {
  try {
    let response;

    const { rowsPerPage, page, domain, sortBy, sort } = req.query;

    // Validate if request has Query rowsPerPage
    if (rowsPerPage == null) {
      response = await db("dbPortalFA.dbo.kode_pnl")
        .select("kode_pnl_id", "domain", "tipe", "group", "detail")
        .where("domain", domain)
        .orderBy(sortBy, sort);
    } else {
      const pages = Math.abs(Math.floor(parseInt(page)));
      response = await db("dbPortalFA.dbo.kode_pnl")
        .select("kode_pnl_id", "domain", "tipe", "group", "detail")
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

// Search data master Kode PNL
export const Projection_SearchKodePnl = async (req, res) => {
  try {
    let response;

    const { rowsPerPage, page, domain, search, sortBy, sort } = req.query;

    // Validate if request has Query rowsPerPage
    if (rowsPerPage == null) {
      response = await db("dbPortalFA.dbo.kode_pnl")
        .select("kode_pnl_id", "domain", "tipe", "group", "detail")
        .where("domain", domain)
        .andWhere((builder) => {
          builder
            .whereILike("tipe", `%${search}%`)
            .orWhereILike("group", `%${search}%`)
            .orWhereILike("detail", `%${search}%`);
        })
        .orderBy(sortBy, sort);
    } else {
      const pages = Math.abs(Math.floor(parseInt(page)));
      response = await db("dbPortalFA.dbo.kode_pnl")
        .select("kode_pnl_id", "domain", "tipe", "group", "detail")
        .where("domain", domain)
        .andWhere((builder) => {
          builder
            .whereILike("tipe", `%${search}%`)
            .orWhereILike("group", `%${search}%`)
            .orWhereILike("detail", `%${search}%`);
        })
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

// Create Kode PNL
export const Projection_CreateKodePnl = async (req, res) => {
  const trx = await db.transaction();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await trx.rollback();
      return res.status(400).json({ errors: errors.array() });
    }

    const { tipe, group, detail, domain, empid } = req.body;

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
    const kodePnl = await db("dbPortalFA.dbo.kode_pnl")
      .select("kode_pnl_id", "domain", "tipe", "group", "detail")
      .where({ tipe, group, detail, domain })
      .first();

    if(kodePnl) {
        await trx.rollback();
        return res
            .status(400)
            .json({ message: "Kode pnl tersebut sudah terdaftar!" });
    }

    await trx("dbPortalFA.dbo.kode_pnl").insert({
        domain: domain,
        tipe: tipe,
        group: group,
        detail: detail,
        created_by: c_empid,
        created_date: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    });

    // Commit transaction
    await trx.commit();
    return res.status(201).json({ message: "Berhasil Membuat Kode PNL" });
  } catch (error) {
    console.log(error)
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


// Delete Kode PNL
export const Projection_DeleteKodePnl = async (req, res) => {
  try {
    const { kode_pnl_id } = req.query;

    if (!kode_pnl_id) {
      return res.status(400).json({
        message: "Kode Pnl are required",
      });
    }

    // Delete all matching records
    await db("dbPortalFA.dbo.kode_pnl").where({ kode_pnl_id }).delete();

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
