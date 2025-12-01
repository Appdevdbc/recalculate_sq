import { query, body } from "express-validator";

export const deleteMapActualVolume = [
    // Validate domain (required and integer with length 4)
    query('domain')
        .isInt({ min: 0 }).withMessage('domain must be an integer')
        .isLength({ max: 4 }).withMessage('domain should not exceed 4 digits'),

    // Validate group produk)
    query('group_product')
        .notEmpty().withMessage('group_product is required')
        .isString().withMessage('group_product must be a string')
];

export const createMapActualVolume = [
    body('group_produk')
        .notEmpty().withMessage('Group Produk kolom wajib diisi.')  // Check if the field is not empty
        .isString().withMessage('Group Produk harus berupa string.'),  // Ensure the value is a string

    body('kategori')
        .notEmpty().withMessage('Kategori kolom wajib diisi.')  // Check if the field is not empty
        .isString().withMessage('Kategori harus berupa string.')  // Ensure the value is a string
        .isLength({ max: 100 }).withMessage('Kategori maksimal 100 karakter.'),  // Max length of 100 characters
]

export const IDMapActualVolume = [
    // Validate map_aktual_id (required and integer)
    query('map_aktual_id')
        .isInt({ min: 0 }).withMessage('map_aktual_id must be an integer')
];

export default {
    deleteMapActualVolume,
    createMapActualVolume,
    IDMapActualVolume,
}