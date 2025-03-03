const Offer = require('../../models/offerSchema');
const Categories = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const mongoose = require('mongoose');

exports.getAllOffers = async (req, res) => {
    try {
        // Fetch offers and populate Categories and Product fields
        const offers = await Offer.find()
            .populate('Categories') 
            .populate('Product');   

        const categories = await Categories.find(); 
        const products = await Product.find();     

        // Log the fetched offers for debugging
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
        // Log the incoming request body for debugging
        console.log('Request Body:', req.body);
        console.log('Offer Type:', req.query.type);

        const { name, description, discountType, discountValue, maxDiscount, minimumAmount, startDate, endDate, product, category } = req.body;
        const offerType = req.query.type; 

        // Validation for required fields
        if (!name || !discountType || !discountValue || !startDate || !endDate) {
            throw new Error('Please fill in all required fields (name, discountType, discountValue, startDate, endDate)');
        }

        // Validate offer name
        if (name.length < 3 || name.length > 30) {
            throw new Error('Offer name must be between 3 and 30 characters');
        }

        // Validate discount type
        if (!['percentage', 'fixed'].includes(discountType)) {
            throw new Error('Invalid discount type. Must be "percentage" or "fixed"');
        }

        // Validate discount value
        const discountValueNum = parseFloat(discountValue);
        if (isNaN(discountValueNum) || discountValueNum < 0) {
            throw new Error('Discount value must be a positive number');
        }
        if (discountType === 'percentage' && discountValueNum > 100) {
            throw new Error('Percentage discount cannot exceed 100');
        }

        // Validate minimum amount
        const minimumAmountNum = parseFloat(minimumAmount);
        if (isNaN(minimumAmountNum) || minimumAmountNum < 0) {
            throw new Error('Minimum amount must be a positive number');
        }

        // Validate dates
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        const currentDate = new Date();

        if (isNaN(startDateObj.getTime())) {
            throw new Error('Invalid start date format');
        }
        if (isNaN(endDateObj.getTime())) {
            throw new Error('Invalid end date format');
        }

        if (startDateObj < currentDate) {
            throw new Error('Start date cannot be in the past');
        }
        if (endDateObj <= startDateObj) {
            throw new Error('End date must be after start date');
        }

        // Validate product or category based on offer type
        let productArray = [];
        let categoryArray = [];

        if (offerType === 'product') {
            if (!product) {
                throw new Error('Please select a product');
            }
            const productIdArray = Array.isArray(product) ? product : [product];
            for (const prodId of productIdArray) {
                if (!mongoose.Types.ObjectId.isValid(prodId)) {
                    throw new Error(`Invalid product ID provided: ${prodId}`);
                }
                const existingProduct = await Product.findById(prodId);
                if (!existingProduct) {
                    throw new Error(`Selected product does not exist: ${prodId}`);
                }
                productArray.push(prodId);
            }
        } else if (offerType === 'category') {
            if (!category) {
                throw new Error('Please select a category');
            }
            const categoryIdArray = Array.isArray(category) ? category : [category];
            for (const catId of categoryIdArray) {
                if (!mongoose.Types.ObjectId.isValid(catId)) {
                    throw new Error(`Invalid category ID provided: ${catId}`);
                }
                const existingCategory = await Categories.findById(catId);
                if (!existingCategory) {
                    throw new Error(`Selected category does not exist: ${catId}`);
                }
                categoryArray.push(catId);
            }
        } else {
            throw new Error('Invalid offer type');
        }

        // Prepare offer data
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

        // Respond with JSON for fetch requests
        res.status(200).json({ message: 'Offer created successfully' });

    } catch (error) {
        console.error('Error creating offer:', error);
        // Respond with JSON error for fetch requests
        res.status(400).json({ message: error.message });
    }
};

exports.getEditOffer = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            throw new Error('Invalid offer ID');
        }

        const offer = await Offer.findById(req.params.id);
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

        // Validation for required fields
        if (!name || !discountType || !discountValue || !startDate || !endDate) {
            throw new Error('Please fill in all required fields');
        }

        // Validate offer name
        if (name.length < 3 || name.length > 30) {
            throw new Error('Offer name must be between 3 and 30 characters');
        }

        // Validate discount type
        if (!['percentage', 'fixed'].includes(discountType)) {
            throw new Error('Invalid discount type');
        }

        // Validate discount value
        const discountValueNum = parseFloat(discountValue);
        if (isNaN(discountValueNum) || discountValueNum < 0) {
            throw new Error('Discount value must be a positive number');
        }
        if (discountType === 'percentage' && discountValueNum > 100) {
            throw new Error('Percentage discount cannot exceed 100%');
        }

        // Validate minimum amount
        const minimumAmountNum = parseFloat(minimumAmount);
        if (isNaN(minimumAmountNum) || minimumAmountNum < 0) {
            throw new Error('Minimum amount must be a positive number');
        }

        // Validate dates
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);

        if (endDateObj <= startDateObj) {
            throw new Error('End date must be after start date');
        }

        // Validate product or category based on existing offer
        let productArray = [];
        let categoryArray = [];

        if (product) {
            const productIdArray = Array.isArray(product) ? product : [product];
            for (const prodId of productIdArray) {
                if (!mongoose.Types.ObjectId.isValid(prodId)) {
                    throw new Error('Invalid product ID provided');
                }
                const existingProduct = await Product.findById(prodId);
                if (!existingProduct) {
                    throw new Error('Selected product does not exist');
                }
                productArray.push(prodId);
            }
        }

        if (category) {
            const categoryIdArray = Array.isArray(category) ? category : [category];
            for (const catId of categoryIdArray) {
                if (!mongoose.Types.ObjectId.isValid(catId)) {
                    throw new Error('Invalid category ID provided');
                }
                const existingCategory = await Categories.findById(catId);
                if (!existingCategory) {
                    throw new Error('Selected category does not exist');
                }
                categoryArray.push(catId);
            }
        }

        // Update offer data
        offer.name = name;
        offer.description = description || '';
        offer.discountType = discountType;
        offer.discountValue = discountValueNum;
        offer.minimumAmount = minimumAmountNum;
        offer.maxDiscount = maxDiscount ? parseFloat(maxDiscount) : null;
        offer.startDate = startDateObj;
        offer.endDate = endDateObj;
        offer.isActive = req.body.isActive === 'on';
        offer.Categories = categoryArray;
        offer.Product = productArray;

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