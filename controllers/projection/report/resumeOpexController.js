import { validationResult } from "express-validator";
import { db } from "../../../config/db.js";
import * as dotenv from "dotenv";
import dayjs from "dayjs";
import xlsx from "xlsx";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import knex from "knex";

dotenv.config();

export const PJL_REOpex_getdata = async (req, res) => {

  // #swagger.tags = ['General']
    /* #swagger.security = [{
              "bearerAuth": []
      }] */
    // #swagger.description = 'Fungsi untuk get data'
    try {
      const tahun = req.query.tahun;
      const domain = req.query.domain;
      const jenis_opex = req.query.jenis_opex;
      if (jenis_opex == "Budget") {
        let query = db("dbPortalFA.dbo.opex as o")
          .select(
            "o.gl_id",
            "o.tahun",
            "o.bulan",
            db.raw("sum(o.budget) as budget"),
            "qg.gl_desc",
            db.raw("'budget' as jenis")
          )
          .innerJoin("dbPortalFA.dbo.qad_gl as qg", "o.gl_id", "qg.gl_code")
          .groupBy("o.gl_id", "o.tahun", "o.bulan", "qg.gl_desc")
          .where("o.tahun", tahun)
          .where("o.domain", domain);

        const result = await query;

        // Mengirimkan response
        res.json({
          message: "success",
          status: true,
          data: result,
        });
      } else {
        const queryOpex = db("dbPortalFA.dbo.opex as o")
          .select(
            "o.gl_id",
            "o.tahun",
            "o.bulan",
            db.raw("sum(o.proyeksi) as budget"),
            "qg.gl_desc",
            db.raw("'budget' as jenis")
          )
          .innerJoin("dbPortalFA.dbo.qad_gl as qg", "o.gl_id", "qg.gl_code")
          .groupBy("o.gl_id", "o.tahun", "o.bulan", "qg.gl_desc")
          .where("o.tahun", tahun)
          .where("o.domain", domain);

        // Query kedua
        const queryTransaksiAktual = db("dbPortalFA.dbo.transaksi_aktual as ta")
          .select(
            "ta.gl_code",
            "ta.jan",
            "ta.feb",
            "ta.mar",
            "ta.apr",
            "ta.may",
            "ta.jun",
            "ta.jul",
            "ta.aug",
            "ta.sep",
            "ta.oct",
            "ta.nov",
            "ta.dec"
          )
          .where("ta.tahun", tahun)
          .where("ta.domain", domain);
        const opexData = await queryOpex;
        const transaksiAktualData = await queryTransaksiAktual;
        // console.log(opexData);

        // Transform data transaksi_aktual untuk mempermudah mapping
        const transaksiMapping = transaksiAktualData.reduce((map, row) => {
          map[row.gl_code] = row;
          return map;
        }, {});

        // Update data opex berdasarkan transaksi aktual
        const updatedData = opexData.map((row) => {
          const aktual = transaksiMapping[row.gl_id] || {};

          // Update actual berdasarkan bulan
          const bulanMapping = {
            1: "jan",
            2: "feb",
            3: "mar",
            4: "apr",
            5: "may",
            6: "jun",
            7: "jul",
            8: "aug",
            9: "sep",
            10: "oct",
            11: "nov",
            12: "dec",
          };

          const actualValue = aktual[bulanMapping[row.bulan]] || row.budget;
          const jenisValue = aktual[bulanMapping[row.bulan]]
            ? "proyeksi"
            : "budget";
          return {
            ...row,
            budget: actualValue,
            jenis: jenisValue,
          };
        });

        console.log(updatedData);

        // Mengirimkan response
        res.json({
          message: "success",
          status: true,
          data: updatedData,
        });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Internal server error, please call IT",
        status: false,
        error: error.message,
      });
    }
};
