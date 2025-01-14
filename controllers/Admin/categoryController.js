const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');

const loadCategory = async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.redirect('/admin/login');
        }
        res.render('admin/addCategory', {
            error: null,
            formData: null
        });
    } catch (error) {
        console.error("Dashboard error", error);
        res.redirect('/admin/login');
    }
};

const categoryInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        // Get total count
        const totalItems = await Category.countDocuments();
        const totalPages = Math.ceil(totalItems / limit);

        // Get paginated categories with product count
        const categories = await Category.find()
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        // Add product count to each category
        const categoriesWithCount = await Promise.all(categories.map(async (category) => {
            const productCount = await Product.countDocuments({ category: category._id });
            return {
                ...category.toObject(),
                productCount
            };
        }));

        res.render('admin/categories', {
            categories: categoriesWithCount || [], // Provide empty array as fallback
            pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                startIndex: skip,
                endIndex: Math.min(skip + limit, totalItems),
                startPage: Math.max(1, page - 2),
                endPage: Math.min(totalPages, page + 2)
            },
            error: null,
            success: req.query.success || null,
            req: req // Pass the request object to access query params in view
        });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.render('admin/categories', {
            categories: [],
            pagination: {
                currentPage: 1,
                totalPages: 0,
                totalItems: 0,
                startIndex: 0,
                endIndex: 0,
                startPage: 1,
                endPage: 1
            },
            error: 'Failed to fetch categories',
            success: null,
            req: req
        });
    }
};

const addCategory = async (req, res) => {
    const { name, description } = req.body;
  
    try {
        // Check if the category already exists
        const existingCategory = await Category.findOne({ name });
        if (existingCategory) {
            return res.render('admin/addCategory', {
                error: 'Category already exists',
                formData: req.body
            });
        }
  
        // Create a new category
        const newCategory = new Category({
            name,
            description,
            isActive: true
        });
  
        await newCategory.save();
        
        // Redirect to categories page with success message
        res.redirect('/admin/categories?success=Category added successfully');
    } catch (error) {
        console.error('Error adding category:', error);
        res.render('admin/addCategory', {
            error: 'Failed to add category',
            formData: req.body
        });
    }
};

const loadEditCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        
        // Breadcrumb data for edit page
        const breadcrumbs = [
            { name: 'Categories', url: '/admin/category' },
            { name: 'Edit Category', url: '#' }
        ];

        res.render('admin/editCategory', { 
            category,
            breadcrumbs
        });
    } catch (error) {
        console.error('Error loading category:', error);
        res.status(500).send('Server Error');
    }
};

// Update existing category
const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({ 
                success: false, 
                message: 'Category not found' 
            });
        }

        // Update the category
        category.name = name;
        category.description = description;
        await category.save();

        return res.status(200).json({
            success: true,
            message: 'Category updated successfully'
        });

    } catch (error) {
        console.error('Error updating category:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to update category'
        });
    }
};

// Delete category
const deleteCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;

        // First check if there are any products using this category
        const associatedProducts = await Product.exists({ category: categoryId });

        if (associatedProducts) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete category that has associated products. Please remove or reassign products first."
            });
        }

        // If no associated products, proceed with deletion
        const deletedCategory = await Category.findByIdAndDelete(categoryId);

        if (!deletedCategory) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Category deleted successfully"
        });

    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({
            success: false,
            message: "Failed to delete category"
        });
    }
};

const toggleCategoryStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({ 
                success: false, 
                message: 'Category not found' 
            });
        }

        // Update isAvailable status
        category.isAvailable = status;
        await category.save();

        return res.status(200).json({ 
            success: true,
            message: `Category is now ${status ? 'available' : 'unavailable'}`
        });

    } catch (error) {
        console.error('Error toggling category status:', error);
        return res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to update category status'
        });
    }
};



module.exports = {
  categoryInfo,
  addCategory,
  loadCategory,
  loadEditCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus
};
