const express = require('express');
const router = express.Router();

const adminControllers = require('../controllers/Admin/adminController');
const customerController = require('../controllers/Admin/customerController');
const categoryController = require('../controllers/Admin/categoryController')
const productController = require('../controllers/Admin/productController')
const orderController = require('../controllers/Admin/orderControllers')
const offerController = require('../controllers/Admin/offerController')
const couponController = require('../controllers/Admin/couponController')

const { upload } = require('../config/multer');
const validationMiddleware = require('../middleware/validation');
const admin = require('../middleware/adminAuth')

// Admin Authentication Routes
router.get('/pageerror', adminControllers.pageerror);
router.get('/login',adminControllers.loadLogin);
router.post('/login',  adminControllers.login);
router.get('/dashboard', admin.isAdmin , adminControllers.loadDashboard);
router.get('/logout', adminControllers.logout);

// User Management Routes
router.get('/users', admin.isAdmin , customerController.customerInfo); 
router.put('/users/block/:id', admin.isAdmin ,  customerController.blockUser);

// Category Management Routes
router.get('/categories', admin.isAdmin , categoryController.categoryInfo);
router.get('/categories/:id', admin.isAdmin , categoryController.getCategoryDetails);
router.get('/addCategory', admin.isAdmin ,  categoryController.loadCategory);
router.post('/addCategory',  admin.isAdmin ,  categoryController.addCategory);
router.get('/editCategory/:id',  admin.isAdmin ,  categoryController.loadEditCategory);
router.put('/updateCategory/:id', admin.isAdmin ,   categoryController.updateCategory);
router.put('/toggleCategoryStatus/:id', admin.isAdmin ,   categoryController.toggleCategoryStatus);

// Product Management 
router.get('/products', admin.isAdmin ,   productController.loadProduct);
router.get('/addProduct', admin.isAdmin ,   productController.loadAddProduct);
router.post('/addProduct', admin.isAdmin ,   upload.array('images', 5), validationMiddleware.validateProduct, productController.addProduct);
router.get('/editProduct/:id', admin.isAdmin ,  admin.isAdmin ,  productController.loadEditProduct);
router.post('/editProduct/:id',  admin.isAdmin ,  upload.array('images', 5), validationMiddleware.validateProduct, productController.updateProduct);
router.delete('/deleteProductImage/:productId',   productController.deleteProductImage);
router.delete('/deleteProduct/:id', admin.isAdmin ,   productController.deleteProduct);
router.patch('/products/:id/toggle-list',   productController.toggleListStatus)
router.delete('/softDeleteProduct/:id', productController.softDelete);


//Order Management

router.get('/orders', admin.isAdmin, orderController.getOrders);
router.patch('/orders/:orderId/toggle-status', admin.isAdmin, orderController.toggleOrderStatus); // Use PATCH
router.get('/viewdetails/:orderId',admin.isAdmin, orderController.viewOrderDetails);


//Offer Management

router.get('/offers',admin.isAdmin,offerController.getAllOffers)
router.get('/offers/add',admin.isAdmin,offerController.getAddOffer)
router.post('/offers/add',admin.isAdmin,offerController.postAddOffer)
router.get('/offers/edit/:id',admin.isAdmin, offerController.getEditOffer);
router.post('/offers/edit/:id', offerController.postEditOffer);


//coupoun Management

// Route to display all coupons
router.get('/coupon', admin.isAdmin, couponController.getAllCoupon);
// Route to display the create coupon form
router.get('/createCoupon', admin.isAdmin, couponController.getCreateCouponForm);
router.post('/createCoupon', admin.isAdmin, couponController.postCreateCoupon);
// In your routes file
router.delete('/coupon/delete/:id', couponController.deleteCoupon);







module.exports = router;