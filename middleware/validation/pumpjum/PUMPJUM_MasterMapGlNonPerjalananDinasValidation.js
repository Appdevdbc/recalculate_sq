import { body, query, check } from "express-validator";

const allowNullOrString = field =>
  body(field)
    .optional({ nullable: true })
    .custom(v => v === null || typeof v === 'string')
    .withMessage(`${field} must be a string or null`);

export const createMasterMapGlNonPerjalananDinasValidation = [
    body('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    body('empid')
        .notEmpty().withMessage('empid is required')
        .isString().withMessage('empid must be a string'),
        
    body('um_type_id')
        .notEmpty().withMessage('um_type_id is required')
        .isInt().withMessage('um_type_id must be a string'),

    body('payment_method_id')
        .notEmpty().withMessage('payment_method_id is required')
        .isInt().withMessage('payment_method_id must be a string'),

    body('gl_id')
        .notEmpty().withMessage('gl_id is required')
        .isString().withMessage('gl_id must be a string'),

    allowNullOrString('subacc_id'),

    allowNullOrString('prodline_id'),
]

export const editMasterMapGlNonPerjalananDinasValidation = [
    body('id')
        .notEmpty().withMessage('id is required')
        .isString().withMessage('id must be a string'),

    body('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    body('empid')
        .notEmpty().withMessage('empid is required')
        .isString().withMessage('empid must be a string'),
        
    body('um_type_id')
        .notEmpty().withMessage('um_type_id is required')
        .isInt().withMessage('um_type_id must be a string'),

    body('payment_method_id')
        .notEmpty().withMessage('payment_method_id is required')
        .isInt().withMessage('payment_method_id must be a string'),

    body('gl_id')
        .notEmpty().withMessage('gl_id is required')
        .isString().withMessage('gl_id must be a string'),

    allowNullOrString('subacc_id'),

    allowNullOrString('prodline_id'),
]

export default {
    createMasterMapGlNonPerjalananDinasValidation,
    editMasterMapGlNonPerjalananDinasValidation,
}