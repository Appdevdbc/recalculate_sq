import { db, dbDbcHris, dbHris } from "../../../config/db.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import dayjs from "dayjs";
import { formatRupiah2, encryptString } from "../../../helpers/utils.js";
import { sendMailNew } from "../../../helpers/mail.js";
import ejs from "ejs";

export const PUMPJUM_NonPerjalananDinasPengajuanUangMukaList = async (
  req,
  res
) => {
  const sorting = req.query.descending == "true" ? "desc" : "asc";
  let columnSort =
    req.query.sortBy == "desc"
      ? "ndt.created_date desc"
      : `${req.query.sortBy} ${sorting}`;

  let page = Math.floor(req.query.page);

  try {
    let response = await db("dbPortalFA.dbo.trx_nonduty_header as ndt")
      .select(
        "ndt.id",
        "ndt.domain",
        "ndt.pum_number",
        "ndt.perihal",
        "ndt.payment_method_id",
        "ndt.status_data",
        "ndt.feedback_notes",
        "ndt.created_by",
        "ndt.created_date",
        db.raw("COALESCE(dom.domain_code, NULL) as domain_code"),
        db.raw("COALESCE(dom.domain_shortname, NULL) as domain_shortname"),
        db.raw("COALESCE(usr.user_name, NULL) as created_name")
      )
      .leftJoin(
        "dbPortalFA.dbo.users as usr",
        "ndt.created_by",
        "=",
        "usr.user_nik"
      )
      .leftJoin(
        "dbPortalFA.dbo.domain as dom",
        "ndt.domain",
        "=",
        "dom.domain_code"
      )
      .modify((query) => {
        if (req.query.filter) {
          const search = `%${req.query.filter}%`;
          query.where(function () {
            this.orWhere("dom.domain_shortname", "like", search)
              .orWhere("ndt.pum_number", "like", search)
              .orWhere("ndt.status_data", "like", search)
              .orWhere("ndt.feedback_notes", "like", search);
          });
        }
      })
      .orderByRaw(columnSort)
      .paginate({
        perPage: Math.floor(req.query.rowsPerPage),
        currentPage: page,
        isLengthAware: true,
      });

    return res.status(200).json({
      message: "Success",
      data: response,
    });
  } catch (error) {
    console.log(error);
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
