const express = require('express');
const adminControllers = require('../controllers/Admin/adminController');
const {preventBack} = require('../middleware/adminAuth')
const customerController = require('../controllers/Admin/customerController');
const categoryController = require('../controllers/Admin/categoryController')
const productController = require('../controllers/Admin/productController')
const router = express.Router();
const Product = require('../models/productSchema');
const Order = require('../models/orderSchema')
const { upload } = require('../config/multer');
const validationMiddleware = require('../middleware/validation');

// Admin Authentication Routes
router.get('/pageerror', adminControllers.pageerror);
router.get('/login', preventBack, adminControllers.loadLogin);
router.post('/login',  adminControllers.login);
router.get('/dashboard',preventBack, adminControllers.loadDashboard);
router.get('/logout', adminControllers.logout);

// User Management Routes
router.get('/users', customerController.customerInfo); 
router.post('/users/block/:id',  customerController.blockUser);

// Category Management Routes
router.get('/categories', categoryController.categoryInfo);
router.get('/categories/:id', categoryController.getCategoryDetails);
router.get('/addCategory',  categoryController.loadCategory);
router.post('/addCategory',   categoryController.addCategory);
router.get('/editCategory/:id',   categoryController.loadEditCategory);
router.put('/updateCategory/:id',   categoryController.updateCategory);
router.put('/toggleCategoryStatus/:id',   categoryController.toggleCategoryStatus);

// Product Management 
router.get('/products',   productController.loadProduct);
router.get('/addProduct',   productController.loadAddProduct);
router.post('/addProduct',   upload.array('images', 5), validationMiddleware.validateProduct, productController.addProduct);
router.get('/editProduct/:id',   productController.loadEditProduct);
router.post('/editProduct/:id',   upload.array('images', 5), validationMiddleware.validateProduct, productController.updateProduct);
router.delete('/deleteProduct/:id',   productController.deleteProduct);
router.delete('/deleteProductImage/:productId/:imagePath',   productController.deleteProductImage);
router.patch('/products/:id/toggle-list',   productController.toggleListStatus)
// router.patch('/products/:id/soft-delete',   productController.softDelete);
router.delete('/softDeleteProduct/:id', productController.softDelete);


//Order Management
router.get('/orders', async(req,res)=>{
    try {
        const orders = await Order.find().populate("user").populate("products.productId");
        res.render("admin/orders", { orders });
      } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
      }
    });

router.post('/orders',async (req,res) =>{
    try {
        const { status } = req.body;
        await Order.findByIdAndUpdate(req.params.id, { status });
        res.redirect("/admin/orders");
      } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
      }
    });
    
    // Delete an order
    router.post("/orders/delete/:id", async (req, res) => {
      try {
        await Order.findByIdAndDelete(req.params.id);
        res.redirect("/admin/orders");
      } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
      }
    });

module.exports = router;