const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const fs = require('fs').promises;
const path = require('path');

// Load Products Page with pagination
const loadProduct = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const [products, totalProducts] = await Promise.all([
            Product.find()
                .populate('category', 'name')
                .skip(skip)
                .limit(limit)
                .sort('-createdAt')
                .lean(),
            Product.countDocuments()
        ]);

        const totalPages = Math.ceil(totalProducts / limit);

        res.render('admin/products', {
            products,
            currentPage: page,
            totalPages,
            limit,
            totalProducts,
            breadcrumbs: [
                { text: 'Dashboard', url: '/admin/dashboard' },
                { text: 'Products', url: '/admin/products', active: true }
            ]
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
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
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
        // Debug incoming data
        console.log('Files received:', req.files);
        console.log('Form data received:', req.body);

        // Check if files were uploaded
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one product image is required'
            });
        }

        const {
            name,
            brand,
            category,
            price,
            stock,
            discountPercentage,
            description,
            specifications
        } = req.body;

        // Extract specifications
        const processor = specifications?.processor || req.body['specifications[processor]'];
        const ram = specifications?.ram || req.body['specifications[ram]'];
        const storage = specifications?.storage || req.body['specifications[storage]'];
        const graphics = specifications?.graphics || req.body['specifications[graphics]'];

        // Validate all required fields
        const requiredFields = {
            name,
            brand,
            category,
            price,
            stock,
            description,
            'Processor': processor,
            'RAM': ram,
            'Storage': storage,
            'Graphics': graphics
        };

        // Check which fields are missing
        const missingFields = Object.entries(requiredFields)
            .filter(([_, value]) => !value)
            .map(([field]) => field);

        if (missingFields.length > 0) {
            // Delete uploaded files if validation fails
            await Promise.all(req.files.map(file => 
                fs.unlink(file.path).catch(err => console.error('Error deleting file:', err))
            ));

            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        // Validate numeric fields
        const parsedPrice = parseFloat(price);
        const parsedStock = parseInt(stock);
        const parsedDiscount = parseFloat(discountPercentage) || 0;

        if (parsedPrice < 0 || parsedStock < 0 || parsedDiscount < 0 || parsedDiscount > 100) {
            await Promise.all(req.files.map(file => 
                fs.unlink(file.path).catch(err => console.error('Error deleting file:', err))
            ));

            return res.status(400).json({
                success: false,
                message: 'Invalid values for price, stock, or discount'
            });
        }

        // Create image paths array
        const images = req.files.map(file => `/uploads/products/${file.filename}`);

        // Create new product
        const newProduct = new Product({
            name: name.trim(),
            brand: brand.trim(),
            category,
            description: description.trim(),
            price: parsedPrice,
            stock: parsedStock,
            discountPercentage: parsedDiscount,
            specifications: {
                processor: processor.trim(),
                ram: ram.trim(),
                storage: storage.trim(),
                graphics: graphics.trim()
            },
            images
        });

        await newProduct.save();

        res.json({
            success: true,
            message: 'Product added successfully',
            product: newProduct
        });
    } catch (error) {
        console.error('Error in addProduct:', error);

        // Delete uploaded files if product creation fails
        if (req.files) {
            await Promise.all(req.files.map(file => 
                fs.unlink(file.path).catch(err => console.error('Error deleting file:', err))
            ));
        }

        res.status(500).json({
            success: false,
            message: error.message || 'Error adding product'
        });
    }
};

// Load Edit Product Page
const loadEditProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findOne({ 
            _id: productId, 
            isDeleted: false 
        }).populate('category', 'name');
        
        if (!product) {
            req.flash('error', 'Product not found');
            return res.redirect('/admin/products');
        }

        const categories = await Category.find({ isDeleted: false });
        
        res.render('admin/editProduct', {
            product,
            categories,
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });
    } catch (error) {
        console.error('Error in loadEditProduct:', error);
        req.flash('error', 'Error loading product');
        res.redirect('/admin/products');
    }
};

// Update Product
const updateProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const {
            name,
            brand,
            category,
            price,
            stock,
            discountPercentage,
            description,
            specifications
        } = req.body;

        // Validate required fields
        const requiredFields = {
            name,
            brand,
            category,
            price,
            stock,
            description
        };

        const missingFields = Object.entries(requiredFields)
            .filter(([_, value]) => !value)
            .map(([field]) => field);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        // Check if product exists
        const existingProduct = await Product.findById(productId);
        if (!existingProduct) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Check for duplicate name (excluding current product)
        const duplicateProduct = await Product.findOne({
            name: name.trim(),
            _id: { $ne: productId },
            isDeleted: false
        });

        if (duplicateProduct) {
            return res.status(400).json({
                success: false,
                message: 'A product with this name already exists'
            });
        }

        // Validate numeric fields
        const parsedPrice = parseFloat(price);
        const parsedStock = parseInt(stock);
        const parsedDiscount = parseFloat(discountPercentage) || 0;

        if (parsedPrice < 0 || parsedStock < 0 || parsedDiscount < 0 || parsedDiscount > 100) {
            return res.status(400).json({
                success: false,
                message: 'Invalid values for price, stock, or discount'
            });
        }

        // Extract specifications
        const processor = specifications?.processor || req.body['specifications[processor]'];
        const ram = specifications?.ram || req.body['specifications[ram]'];
        const storage = specifications?.storage || req.body['specifications[storage]'];
        const graphics = specifications?.graphics || req.body['specifications[graphics]'];

        // Handle image updates
        let images = existingProduct.images;
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => `/uploads/products/${file.filename}`);
            images = [...images, ...newImages];
        }

        // Update product with new values only if they're different
        const updateData = {
            name: name.trim() !== existingProduct.name ? name.trim() : undefined,
            brand: brand.trim() !== existingProduct.brand ? brand.trim() : undefined,
            category: category !== existingProduct.category.toString() ? category : undefined,
            price: parsedPrice !== existingProduct.price ? parsedPrice : undefined,
            stock: parsedStock !== existingProduct.stock ? parsedStock : undefined,
            discountPercentage: parsedDiscount !== existingProduct.discountPercentage ? parsedDiscount : undefined,
            description: description.trim() !== existingProduct.description ? description.trim() : undefined,
            specifications: {
                processor: processor?.trim() !== existingProduct.specifications?.processor ? processor.trim() : existingProduct.specifications?.processor,
                ram: ram?.trim() !== existingProduct.specifications?.ram ? ram.trim() : existingProduct.specifications?.ram,
                storage: storage?.trim() !== existingProduct.specifications?.storage ? storage.trim() : existingProduct.specifications?.storage,
                graphics: graphics?.trim() !== existingProduct.specifications?.graphics ? graphics.trim() : existingProduct.specifications?.graphics
            },
            images: images.length !== existingProduct.images.length ? images : existingProduct.images
        };

        // Remove undefined values
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
                delete updateData[key];
            }
        });

        // Update product
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { $set: updateData },
            { new: true }
        ).populate('category');

        res.json({
            success: true,
            message: 'Product updated successfully',
            product: updatedProduct
        });
    } catch (error) {
        console.error('Error in updateProduct:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error updating product'
        });
    }
};

// Delete Product Image
const deleteProductImage = async (req, res) => {
    try {
        const { productId } = req.params;
        const { imagePath } = req.body;

        // Find product
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Check if image exists in product
        if (!product.images.includes(imagePath)) {
            return res.status(404).json({
                success: false,
                message: 'Image not found in product'
            });
        }

        // Ensure at least one image remains
        if (product.images.length <= 1) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete the last image. Product must have at least one image.'
            });
        }

        // Remove image from filesystem
        const absolutePath = path.join(__dirname, '../../public', imagePath);
        await fs.unlink(absolutePath).catch(err => {
            console.warn('Warning: Could not delete image file:', err);
        });

        // Update product images array
        product.images = product.images.filter(img => img !== imagePath);
        await product.save();

        res.json({
            success: true,
            message: 'Image deleted successfully'
        });
    } catch (error) {
        console.error('Error in deleteProductImage:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error deleting image'
        });
    }
};

// Delete Product (complete removal)
const deleteProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Delete product images from filesystem
        if (product.images && product.images.length > 0) {
            await Promise.all(product.images.map(imagePath => {
                const fullPath = path.join(__dirname, '../../public', imagePath);
                return fs.unlink(fullPath).catch(err => {
                    console.error('Error deleting image:', err);
                    // Continue even if file deletion fails
                    return Promise.resolve();
                });
            }));
        }

        // Delete the product from database
        await Product.findByIdAndDelete(productId);

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });
    } catch (error) {
        console.error('Error in deleteProduct:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting product'
        });
    }
};

module.exports = {
    loadProduct,
    loadAddProduct,
    addProduct,
    loadEditProduct,
    updateProduct,
    deleteProduct,
    deleteProductImage
};
