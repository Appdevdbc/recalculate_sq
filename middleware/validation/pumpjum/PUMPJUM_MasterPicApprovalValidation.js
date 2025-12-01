import { body, query, check } from "express-validator";

export const createMasterPicApprovalValidation = [
    body('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    body('empid')
        .notEmpty().withMessage('empid is required')
        .isString().withMessage('empid must be a string'),

    check('site')
        .isArray({ min: 1 }).withMessage('site must be an array')
        .bail()
        .custom((arr) => {
            const allStrings = arr.every(item => typeof item === 'string');
            if (!allStrings) {
                throw new Error('All site values must be strings');
            }
            return true;
        }),

    body('type_pum')
        .notEmpty().withMessage('type_pum is required')
        .isString().withMessage('type_pum must be a string'),

    body('type_approval_id')
        .notEmpty().withMessage('type_approval_id is required')
        .isString().withMessage('type_approval_id must be a string'),

    body('employee_id')
        .notEmpty().withMessage('employee_id is required')
        .isString().withMessage('employee_id must be a string'),

    body('level')
        .notEmpty().withMessage('level is required')
        .isInt({ min: 0 }).withMessage('Level must be an integer'),
]

export const editMasterPicApprovalValidation = [
    body('id')
        .notEmpty().withMessage('id is required')
        .isString().withMessage('id must be a string'),

    body('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    body('empid')
        .notEmpty().withMessage('empid is required')
        .isString().withMessage('empid must be a string'),

    check('site')
        .isArray({ min: 1 }).withMessage('site must be an array')
        .bail()
        .custom((arr) => {
            const allStrings = arr.every(item => typeof item === 'string');
            if (!allStrings) {
                throw new Error('All site values must be strings');
            }
            return true;
        }),
        
    body('type_pum')
        .notEmpty().withMessage('type_pum is required')
        .isString().withMessage('type_pum must be a string'),

    body('type_approval_id')
        .notEmpty().withMessage('type_approval_id is required')
        .isString().withMessage('type_approval_id must be a string'),

    body('employee_id')
        .notEmpty().withMessage('employee_id is required')
        .isString().withMessage('employee_id must be a string'),

    body('level')
        .notEmpty().withMessage('level is required')
        .isInt({ min: 0 }).withMessage('Level must be an integer'),
]

export default {
    createMasterPicApprovalValidation,
    editMasterPicApprovalValidation,
}