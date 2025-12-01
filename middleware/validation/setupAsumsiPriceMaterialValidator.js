import { body, query, check } from "express-validator";

export const listAsumsiPriceMaterial = [
    // Validate domain (required and integer with length 4)
    query('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),
]

export const detailAsumsiPriceMaterial = [
    // Validate domain (required and integer with length 4)
    query('asumsi_price_material_id')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
]

export const createAsumsiPriceMaterial = [
    // Validate domain (required and integer with length 4)
    body('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),
    
    // Validate asumsiprice
    check('asumsiprice')
          .isArray()
          .withMessage('asumsiprice must be an array')
          .bail()
          .custom((items) => {
            for (let item of items) {
              if (typeof item.tahun !== 'number' || item.tahun <= 0) {
                throw new Error('Tahun tidak valid');
              }
              if(typeof item.component !== 'string' || item.component == ''){
                throw new Error('Component mandatory')
              }
              if(typeof item.kurs_id !== 'number' || item.kurs_id < 0){
                throw new Error('Kurs mandatory')
              }
              if(typeof item.value_item !== 'number' || item.value_item < 0){
                throw new Error('Value Item mandatory')
              }
            }
            return true;
        }),

    // Validate empid (required and string)
    body('empid')
        .notEmpty().withMessage('empid is required')
        .isString().withMessage('empid must be a string')
]

export const updateAsumsiPriceMaterial = [
    // Validate asumsi_price_material_id (required and integer)
    body('asumsi_price_material_id')
        .isInt({ min: 0 }).withMessage('ID must be an integer'),

    // Validate value (required and integer)
    body('value_item')
        .isInt({ min: 0 }).withMessage('Value Item must be an integer'),

    // Validate empid (required and string)
    body('empid')
        .notEmpty().withMessage('empid is required')
        .isString().withMessage('empid must be a string')
]

export default {
    listAsumsiPriceMaterial,
    detailAsumsiPriceMaterial,
    createAsumsiPriceMaterial,
    updateAsumsiPriceMaterial,
}