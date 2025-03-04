const Offer = require('../../models/offerSchema');
const Categories = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const mongoose = require('mongoose');

exports.getAllOffers = async (req, res) => {
    try {
        const offers = await Offer.find()
            .populate('Categories')
            .populate('Product');
        const categories = await Categories.find();
        const products = await Product.find();

        console.log('Fetched Offers:', offers);

        res.render('offer', {
            offers,
            categories,
            products,
            editing: false,
            success: req.flash('success'),
            error: req.flash('error'),
            oldInput: {}
        });
    } catch (error) {
        console.error('Error fetching offers:', error);
        req.flash('error', 'Failed to load offers.');
        res.redirect('/admin');
    }
};

exports.getAddOffer = async (req, res) => {
    try {
        const categories = await Categories.find();
        const products = await Product.find();

        res.render('addOffer', {
            editing: false,
            categories,
            products,
            offer: {},
            errorMessage: req.flash('error'),
            validationErrors: [],
            oldInput: req.flash('oldInput')[0] || {}
        });
    } catch (error) {
        console.error('Error loading form:', error);
        req.flash('error', 'Failed to load form data');
        res.redirect('/admin/offers');
    }
};

exports.postAddOffer = async (req, res) => {
    try {
        console.log('Request Body:', req.body);
        console.log('Offer Type:', req.query.type);

        const { name, description, discountType, discountValue, maxDiscount, minimumAmount, startDate, endDate, product, category } = req.body;
        const offerType = req.query.type;

        if (!name || !discountType || !discountValue || !startDate || !endDate) {
            throw new Error('Please fill in all required fields');
        }

        if (name.length < 3 || name.length > 30) {
            throw new Error('Offer name must be between 3 and 30 characters');
        }

        if (!['percentage', 'fixed'].includes(discountType)) {
            throw new Error('Invalid discount type');
        }

        const discountValueNum = parseFloat(discountValue);
        if (isNaN(discountValueNum) || discountValueNum < 0) {
            throw new Error('Discount value must be a positive number');
        }
        if (discountType === 'percentage' && discountValueNum > 100) {
            throw new Error('Percentage discount cannot exceed 100');
        }

        const minimumAmountNum = parseFloat(minimumAmount || 0);
        if (isNaN(minimumAmountNum) || minimumAmountNum < 0) {
            throw new Error('Minimum amount must be a positive number');
        }

        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        const currentDate = new Date();

        if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
            throw new Error('Invalid date format');
        }
        if (startDateObj < currentDate) {
            throw new Error('Start date cannot be in the past');
        }
        if (endDateObj <= startDateObj) {
            throw new Error('End date must be after start date');
        }

        let productArray = [];
        let categoryArray = [];

        if (offerType === 'product') {
            if (!product) throw new Error('Please select a product');
            const productIdArray = Array.isArray(product) ? product : [product];
            for (const prodId of productIdArray) {
                if (!mongoose.Types.ObjectId.isValid(prodId)) throw new Error(`Invalid product ID: ${prodId}`);
                const existingProduct = await Product.findById(prodId);
                if (!existingProduct) throw new Error(`Product not found: ${prodId}`);
                productArray.push(prodId);
            }
        } else if (offerType === 'category') {
            if (!category) throw new Error('Please select a category');
            const categoryIdArray = Array.isArray(category) ? category : [category];
            for (const catId of categoryIdArray) {
                if (!mongoose.Types.ObjectId.isValid(catId)) throw new Error(`Invalid category ID: ${catId}`);
                const existingCategory = await Categories.findById(catId);
                if (!existingCategory) throw new Error(`Category not found: ${catId}`);
                categoryArray.push(catId);
            }
        } else {
            throw new Error('Invalid offer type');
        }

        const offerData = {
            name,
            description: description || '',
            discountType,
            discountValue: discountValueNum,
            minimumAmount: minimumAmountNum,
            maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
            startDate: startDateObj,
            endDate: endDateObj,
            isActive: true,
            Categories: categoryArray,
            Product: productArray
        };

        const newOffer = new Offer(offerData);
        await newOffer.save();

        res.status(200).json({ message: 'Offer created successfully' });
    } catch (error) {
        console.error('Error creating offer:', error);
        res.status(400).json({ message: error.message });
    }
};

exports.getEditOffer = async (req, res) => {
    try {
        console.log('Editing offer ID:', req.params.id);
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            throw new Error('Invalid offer ID');
        }

        const offer = await Offer.findById(req.params.id)
            .populate('Categories')
            .populate('Product');
        if (!offer) {
            throw new Error('Offer not found');
        }

        const categories = await Categories.find();
        const products = await Product.find();

        res.render('addOffer', {
            editing: true,
            offer,
            categories,
            products,
            errorMessage: req.flash('error'),
            validationErrors: [],
            oldInput: req.flash('oldInput')[0] || offer
        });
    } catch (error) {
        console.error('Error loading offer:', error);
        req.flash('error', error.message);
        res.redirect('/admin/offers');
    }
};

exports.postEditOffer = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            throw new Error('Invalid offer ID');
        }

        const offer = await Offer.findById(req.params.id);
        if (!offer) {
            throw new Error('Offer not found');
        }

        const { name, description, discountType, discountValue, maxDiscount, minimumAmount, startDate, endDate, product, category } = req.body;

        if (!name || !discountType || !discountValue || !startDate || !endDate) {
            throw new Error('Please fill in all required fields');
        }

        if (name.length < 3 || name.length > 30) {
            throw new Error('Offer name must be between 3 and 30 characters');
        }

        if (!['percentage', 'fixed'].includes(discountType)) {
            throw new Error('Invalid discount type');
        }

        const discountValueNum = parseFloat(discountValue);
        if (isNaN(discountValueNum) || discountValueNum < 0) {
            throw new Error('Discount value must be a positive number');
        }
        if (discountType === 'percentage' && discountValueNum > 100) {
            throw new Error('Percentage discount cannot exceed 100');
        }

        const minimumAmountNum = parseFloat(minimumAmount || 0);
        if (isNaN(minimumAmountNum) || minimumAmountNum < 0) {
            throw new Error('Minimum amount must be a positive number');
        }

        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
            throw new Error('Invalid date format');
        }
        if (endDateObj <= startDateObj) {
            throw new Error('End date must be after start date');
        }

        let productArray = [];
        let categoryArray = [];
        const offerType = offer.Product.length > 0 ? 'product' : 'category';

        if (offerType === 'product' && product) {
            const productIdArray = Array.isArray(product) ? product : [product];
            for (const prodId of productIdArray) {
                if (!mongoose.Types.ObjectId.isValid(prodId)) throw new Error('Invalid product ID');
                const existingProduct = await Product.findById(prodId);
                if (!existingProduct) throw new Error('Selected product does not exist');
                productArray.push(prodId);
            }
        } else if (offerType === 'category' && category) {
            const categoryIdArray = Array.isArray(category) ? category : [category];
            for (const catId of categoryIdArray) {
                if (!mongoose.Types.ObjectId.isValid(catId)) throw new Error('Invalid category ID');
                const existingCategory = await Categories.findById(catId);
                if (!existingCategory) throw new Error('Selected category does not exist');
                categoryArray.push(catId);
            }
        }

        offer.name = name;
        offer.description = description || '';
        offer.discountType = discountType;
        offer.discountValue = discountValueNum;
        offer.minimumAmount = minimumAmountNum;
        offer.maxDiscount = maxDiscount ? parseFloat(maxDiscount) : null;
        offer.startDate = startDateObj;
        offer.endDate = endDateObj;
        offer.isActive = req.body.isActive === 'on';
        offer.Categories = categoryArray.length ? categoryArray : offer.Categories;
        offer.Product = productArray.length ? productArray : offer.Product;

        await offer.save();

        req.flash('success', 'Offer updated successfully');
        res.redirect('/admin/offers');
    } catch (error) {
        console.error('Error updating offer:', error);
        const categories = await Categories.find();
        const products = await Product.find();

        res.render('addOffer', {
            editing: true,
            offer: { _id: req.params.id, ...req.body },
            categories,
            products,
            errorMessage: error.message,
            validationErrors: [{ msg: error.message }],
            oldInput: req.body
        });
    }
};