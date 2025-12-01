import { body, query, check } from "express-validator";

export const createMasterNumberingPumValidation = [
    body('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    body('empid')
        .notEmpty().withMessage('empid is required')
        .isString().withMessage('empid must be a string'),

    body('start_year')
        .isInt({ min: 0 }).withMessage('Start year must be an integer')
        .isLength({ max: 4 }).withMessage('Start year should not exceed 4 digits'),

    body('start_numbering')
        .notEmpty().withMessage('start numbering is required')
        .isString().withMessage('start numbering must be a string'),
]

export const editMasterNumberingPumValidation = [
    body('id')
        .notEmpty().withMessage('id is required')
        .isString().withMessage('id must be a string'),

    body('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    body('empid')
        .notEmpty().withMessage('empid is required')
        .isString().withMessage('empid must be a string'),
  
    body('start_year')
        .isInt({ min: 0 }).withMessage('Start year must be an integer')
        .isLength({ max: 4 }).withMessage('Start year should not exceed 4 digits'),

    body('start_numbering')
        .notEmpty().withMessage('Start numbering is required')
        .isString().withMessage('Start numbering must be a string'),
]

export default {
    createMasterNumberingPumValidation,
    editMasterNumberingPumValidation,
}