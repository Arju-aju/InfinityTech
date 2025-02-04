const Product = require('../../models/productSchema');
const LaptopCategory = require('../../models/categorySchema');
const User = require('../../models/userSchema'); // Add this line

// Get Home Page Products
const getHomePageProducts = async (req, res) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const newArrivals = await Product.find({ 
            isListed: true,
            isDeleted: false,
            createdAt: { $gte: sevenDaysAgo }
        })
        .sort({ createdAt: -1 })
        .limit(8);

        const featuredProducts = await Product.find({ 
            isListed: true,
            isDeleted: false,
            discount: { $gt: 56 }
        })
        .sort({ discount: -1 })
        .limit(8);

        const topSellingProducts = await Product.find({ 
            isListed: true,
            isDeleted: false
        })
        .sort({ salesCount: -1 })
        .limit(8);

        const dealProducts = await Product.find({ 
            isListed: true,
            isDeleted: false,
            discount: { $gt: 0 }
        })
        .sort({ discount: -1 })
        .limit(8);

        res.render('user/home', {
            newArrivals,
            featuredProducts,
            topSellingProducts,
            dealProducts,
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });
     

    } catch (error) {
        console.error('Error in getHomePageProducts:', error);
        req.flash('error', 'Error loading home page');
        res.redirect('/');
    }
};

// Get Single Product Details

const getSingleProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findOne({
            _id: productId,
            isListed: true,
            isDeleted: false
        }).populate('category');

        if (!product) {
            req.flash('error', 'Product not found or unavailable');
            return res.redirect('/shop');
        }

        const discountedPrice = product.price - (product.price * (product.discountPercentage / 100));

        const recommendedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: product._id },
            isListed: true,
            isDeleted: false
        })
        .populate('category')
        .limit(4)
        .sort('-createdAt')
        .lean();

        recommendedProducts.forEach(prod => {
            prod.discountedPrice = prod.price - (prod.price * (prod.discountPercentage / 100));
        });

        res.render('user/product', {
            product: {
                ...product.toObject(),
                discountedPrice
            },
            recommendedProducts,
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });
    } catch (error) {
        console.error('Error in getSingleProduct:', error);
        req.flash('error', 'Error loading product details');
        res.redirect('/shop');
    }
};


// Get All Categories
const getAllCategories = async (req, res) => {
    try {
        const categories = await LaptopCategory.find()
            .sort('name')
            .lean();

        // Get product count for each category
        const categoriesWithCount = await Promise.all(categories.map(async category => {
            const count = await Product.countDocuments({ category: category._id });
            return { ...category, productCount: count };
        }));

        res.render('user/categories', {
            categories: categoriesWithCount,
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });
    } catch (error) {
        console.error('Error in getAllCategories:', error);
        req.flash('error', 'Error loading categories');
        res.redirect('/');
    }
};

// Get Category Products
const getCategoryProducts = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        const category = await LaptopCategory.findById(categoryId);
        if (!category) {
            req.flash('error', 'Category not found');
            return res.redirect('/categories');
        }

        const [products, totalProducts] = await Promise.all([
            Product.find({ 
                category: categoryId,
                isListed: true,
                isDeleted: false
            })
            .populate('category')
            .skip(skip)
            .limit(limit)
            .sort('-createdAt')
            .lean(),
            Product.countDocuments({ 
                category: categoryId,
                isListed: true,
                isDeleted: false
            })
        ]);

        products.forEach(product => {
            product.discountedPrice = product.price - (product.price * (product.discountPercentage / 100));
        });

        const totalPages = Math.ceil(totalProducts / limit);

        res.render('user/categoryProducts', {
            category,
            products,
            currentPage: page,
            totalPages,
            totalProducts,
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });
    } catch (error) {
        console.error('Error in getCategoryProducts:', error);
        req.flash('error', 'Error loading category products');
        res.redirect('/categories');
    }
};
// Load Shop Page
const loadShop = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;
        const selectedCategory = req.query.category || null; // Get the selected category from query

        // Build filter object
        const filter = { isListed: true };
        if (selectedCategory) {
            filter.category = selectedCategory;
        }

        const [products, totalProducts, categories] = await Promise.all([
            Product.find(filter)
                .populate('category')
                .skip(skip)
                .limit(limit)
                .sort('-createdAt')
                .lean(),
            Product.countDocuments(filter),
            LaptopCategory.find().sort('name').lean()
        ]);

        // Calculate discounted prices
        products.forEach(product => {
            product.discountedPrice = product.price - (product.price * (product.discountPercentage / 100));
        });

        const totalPages = Math.ceil(totalProducts / limit);

        res.render('user/shop', {
            products,
            categories,
            currentPage: page,
            totalPages,
            totalProducts,
            selectedCategory, // Pass selectedCategory to the template
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });
    } catch (error) {
        console.error('Error in loadShop:', error);
        req.flash('error', 'Error loading shop page');
        res.redirect('/');
    }
};

// Search Products
const searchProducts = async (req, res) => {
    try {
        const searchQuery = req.query.q;
        const products = await Product.find({
            isListed: true,
            isDeleted: false,
            $or: [
                { name: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } }
            ]
        })
        .populate('category')
        .lean();

        products.forEach(product => {
            product.discountedPrice = product.price - (product.price * (product.discountPercentage / 100));
        });

        res.render('user/search', {
            products,
            searchQuery,
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });
    } catch (error) {
        console.error('Error in searchProducts:', error);
        req.flash('error', 'Error searching products');
        res.redirect('/shop');
    }
};

// Cart and Wishlist Functions
const addToCart = async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;
        const userId = req.session.user._id;

        const product = await Product.findOne({ 
            _id: productId,
            isListed: true,
            isDeleted: false
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found or unavailable'
            });
        }

        const price = product.price;
        const discountedPrice = price - (price * (product.discountPercentage / 100));

        const user = await User.findById(userId);
        const existingCartItem = user.cart.find(item => 
            item.product.toString() === productId
        );

        if (existingCartItem) {
            existingCartItem.quantity += parseInt(quantity);
        } else {
            user.cart.push({
                product: productId,
                quantity: parseInt(quantity),
                price: discountedPrice
            });
        }

        await user.save();
        res.json({
            success: true,
            message: 'Product added to cart successfully'
        });
    } catch (error) {
        console.error('Error in addToCart:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding product to cart'
        });
    }
};

const addToWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.session.user._id;

        // Find the product
        const product = await Product.findById(productId);
        if (!product || product.isDeleted) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Add to wishlist logic
        const user = await User.findById(userId);
        if (user.wishlist.includes(productId)) {
            return res.json({
                success: false,
                message: 'Product already in wishlist'
            });
        }

        user.wishlist.push(productId);
        await user.save();

        res.json({
            success: true,
            message: 'Product added to wishlist successfully'
        });
    } catch (error) {
        console.error('Error in addToWishlist:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding product to wishlist'
        });
    }
};

const getCart = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId)
            .populate({
                path: 'cart.product',
                select: 'name images price discountPercentage'
            });

        const cartItems = user.cart.map(item => {
            const product = item.product;
            const price = product.price;
            const discountedPrice = price - (price * (product.discountPercentage / 100));
            return {
                ...item.toObject(),
                product,
                discountedPrice,
                total: discountedPrice * item.quantity
            };
        });

        const cartTotal = cartItems.reduce((total, item) => total + item.total, 0);

        res.render('user/cart', {
            cartItems,
            cartTotal,
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });
    } catch (error) {
        console.error('Error in getCart:', error);
        req.flash('error', 'Error loading cart');
        res.redirect('/');
    }
};

const getWishlist = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId)
            .populate({
                path: 'wishlist',
                select: 'name images price discountPercentage',
                match: { isDeleted: false }
            });

        const wishlistItems = user.wishlist.map(product => {
            const price = product.price;
            const discountedPrice = price - (price * (product.discountPercentage / 100));
            return {
                ...product.toObject(),
                discountedPrice
            };
        });

        res.render('user/wishlist', {
            wishlistItems,
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });
    } catch (error) {
        console.error('Error in getWishlist:', error);
        req.flash('error', 'Error loading wishlist');
        res.redirect('/');
    }
};

const removeFromCart = async (req, res) => {
    try {
        const { productId } = req.params;
        const userId = req.session.user._id;

        const user = await User.findById(userId);
        user.cart = user.cart.filter(item => 
            item.product.toString() !== productId
        );
        await user.save();

        res.json({
            success: true,
            message: 'Product removed from cart successfully'
        });
    } catch (error) {
        console.error('Error in removeFromCart:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing product from cart'
        });
    }
};

const removeFromWishlist = async (req, res) => {
    try {
        const { productId } = req.params;
        const userId = req.session.user._id;

        const user = await User.findById(userId);
        user.wishlist = user.wishlist.filter(id => 
            id.toString() !== productId
        );
        await user.save();

        res.json({
            success: true,
            message: 'Product removed from wishlist successfully'
        });
    } catch (error) {
        console.error('Error in removeFromWishlist:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing product from wishlist'
        });
    }
};

const updateCartQuantity = async (req, res) => {
    try {
        const { productId } = req.params;
        const { quantity } = req.body;
        const userId = req.session.user._id;

        const user = await User.findById(userId);
        const cartItem = user.cart.find(item => 
            item.product.toString() === productId
        );

        if (!cartItem) {
            return res.status(404).json({
                success: false,
                message: 'Product not found in cart'
            });
        }

        cartItem.quantity = parseInt(quantity);
        await user.save();

        res.json({
            success: true,
            message: 'Cart quantity updated successfully'
        });
    } catch (error) {
        console.error('Error in updateCartQuantity:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating cart quantity'
        });
    }
};

module.exports = {
    getHomePageProducts,
    getSingleProduct,
    getAllCategories,
    getCategoryProducts,
    loadShop,
    searchProducts,
    addToCart,
    addToWishlist,
    getCart,
    getWishlist,
    removeFromCart,
    removeFromWishlist,
    updateCartQuantity
};
