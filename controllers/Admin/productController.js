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
            processor, ram, storage, graphics
        } = req.body;

        const requiredFields = {
            name: name?.trim(), brand: brand?.trim(), category, price, stock,
            description: description?.trim(), processor: processor?.trim(),
            ram: ram?.trim(), storage: storage?.trim(), graphics: graphics?.trim()
        };
        const missingFields = Object.entries(requiredFields)
            .filter(([_, value]) => !value)
            .map(([key]) => key);
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        const parsedPrice = parseFloat(price);
        const parsedStock = parseInt(stock);
        const parsedDiscount = parseFloat(discountPercentage) || 0;

        if (isNaN(parsedPrice) || parsedPrice < 0) throw new Error('Price must be a valid non-negative number');
        if (isNaN(parsedStock) || parsedStock < 0) throw new Error('Stock must be a valid non-negative integer');
        if (parsedDiscount < 0 || parsedDiscount > 100) throw new Error('Discount percentage must be between 0 and 100');

        const categoryExists = await Category.findOne({ _id: category, isDeleted: false });
        if (!categoryExists) throw new Error('Selected category does not exist or is deleted');

        const discountValue = parsedPrice * (parsedDiscount / 100);
        const salePrice = parsedPrice - discountValue;

        const images = req.files.map(file => `/uploads/products/${file.filename}`);

        const newProduct = new Product({
            name: name.trim(), brand: brand.trim(), category, description: description.trim(),
            price: parsedPrice, salePrice, productOffer: parsedDiscount, stock: parsedStock,
            specifications: { processor: processor.trim(), ram: ram.trim(), storage: storage.trim(), graphics: graphics.trim() },
            images, isListed: true, isDeleted: false
        });

        await newProduct.save();
        res.status(200).json({ message: 'Product added successfully', product: newProduct });
    } catch (error) {
        console.error('Error in addProduct:', error);
        if (req.files && req.files.length > 0) {
            await Promise.all(req.files.map(file => fs.unlink(file.path).catch(err => console.error('Error deleting file:', err))));
        }
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
        const productId = req.params.id;
        const product = await Product.findById(productId);
        
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        
        console.log('Request Body:', req.body);
        console.log('Request Files:', req.files);
        
        const { name, brand, category, description, price, stock, processor, ram, storage, graphics } = req.body;
        
        // Validation for required fields
        const requiredFields = { name, brand, category, description, price, stock, processor, ram, storage, graphics };
        const missingFields = Object.entries(requiredFields)
            .filter(([_, value]) => !value?.trim())
            .map(([key]) => key);
            
        if (missingFields.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Missing required fields: ${missingFields.join(', ')}` 
            });
        }
        
        const parsedPrice = parseFloat(price);
        const parsedStock = parseInt(stock);
        
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Price must be a valid non-negative number' 
            });
        }
        
        if (isNaN(parsedStock) || parsedStock < 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Stock must be a valid non-negative integer' 
            });
        }
        
        const categoryExists = await Category.findOne({ _id: category, isDeleted: false });
        if (!categoryExists) {
            return res.status(400).json({ 
                success: false, 
                message: 'Selected category does not exist or is deleted' 
            });
        }
        
        // Prepare update data
        const updateData = {
            name: name.trim(),
            brand: brand.trim(),
            category,
            description: description.trim(),
            price: parsedPrice,
            stock: parsedStock,
            specifications: {
                processor: processor.trim(),
                ram: ram.trim(),
                storage: storage.trim(),
                graphics: graphics.trim()
            }
        };
        
        // Handle image updates (replace all if new images are uploaded)
        if (req.files && req.files.length > 0) {
            // Delete old images
            await Promise.all(
                product.images.map(async (image) => {
                    try {
                        const imagePath = path.join(__dirname, '../..', 'public', image);
                        await fs.promises.unlink(imagePath);
                    } catch (err) {
                        console.error('Error deleting old image:', err);
                        // Continue even if some images fail to delete
                    }
                })
            );
            
            // Update with new image paths
            updateData.images = req.files.map(file => {
                // Convert absolute path to relative URL path
                const relativePath = file.path.split('uploads')[1] || file.path;
                return `/uploads${relativePath}`;
            });
        }
        
        // Update the product
        const updatedProduct = await Product.findByIdAndUpdate(
            productId, 
            updateData, 
            { runValidators: true, new: true }
        );
        
        return res.status(200).json({ 
            success: true, 
            message: 'Product updated successfully', 
            product: updatedProduct 
        });
        
    } catch (error) {
        console.error('Error in updateProduct:', error);
        
        // If files were uploaded but an error occurred, delete them
        if (req.files && req.files.length > 0) {
            await Promise.all(
                req.files.map(file => 
                    fs.promises.unlink(file.path).catch(err => 
                        console.error('Error deleting file:', err)
                    )
                )
            );
        }
        
        return res.status(500).json({ 
            success: false, 
            message: error.message || 'Error updating product' 
        });
    }
};

// Toggle Listing Status
const toggleListStatus = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

        product.isListed = !product.isListed;
        await product.save();
        res.status(200).json({ success: true, message: `Product ${product.isListed ? 'listed' : 'unlisted'} successfully` });
    } catch (error) {
        console.error('Error toggling product list status:', error);
        res.status(500).json({ success: false, message: 'Server error while toggling product status' });
    }
};

// Soft Delete Product
const softDeleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

        product.isDeleted = !product.isDeleted;
        await product.save();
        res.status(200).json({ success: true, message: `Product ${product.isDeleted ? 'marked as deleted' : 'restored'} successfully` });
    } catch (error) {
        console.error('Error soft deleting product:', error);
        res.status(500).json({ success: false, message: 'Server error while soft deleting product' });
    }
};

// Delete Product Image
const deleteProductImage = async (req, res) => {
    try {
        const { productId } = req.params;
        const { imagePath } = req.body;

        if (!productId || !imagePath) {
            return res.status(400).json({ success: false, message: 'Missing required parameters: productId and imagePath' });
        }

        const product = await Product.findById(productId);
        if (!product) return res.status(400).json({ success: false, message: 'Product not found' });
        if (!product.images.includes(imagePath)) return res.status(400).json({ success: false, message: 'Image not found in product' });
        if (product.images.length <= 1) return res.status(400).json({ success: false, message: 'Cannot delete the last image. Please add a new image first.' });

        product.images = product.images.filter(img => img !== imagePath);
        await product.save();

        const absolutePath = path.join(__dirname, '../../public', imagePath);
        fs.unlink(absolutePath).catch(err => console.error(`Warning: Could not delete file ${absolutePath}:`, err));

        return res.status(200).json({ success: true, message: 'Image deleted successfully' });
    } catch (error) {
        console.error('Error in deleteProductImage:', error);
        return res.status(500).json({ success: false, message: 'Server error while deleting image' });
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