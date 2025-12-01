import { body, query, check } from "express-validator";

export const listKurs = [
    // Validate domain (required and integer with length 4)
    query('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),
]

export const detailKurs = [
    // Validate domain (required and integer with length 4)
    query('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    // Validate year (required and integer with length 4)
    query('tahun')
       .isInt({ min: 0 }).withMessage('tahun must be an integer')
       .isLength({ max: 4 }).withMessage('tahun should not exceed 4 digits'),
    
    // Validate jenis_produksi_id (required and integer)
    query('currency')
        .isInt({ min: 0 }).withMessage('currency must be an integer'),
]

export const createKurs = [
    // Validate domain (required and integer with length 4)
    body('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    // Validate year (required and integer with length 4)
    body('tahun')
        .isInt({ min: 0 }).withMessage('tahun must be an integer')
        .isLength({ max: 4 }).withMessage('tahun should not exceed 4 digits'),
    
    // Validate month (required and integer with length 2)
    check('bulan')
          .isArray()
          .withMessage('bulan must be an array')
          .bail()
          .custom((items) => {
            for (let item of items) {
              if (typeof item.id !== 'number' || item.id <= 0 || item.id > 12) {
                throw new Error('Bulan tidak valid');
              }
              if(typeof item.budget !== 'number' || item.budget < 0){
                throw new Error('Budget minimal 0')
              }
              if(typeof item.projection !== 'number' || item.projection < 0){
                throw new Error('Proyeksi minimal 0')
              }
            }
            return true;
          }),
    
    // Validate jenis_produksi_id (required and integer)
    body('currency')
        .isInt({ min: 0 }).withMessage('currency must be an integer'),

    // Validate empid (required and string)
    body('empid')
        .notEmpty().withMessage('empid is required')
        .isString().withMessage('empid must be a string')
]

export const updateKurs = [   
    // Validate month (required and integer with length 2)
    check('bulan')
          .isArray()
          .withMessage('bulan must be an array')
          .bail()
          .custom((items) => {
            for (let item of items) {
              if (typeof item.kurs_pnl_id !== 'number' || item.kurs_pnl_id < 0 ) {
                throw new Error('ID kurs pnl tidak valid');
              }
              if(typeof item.budget !== 'number' || item.budget < 0){
                throw new Error('Budget minimal 0')
              }
              if(typeof item.proyeksi !== 'number' || item.proyeksi < 0){
                throw new Error('Proyeksi minimal 0')
              }
            }
            return true;
          }),
    
    // Validate empid (required and string)
    body('empid')
        .notEmpty().withMessage('empid is required')
        .isString().withMessage('empid must be a string')
]

export const deleteKurs = [
    // Validate domain (required and integer with length 4)
    query('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    // Validate year (required and integer with length 4)
    query('tahun')
        .isInt({ min: 0 }).withMessage('tahun must be an integer')
        .isLength({ max: 4 }).withMessage('tahun should not exceed 4 digits'),
    
    // Validate jenis_produksi_id (required and integer)
    query('currency')
        .isInt({ min: 0 }).withMessage('currency must be an integer'),
]

export const copyKurs = [
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
    listKurs,
    detailKurs,
    createKurs,
    updateKurs,
    deleteKurs,
    copyKurs,
}