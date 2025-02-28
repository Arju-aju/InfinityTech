const { body, validationResult } = require('express-validator');
const Coupon = require('../../models/coupounSchema');
const generateCouponCode = require('../../utils/couponGenerator');

// Get all coupons
exports.getAllCoupon = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const totalCoupons = await Coupon.countDocuments();
        const coupons = await Coupon.find().sort({ createdAt: -1 }).skip(skip).limit(limit);

        res.render('coupon', {
            coupons,
            currentPage: page,
            totalPages: Math.ceil(totalCoupons / limit),
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
        const couponCode = generateCouponCode();
        res.render('createCoupon', {
            formData: req.session.formData || { code: couponCode },
            errors: [],
            success: req.flash('success'),
            error: req.flash('error'),
        });
        delete req.session.formData;
    } catch (error) {
        req.flash('error', 'Failed to load create coupon form');
        res.redirect('/admin/coupon');
    }
};

// Validation middleware for creating/updating coupons
const validateCoupon = [
    body('code').trim().notEmpty().withMessage('Coupon code is required').custom(async (value, { req }) => {
        const exists = await Coupon.findOne({ code: value.toUpperCase(), _id: { $ne: req.params.id } });
        if (exists) throw new Error('Coupon code already exists');
        return true;
    }),
    body('discountType').isIn(['percentage', 'fixed']).withMessage('Invalid discount type'),
    body('discountValue').isFloat({ min: 0.01 }).withMessage('Discount value must be a positive number')
        .custom((value, { req }) => {
            if (req.body.discountType === 'percentage' && (value > 100 || value <= 0)) {
                throw new Error('Percentage discount must be between 1 and 100');
            }
            return true;
        }),
    body('maxDiscount').optional().isFloat({ min: 0.01 }).withMessage('Max discount must be a positive number'),
    body('minPurchase').optional().isFloat({ min: 0 }).withMessage('Min purchase must be a positive number'),
    body('expirationDate').isISO8601().withMessage('Valid expiration date required')
        .custom((value) => {
            if (new Date(value) < new Date()) throw new Error('Expiration date must be in the future');
            return true;
        }),
    body('usageLimit').optional().isInt({ min: 1 }).withMessage('Usage limit must be a positive integer'),
    body('status').isIn(['active', 'disabled', 'expired']).withMessage('Invalid status'),
];

// Create coupon
exports.postCreateCoupon = [
    validateCoupon,
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.session.formData = req.body;
            return res.render('createCoupon', {
                errors: errors.array().map(err => err.msg),
                formData: req.body,
                success: req.flash('success'),
                error: req.flash('error'),
            });
        }

        try {
            const { code, discountType, discountValue, maxDiscount, minPurchase, expirationDate, usageLimit, status } = req.body;

            const newCoupon = new Coupon({
                code: code.toUpperCase(),
                discountType,
                discountValue,
                maxDiscount: discountType === 'percentage' ? maxDiscount || null : null,
                minPurchase: minPurchase || 0,
                expirationDate,
                usageLimit: usageLimit || null,
                status,
            });

            await newCoupon.save();
            req.flash('success', 'Coupon created successfully!');
            res.redirect('/admin/coupon');
        } catch (error) {
            req.flash('error', 'Failed to create coupon');
            res.redirect('/admin/coupon');
        }
    }
];

// Render edit coupon form
exports.getEditCouponForm = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            req.flash('error', 'Coupon not found');
            return res.redirect('/admin/coupon');
        }

        res.render('admin/editCoupon', {
            coupon,
            success: req.flash('success'),
            error: req.flash('error'),
            errors: [],
        });
    } catch (error) {
        req.flash('error', 'Failed to load edit form');
        res.redirect('/admin/coupon');
    }
};

// Update coupon
exports.updateCoupon = [
    validateCoupon,
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const coupon = await Coupon.findById(req.params.id);
            return res.render('editCoupon', {
                coupon: { ...coupon._doc, ...req.body },
                errors: errors.array().map(err => err.msg),
                success: req.flash('success'),
                error: req.flash('error'),
            });
        }

        try {
            const { code, discountType, discountValue, maxDiscount, minPurchase, expirationDate, usageLimit, status } = req.body;

            const updatedCoupon = await Coupon.findByIdAndUpdate(
                req.params.id,
                {
                    code: code.toUpperCase(),
                    discountType,
                    discountValue,
                    maxDiscount: discountType === 'percentage' ? maxDiscount || null : null,
                    minPurchase: minPurchase || 0,
                    expirationDate,
                    usageLimit: usageLimit || null,
                    status,
                },
                { new: true }
            );

            if (!updatedCoupon) {
                req.flash('error', 'Coupon not found');
                return res.redirect('/admin/coupon');
            }

            req.flash('success', 'Coupon updated successfully!');
            res.redirect('/admin/coupon');
        } catch (error) {
            req.flash('error', 'Failed to update coupon');
            res.redirect('/admin/coupon');
        }
    }
];

// Delete coupon
exports.deleteCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;
        const deletedCoupon = await Coupon.findByIdAndDelete(couponId);

        if (!deletedCoupon) return res.status(404).json({ error: 'Coupon not found' });

        res.status(200).json({ message: 'Coupon deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete coupon' });
    }
};