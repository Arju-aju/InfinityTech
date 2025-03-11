const express = require('express');
const router = express.Router();

const adminControllers = require('../controllers/Admin/adminController');
const customerController = require('../controllers/Admin/customerController');
const categoryController = require('../controllers/Admin/categoryController')
const productController = require('../controllers/Admin/productController')
const orderController = require('../controllers/Admin/orderControllers')
const offerController = require('../controllers/Admin/offerController')
const couponController = require('../controllers/Admin/couponController')
const returnController = require('../controllers/Admin/returnOrderController')

const { upload, handleMulterError } = require('../config/multer');
const validationMiddleware = require('../middleware/validation');
const admin = require('../middleware/adminAuth')

// Admin Authentication Routes
router.get('/pageerror', adminControllers.pageerror);
router.get('/login',adminControllers.loadLogin);
router.post('/login',  adminControllers.login);
router.get('/dashboard', admin.isAdmin , adminControllers.loadDashboard);
router.get('/logout', adminControllers.logout);

router.get('/sales-report', admin.isAdmin , adminControllers.getSalesReport);
router.get('/top-sellers', admin.isAdmin , adminControllers.getTopSellers);

// User Management Routes
router.get('/users', admin.isAdmin, customerController.customerInfo);
router.put('/users/block/:id', admin.isAdmin, customerController.blockUser);

// Category Management Routes
router.get('/categories', admin.isAdmin , categoryController.categoryInfo);
router.get('/categories/:id', admin.isAdmin , categoryController.getCategoryDetails);
router.get('/addCategory', admin.isAdmin ,  categoryController.loadCategory);
router.post('/addCategory',  admin.isAdmin ,  categoryController.addCategory);
router.get('/editCategory/:id',  admin.isAdmin ,  categoryController.loadEditCategory);
router.put('/updateCategory/:id', admin.isAdmin ,   categoryController.updateCategory);
router.put('/toggleCategoryStatus/:id', admin.isAdmin ,   categoryController.toggleCategoryStatus);

// Product Management 
router.get('/products', admin.isAdmin, productController.loadProduct);
router.get('/addProduct', admin.isAdmin, productController.loadAddProduct);
router.post('/addProduct',admin.isAdmin,upload.array('images',5), handleMulterError,productController.addProduct);
router.get('/editProduct/:id', admin.isAdmin, productController.loadEditProduct);
router.post('/editProduct/:id', admin.isAdmin, upload.array('images', 6), handleMulterError, productController.updateProduct);
router.post('/deleteProductImage/:productId', productController.deleteProductImage);
router.post('/products/:id/toggle-list', productController.toggleListStatus);
router.post('/softDeleteProduct/:id', productController.softDeleteProduct);


//Order Management

router.get('/orders', admin.isAdmin, orderController.getOrders);
router.patch('/orders/:orderId/toggle-status', admin.isAdmin, orderController.toggleOrderStatus); 
router.get('/viewdetails/:orderId',admin.isAdmin, orderController.viewOrderDetails);


//Offer Management

router.get('/offers', admin.isAdmin, offerController.getAllOffers);
router.get('/offers/add', admin.isAdmin, offerController.getAddOffer);
router.post('/offers/add', admin.isAdmin, offerController.postAddOffer);
router.get('/offers/edit/:id', admin.isAdmin, offerController.getEditOffer);
router.post('/offers/edit/:id', admin.isAdmin, offerController.postEditOffer);


//coupoun Management

router.get('/coupons', admin.isAdmin, couponController.getAllCoupon);
router.get('/add-coupon', admin.isAdmin, couponController.getCreateCouponForm);
router.post('/addCoupon', admin.isAdmin, couponController.postCreateCoupon);
router.get('/editCoupon/:Id', admin.isAdmin, couponController.getEditCouponForm);
router.post('/editCoupon/:Id', admin.isAdmin, couponController.updateCoupon);
router.get('/deleteCoupon/:Id', admin.isAdmin, couponController.deleteCoupon);

//returnRequest

router.get('/return/requests',  returnController.getReturnRequests);
router.post('/return/approve/:id', returnController.approveReturnRequest);
router.post('/return/reject/:id', returnController.rejectReturnRequest);
router.get('/return/order-details/:id',  returnController.getReturnRequestDetails);


module.exports = router;