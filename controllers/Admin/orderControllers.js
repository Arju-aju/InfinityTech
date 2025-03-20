const Order = require('../../models/orderSchema');
const Wallet = require('../../models/walletSchema');
const Product = require('../../models/productSchema'); // Ensure this model exists
const mongoose = require('mongoose');

const OrderPerPage = 10;

// Helper function to calculate refund and update order
const calculateRefundAndUpdateOrder = async (order, productIndex, action, reason) => {
    const product = order.products[productIndex];
    const originalSubtotal = order.products.reduce((sum, p) => sum + p.totalPrice, 0);
    let refundAmount = product.totalPrice;
    let couponAdjustment = 0;

    if (order.couponDiscount > 0 && originalSubtotal > 0) {
        couponAdjustment = (order.couponDiscount * refundAmount) / originalSubtotal;
        refundAmount += couponAdjustment;
    }

    product.status = action === 'cancel' ? 'Cancelled' : 'Returned';
    product[action === 'cancel' ? 'cancellationReason' : 'returnReason'] = reason;
    if (action === 'return') product.returnRequestedAt = new Date();

    const productDoc = await Product.findById(product.productId);
    if (productDoc) {
        productDoc.stock += product.quantity;
        await productDoc.save();
    }

    const activeProducts = order.products.filter(p => p.status === 'Ordered');
    const newSubtotal = activeProducts.reduce((sum, p) => sum + p.totalPrice, 0);

    if (order.couponDiscount > 0 && originalSubtotal > 0) {
        order.couponDiscount = activeProducts.length > 0 
            ? (order.couponDiscount * newSubtotal) / originalSubtotal 
            : 0;
    }

    order.orderAmount = newSubtotal + order.shippingCharge - order.couponDiscount;

    if (activeProducts.length === 0) {
        order.status = action === 'cancel' ? 'Cancelled' : 'Returned';
        order.orderAmount = 0;
        order.shippingCharge = 0;
        order.couponDiscount = 0;
        order[action === 'cancel' ? 'cancelDate' : 'returnRequestedAt'] = new Date().toISOString();
    }

    return { refundAmount, couponAdjustment };
};

exports.getOrders = async (req, res) => {
    try {
        const { search, status, startDate, endDate, minAmount, maxAmount, page = 1 } = req.query;
        const limit = OrderPerPage;
        const skip = (page - 1) * limit;
        
        let query = {};
        
        if (search) {
            if (mongoose.Types.ObjectId.isValid(search)) {
                query._id = search;
            }
        }
        
        if (status && status !== 'All') {
            query.status = status;
        }
        
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }
        
        if (minAmount || maxAmount) {
            query.orderAmount = {};
            if (minAmount) query.orderAmount.$gte = parseFloat(minAmount);
            if (maxAmount) query.orderAmount.$lte = parseFloat(maxAmount);
        }

        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);
        
        let orders = await Order.find(query)
            .populate({ path: 'user', select: 'name email' })
            .populate({ path: 'products.productId', select: 'name price image' })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        if (search && !mongoose.Types.ObjectId.isValid(search)) {
            const searchRegex = new RegExp(search, 'i');
            orders = orders.filter(order => order.user && searchRegex.test(order.user.name));
        }

        const processedOrders = orders.map(order => ({
            ...order,
            user: order.user || { name: 'Unknown User', email: 'No email' },
            products: order.products.map(product => ({
                ...product,
                productId: product.productId || {
                    name: 'Product Unavailable',
                    price: 0,
                    image: '/placeholder-image.jpg'
                }
            }))
        }));

        res.render('admin/orders', {
            path: req.path,
            orders: processedOrders,
            filters: { search, status, startDate, endDate, minAmount, maxAmount },
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                totalOrders
            }
        });
    } catch (error) {
        console.error('Error in getOrders:', error);
        res.status(500).render('error', { message: 'Error fetching orders', error: error.message });
    }
};

exports.toggleOrderStatus = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { status } = req.body;

        if (!orderId || !status) {
            return res.status(400).json({ success: false, message: 'Order ID and status are required' });
        }

        const validStatuses = ["Pending", "Processing", "Shipped", "Out for Delivery", "Delivered", "Cancelled"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status value' });
        }

        const order = await Order.findById(orderId).populate('user');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const statusFlow = {
            "Pending": ["Processing", "Cancelled"],
            "Processing": ["Shipped", "Cancelled"],
            "Shipped": ["Out for Delivery", "Cancelled"],
            "Out for Delivery": ["Delivered", "Cancelled"],
            "Delivered": ["Cancelled"],
            "Cancelled": []
        };

        if (!statusFlow[order.status]?.includes(status)) {
            return res.status(400).json({ success: false, message: `Cannot change status from ${order.status} to ${status}` });
        }

        if (status === "Cancelled" && order.status !== "Cancelled") {
            const activeProducts = order.products.filter(p => p.status === 'Ordered');
            if (activeProducts.length > 0) {
                let wallet = await Wallet.findOne({ userId: order.user._id });
                if (!wallet) {
                    wallet = new Wallet({ userId: order.user._id, balance: 0, transactions: [] });
                }

                const refundAmount = order.orderAmount;
                order.products.forEach(p => {
                    if (p.status === 'Ordered') {
                        p.status = 'Cancelled';
                        p.cancellationReason = 'Order cancelled by admin';
                    }
                });

                wallet.balance += refundAmount;
                wallet.transactions.push({
                    amount: refundAmount,
                    type: 'credit',
                    date: new Date(),
                    description: `Refund for order #${order._id} cancellation`
                });

                order.cancellationReason = "Cancelled by admin";
                order.cancelDate = new Date().toISOString();
                order.orderAmount = 0;
                order.shippingCharge = 0;
                order.couponDiscount = 0;

                await wallet.save();
            }
        }

        order.status = status;
        await order.save();

        res.json({ success: true, message: 'Order status updated successfully', newStatus: order.status });
    } catch (error) {
        console.error('Error in toggleOrderStatus:', error);
        res.status(500).json({ success: false, message: 'Error updating order status' });
    }
};

exports.viewOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('user')
            .populate({ path: 'products.productId', select: 'name images price' });
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        
        const formattedDate = new Date(order.createdAt).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        res.render('admin/viewdetails', { order: { ...order.toObject(), formattedDate } });
    } catch (error) {
        console.error('Error in viewOrderDetails:', error);
        res.status(500).json({ success: false, message: 'Error viewing order details' });
    }
};

exports.cancelProduct = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { productIndex, reason } = req.body;

        if (!orderId || productIndex === undefined || !reason) {
            return res.status(400).json({ success: false, message: 'Order ID, product index, and reason are required' });
        }

        const order = await Order.findById(orderId).populate('user').populate('products.productId');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (!['Pending', 'Processing'].includes(order.status)) {
            return res.status(400).json({ success: false, message: 'Cannot cancel products in this order status' });
        }

        if (!order.products[productIndex] || order.products[productIndex].status !== 'Ordered') {
            return res.status(400).json({ success: false, message: 'Invalid product or already processed' });
        }

        const { refundAmount } = await calculateRefundAndUpdateOrder(order, productIndex, 'cancel', reason);

        let wallet = await Wallet.findOne({ userId: order.user._id });
        if (!wallet) {
            wallet = new Wallet({ userId: order.user._id, balance: 0, transactions: [] });
        }

        wallet.balance += refundAmount;
        wallet.transactions.push({
            amount: refundAmount,
            type: 'credit',
            date: new Date(),
            description: `Refund for cancelled product ${order.products[productIndex].productId.name} from Order #${order._id}`
        });

        await Promise.all([order.save(), wallet.save()]);

        res.json({
            success: true,
            message: 'Product cancelled successfully and refund added to wallet',
            updatedOrder: {
                orderAmount: order.orderAmount,
                status: order.status,
                products: order.products
            },
            walletBalance: wallet.balance
        });
    } catch (error) {
        console.error('Error in cancelProduct:', error);
        res.status(500).json({ success: false, message: 'Error cancelling product' });
    }
};

exports.returnProduct = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { productIndex, reason } = req.body;

        if (!orderId || productIndex === undefined || !reason) {
            return res.status(400).json({ success: false, message: 'Order ID, product index, and reason are required' });
        }

        const order = await Order.findById(orderId).populate('user').populate('products.productId');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status !== 'Delivered') {
            return res.status(400).json({ success: false, message: 'Can only return delivered products' });
        }

        if (!order.products[productIndex] || order.products[productIndex].status !== 'Ordered') {
            return res.status(400).json({ success: false, message: 'Invalid product or already processed' });
        }

        order.products[productIndex].status = 'Return Requested';
        order.products[productIndex].returnReason = reason;
        order.products[productIndex].returnRequestedAt = new Date();

        await order.save();

        res.json({
            success: true,
            message: 'Return request submitted successfully',
            updatedOrder: {
                orderAmount: order.orderAmount,
                status: order.status,
                products: order.products
            }
        });
    } catch (error) {
        console.error('Error in returnProduct:', error);
        res.status(500).json({ success: false, message: 'Error processing return request' });
    }
};

exports.approveReturn = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { productIndex } = req.body;

        const order = await Order.findById(orderId).populate('user').populate('products.productId');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.products[productIndex].status !== 'Return Requested') {
            return res.status(400).json({ success: false, message: 'No return request found for this product' });
        }

        const { refundAmount } = await calculateRefundAndUpdateOrder(order, productIndex, 'return', order.products[productIndex].returnReason);

        let wallet = await Wallet.findOne({ userId: order.user._id });
        if (!wallet) {
            wallet = new Wallet({ userId: order.user._id, balance: 0, transactions: [] });
        }

        wallet.balance += refundAmount;
        wallet.transactions.push({
            amount: refundAmount,
            type: 'credit',
            date: new Date(),
            description: `Refund for returned product ${order.products[productIndex].productId.name} from Order #${order._id}`
        });

        await Promise.all([order.save(), wallet.save()]);

        res.json({
            success: true,
            message: 'Return approved and refund processed',
            updatedOrder: {
                orderAmount: order.orderAmount,
                status: order.status,
                products: order.products
            },
            walletBalance: wallet.balance
        });
    } catch (error) {
        console.error('Error in approveReturn:', error);
        res.status(500).json({ success: false, message: 'Error approving return' });
    }
};

module.exports = exports;