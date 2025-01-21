const express = require('express');
const adminControllers = require('../controllers/Admin/adminController');
const { userAuth,adminAuth } = require('../middleware/auth');
const customerController = require('../controllers/Admin/customerController');
const categoryController = require('../controllers/Admin/categoryController')
const productController = require('../controllers/Admin/productController')
const router = express.Router();
const { upload } = require('../config/multer');

// Fix the route path - add /admin prefix
router.get('/pageerror', adminControllers.pageerror);
router.get('/login', adminControllers.loadLogin);
router.post('/login', adminControllers.login);
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
router.post('/addProduct', adminAuth, upload.array('images', 5), (req, res, next) => {
    console.log('Received body:', req.body);
    console.log('Received files:', req.files);
    next();
}, productController.addProduct);
router.get('/editProduct/:id', adminAuth, productController.loadEditProduct);
router.post('/editProduct/:id', adminAuth, upload.array('images', 5), productController.updateProduct);
router.post('/deleteProduct/:id', adminAuth, productController.deleteProduct);
router.post('/deleteImage/:productId/:imageIndex', adminAuth, productController.deleteProductImage);

module.exports = router;