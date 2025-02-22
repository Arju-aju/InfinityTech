const Product = require('../../models/productSchema');
const LaptopCategory = require('../../models/categorySchema');
const User = require('../../models/userSchema'); 
const Cart = require('../../models/cartSchema');
const { default: mongoose } = require('mongoose');

// Get Home Page Products
const getHomePageProducts = async (req, res) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Fetch active categories
        const activeCategories = await LaptopCategory.find({ isActive: true }).select('_id');
        const activeCategoryIds = activeCategories.map(cat => cat._id);

        const newArrivals = await Product.find({ 
            isListed: true,
            isDeleted: false,
            category: { $in: activeCategoryIds },
            createdAt: { $gte: sevenDaysAgo }
        })
        .sort({ createdAt: -1 })
        .limit(8);

        const featuredProducts = await Product.find({ 
            isListed: true,
            isDeleted: false,
            category: { $in: activeCategoryIds },
            discount: { $gt: 56 }
        })
        .sort({ discount: -1 })
        .limit(8);

        const topSellingProducts = await Product.find({ 
            isListed: true,
            isDeleted: false,
            category: { $in: activeCategoryIds }
        })
        .sort({ salesCount: -1 })
        .limit(8);

        const dealProducts = await Product.find({ 
            isListed: true,
            isDeleted: false,
            category: { $in: activeCategoryIds },
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

        // Fetch the cart items count for the logged-in user
        let cartItemsCount = 0;
        if (req.user) {
            const cart = await Cart.findOne({ user: req.user._id });
            if (cart) {
                cartItemsCount = cart.items.length;
            }
        }

        res.render('user/product', {
            product: {
                ...product.toObject(),
                discountedPrice
            },
            recommendedProducts,
            cartItemsCount, // Pass the cart items count to the template
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
        const categories = await LaptopCategory.find({isActive:true})
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

        // Ensure category is active
        const category = await LaptopCategory.findOne({ _id: categoryId, isActive: true });
        if (!category) {
            req.flash('error', 'Category not found or inactive');
            return res.redirect('/categories');
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

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

        // Get filter parameters
        const selectedCategory = req.query.category || null;
        const sortOption = req.query.sort || 'newest';
        const searchQuery = req.query.search || '';
        const minPrice = parseFloat(req.query.minPrice) || 0;
        const maxPrice = parseFloat(req.query.maxPrice) || Number.MAX_VALUE;

        // Get active categories
        const activeCategories = await LaptopCategory.find({ isActive: true }).select('_id name');
        const activeCategoryIds = activeCategories.map(cat => cat._id);

        // Build filter object
        const filter = {
            isListed: true,
            isDeleted: false,
            category: { $in: activeCategoryIds }
        };

        // Add search query if present
        if (searchQuery) {
            filter.$or = [
                { name: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } }
            ];
        }

        if (selectedCategory) {
            filter.category = selectedCategory;
        }

        // Fetch all products matching the filter
        const allProducts = await Product.find(filter).populate('category').lean();

        // Calculate discounted prices and filter by price range
        const filteredProducts = allProducts
            .map(product => {
                product.discountedPrice = product.price - (product.price * (product.discountPercentage / 100));
                return product;
            })
            .filter(product => {
                return product.discountedPrice >= minPrice && product.discountedPrice <= maxPrice;
            });

        // Define sorting logic based on discountedPrice
        const sortQuery = {
            'price_low_to_high': { discountedPrice: 1 },
            'price_high_to_low': { discountedPrice: -1 },
            'newest': { createdAt: -1 },
            'name_a_to_z': { name: 1 },
            'name_z_to_a': { name: -1 },
            'popularity': { viewCount: -1 },
            'average_rating': { averageRating: -1 }
        }[sortOption] || { createdAt: -1 };

        // Sort the filtered products
        filteredProducts.sort((a, b) => {
            if (sortOption === 'price_low_to_high') return a.discountedPrice - b.discountedPrice;
            if (sortOption === 'price_high_to_low') return b.discountedPrice - a.discountedPrice;
            if (sortOption === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
            if (sortOption === 'name_a_to_z') return a.name.localeCompare(b.name);
            if (sortOption === 'name_z_to_a') return b.name.localeCompare(a.name);
            if (sortOption === 'popularity') return b.viewCount - a.viewCount;
            if (sortOption === 'average_rating') return b.averageRating - a.averageRating;
            return 0;
        });

        // Paginate the sorted and filtered products
        const paginatedProducts = filteredProducts.slice(skip, skip + limit);

        // Get price range for the filter (based on discountedPrice)
        const discountedPrices = filteredProducts.map(product => product.discountedPrice);
        const minPriceInDb = Math.min(...discountedPrices);
        const maxPriceInDb = Math.max(...discountedPrices);

        const totalProducts = filteredProducts.length;
        const totalPages = Math.ceil(totalProducts / limit);

        res.render('user/shop', {
            products: paginatedProducts,
            categories: activeCategories,
            currentPage: page,
            totalPages,
            totalProducts,
            selectedCategory,
            sortOption,
            searchQuery,
            minPrice: minPriceInDb || 0,
            maxPrice: maxPriceInDb || 0,
            selectedMinPrice: minPrice,
            selectedMaxPrice: maxPrice === Number.MAX_VALUE ? maxPriceInDb : maxPrice,
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
                { name: { $regex: searchQuery, $options: 'i' } }, // Case-insensitive search
                { description: { $regex: searchQuery, $options: 'i' } }
            ]
        })
        .populate('category')
        .lean();

        // Calculate discounted price for each product
        products.forEach(product => {
            product.discountedPrice = product.price - (product.price * (product.discountPercentage / 100));
        });

        // If the request accepts JSON (for AJAX), return JSON
        if (req.accepts('json')) {
            return res.json({
                html: `
                    <div class="container mx-auto px-4 py-8">
                        <h1 class="text-2xl font-bold mb-4">Search Results for "${searchQuery}"</h1>
                        ${products.length > 0 ? `
                            <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                ${products.map(product => `
                                    <div class="bg-white rounded-lg shadow-md overflow-hidden">
                                        <img src="${product.imageUrl}" alt="${product.name}" class="w-full h-48 object-cover">
                                        <div class="p-4">
                                            <h2 class="text-lg font-semibold">${product.name}</h2>
                                            <p class="text-gray-600">${product.description}</p>
                                            <div class="mt-4">
                                                <span class="text-lg font-bold">$${product.discountedPrice.toFixed(2)}</span>
                                                ${product.discountPercentage > 0 ? `
                                                    <span class="text-sm text-gray-500 line-through">$${product.price.toFixed(2)}</span>
                                                    <span class="text-sm text-green-600 ml-2">${product.discountPercentage}% off</span>
                                                ` : ''}
                                            </div>
                                            <div class="mt-4">
                                                <a href="/product/${product._id}" class="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">View Product</a>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `
                            <p class="text-gray-600">No products found.</p>
                        `}
                    </div>
                `
            });
        }

        // Render the search results page (for non-AJAX requests)
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



const getWishlst = async (req, res) => {
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


module.exports = {
    getHomePageProducts,
    getSingleProduct,
    getAllCategories,
    getCategoryProducts,
    loadShop,
    searchProducts,
    addToWishlist,
    removeFromWishlist,
};