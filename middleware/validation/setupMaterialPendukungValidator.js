import { query, body } from "express-validator";

export const deleteMaterialPendukung = [
    // Validate domain (required and integer with length 4)
    query('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    // Validate jenis produksi id
    query('jenis_produksi_id')
        .notEmpty().withMessage('Kode jenis produksi is required')
        .isString().withMessage('Kode jenis produksi must be a string')
];

export const IDMaterialPendukung = [
    // Validate material pendukung id
    query('material_pendukung_id')
        .isInt({ min: 0 }).withMessage('Material pendukung id must be an integer')
];

export const createMaterialPendukung = [
    // Validate domain (required and integer with length 4)
    query('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    // Validate year (required and integer with length 4)
    query('year')
        .isInt({ min: 0 }).withMessage('year must be an integer')
        .isLength({ max: 4 }).withMessage('year should not exceed 4 digits'),
    
    // Validate jenis_produksi_id (required and integer)
    query('jenis_produksi_id')
        .isInt({ min: 0 }).withMessage('jenis_produksi_id must be an integer'),

    // Validate empid (required and string)
    query('empid')
        .notEmpty().withMessage('empid is required')
        .isString().withMessage('empid must be a string')
]


export const updateMaterialPendukung = [
    // Validate domain (required and integer with length 4)
    query('material_pendukung_id')
        .isInt({ min: 0 }).withMessage('material pendukung id must be an integer'),

    // Validate jenis_produksi_id (required and integer)
    query('jenis_produksi_id')
        .isInt({ min: 0 }).withMessage('jenis_produksi_id must be an integer'),

    // Validate empid (required and string)
    query('empid')
        .notEmpty().withMessage('empid is required')
        .isString().withMessage('empid must be a string')
]

export default {
    deleteMaterialPendukung,
    createMaterialPendukung,
    IDMaterialPendukung,
    updateMaterialPendukung,
}