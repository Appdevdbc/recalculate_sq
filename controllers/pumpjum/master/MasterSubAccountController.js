import { db } from "../../../config/db.js";
import * as dotenv from "dotenv";

dotenv.config();

// Get List of Master Sub Account data
export const PUMPJUM_MasterSubAccountList = async (req, res) => {
    const { rowsPerPage, page } = req.query;

    const domain = req.query.domain || req.body.domain || req.params.domain;
    const sortBy = req.query.sortBy || 'sub.subacc_code';
    const sort = req.query.descending === "true" ? "desc" : "asc";

    if (!domain) {
        return res.status(400).json({ error: "Missing domain parameter" });
    }

    try {
        let response;

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db('dbPortalFa.dbo.qad_subacc as sub')
            .select(
                'sub.subacc_domain',
                'sub.subacc_code',
                'sub.subacc_desc',
                "dom.domain_shortname",
            )
            .where('sub.subacc_domain', domain)
            .leftJoin("dbPortalFA.dbo.domain as dom", "sub.subacc_domain", "=", "dom.domain_code")
            .modify((query) => {
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere('sub.subacc_domain', 'like', search)
                        this.orWhere('sub.subacc_code', 'like', search)
                        this.orWhere('sub.subacc_desc', 'like', search)
                        this.orWhere('dom.domain_shortname', 'like', search)
                    });
                }
            })
            .orderBy(sortBy, sort);
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db('dbPortalFa.dbo.qad_subacc as sub')
            .select(
                'sub.subacc_domain',
                'sub.subacc_code',
                'sub.subacc_desc',
                "dom.domain_shortname",
            )
            .where('sub.subacc_domain', domain)
            .leftJoin("dbPortalFA.dbo.domain as dom", "sub.subacc_domain", "=", "dom.domain_code")
            .modify((query) => {
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere('sub.subacc_domain', 'like', search)
                        this.orWhere('sub.subacc_code', 'like', search)
                        this.orWhere('sub.subacc_desc', 'like', search)
                        this.orWhere('dom.domain_shortname', 'like', search)
                    });
                }
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
        console.log(error)
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
