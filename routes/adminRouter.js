const express = require('express');
const adminControllers = require('../controllers/Admin/adminController');
const admin = require('../middleware/adminAuth')
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
router.get('/login', admin.isAdmin, adminControllers.loadLogin);
router.post('/login',  adminControllers.login);
router.get('/dashboard',admin.isLogout, adminControllers.loadDashboard);
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
router.delete('/softDeleteProduct/:id', productController.softDelete);


//Order Management

router.get('/orderDetails/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId).populate("user").populate("products.productId");

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.json({
            success: true,
            order: order
        });
    } catch (error) {
        console.log(`Error fetching order details: ${error}`);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
});

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
    router.delete('/deleteOrder/:id', async (req, res) => {
        try {
            const orderId = req.params.id;
            await Order.findByIdAndDelete(orderId);
            res.json({ success: true, message: 'Order deleted successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: 'Server Error' });
        }
    });

    router.post('/updateOrderStatus/:orderId', async (req, res) => {
        try {
            const { orderId } = req.params;
            const { status } = req.body;
    
            const validStatuses = ['pending', 'shipped', 'delivered', 'cancelled'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid Status'
                });
            }
    
            const updatedOrder = await Order.findByIdAndUpdate(
                orderId,
                { status: status },
                { new: true } // Returns the updated document
            );
    
            if (!updatedOrder) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }
    
            res.json({
                success: true,
                message: 'Order status updated successfully',
                status: updatedOrder.status
            });
        } catch (error) {
            console.error(`Error updating order status: ${error}`);
            res.status(500).json({
                success: false,
                message: 'Server Error'
            });
        }
    });
    


module.exports = router;