const { body, validationResult } = require('express-validator');
const Coupon = require('../../models/coupounSchema');


const generateCouponCode = async () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const codeLength = 8;
    let code = '';
    
    // Generate random code
    for (let i = 0; i < codeLength; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    // Check if code already exists
    const existingCoupon = await Coupon.findOne({ code });
    if (existingCoupon) {
        return generateCouponCode(); // Recursively generate new code if it exists
    }
    
    return code;
};

// Get all coupons
exports.getAllCoupon = async (req, res) => {
    try {
        const { search, status } = req.query;
        let query = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } }
            ];
        }

        if (status === 'active') query.isActive = true;
        if (status === 'inactive') query.isActive = false;

        const coupons = await Coupon.find(query).sort({ createdOn: -1 });

        res.render('admin/coupon', {
            coupons,
            success: req.flash('success'),
            error: req.flash('error'),
        });
    } catch (error) {
        req.flash('error', 'Failed to fetch coupons');
        res.redirect('/admin/dashboard');
    }
};

// Render create coupon form
exports.getCreateCouponForm = async (req, res) => {
    try {
        const autoGeneratedCode = await generateCouponCode();
        
        res.render('createCoupon', {
            oldValue: {
                ...req.session.formData,
                code: req.session.formData?.code || autoGeneratedCode // Use existing if present, otherwise new code
            },
            error_msg: req.flash('error'),
        });
        delete req.session.formData;
    } catch (error) {
        req.flash('error', 'Failed to load create coupon form');
        res.redirect('/admin/coupons');
    }
};

// Validation middleware
const validateCoupon = [
    body('name').trim().notEmpty().withMessage('Coupon name is required')
        .custom(async (value, { req }) => {
            const exists = await Coupon.findOne({ name: value, _id: { $ne: req.params?.Id } });
            if (exists) throw new Error('Coupon name already exists');
            return true;
        }),
    body('code').trim().notEmpty().withMessage('Coupon code is required')
        .custom(async (value, { req }) => {
            const exists = await Coupon.findOne({ code: value.toUpperCase(), _id: { $ne: req.params?.Id } });
            if (exists) throw new Error('Coupon code already exists');
            return true;
        }),
    body('offerType').isIn(['percentage', 'flat']).withMessage('Invalid offer type'),
    body('offerValue').isFloat({ min: 0.01 }).withMessage('Offer value must be a positive number')
        .custom((value, { req }) => {
            if (req.body.offerType === 'percentage' && (value > 100 || value <= 0)) {
                throw new Error('Percentage discount must be between 1 and 100');
            }
            return true;
        }),
    body('minimumPrice').isFloat({ min: 0 }).withMessage('Minimum price must be a positive number'),
    body('expiredOn').isISO8601().withMessage('Valid expiration date required')
        .custom((value) => {
            if (new Date(value) < new Date()) throw new Error('Expiration date must be in the future');
            return true;
        }),
    body('usageLimit').optional().isInt({ min: 1 }).withMessage('Usage limit must be a positive integer'),
    body('usagePerUserLimit').isInt({ min: 1 }).withMessage('Usage per user limit must be at least 1'),
];

// Create coupon
exports.postCreateCoupon = [
    validateCoupon,
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.session.formData = req.body;
            req.flash('error', errors.array().map(err => err.msg).join(', '));
            return res.redirect('/admin/add-coupon');
        }

        try {
            const {
                name,
                code = await generateCouponCode(), // Use provided code or generate new one
                offerType,
                offerValue,
                minimumPrice,
                expiredOn,
                usageLimit,
                usagePerUserLimit,
                isActive
            } = req.body;

            const newCoupon = new Coupon({
                name,
                code: code.toUpperCase(),
                offerType,
                offerValue,
                minimumPrice,
                createdOn: new Date(),
                expiredOn,
                isActive: isActive === 'on',
                usageLimit: usageLimit || null,
                usagePerUserLimit: usagePerUserLimit || 1,
            });

            await newCoupon.save();
            req.flash('success', 'Coupon created successfully!');
            res.redirect('/admin/coupons');
        } catch (error) {
            req.flash('error', 'Failed to create coupon');
            res.redirect('/admin/add-coupon');
        }
    }
];

// Render edit coupon form
exports.getEditCouponForm = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.Id);
        if (!coupon) {
            req.flash('error', 'Coupon not found');
            return res.redirect('/admin/coupons');
        }

        res.render('editCoupon', {
            Id: req.params.Id,
            coupon,
            oldValue: {},
            error_msg: req.flash('error'),
        });
    } catch (error) {
        req.flash('error', 'Failed to load edit form');
        res.redirect('/admin/coupons');
    }
};

// Update coupon
exports.updateCoupon = [
    validateCoupon,
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const coupon = await Coupon.findById(req.params.Id);
            req.flash('error', errors.array().map(err => err.msg).join(', '));
            return res.render('editCoupon', {
                Id: req.params.Id,
                coupon,
                oldValue: req.body,
                error_msg: req.flash('error'),
            });
        }

        try {
            const {
                name,
                code,
                offerType,
                offerValue,
                minimumPrice,
                expiredOn,
                usageLimit,
                usagePerUserLimit,
                isActive
            } = req.body;

            const updatedCoupon = await Coupon.findByIdAndUpdate(
                req.params.Id,
                {
                    name,
                    code: code.toUpperCase(),
                    offerType,
                    offerValue,
                    minimumPrice,
                    expiredOn,
                    isActive: isActive === 'on',
                    usageLimit: usageLimit || null,
                    usagePerUserLimit: usagePerUserLimit || 1,
                },
                { new: true }
            );

            if (!updatedCoupon) {
                req.flash('error', 'Coupon not found');
                return res.redirect('/admin/coupons');
            }

            req.flash('success', 'Coupon updated successfully!');
            res.redirect('/admin/coupons');
        } catch (error) {
            req.flash('error', 'Failed to update coupon');
            res.redirect('/admin/coupons');
        }
    }
];

// Delete coupon
exports.deleteCoupon = async (req, res) => {
    try {
        const couponId = req.params.Id;
        const deletedCoupon = await Coupon.findByIdAndDelete(couponId);

        if (!deletedCoupon) {
            req.flash('error', 'Coupon not found');
            return res.redirect('/admin/coupons');
        }

        req.flash('success', 'Coupon deleted successfully');
        res.redirect('/admin/coupons');
    } catch (error) {
        req.flash('error', 'Failed to delete coupon');
        res.redirect('/admin/coupons');
    }
};