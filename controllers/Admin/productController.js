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
        // Log req.body for debugging
        console.log('req.body:', req.body);
        console.log('req.files:', req.files);

        // Step 1: Ensure at least one image file is uploaded
        if (!req.files || req.files.length === 0) {
            throw new Error('At least one product image is required');
        }

        // Step 2: Destructure fields from req.body
        const {
            name,
            brand,
            category,
            price,
            stock,
            discountPercentage,
            description,
            specifications // Nested specifications object
        } = req.body;

        // Step 3: Destructure nested specifications fields
        const {
            processor,
            ram,
            storage,
            graphics
        } = specifications || {}; // Fallback to empty object if specifications is undefined

        // Step 4: Validate required fields
        const requiredFields = {
            name: name?.trim(),
            brand: brand?.trim(),
            category,
            price,
            stock,
            description: description?.trim(),
            processor: processor?.trim(),
            ram: ram?.trim(),
            storage: storage?.trim(),
            graphics: graphics?.trim()
        };

        const missingFields = Object.entries(requiredFields)
            .filter(([_, value]) => !value)
            .map(([key]) => key);

        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Step 5: Validate numeric fields
        const parsedPrice = parseFloat(price);
        const parsedStock = parseInt(stock);
        const parsedDiscount = parseFloat(discountPercentage) || 0;

        if (isNaN(parsedPrice) || parsedPrice < 0) {
            throw new Error('Price must be a valid non-negative number');
        }
        if (isNaN(parsedStock) || parsedStock < 0) {
            throw new Error('Stock must be a valid non-negative integer');
        }
        if (parsedDiscount < 0 || parsedDiscount > 100) {
            throw new Error('Discount percentage must be between 0 and 100');
        }

        // Step 6: Validate category exists and is not deleted
        const categoryExists = await Category.findOne({ _id: category, isDeleted: false });
        if (!categoryExists) {
            throw new Error('Selected category does not exist or is deleted');
        }

        // Step 7: Calculate sale price after discount
        const discountValue = parsedPrice * (parsedDiscount / 100);
        const salePrice = parsedPrice - discountValue;

        // Step 8: Map uploaded images to their paths
        const images = req.files.map(file => `/uploads/products/${file.filename}`);

        // Step 9: Create the new product
        const newProduct = new Product({
            name: name.trim(),
            brand: brand.trim(),
            category,
            description: description.trim(),
            price: parsedPrice,
            salePrice,
            productOffer: parsedDiscount,
            stock: parsedStock,
            specifications: {
                processor: processor.trim(),
                ram: ram.trim(),
                storage: storage.trim(),
                graphics: graphics.trim()
            },
            images,
            isListed: true,
            isDeleted: false
        });

        // Step 10: Save the product to the database
        await newProduct.save();

        // Step 11: Respond with success
        res.status(200).json({ message: 'Product added successfully', product: newProduct });
    } catch (error) {
        console.error('Error in addProduct:', error);

        // Clean up uploaded files in case of error
        if (req.files && req.files.length > 0) {
            await Promise.all(
                req.files.map(file =>
                    fs.unlink(file.path).catch(err => console.error('Error deleting file:', err))
                )
            );
        }

        // Send error response
        res.status(400).json({ message: error.message || 'Error adding product' });
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
        const productId = req.params.id;

        // Find the product by ID
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Toggle the isListed status
        product.isListed = !product.isListed;
        await product.save();

        // Send success response
        res.status(200).json({
            success: true,
            message: `Product ${product.isListed ? 'listed' : 'unlisted'} successfully`
        });
    } catch (error) {
        console.error('Error toggling product list status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while toggling product status'
        });
    }
};

// Soft Delete Product
const softDeleteProduct = async (req, res) => {
    try {
        const productId = req.params.id;

        // Find the product by ID
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Toggle the isDeleted status
        product.isDeleted = !product.isDeleted;
        await product.save();

        // Send success response
        res.status(200).json({
            success: true,
            message: `Product ${product.isDeleted ? 'marked as deleted' : 'restored'} successfully`
        });
    } catch (error) {
        console.error('Error soft deleting product:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while soft deleting product'
        });
    }
};

// Delete Product Image
const deleteProductImage = async (req, res) => {
    try {
        const { productId } = req.params;
        const { imagePath } = req.body;

        // Validate inputs
        if (!productId || !imagePath) {
            return res.status(400).json({ success: false, message: 'Product ID and image path are required' });
        }

        // Find the product
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Check if the image exists in the product
        if (!product.images.includes(imagePath)) {
            return res.status(400).json({ success: false, message: 'Image not found in product' });
        }

        // Prevent deletion of the last image
        if (product.images.length <= 1) {
            return res.status(400).json({ success: false, message: 'Cannot delete the last image' });
        }

        // Delete the image file from the filesystem
        const absolutePath = path.join(__dirname, '../../public', imagePath);
        try {
            await fs.unlink(absolutePath);
        } catch (err) {
            throw new Error(`Failed to delete image file: ${err.message}`);
        }

        // Remove the image from the product's images array
        product.images = product.images.filter(img => img !== imagePath);
        await product.save();

        // Return success response
        return res.status(200).json({ success: true, message: 'Image deleted successfully' });
    } catch (error) {
        console.error('Error deleting image:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Server error while deleting image'
        });
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
    softDeleteProduct
};