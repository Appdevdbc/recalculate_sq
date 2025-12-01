import { body, query } from "express-validator";

export const listVolumeSales = [
    // Validate domain (required and integer with length 4)
    query('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),
]

export const viewVolumeSales = [
    // Validate domain (required and integer with length 4)
    query('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    // Validate year (required and integer with length 4)
    query('tahun')
        .isInt({ min: 0 }).withMessage('year must be an integer')
        .isLength({ max: 4 }).withMessage('year should not exceed 4 digits'),
    
    // Validate jenis_produksi_id (required and integer)
    query('jenis_produksi_id')
        .isInt({ min: 0 }).withMessage('jenis_produksi_id must be an integer'),
]

export const detailVolumeSales = [
    // Validate domain (required and integer with length 4)
    query('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    // Validate year (required and integer with length 4)
    query('tahun')
        .isInt({ min: 0 }).withMessage('year must be an integer')
        .isLength({ max: 4 }).withMessage('year should not exceed 4 digits'),
]

export const createVolumeSales = [
    // Validate domain (required and integer with length 4)
    body('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    // Validate year (required and integer with length 4)
    body('tahun')
        .isInt({ min: 0 }).withMessage('tahun must be an integer')
        .isLength({ max: 4 }).withMessage('tahun should not exceed 4 digits'),
    
    // Validate month (required and integer with length 2)
    body('bulan')
        .isInt({ min: 0 }).withMessage('month must be an integer')
        .isLength({ max: 2 }).withMessage('month should not exceed 2 digits'),
    
    // Validate jenis_produksi_id (required and integer)
    body('jenis_produksi_id')
        .isInt({ min: 0 }).withMessage('jenis_produksi_id must be an integer'),

    // Validate empid (required and string)
    body('empid')
        .notEmpty().withMessage('empid is required')
        .isString().withMessage('empid must be a string')
]

export const updateVolumeSales = [
    // Validate volume_pnl_id (required and integer)
    body('volume_pnl_id')
        .isInt({ min: 0 }).withMessage('volume_pnl_id must be an integer'),

    // Validate domain (required and integer with length 4)
    body('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    // Validate year (required and integer with length 4)
    body('tahun')
        .isInt({ min: 0 }).withMessage('tahun must be an integer')
        .isLength({ max: 4 }).withMessage('tahun should not exceed 4 digits'),
    
    // Validate month (required and integer with length 2)
    body('bulan')
        .isInt({ min: 0 }).withMessage('month must be an integer')
        .isLength({ max: 2 }).withMessage('month should not exceed 2 digits'),
    
    // Validate jenis_produksi_id (required and integer)
    body('jenis_produksi_id')
        .isInt({ min: 0 }).withMessage('jenis_produksi_id must be an integer'),

    // Validate empid (required and string)
    body('empid')
        .notEmpty().withMessage('empid is required')
        .isString().withMessage('empid must be a string')
]

export const deleteVolumeSales = [
    // Validate domain (required and integer with length 4)
    query('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    // Validate year (required and integer with length 4)
    query('tahun')
        .isInt({ min: 0 }).withMessage('year must be an integer')
        .isLength({ max: 4 }).withMessage('year should not exceed 4 digits'),
]

export const deleteVolumeSalesByJenis = [
    // Validate domain (required and integer with length 4)
    query('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    // Validate year (required and integer with length 4)
    query('tahun')
        .isInt({ min: 0 }).withMessage('year must be an integer')
        .isLength({ max: 4 }).withMessage('year should not exceed 4 digits'),

            
    // Validate jenis_produksi_id (required and integer)
    query('jenis_produksi_id')
        .isInt({ min: 0 }).withMessage('jenis_produksi_id must be an integer'),
]

export const copyVolumeSales = [
    // Validate domain (required and integer with length 4)
    body('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    // Validate year (required and integer with length 4)
    body('tahun')
        .isInt({ min: 0 }).withMessage('tahun must be an integer')
        .isLength({ max: 4 }).withMessage('tahun should not exceed 4 digits'),

    // Validate year (required and integer with length 4)
    body('new_tahun')
        .isInt({ min: 0 }).withMessage('new_tahun must be an integer')
        .isLength({ max: 4 }).withMessage('new_tahun should not exceed 4 digits'),
        
    // Validate empid (required and string)
    body('empid')
        .notEmpty().withMessage('empid is required')
        .isString().withMessage('empid must be a string')
]

export default {
    createVolumeSales,
    updateVolumeSales,
    deleteVolumeSales,
    deleteVolumeSalesByJenis,
    copyVolumeSales,
    listVolumeSales,
    viewVolumeSales,
    detailVolumeSales,
}