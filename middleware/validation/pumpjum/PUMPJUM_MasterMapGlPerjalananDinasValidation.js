import { body, query, check } from "express-validator";

export const createMasterMapGlPerjalananDinasValidation = [
    body('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    body('empid')
        .notEmpty().withMessage('empid is required')
        .isString().withMessage('empid must be a string'),
        
    body('on_duty_type')
        .notEmpty().withMessage('on_duty_type is required')
        .isString().withMessage('on_duty_type must be a string'),

    body('on_duty_item_code')
        .notEmpty().withMessage('on_duty_item_code is required')
        .isString().withMessage('on_duty_item_code must be a string'),

    body('on_duty_item_name')
        .notEmpty().withMessage('on_duty_item_name is required')
        .isString().withMessage('on_duty_item_name must be a string'),

    body('gl_id')
        .notEmpty().withMessage('gl_id is required')
        .isString().withMessage('gl_id must be a string'),

    body('subacc_id')
        .notEmpty().withMessage('subacc_id is required')
        .isString().withMessage('subacc_id must be a string'),

    body('supplier')
        .notEmpty().withMessage('supplier is required')
        .isString().withMessage('supplier must be a string'),
]

export const editMasterMapGlPerjalananDinasValidation = [
    body('id')
        .notEmpty().withMessage('id is required')
        .isString().withMessage('id must be a string'),

    body('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    body('empid')
        .notEmpty().withMessage('empid is required')
        .isString().withMessage('empid must be a string'),
        
    body('on_duty_type')
        .notEmpty().withMessage('on_duty_type is required')
        .isString().withMessage('on_duty_type must be a string'),

    body('on_duty_item_code')
        .notEmpty().withMessage('on_duty_item_code is required')
        .isString().withMessage('on_duty_item_code must be a string'),

    body('on_duty_item_name')
        .notEmpty().withMessage('on_duty_item_name is required')
        .isString().withMessage('on_duty_item_name must be a string'),

    body('gl_id')
        .notEmpty().withMessage('gl_id is required')
        .isString().withMessage('gl_id must be a string'),

    body('subacc_id')
        .notEmpty().withMessage('subacc_id is required')
        .isString().withMessage('subacc_id must be a string'),

    body('supplier')
        .notEmpty().withMessage('supplier is required')
        .isString().withMessage('supplier must be a string'),
]

export default {
    createMasterMapGlPerjalananDinasValidation,
    editMasterMapGlPerjalananDinasValidation,
}