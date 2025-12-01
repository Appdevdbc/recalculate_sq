import { body, query, check } from "express-validator";

export const createMasterAmountApprovalValidation = [
    // Validate domain (required and integer with length 4)
    body('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    // Validate empid (required and string)
    body('empid')
        .notEmpty().withMessage('empid is required')
        .isString().withMessage('empid must be a string'),
  
    // Validate amt_min (required and integer)
    body('amt_min')
        .isInt({ min: 0 }).withMessage('Amount Min must be an integer'),
        
    // Validate amt_max (required and integer)
    body('amt_max')
        .isInt({ min: 0 }).withMessage('Amount Max must be an integer')
        .custom((value, { req }) => {
            if (parseInt(value) < parseInt(req.body.amt_min)) {
                throw new Error('Amount Max must be greater than or equal to Amount Min');
            }
            return true;
        }),

    // Validate department_id
    check('department_id')
        .isArray({ min: 1 }).withMessage('department_id must be an array')
        .bail()
        .custom((arr) => {
            const allStrings = arr.every(item => typeof item === 'string');
            if (!allStrings) {
                throw new Error('All department_id values must be strings');
            }
            return true;
        }),
    
    // Validate grade (required and string)
    body('grade')
        .notEmpty().withMessage('grade is required')
        .isString().withMessage('grade must be a string'),
]

export const editMasterAmountApprovalValidation = [
    // Validate amount_approval_id (required and string)
    body('amount_approval_id')
        .notEmpty().withMessage('amount_approval_id is required')
        .isString().withMessage('amount_approval_id must be a string'),

    // Validate domain (required and integer with length 4)
    body('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    // Validate empid (required and string)
    body('empid')
        .notEmpty().withMessage('empid is required')
        .isString().withMessage('empid must be a string'),
  
    // Validate amt_min (required and integer)
    body('amt_min')
        .isInt({ min: 0 }).withMessage('Amount Min must be an integer'),
        
    // Validate amt_max (required and integer)
    body('amt_max')
        .isInt({ min: 0 }).withMessage('Amount Max must be an integer')
        .custom((value, { req }) => {
            if (parseInt(value) < parseInt(req.body.amt_min)) {
                throw new Error('Amount Max must be greater than or equal to Amount Min');
            }
            return true;
        }),

    // Validate department_id
    check('department_id')
        .isArray({ min: 1 }).withMessage('department_id must be an array')
        .bail()
        .custom((arr) => {
            const allStrings = arr.every(item => typeof item === 'string');
            if (!allStrings) {
                throw new Error('All department_id values must be strings');
            }
            return true;
        }),
    
    // Validate grade (required and string)
    body('grade')
        .notEmpty().withMessage('grade is required')
        .isString().withMessage('grade must be a string'),
]

export default {
    createMasterAmountApprovalValidation,
    editMasterAmountApprovalValidation,
}