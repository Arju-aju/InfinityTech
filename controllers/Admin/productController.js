const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const fs = require('fs');
const path = require('path');
const { log } = require('console');

const getBrandColorClass = (brand) => {
    if (!brand) return 'bg-gray-100 text-gray-800'; // Default color for undefined brand
    
    const brandColors = {
        'Apple': 'bg-gray-100 text-gray-800',
        'Dell': 'bg-blue-100 text-blue-800',
        'HP': 'bg-indigo-100 text-indigo-800',
        'Lenovo': 'bg-red-100 text-red-800',
        'Acer': 'bg-green-100 text-green-800',
        'ASUS': 'bg-purple-100 text-purple-800',
        'MSI': 'bg-pink-100 text-pink-800',
        'Samsung': 'bg-yellow-100 text-yellow-800',
        'ROG': 'bg-red-100 text-red-800'  // Added ROG brand
    };
    return brandColors[brand] || 'bg-gray-100 text-gray-800';
};

const loadProduct = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const totalItems = await Product.countDocuments();
        const totalPages = Math.ceil(totalItems / limit);

        let products = await Product.find()
            .populate('category', 'name')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        products = products.map(product => {
            const doc = product.toObject();
            if (doc.discountPercentage) {
                doc.discountedPrice = doc.price - (doc.price * doc.discountPercentage / 100);
            }
            return doc;
        });

        console.log('Products with brand:', products.map(p => ({ id: p._id, brand: p.brand })));

        res.render('admin/products', {
            products,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                startIndex: skip,
                endIndex: Math.min(skip + limit, totalItems),
                startPage: Math.max(1, page - 2),
                endPage: Math.min(totalPages, page + 2)
            },
            breadcrumbs: [{ name: 'Products', url: '/admin/products' }],
            getBrandColorClass,
            calculateDiscountedPrice: (price, discountPercentage) => {
                return price - (price * discountPercentage / 100);
            },
            formatPrice: (price) => {
                return price.toLocaleString('en-IN', {
                    style: 'currency',
                    currency: 'INR',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            }
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};


const loadAddproduct = async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.redirect('/admin/login');
        }

        // Fetch all active categories
        const categories = await Category.find({ isActive: true });

        res.render('admin/addProduct', {
            categories,
            error: null,
            formData: null,
            path: req.path, // Add the current path
            title: 'Add Product' // Add page title
        });
    } catch (error) {
        console.error('Error loading add product page:', error);
        res.redirect('/admin/products');
    }
};

const addProduct = async (req, res) => {
    try {
        const {
            name,
            description,
            brand,
            stock,
            price,
            discountPercentage,
            category,
            specifications
        } = req.body;

        // Create new product
        const newProduct = new Product({
            name,
            description,
            brand,
            stock: parseInt(stock),
            price: parseFloat(price),
            discountPercentage: parseFloat(discountPercentage || 0),
            category,
            specifications: {
                processor: specifications?.processor || '',
                ram: specifications?.ram || '',
                storage: specifications?.storage || '',
                graphics: specifications?.graphics || ''
            }
        });

        // Handle image uploads
        if (req.files && req.files.images) {
            const images = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
            
            // Process each image
            for (const image of images) {
                const filename = `${Date.now()}-${image.name}`;
                await image.mv(path.join(__dirname, '../../public/uploads/products', filename));
                newProduct.images.push(filename);
            }
        }

        await newProduct.save();
        res.redirect('/admin/products?success=Product added successfully');
    } catch (error) {
        console.error('Error adding product:', error);
        
        // Fetch categories for re-rendering the form
        const categories = await Category.find({ isActive: true });
        
        res.render('admin/addProduct', {
            categories,
            error: 'Failed to add product. Please try again.',
            formData: req.body
        });
    }
};


const loadEditProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        
        // Fetch the product with populated category
        const product = await Product.findById(productId)
            .populate('category')
            .select('-__v');
        
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Fetch ALL categories, not just active ones
        const categories = await Category.find({})
            .select('name _id isAvailable')
            .lean(); 

        console.log('Categories fetched:', categories); // Debug log

        // Render the edit page with complete data
        return res.render('admin/editProduct', {
            product: {
                _id: product._id,
                name: product.name,
                description: product.description || '',
                category: product.category,
                price: product.price,
                stock: product.stock,
                specifications: {
                    processor: product.specifications?.processor || '',
                    ram: product.specifications?.ram || '',
                    storage: product.specifications?.storage || '',
                    graphics: product.specifications?.graphics || ''
                },
                images: product.images || [],
                discountPercentage: product.discountPercentage || 0
            },
            categories: categories, // Pass all categories
            admin: req.session.admin
        });

    } catch (error) {
        console.error('Error in loadEditProduct:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load product details'
        });
    }
};

const updateProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const {
            productName,
            description,
            price,
            stock,
            productCategory,
            brand,
            specifications,
            discountPercentage
        } = req.body;
console.log("brandddd",brand);
   
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            {
                name: productName,
                description,
                price,
                stock,
                category:productCategory,
                specifications: {
                    brand:brand,
                    processor: specifications.processor,
                    ram: specifications.ram,
                    storage: specifications.storage,
                    graphics: specifications.graphics
                },
                discountPercentage
            },
            { new: true }
        );
console.log(updatedProduct);
        if (!updatedProduct) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Product updated successfully'
        });

    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update product'
        });
    }
};

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

        // Delete images from filesystem
        if (product.images && product.images.length > 0) {
            for (const imagePath of product.images) {
                try {
                    // Get absolute path
                    const fullPath = path.join(__dirname, '../../public', imagePath);
                    // Check if file exists before attempting to delete
                    await fs.access(fullPath);
                    await fs.unlink(fullPath);
                } catch (err) {
                    console.error(`Error deleting image ${imagePath}:`, err);
                    // Continue with deletion even if image deletion fails
                }
            }
        }

        // Delete the product from database
        await Product.findByIdAndDelete(productId);

        return res.status(200).json({
            success: true,
            message: `${product.name} has been successfully deleted`
        });

    } catch (error) {
        console.error('Error in deleteProduct:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete product'
        });
    }
};

const removeProductImage = async (req, res) => {
    try {
        const { productId, imageIndex } = req.params;

        // Find the product
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        if (!product.images || imageIndex >= product.images.length) {
            return res.status(400).json({
                success: false,
                message: 'Image not found'
            });
        }

        // Get the image path to delete
        const imageToDelete = product.images[imageIndex];
        const fullPath = path.join(__dirname, '../../public', imageToDelete);

        // Remove the image file from filesystem using promises
        try {
            await fs.promises.unlink(fullPath);
        } catch (unlinkError) {
            console.error('Error deleting image file:', unlinkError);
            // Continue even if file deletion fails
        }

        // Remove the image from the product's images array
        product.images.splice(imageIndex, 1);
        
        // Save without validation since we're just updating images
        await product.save({ validateBeforeSave: false });

        return res.status(200).json({
            success: true,
            message: 'Image removed successfully'
        });

    } catch (error) {
        console.error('Error removing image:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to remove image'
        });
    }
};

const replaceProductImage = async (req, res) => {
    try {
        const { productId, index } = req.params;
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file provided'
            });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        if (!product.images || index >= product.images.length) {
            return res.status(400).json({
                success: false,
                message: 'Invalid image index'
            });
        }

        // Delete the old image
        const oldImagePath = path.join(__dirname, '../../public', product.images[index]);
        try {
            await fs.promises.unlink(oldImagePath);
        } catch (unlinkError) {
            console.error('Error deleting old image:', unlinkError);
        }

        // Update with new image
        const newImagePath = `/uploads/products/${req.file.filename}`;
        product.images[index] = newImagePath;
        
        // Save without validation since we're just updating images
        await product.save({ validateBeforeSave: false });

        return res.status(200).json({
            success: true,
            message: 'Image replaced successfully',
            newImage: newImagePath
        });

    } catch (error) {
        console.error('Error replacing image:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to replace image'
        });
    }
};

module.exports = {
    loadProduct,
    loadAddproduct,
    addProduct,
    loadEditProduct,
    updateProduct,
    deleteProduct,
    removeProductImage,
    replaceProductImage,
};