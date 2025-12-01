import { body, query, check } from "express-validator";

export const listAsumsiPrice = [
    // Validate domain (required and integer with length 4)
    query('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),
]

export const listAsumsiPriceByYear = [
    // Validate domain (required and integer with length 4)
    query('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),
    
        // Validate year (required and integer with length 4)
    query('tahun')
        .isInt({ min: 0 }).withMessage('tahun must be an integer')
        .isLength({ max: 4 }).withMessage('tahun should not exceed 4 digits'),
]

export const detailAsumsiPrice= [
    // Validate domain (required and integer with length 4)
    query('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),
    
    // Validate year (required and integer with length 4)
    query('tahun')
        .isInt({ min: 0 }).withMessage('tahun must be an integer')
        .isLength({ max: 4 }).withMessage('tahun should not exceed 4 digits'),

    // Validate empid (required and string)
    query('jenis_produksi_id')
        .notEmpty().withMessage('jenis_produksi_id is required')
        .isString().withMessage('jenis_produksi_id must be a string')
]

export const createAsumsiPrice = [
    // Validate domain (required and integer with length 4)
    body('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    // Validate year (required and integer with length 4)
    body('tahun')
        .isInt({ min: 0 }).withMessage('tahun must be an integer')
        .isLength({ max: 4 }).withMessage('tahun should not exceed 4 digits'),
    
    // Validate asumsi
    check('asumsi')
          .isArray()
          .withMessage('asumsi must be an array')
          .bail()
          .custom((items) => {
            for (let item of items) {
              if (typeof item.bulan !== 'number' || item.bulan <= 0 || item.bulan > 12) {
                throw new Error('Bulan tidak valid');
              }
              if(typeof item.avgPriceBudget !== 'number' || item.avgPriceBudget < 0){
                throw new Error('Avg Price Budget mandatory')
              }
              if(typeof item.avgPriceProject !== 'number' || item.avgPriceProject < 0){
                throw new Error('Avg Price Proyeksi mandatory')
              }
              if(typeof item.discountBudget !== 'number' || item.discountBudget < 0){
                throw new Error('Diskon Budget mandatory')
              }
              if(typeof item.discountProject !== 'number' || item.discountProject < 0){
                throw new Error('Diskon Proyeksi mandatory')
              }
              if(item.hppBudget && item.hppBudget < 0){
                throw new Error('HPP Budget minimal 0')
              }
              if(item.hppProject && item.hppProject < 0){
                throw new Error('HPP Proyeksi minimal 0')
              }
            }
            return true;
          }),
    
    // Validate jenis_produksi_id (required and integer)
    body('jenis_produksi_id')
        .isInt({ min: 0 }).withMessage('jenis_produksi_id must be an integer'),

    // Validate empid (required and string)
    body('empid')
        .notEmpty().withMessage('empid is required')
        .isString().withMessage('empid must be a string')
]

export const updateAsumsiPrice = [
    // Validate asumsi
    check('asumsi')
          .isArray()
          .withMessage('asumsi must be an array')
          .bail()
          .custom((items) => {
            for (let item of items) {
              if (typeof item.bulan !== 'number' || item.bulan <= 0 || item.bulan > 12) {
                throw new Error('Bulan tidak valid');
              }
              if(typeof item.avgPriceBudget !== 'number' || item.avgPriceBudget < 0){
                throw new Error('Avg Price Budget mandatory')
              }
              if(typeof item.avgPriceProject !== 'number' || item.avgPriceProject < 0){
                throw new Error('Avg Price Proyeksi mandatory')
              }
              if(typeof item.discountBudget !== 'number' || item.discountBudget < 0){
                throw new Error('Diskon Budget mandatory')
              }
              if(typeof item.discountProject !== 'number' || item.discountProject < 0){
                throw new Error('Diskon Proyeksi mandatory')
              }
              if(item.hppBudget && item.hppBudget < 0){
                throw new Error('HPP Budget minimal 0')
              }
              if(item.hppProject && item.hppProject < 0){
                throw new Error('HPP Proyeksi minimal 0')
              }
            }
            return true;
          }),
    
    // Validate jenis_produksi_id (required and integer)
    body('jenis_produksi_id')
        .isInt({ min: 0 }).withMessage('jenis_produksi_id must be an integer'),

    // Validate empid (required and string)
    body('empid')
        .notEmpty().withMessage('empid is required')
        .isString().withMessage('empid must be a string')
]

export const deleteAsumsiPriceByJenis = [
    // Validate domain (required and integer with length 4)
    query('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),
    
    // Validate year (required and integer with length 4)
    query('tahun')
        .isInt({ min: 0 }).withMessage('tahun must be an integer')
        .isLength({ max: 4 }).withMessage('tahun should not exceed 4 digits'),
    
        // Validate jenis_produksi_id (required and integer)
    body('jenis_produksi_id')
        .isInt({ min: 0 }).withMessage('jenis_produksi_id must be an integer'),
]

export default {
    listAsumsiPrice,
    listAsumsiPriceByYear,
    detailAsumsiPrice,
    createAsumsiPrice,
    updateAsumsiPrice,
    deleteAsumsiPriceByJenis,
}





