import { db, dbFINHris } from "../../../config/db.js";
import * as dotenv from "dotenv";

dotenv.config();

// Get List of Master Item perjalanan dinas data
export const PUMPJUM_MasterItemPerjalananDinasList = async (req, res) => {
    const { rowsPerPage, page } = req.query;

    const sortBy = req.query.sortBy || 'itemCode';
    const sort = req.query.descending === "true" ? "desc" : "asc";

    try {
        let response;

        const dbConn = process.env.DB6_DATABASE ? dbFINHris : db;
        const dbname = process.env.DB6_DATABASE ? 'AppDB_FIN_HRIS' : 'dbPortalFA';

        // Validate if request has Query rowsPerPage
        if (rowsPerPage == null) {
            response = await dbConn(`${dbname}.dbo.T_ATT_OnDuty_Claim_Item as num`)
            .select(
                'num.itemCode',
                'num.itemName',
                'num.itemType',
                'num.itemCategoryCode',
                'num.itemCategory',
            )
            .modify((query) => {
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere('num.itemCode', 'like', search)
                        this.orWhere('num.itemName', 'like', search)
                        this.orWhere('num.itemType', 'like', search)
                        this.orWhere('num.itemCategoryCode', 'like', search)
                        this.orWhere('num.itemCategory', 'like', search)
                    });
                }
            })
            .orderBy(sortBy, sort);
        } else {
            const pages = Math.abs(Math.floor(parseInt(page)));
            response = await dbConn(`${dbname}.dbo.T_ATT_OnDuty_Claim_Item as num`)
            .select(
                'num.itemCode',
                'num.itemName',
                'num.itemType',
                'num.itemCategoryCode',
                'num.itemCategory',
            )
            .modify((query) => {
                if (req.query.filter) {
                    const search = `%${req.query.filter}%`;
                    query.where(function () {
                        this.orWhere('num.itemCode', 'like', search)
                        this.orWhere('num.itemName', 'like', search)
                        this.orWhere('num.itemType', 'like', search)
                        this.orWhere('num.itemCategoryCode', 'like', search)
                        this.orWhere('num.itemCategory', 'like', search)
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
