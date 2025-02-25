const { body, validationResult } = require('express-validator');
const Coupon = require('../../models/coupounSchema')
const generateCouponCode = require('../../utils/couponGenerator');

// Get all coupons
exports.getAllCoupon = async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        let limit = 5; 
        let skip = (page - 1) * limit;

        const totalCoupons = await Coupon.countDocuments();
        const coupons = await Coupon.find().sort({ createdAt: -1 }).skip(skip).limit(limit);

        res.render('coupon', {
            coupons,
            currentPage: page,
            totalPages: Math.ceil(totalCoupons / limit),
        });
    } catch (error) {
        req.flash('error', 'Failed to fetch coupons');
        res.redirect('/');
    }
};


// Render the create coupon form
exports.getCreateCouponForm = async (req, res) => {
    try {
        const couponCode = generateCouponCode()
        res.render('createCoupon',{
            formData: req.session.formData || {},
            errors: []
        }); 

        delete req.session.formData;

    } catch (error) {
        console.error("Error rendering createCoupon:", error);
        req.flash('error', 'Failed to load the create coupon form');
        res.redirect('/coupon');
    }
};

exports.postCreateCoupon = async (req,res) => {
    try {
        const { code, discountType, discountValue, maxDiscount, minPurchase, expirationDate, usageLimit, status } = req.body;
        console.log('form data>>>>>>>>>>>>>>>',req.body);

        let errors = [];

        // Required field validation
        if (!code || !discountType || !discountValue || !expirationDate) {
            errors.push('All required fields must be filled.');
        }

        // Validate coupon code (Uppercase & Unique)
        const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (existingCoupon) {
            errors.push('Coupon code already exists. Please use a different one.');
        }

        // Validate discount type and value
        if (!['percentage', 'fixed'].includes(discountType)) {
            errors.push('Invalid discount type.');
        }

        if (isNaN(discountValue) || discountValue <= 0) {
            errors.push('Discount value must be a valid positive number.');
        }

        // If percentage, ensure it's between 1-100
        if (discountType === 'percentage' && (discountValue <= 0 || discountValue > 100)) {
            errors.push('Percentage discount must be between 1 and 100.');
        }

        // If percentage discount, maxDiscount must be provided
        if (discountType === 'percentage' && (!maxDiscount || isNaN(maxDiscount) || maxDiscount <= 0)) {
            errors.push('Maximum discount must be a valid positive number when using percentage discount.');
        }

        // Minimum purchase validation
        if (minPurchase && (isNaN(minPurchase) || minPurchase < 0)) {
            errors.push('Minimum purchase must be a positive number.');
        }

        // Expiration date validation
        const today = new Date();
        const expDate = new Date(expirationDate);
        if (expDate < today) {
            errors.push('Expiration date must be in the future.');
        }

        // Usage limit validation
        if (usageLimit && (isNaN(usageLimit) || usageLimit < 1)) {
            errors.push('Usage limit must be a positive integer.');
        }

        // Status validation
        if (!['active', 'disabled'].includes(status)) {
            errors.push('Invalid status.');
        }

        // If errors exist, re-render the form with errors
        if (errors.length > 0) {
            return res.render('admin/createCoupon', { errors, formData: req.body });
        }

        // Save new coupon
        const newCoupon = new Coupon({
            code: code.toUpperCase(),
            discountType,
            discountValue,
            maxDiscount: discountType === 'percentage' ? maxDiscount : null,
            minPurchase: minPurchase || 0,
            expirationDate,
            usageLimit: usageLimit || null,
            status
        });

        await newCoupon.save();
        req.flash('success', 'Coupon created successfully!');
        res.redirect('/admin/coupon');

    } catch (error) {
        console.error('Error creating coupon:', error);
        res.status(500).send('Server Error');
    }
}


exports.deleteCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;
        console.log('coupoun>>>>>>>>>>>.',couponId);
        await Coupon.findByIdAndDelete(couponId);
        res.status(200).json({ message: 'Coupon deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete coupon' });
    }
};

