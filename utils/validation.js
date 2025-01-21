const { body, validationResult } = require('express-validator');

// User validation rules
const userValidationRules = {
    signup: [
        body('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Please enter a valid email address'),
        body('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long')
            .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])/)
            .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
        body('name')
            .trim()
            .isLength({ min: 2 })
            .withMessage('Name must be at least 2 characters long')
            .matches(/^[a-zA-Z\s]+$/)
            .withMessage('Name can only contain letters and spaces'),
        body('phone')
            .matches(/^\d{10}$/)
            .withMessage('Please enter a valid 10-digit phone number')
    ],
    login: [
        body('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Please enter a valid email address'),
        body('password')
            .notEmpty()
            .withMessage('Password is required')
    ]
};

// Category validation rules
const categoryValidationRules = {
    create: [
        body('name')
            .trim()
            .notEmpty()
            .withMessage('Category name is required')
            .isLength({ min: 2 })
            .withMessage('Category name must be at least 2 characters long'),
        body('description')
            .trim()
            .notEmpty()
            .withMessage('Description is required')
    ],
    update: [
        body('name')
            .trim()
            .notEmpty()
            .withMessage('Category name is required')
            .isLength({ min: 2 })
            .withMessage('Category name must be at least 2 characters long'),
        body('description')
            .trim()
            .notEmpty()
            .withMessage('Description is required')
    ]
};

// Product validation rules
const productValidationRules = {
    create: [
        body('name')
            .trim()
            .notEmpty()
            .withMessage('Product name is required')
            .isLength({ min: 2 })
            .withMessage('Product name must be at least 2 characters long'),
        body('description')
            .trim()
            .notEmpty()
            .withMessage('Description is required'),
        body('price')
            .isFloat({ min: 0 })
            .withMessage('Price must be a positive number'),
        body('category')
            .notEmpty()
            .withMessage('Category is required'),
        body('brand')
            .trim()
            .notEmpty()
            .withMessage('Brand is required')
    ]
};

// Validation middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array().map(err => ({
                field: err.param,
                message: err.msg
            }))
        });
    }
    next();
};

module.exports = {
    userValidationRules,
    categoryValidationRules,
    productValidationRules,
    validate
};
