import { body, check, query } from 'express-validator';

// Validate Create PNL GL
export const createPnlGlValidator = [
    // Validate item
    check('pnl_gl')
    .isArray()
    .withMessage('Items must be an array')
    .bail()
    .custom((items) => {
        for (let item of items) {
            if (typeof item.domain !== 'number' || item.domain <= 0) {
                throw new Error('Each PNL GL must have a valid Domain');
            }
            if (typeof item.tipe !== 'string' || item.tipe.trim() === '') {
                throw new Error('Each PNL GL must have a valid Tipe');
            }
            if(typeof item.kode_pnl_id !== 'number' || item.kode_pnl_id <= 0){
                throw new Error('Each PNL GL must have a valid Kode PNL')
            }
            if(typeof item.gl_code !== 'number' || item.gl_code <= 0){
                throw new Error('Each PNL GL must have a valid GL Code')
            }
        }
        return true;
    }),
    
    // Validate tahun (required and integer with length 4)
    body('tahun')
    .isInt({ min: 0 }).withMessage('Tahun must be an integer')
    .isLength({ max: 4 }).withMessage('Tahun should not exceed 4 digits'),

    // Validate empid must be an integer
    body('empid')
        .isString().withMessage('Tipe must be a string')
];

// Validate Update PNL GL
export const updatePnlGlValidator = [
    // Validate PNL GL ID
    body('pnl_gl_id')
        .isInt({ min: 0 }).withMessage('PNL GL Id must be integer'),

    // Validate domain (required and integer with length 4)
    body('domain')
        .isInt({ min: 0 }).withMessage('Domain must be an integer')
        .isLength({ max: 4 }).withMessage('Domain should not exceed 4 digits'),

    // Validate tipe (required and string with max length 50)
    body('tipe')
        .notEmpty().withMessage('Tipe is required')
        .isString().withMessage('Tipe must be a string')
        .isLength({ max: 50 }).withMessage('Tipe should not exceed 50 characters')
        .custom(value => {
            const validValues = ['Budget', 'Aktual'];
            if (!validValues.includes(value)) {
              throw new Error('Tipe must be either "Budget" or "Aktual"');
            }
            return true;
        }),

    // Validate tahun (required and integer with length 4)
    body('tahun')
        .isInt({ min: 0 }).withMessage('Tahun must be an integer')
        .isLength({ max: 4 }).withMessage('Tahun should not exceed 4 digits'),

    // Validate kode_pnl_id (required and unsigned integer)
    body('kode_pnl_id')
        .isInt({ min: 0 }).withMessage('Kode PNL ID must be a positive integer'),

    // Validate gl_id (required and unsigned integer)
    body('gl_id')
        .isInt({ min: 0 }).withMessage('GL ID must be a positive integer'),

    // Validate desc (optional and string with max length 100)
    body('desc')
        .optional()
        .isString().withMessage('Desc must be a string')
        .isLength({ max: 100 }).withMessage('Desc should not exceed 100 characters'),

    // Validate empid must be an integer
    body('empid')
        .isInt({ min: 1 }).withMessage('Domain must be an integer')
]

// Validate Update PNL GL
export const IDPnlGlValidator = [
    // Validate PNL GL ID
    body('pnl_gl_id')
        .isInt({ min: 0 }).withMessage('PNL GL Id must be integer'),
]

// Validate Update PNL GL
export const detailPnlGlValidator = [
    // Validate domain (required and integer with length 4)
    query('domain')
        .isInt({ min: 0 }).withMessage('Domain must be an integer')
        .isLength({ max: 4 }).withMessage('Domain should not exceed 4 digits'),

    // Validate tipe (required and string with max length 50)
    query('tipe')
        .notEmpty().withMessage('Tipe is required')
        .isString().withMessage('Tipe must be a string')
        .isLength({ max: 50 }).withMessage('Tipe should not exceed 50 characters')
        .custom(value => {
            const validValues = ['Budget', 'Aktual'];
            if (!validValues.includes(value)) {
              throw new Error('Tipe must be either "Budget" or "Aktual"');
            }
            return true;
        }),

    // Validate tahun (required and integer with length 4)
    query('tahun')
        .isInt({ min: 0 }).withMessage('Tahun must be an integer')
        .isLength({ max: 4 }).withMessage('Tahun should not exceed 4 digits'),
];

// Validate List Copy
export const listCopyPnlGlValidator = [
    // Validate domain (required and integer with length 4)
    body('domain')
        .isInt({ min: 0 }).withMessage('Domain must be an integer')
        .isLength({ max: 4 }).withMessage('Domain should not exceed 4 digits'),

    // Validate tipe (required and string with max length 50)
    body('tipe')
        .notEmpty().withMessage('Tipe is required')
        .isString().withMessage('Tipe must be a string')
        .isLength({ max: 50 }).withMessage('Tipe should not exceed 50 characters')
        .custom(value => {
            const validValues = ['Budget', 'Aktual'];
            if (!validValues.includes(value)) {
              throw new Error('Tipe must be either "Budget" or "Aktual"');
            }
            return true;
        }),

    // Validate tahun (required and integer with length 4)
    body('tahun')
        .isInt({ min: 0 }).withMessage('Tahun must be an integer')
        .isLength({ max: 4 }).withMessage('Tahun should not exceed 4 digits'),

    // Validate kode_pnl_id (required and unsigned integer)
    body('kode_pnl_id')
        .isInt({ min: 0 }).withMessage('Kode PNL ID must be a positive integer'),
]

export const copyPnlGlValidator = [
    // Validate pnl_gl item must be array of object
    check('pnl_gl')
      .isArray()
      .withMessage('Items must be an array')
      .bail()
      .custom((items) => {
        for (let item of items) {
          if (typeof item.domain !== 'number' || item.domain <= 0) {
            throw new Error('Each PNL GL must have a valid Domain');
          }
          if (typeof item.tipe !== 'string' || item.tipe.trim() === '') {
            throw new Error('Each PNL GL must have a valid Tipe');
          }
          if(typeof item.kode_pnl_id !== 'number' || item.kode_pnl_id <= 0){
            throw new Error('Each PNL GL must have a valid Kode PNL')
          }
          if(typeof item.gl_id !== 'number' || item.gl_id <= 0){
            throw new Error('Each PNL GL must have a valid GL Code')
          }
        }
        return true;
      }),
    
    // Validate tahun (required and integer with length 4)
    body('tahun')
     .isInt({ min: 0 }).withMessage('Tahun must be an integer')
     .isLength({ max: 4 }).withMessage('Tahun should not exceed 4 digits'),

    // Validate empid must be an integer
    body('empid')
        .isInt({ min: 1 }).withMessage('Domain must be an integer')
]

export default { 
    createPnlGlValidator, 
    updatePnlGlValidator, 
    IDPnlGlValidator,
    detailPnlGlValidator,
    copyPnlGlValidator,
    listCopyPnlGlValidator,
};