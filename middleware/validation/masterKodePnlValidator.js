import { body } from 'express-validator';

// Validate Create PNL GL
export const createKodePnlValidator = [
    body('tipe').isString().withMessage('Tipe must be a string'),
    body('group').isString().withMessage('Group must be a string'),
    body('detail').isString().withMessage('Detail must be a string'),
    body('domain')
        .isInt({ min: 0 }).withMessage('Domain must be an integer')
        .isLength({ max: 4 }).withMessage('Domain should not exceed 4 digits'),
    body('empid').isString().withMessage('Tipe must be a string')
];

export default { 
    createKodePnlValidator
};