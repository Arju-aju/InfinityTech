const express = require('express');
const adminControllers = require('../controllers/Admin/adminController');
const { userAuth, adminAuth, redirectLoggedInAdmin } = require('../middleware/auth');
const customerController = require('../controllers/Admin/customerController');
const categoryController = require('../controllers/Admin/categoryController')
const productController = require('../controllers/Admin/productController')
const router = express.Router();
const Product = require('../models/productSchema');
const { upload } = require('../config/multer');
const validationMiddleware = require('../middleware/validation');

// Admin Authentication Routes
router.get('/pageerror', adminControllers.pageerror);
router.get('/login', redirectLoggedInAdmin, adminControllers.loadLogin);
router.post('/login', redirectLoggedInAdmin, adminControllers.login);
router.get('/dashboard', adminAuth, adminControllers.loadDashboard);
router.get('/logout', adminControllers.logout);

// User Management Routes
router.get('/users', adminAuth, customerController.customerInfo); 
router.post('/users/block/:id', adminAuth, customerController.blockUser);

// Category Management Routes
router.get('/categories', adminAuth, categoryController.categoryInfo);
router.get('/addCategory', adminAuth, categoryController.loadCategory);
router.post('/addCategory', adminAuth, categoryController.addCategory);
router.get('/editCategory/:id', adminAuth, categoryController.loadEditCategory);
router.delete('/deleteCategory/:id', adminAuth, categoryController.deleteCategory);
router.put('/updateCategory/:id', adminAuth, categoryController.updateCategory);
router.put('/toggleCategoryStatus/:id', adminAuth, categoryController.toggleCategoryStatus);

// Product Management Routes
router.get('/products', adminAuth, productController.loadProduct);
router.get('/addProduct', adminAuth, productController.loadAddProduct);
router.post('/addProduct', adminAuth, upload.array('images', 5), validationMiddleware.validateProduct, productController.addProduct);
router.get('/editProduct/:id', adminAuth, productController.loadEditProduct);
router.post('/editProduct/:id', adminAuth, upload.array('images', 5), validationMiddleware.validateProduct, productController.updateProduct);
router.delete('/deleteProduct/:id', adminAuth, productController.deleteProduct);
router.delete('/deleteProductImage/:productId/:imagePath', adminAuth, productController.deleteProductImage);
router.patch('/products/:id/toggle-featured', adminAuth, productController.toggleFeatured);
router.patch('/products/:id/soft-delete', adminAuth, productController.softDelete);

module.exports = router;