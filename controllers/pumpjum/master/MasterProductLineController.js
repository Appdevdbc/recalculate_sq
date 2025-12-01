import { db } from "../../../config/db.js";
import * as dotenv from "dotenv";

dotenv.config();

// Get List of Master Product line data
export const PUMPJUM_MasterProductLineList = async (req, res) => {
    const { rowsPerPage, page } = req.query;

    const domain = req.query.domain || req.body.domain || req.params.domain;
    const sortBy = req.query.sortBy || 'prd.pl_prod_line';
    const sort = req.query.descending === "true" ? "desc" : "asc";

    if (!domain) {
        return res.status(400).json({ error: "Missing domain parameter" });
    }

    try {
        let response;

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db('dbMaster.dbo.qad_prod_line as prd')
            .select(
                'prd.rowid',
                'prd.domain',
                'prd.pl_prod_line',
                'prd.pl_desc',
                "dom.domain_shortname",
            )
            .where('prd.domain', domain)
            .leftJoin("dbPortalFA.dbo.domain as dom", "prd.domain", "=", "dom.domain_code")
            .modify((query) => {
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere('prd.domain', 'like', search)
                        this.orWhere('prd.pl_prod_line', 'like', search)
                        this.orWhere('prd.pl_desc', 'like', search)
                        this.orWhere('dom.domain_shortname', 'like', search)
                    });
                }
            })
            .orderBy(sortBy, sort);
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db('dbMaster.dbo.qad_prod_line as prd')
            .select(
                'prd.rowid',
                'prd.domain',
                'prd.pl_prod_line',
                'prd.pl_desc',
                "dom.domain_shortname",
            )
            .where('prd.domain', domain)
            .leftJoin("dbPortalFA.dbo.domain as dom", "prd.domain", "=", "dom.domain_code")
            .modify((query) => {
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere('prd.domain', 'like', search)
                        this.orWhere('prd.pl_prod_line', 'like', search)
                        this.orWhere('prd.pl_desc', 'like', search)
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
