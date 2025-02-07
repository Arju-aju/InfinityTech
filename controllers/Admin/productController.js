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
        if (!productId) {
            req.flash('error', 'Product ID is required');
            return res.redirect('/admin/products');
        }

        const [product, categories] = await Promise.all([
            Product.findOne({ 
                _id: productId, 
                isDeleted: false 
            }).populate('category', 'name').lean(),
            Category.find({ isDeleted: false }).lean()
        ]);
        
        if (!product) {
            req.flash('error', 'Product not found');
            return res.redirect('/admin/products');
        }

        // Ensure specifications object exists
        product.specifications = product.specifications || {
            processor: '',
            ram: '',
            storage: '',
            graphics: ''
        };

        // Ensure all required fields are present
        product.discountPercentage = product.discountPercentage || 0;
        product.images = product.images || [];

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
        req.flash('error', 'Error loading product. Please try again.');
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

        // Check if product exists
        const existingProduct = await Product.findById(productId);
        if (!existingProduct) {
            // Delete uploaded files if any
            if (req.files) {
                await Promise.all(req.files.map(file => 
                    fs.unlink(file.path).catch(err => console.error('Error deleting file:', err))
                ));
            }
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Validate required fields
        const requiredFields = {
            name,
            price,
            stock
        };

        const missingFields = Object.entries(requiredFields)
            .filter(([_, value]) => !value)
            .map(([field]) => field);

        if (missingFields.length > 0) {
            // Delete uploaded files if validation fails
            if (req.files) {
                await Promise.all(req.files.map(file => 
                    fs.unlink(file.path).catch(err => console.error('Error deleting file:', err))
                ));
            }
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        // Validate numeric fields
        const parsedPrice = parseFloat(price);
        const parsedStock = parseInt(stock);
        const parsedDiscount = parseFloat(discountPercentage) || 0;

        if (isNaN(parsedPrice) || parsedPrice <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Price must be a valid number greater than 0'
            });
        }

        if (isNaN(parsedStock) || parsedStock < 0) {
            return res.status(400).json({
                success: false,
                message: 'Stock must be a valid number greater than or equal to 0'
            });
        }

        if (isNaN(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 100) {
            return res.status(400).json({
                success: false,
                message: 'Discount percentage must be between 0 and 100'
            });
        }

        // Check if any changes were made
        const hasChanges = (
            name !== existingProduct.name ||
            brand !== existingProduct.brand ||
            category !== existingProduct.category.toString() ||
            parsedPrice !== existingProduct.price ||
            parsedStock !== existingProduct.stock ||
            parsedDiscount !== existingProduct.discountPercentage ||
            description !== existingProduct.description ||
            JSON.stringify(specifications) !== JSON.stringify(existingProduct.specifications) ||
            (req.files && req.files.length > 0)
        );

        if (!hasChanges) {
            return res.status(400).json({
                success: false,
                message: 'No changes detected. Please modify at least one field.'
            });
        }

        // Handle image updates
        let images = existingProduct.images;
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => `/uploads/products/${file.filename}`);
            images = [...images, ...newImages];
        }

        // Parse specifications if it's a string
        let parsedSpecs = specifications;
        if (typeof specifications === 'string') {
            try {
                parsedSpecs = JSON.parse(specifications);
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid specifications format'
                });
            }
        }

        // Validate specifications
        if (!parsedSpecs || typeof parsedSpecs !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Invalid specifications format'
            });
        }

        const requiredSpecs = ['processor', 'ram', 'storage', 'graphics'];
        const missingSpecs = requiredSpecs.filter(spec => !parsedSpecs[spec]);

        if (missingSpecs.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing specifications: ${missingSpecs.join(', ')}`
            });
        }

        // Update product with validated data
        const updateData = {
            name: name.trim(),
            brand: brand.trim(),
            category,
            price: parsedPrice,
            stock: parsedStock,
            discountPercentage: parsedDiscount,
            description: description.trim(),
            specifications: {
                processor: parsedSpecs.processor.trim(),
                ram: parsedSpecs.ram.trim(),
                storage: parsedSpecs.storage.trim(),
                graphics: parsedSpecs.graphics.trim()
            },
            images
        };

        // Update product
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('category');

        if (!updatedProduct) {
            throw new Error('Failed to update product');
        }

        res.json({
            success: true,
            message: 'Product updated successfully',
            product: updatedProduct
        });
    } catch (error) {
        console.error('Error in updateProduct:', error);

        // Delete uploaded files if update fails
        if (req.files) {
            await Promise.all(req.files.map(file => 
                fs.unlink(file.path).catch(err => console.error('Error deleting file:', err))
            ));
        }

        res.status(500).json({
            success: false,
            message: error.message || 'An error occurred while updating the product'
        });
    }
};

// Toggle featured status
const toggleListStatus = async (req, res) => {
    try {
        const productId = req.params.id;
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
        
        return res.json({
            success: true,
            message: `Product ${product.isListed ? 'listed' : 'unlisted'} successfully`,
            isListed: product.isListed
        });
    } catch (error) {
        console.error('Error in toggleListStatus:', error);
        return res.status(500).json({
            success: false,
            message: 'Error updating product status'
        });
    }
};

// Soft delete product
const softDelete = async (req, res) => {
    try {
        const productId = req.params.id;
        
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
        
        res.json({ 
            success: true, 
            message: `Product ${product.isDeleted ? 'deactivated' : 'activated'} successfully`,
            isDeleted: product.isDeleted
        });
    } catch (error) {
        console.error('Error in softDelete:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating product status',
            error: error.message 
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

        // Find the product
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Remove product images from the filesystem
        await Promise.all(
            product.images.map(async (imagePath) => {
                const absolutePath = path.join(__dirname, '../../public', imagePath);
                try {
                    await fs.unlink(absolutePath);
                } catch (err) {
                    console.warn('Warning: Could not delete image file:', err);
                }
            })
        );

        // Delete the product from the database
        await Product.findByIdAndDelete(productId);

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });
    } catch (error) {
        console.error('Error in deleteProduct:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error deleting product'
        });
    }
};

// Get all products
const getAllProducts = async (req, res) => {
    try {
        const products = await Product.find({ isDeleted: false })
            .populate('category')
            .sort('-createdAt')
            .lean();
        
        res.json({ success: true, products });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get product details
const getProductDetails = async (req, res) => {
    try {
        const product = await Product.findOne({ 
            _id: req.params.id,
            isDeleted: false 
        }).populate('category');
        
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        
        res.json({ success: true, product });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    loadProduct,
    loadAddProduct,
    addProduct,
    loadEditProduct,
    updateProduct,
    toggleListStatus,
    softDelete,
    deleteProduct,
    deleteProductImage,
    getAllProducts,
    getProductDetails
};
