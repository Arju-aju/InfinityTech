const offer = require('../../models/offerSchema')
const Categories = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const {body, validationResult} = require('express-validator')
const { array } = require('joi')
const { default: mongoose } = require('mongoose')

exports.getAllOffers = async (req, res) => {
    try {
        const offers = await offer.find();
        res.render('offers', {
            offers,
            editing: false 
        });
    } catch (error) {
        console.error('Error fetching offers:', error);
        req.flash('error', 'Failed to load offers.');
        res.redirect('/admin');
    }
};


exports.getAddOffer = async(req,res) => {
    try {
        
        const categories = await Categories.find()
        const products = await Product.find()

        res.render('addOffer', {
            editing :false,
            categories,
            products,
            offer:{},
            errorMessage : req.flash('error'),
            validationErrors: [],
            oldInput : req.flash('oldInput')[0] || {}
        })

    } catch (error) {
        console.error('Error loading form:', error);
        req.flash('error', 'Failed to load form data');
        res.redirect('/admin/offers');
    }
}

exports.postAddOffer = async (req,res) => {
    try {
        
        const {name,discountType , discountValue, startDate, endDate} = req.body

        if(!name || !discountType || !discountValue || !startDate || !endDate){
            throw new Error('Please fill in all  required fields')
        }


        if(name.length < 3 || name.length > 30 ){
            throw new Error('Offer name must be between 3 and 30')
        }

        if(!['percenatge','fixed'].includes(discountType)){
            throw new Error('Invalid Discount Type')
        }


        const discountvalue = parseFloat(discountValue)
        if(isNaN(discountvalue) || discountvalue < 0){
            throw new Error('Discount value must be a positive value')
        }

        if(discountType === 'percentage' && discountvalue >100){
            throw new Error('Percentage discount cannot exceed 100')
        }

        const minimumAmount  = parseFloat(minimumAmount)
        if(isNaN(minimumAmount) || minimumAmount < 0){
            throw new Error('mimum Amount must be positive number') 
        }

        const startdate = new Date(startDate)
        const enddate = new Date(endDate)
        const currentDate = new Date()

        if(startdate < currentDate){
            throw new Error('start date cannot be in the past')
        }
        if(enddate <= startdate){
            throw new Error('End date must be after start date')
        }


        if(req.body.Categories){
            const categories = array.isArray(req.body.Categories)? req.body.Categories : [req.body.Categories]

            for(const catId of categories){

                if(!mongoose.Types.ObjectId.isValid(catId)){
                    throw new Error('Invalid Category is provided')
                }

                const existingCategory =  await Categories.findById(catId)
                if(!existingCategory){
                    throw new Error('One or more category do not exist')
                }
            }
        }

        if(req.body.Product){
            const product =  Array.isArray(req.body.Product) ? req.body.Product :[req.body.Product]

            for (const proId of product){
                if(!mongoose.Types.ObjectId.isValid(prodId)){
                    throw new Error('Invalid Product ID is provided')
                }

            const productExists = await mongoose.model('Product').findById(prodId);
                if (!productExists) {
                    throw new Error('One or more selected products do not exist');
                }
            }
        }

        const offerData = {
            name: req.body.name,
            description: req.body.description || '',
            discountType: req.body.discountType,
            discountValue: discountValue,
            minimumAmount: minimumAmount,
            maxDiscount: req.body.maxDiscount || null,
            startDate: startDate,
            endDate: endDate,
            isActive: req.body.isActive === 'on',
            Categories: req.body.Categories || [],
            Product: req.body.Product || []
        };

        const offer = new Offer(offerData);
        await offer.save();

        req.flash('success', 'Offer created successfully');
        res.redirect('/admin/offers');



    } catch (error) {
        console.error('Error creating offer:', error);
            const categories = await mongoose.model('LaptopCategory').find();
            const products = await mongoose.model('Product').find();

            // Render form with error and old input
            res.render('offers/form', {
                editing: false,
                categories,
                products,
                errorMessage: error.message,
                validationErrors: [{ msg: error.message }],
                oldInput: req.body
            });
        }
}

    
// Show edit offer form

exports.getEditOffer = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            throw new Error('Invalid offer ID');
        }

        const offer = await Offer.findById(req.params.id);
        if (!offer) {
            throw new Error('Offer not found');
        }

        const categories = await mongoose.model('LaptopCategory').find();
        const products = await mongoose.model('Product').find();

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
}  

exports.postEditOffer =  async (req,res) => {
    try {
        
        if(!mongoose.Types.ObjectId.isValid(req.params.id)){
            throw new Error('Invalid offer Id')
        }

        const offer = await Offer.findById(req.params.id)

        if(!offer){
            throw new Error ('Offer not found')
        }

        if(!req.body.name || !req.body.discountType || !req.body.discountValue ||!req.body.startDate || !req.body.endDate){
            throw new Error('Please fill all the required fields')
        }

        if(req.body.name.length < 3 || req.body.name.length > 30 ){
            throw new Error('Offer name must be between 3 and 30')
        }

          // Validate discount type
          if (!['percentage', 'fixed'].includes(req.body.discountType)) {
            throw new Error('Invalid discount type');
        }

        // Validate discount value
        const discountValue = parseFloat(req.body.discountValue);
        if (isNaN(discountValue) || discountValue < 0) {
            throw new Error('Discount value must be a positive number');
        }
        if (req.body.discountType === 'percentage' && discountValue > 100) {
            throw new Error('Percentage discount cannot exceed 100%');
        }

        // Validate minimum amount
        const minimumAmount = parseFloat(req.body.minimumAmount);
        if (isNaN(minimumAmount) || minimumAmount < 0) {
            throw new Error('Minimum amount must be a positive number');
        }

        // Validate dates
        const startDate = new Date(req.body.startDate);
        const endDate = new Date(req.body.endDate);

        if (endDate <= startDate) {
            throw new Error('End date must be after start date');
        }

        // Update offer data
        offer.name = req.body.name;
        offer.description = req.body.description || '';
        offer.discountType = req.body.discountType;
        offer.discountValue = discountValue;
        offer.minimumAmount = minimumAmount;
        offer.maxDiscount = req.body.maxDiscount || null;
        offer.startDate = startDate;
        offer.endDate = endDate;
        offer.isActive = req.body.isActive === 'on';
        offer.Categories = req.body.Categories || [];
        offer.Product = req.body.Product || [];

        await offer.save();
        req.flash('success', 'Offer updated successfully');
        res.redirect('/admin/offers');


    } catch (error) {
        
        console.error('Error updating offer:', error);
            const categories = await mongoose.model('LaptopCategory').find();
            const products = await mongoose.model('Product').find();

            res.render('offers/form', {
                editing: true,
                offer: { _id: req.params.id, ...req.body },
                categories,
                products,
                errorMessage: error.message,
                validationErrors: [{ msg: error.message }],
                oldInput: req.body
            });

    }
}
