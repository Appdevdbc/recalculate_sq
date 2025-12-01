import { db } from "../../../config/db.js";
import * as dotenv from "dotenv";

dotenv.config();

// Get List of Master Supplier data
export const PUMPJUM_MasterSupplierList = async (req, res) => {
    const { rowsPerPage, page } = req.query;

    const domain = req.query.domain || req.body.domain || req.params.domain;
    const sortBy = req.query.sortBy || 'vd_sort';
    const sort = req.query.descending === "true" ? "desc" : "asc";

    if (!domain) {
        return res.status(400).json({ error: "Missing domain parameter" });
    }

    try {
        let response;

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await db('dbMaster.dbo.qad_supplier as sup')
            .select(
                'sup.vd_domain',
                'sup.vd_site',
                'sup.vd_addr',
                'sup.vd_sort',
                'sup.vd_curr',
                "dom.domain_shortname",
                db.raw("COALESCE(sit.site_desc, NULL) as vd_site_desc"),
            )
            .where('sup.vd_domain', domain)
            .leftJoin("dbPortalFA.dbo.domain as dom", "sup.vd_domain", "=", "dom.domain_code")
            .leftJoin("dbPortalFA.dbo.site_mstr as sit", "sup.vd_site", "=", "sit.site_code")
            .modify((query) => {
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere('sup.vd_domain', 'like', search)
                        this.orWhere('sup.vd_site', 'like', search)
                        this.orWhere('sup.vd_addr', 'like', search)
                        this.orWhere('sup.vd_sort', 'like', search)
                        this.orWhere('sup.vd_curr', 'like', search)
                        this.orWhere('dom.domain_shortname', 'like', search)
                        this.orWhere('sit.site_desc', 'like', search)
                    });
                }
            })
            .orderBy(sortBy, sort);
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await db('dbMaster.dbo.qad_supplier as sup')
            .select(
                'sup.vd_domain',
                'sup.vd_site',
                'sup.vd_addr',
                'sup.vd_sort',
                'sup.vd_curr',
                "dom.domain_shortname",
                db.raw("COALESCE(sit.site_desc, NULL) as vd_site_desc"),
            )
            .where('sup.vd_domain', domain)
            .leftJoin("dbPortalFA.dbo.domain as dom", "sup.vd_domain", "=", "dom.domain_code")
            .leftJoin("dbPortalFA.dbo.site_mstr as sit", "sup.vd_site", "=", "sit.site_code")
            .modify((query) => {
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere('sup.vd_domain', 'like', search)
                        this.orWhere('sup.vd_site', 'like', search)
                        this.orWhere('sup.vd_addr', 'like', search)
                        this.orWhere('sup.vd_sort', 'like', search)
                        this.orWhere('sup.vd_curr', 'like', search)
                        this.orWhere('dom.domain_shortname', 'like', search)
                        this.orWhere('sit.site_desc', 'like', search)
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
