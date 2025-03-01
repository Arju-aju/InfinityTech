const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const fs = require('fs').promises;
const path = require('path');

// Load Products Page with pagination
const loadProduct = async (req, res) => {
    try {
        let page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 4;
        const { search, category, priceRange, stock, sortBy = '-createdAt', status } = req.query;

        let filterQuery = {};
        if (search) {
            filterQuery.$or = [
                { name: { $regex: search, $options: 'i' } },
                { brand: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        if (category) filterQuery.category = category;
        if (priceRange) {
            const [min, max] = priceRange.split('-').map(Number);
            filterQuery.price = {};
            if (min) filterQuery.price.$gte = min;
            if (max) filterQuery.price.$lte = max;
        }
        if (stock) {
            switch (stock) {
                case 'out': filterQuery.stock = 0; break;
                case 'low': filterQuery.stock = { $gt: 0, $lte: 10 }; break;
                case 'available': filterQuery.stock = { $gt: 10 }; break;
            }
        }
        if (status) {
            if (status === 'active') filterQuery.isDeleted = false;
            if (status === 'inactive') filterQuery.isDeleted = true;
            if (status === 'listed') filterQuery.isListed = true;
            if (status === 'unlisted') filterQuery.isListed = false;
        }

        const skip = (page - 1) * limit;
        const [products, totalProducts, categories] = await Promise.all([
            Product.find(filterQuery).populate('category', 'name').sort(sortBy).skip(skip).limit(limit).lean(),
            Product.countDocuments(filterQuery),
            Category.find().lean()
        ]);

        const totalPages = Math.ceil(totalProducts / limit);

        res.render('admin/products', {
            products,
            categories,
            filters: { search, category, priceRange, stock, sortBy, status },
            pagination: {
                currentPage: page,
                totalPages,
                limit,
                totalProducts,
                startIndex: skip + 1,
                endIndex: Math.min(skip + limit, totalProducts),
                hasPrevPage: page > 1,
                hasNextPage: page < totalPages
            },
            message: req.flash('success')[0] || req.flash('error')[0],
            messageType: req.flash('success').length ? 'success' : 'error'
        });
    } catch (error) {
        console.error('Error in loadProduct:', error);
        req.flash('error', 'Error loading products');
        res.redirect('/admin/dashboard');
    }
};

// Load Add Product Page
const loadAddProduct = async (req, res) => {
    try {
        const categories = await Category.find({ isDeleted: false });
        res.render('admin/addProduct', {
            categories,
            message: req.flash('error')[0] || req.flash('success')[0],
            messageType: req.flash('error').length ? 'error' : 'success'
        });
    } catch (error) {
        console.error('Error in loadAddProduct:', error);
        req.flash('error', 'Error loading add product page');
        res.redirect('/admin/products');
    }
};

// Add New Product
const addProduct = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            throw new Error('At least one product image is required');
        }

        const {
            name, brand, category, price, stock, discountPercentage, description,
            'specifications[processor]': processor,
            'specifications[ram]': ram,
            'specifications[storage]': storage,
            'specifications[graphics]': graphics
        } = req.body;

        const requiredFields = { name, brand, category, price, stock, description, processor, ram, storage, graphics };
        const missingFields = Object.entries(requiredFields).filter(([_, v]) => !v).map(([k]) => k);
        if (missingFields.length) throw new Error(`Missing required fields: ${missingFields.join(', ')}`);

        const parsedPrice = parseFloat(price);
        const parsedStock = parseInt(stock);
        const parsedDiscount = parseFloat(discountPercentage) || 0;

        if (parsedPrice < 0 || parsedStock < 0 || parsedDiscount < 0 || parsedDiscount > 100) {
            throw new Error('Invalid values for price, stock, or discount');
        }

        const images = req.files.map(file => `/uploads/products/${file.filename}`);
        const newProduct = new Product({
            name: name.trim(),
            brand: brand.trim(),
            category,
            description: description.trim(),
            price: parsedPrice,
            salePrice: parsedPrice,
            productOffer: parsedDiscount,
            stock: parsedStock,
            specifications: { processor, ram, storage, graphics },
            images
        });

        await newProduct.save();
        req.flash('success', 'Product added successfully');
        res.redirect('/admin/products');
    } catch (error) {
        if (req.files) {
            await Promise.all(req.files.map(file => fs.unlink(file.path).catch(err => console.error('Error deleting file:', err))));
        }
        req.flash('error', error.message || 'Error adding product');
        res.redirect('/admin/addProduct');
    }
};

// Load Edit Product Page
const loadEditProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('category', 'name').lean();
        if (!product) throw new Error('Product not found');
        const categories = await Category.find({ isDeleted: false }).lean();

        res.render('admin/editProduct', {
            product,
            categories,
            message: req.flash('error')[0] || req.flash('success')[0],
            messageType: req.flash('error').length ? 'error' : 'success'
        });
    } catch (error) {
        console.error('Error in loadEditProduct:', error);
        req.flash('error', error.message || 'Error loading product');
        res.redirect('/admin/products');
    }
};

// Update Product
const updateProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) throw new Error('Product not found');

        const {
            name, brand, category, price, stock, discountPercentage, description,
            processor, ram, storage, graphics
        } = req.body;

        const requiredFields = { name, price, stock };
        const missingFields = Object.entries(requiredFields).filter(([_, v]) => !v).map(([k]) => k);
        if (missingFields.length) throw new Error(`Missing required fields: ${missingFields.join(', ')}`);

        const parsedPrice = parseFloat(price);
        const parsedStock = parseInt(stock);
        const parsedDiscount = parseFloat(discountPercentage) || 0;

        if (parsedPrice <= 0 || parsedStock < 0 || parsedDiscount < 0 || parsedDiscount > 100) {
            throw new Error('Invalid values for price, stock, or discount');
        }

        let images = product.images;
        if (req.files && req.files.length > 0) {
            images = [...images, ...req.files.map(file => `/uploads/products/${file.filename}`)];
        }

        const updateData = {
            name: name.trim(),
            brand: brand?.trim() || product.brand,
            category: category || product.category,
            description: description?.trim() || product.description,
            price: parsedPrice,
            salePrice: parsedPrice,
            productOffer: parsedDiscount,
            stock: parsedStock,
            specifications: {
                processor: processor || product.specifications.processor,
                ram: ram || product.specifications.ram,
                storage: storage || product.specifications.storage,
                graphics: graphics || product.specifications.graphics
            },
            images
        };

        await Product.findByIdAndUpdate(req.params.id, updateData, { runValidators: true });
        req.flash('success', 'Product updated successfully');
        res.redirect('/admin/products');
    } catch (error) {
        if (req.files) {
            await Promise.all(req.files.map(file => fs.unlink(file.path).catch(err => console.error('Error deleting file:', err))));
        }
        req.flash('error', error.message || 'Error updating product');
        res.redirect(`/admin/editProduct/${req.params.id}`);
    }
};

// Toggle Listing Status
const toggleListStatus = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) throw new Error('Product not found');
        product.isListed = !product.isListed;
        await product.save();
        req.flash('success', `Product ${product.isListed ? 'listed' : 'unlisted'} successfully`);
        res.redirect('/admin/products');
    } catch (error) {
        req.flash('error', error.message || 'Error updating status');
        res.redirect('/admin/products');
    }
};

// Soft Delete Product
const softDelete = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) throw new Error('Product not found');
        product.isDeleted = !product.isDeleted;
        await product.save();
        req.flash('success', `Product ${product.isDeleted ? 'deactivated' : 'activated'} successfully`);
        res.redirect('/admin/products');
    } catch (error) {
        req.flash('error', error.message || 'Error updating status');
        res.redirect('/admin/products');
    }
};

// Delete Product Image
const deleteProductImage = async (req, res) => {
    try {
        const { productId } = req.params;
        const { imagePath } = req.body;

        const product = await Product.findById(productId);
        if (!product) throw new Error('Product not found');
        if (!product.images.includes(imagePath)) throw new Error('Image not found');
        if (product.images.length <= 1) throw new Error('Cannot delete the last image');

        const absolutePath = path.join(__dirname, '../../public', imagePath);
        await fs.unlink(absolutePath).catch(err => console.warn('Warning: Could not delete image file:', err));
        product.images = product.images.filter(img => img !== imagePath);
        await product.save();

        req.flash('success', 'Image deleted successfully');
        res.redirect(`/admin/editProduct/${productId}`);
    } catch (error) {
        req.flash('error', error.message || 'Error deleting image');
        res.redirect(`/admin/editProduct/${req.params.productId}`);
    }
};

module.exports = {
    loadProduct,
    loadAddProduct,
    addProduct,
    loadEditProduct,
    updateProduct,
    deleteProductImage,
    toggleListStatus,
    softDelete
};