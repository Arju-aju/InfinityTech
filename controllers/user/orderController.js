const Order = require('../../models/orderSchema');
const Return = require('../../models/returnSchema');
const User = require('../../models/userSchema');
const { refundToWallet } = require('./walletController');

exports.getOrdersList = async (req, res) => {
    try {
        const userId = req.user._id;

        const orders = await Order.find({ user: userId })
            .populate({
                path: 'products.productId',
                select: 'name images price'
            })
            .sort({ createdAt: -1 });

        const userProfile = await User.findById(userId).select('name email');

        console.log('Orders:', JSON.stringify(orders, null, 2));
        console.log('User Profile:', userProfile);

        res.render('user/orders', { orders, userProfile });
    } catch (error) {
        console.error('Get orders list error:', error);
        res.status(500).render('error', {
            message: 'Error retrieving your orders'
        });
    }
};

exports.getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.user._id;

        console.log('Fetching order with ID:', orderId, 'for user:', userId);

        const order = await Order.findOne({ _id: orderId, user: userId })
            .populate('user', 'name email phone')
            .populate({
                path: 'products.productId',
                select: 'name images price'
            })
            .populate('couponApplied', 'code offerValue offerType');

        const userProfile = await User.findById(userId).select('name email');

        if (!order) {
            console.log('Order not found for ID:', orderId);
            return res.status(404).render('error', {
                message: 'Order not found'
            });
        }

        order.status = order.status || 'Pending';

        console.log('Order found:', JSON.stringify(order, null, 2));
        console.log('User Profile:', JSON.stringify(userProfile, null, 2));

        res.render('user/orderDetails', { 
            order, 
            userProfile, 
            success_msg: req.flash('success_msg'), 
            error_msg: req.flash('error_msg') 
        });
    } catch (error) {
        console.error('Get order details error:', error);
        res.status(500).render('error', {
            message: 'Error retrieving order details'
        });
    }
};

exports.cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { reason } = req.body;

        const order = await Order.findOne({ _id: orderId, user: req.user._id });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (!['Pending', 'Processing', 'Out for Delivery', 'Shipped'].includes(order.status)) {
            return res.status(400).json({ success: false, message: 'Order cannot be cancelled at this stage' });
        }

        order.status = 'Cancelled';
        order.cancellationReason = reason;
        order.cancelDate = new Date();

        // Refund to wallet if payment was made online
        if (order.paymentMethod !== 'COD') {
            await refundToWallet(order._id, order.user, order.orderAmount, `Refund for cancelled order #${order._id}`);
        }

        await order.save();

        res.status(200).json({ success: true, message: 'Order cancelled successfully' });
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({ success: false, message: 'Error cancelling order' });
    }
};

exports.returnOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { reason } = req.body;

        const order = await Order.findOne({ _id: orderId, user: req.user._id });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status !== 'Delivered') {
            return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
        }

        order.status = 'Return Requested';
        order.returnReason = reason;
        order.returnRequestedAt = new Date();
        await order.save();

        res.status(200).json({ success: true, message: 'Return request submitted successfully' });
    } catch (error) {
        console.error('Return order error:', error);
        res.status(500).json({ success: false, message: 'Error submitting return request' });
    }
};

exports.approveReturn = async (req, res) => {
    try {
        const { returnId } = req.params;

        const returnDoc = await Return.findById(returnId);
        if (!returnDoc) {
            req.flash('error_msg', 'Return request not found');
            return res.redirect('/admin/returns');
        }

        const order = await Order.findById(returnDoc.orderId);
        if (!order) {
            req.flash('error_msg', 'Order not found');
            return res.redirect('/admin/returns');
        }

        order.status = 'Returned';
        order.returnApprovedAt = new Date();

        order.products.forEach(product => {
            if (product.status === 'Return Requested') {
                product.status = 'Returned';
            }
        });

        await order.save();

        returnDoc.status = 'Approved';
        await returnDoc.save();

        const refundAmount = order.orderAmount;
        await refundToWallet(order._id, order.user, refundAmount, `Refund for approved return of order #${order._id}`);

        req.flash('success_msg', 'Return approved and amount refunded to user wallet');
        res.redirect('/admin/returns');
    } catch (error) {
        console.error('Error approving return:', error);
        req.flash('error_msg', 'Server error while approving return');
        res.redirect('/admin/returns');
    }
};

exports.cancelProduct = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { productIndex, reason } = req.body;

        const order = await Order.findOne({ _id: orderId, user: req.user._id });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (!['Pending', 'Processing'].includes(order.status)) {
            return res.status(400).json({ success: false, message: 'Products can only be cancelled in Pending or Processing status' });
        }

        const product = order.products[productIndex];
        if (!product || product.status !== 'Active') {
            return res.status(400).json({ success: false, message: 'Product cannot be cancelled' });
        }

        product.status = 'Cancelled';
        product.cancellationReason = reason;
        product.cancelDate = new Date();

        // Update order amount if necessary
        order.orderAmount -= product.totalPrice;

        // Check if all products are cancelled
        const activeProducts = order.products.filter(p => p.status === 'Active');
        if (activeProducts.length === 0) {
            order.status = 'Cancelled';
        }

        await order.save();

        res.status(200).json({ success: true, message: 'Product cancelled successfully' });
    } catch (error) {
        console.error('Cancel product error:', error);
        res.status(500).json({ success: false, message: 'Error cancelling product' });
    }
};

exports.returnProduct = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { productIndex, reason } = req.body;

        const order = await Order.findOne({ _id: orderId, user: req.user._id });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status !== 'Delivered') {
            return res.status(400).json({ success: false, message: 'Only delivered products can be returned' });
        }

        const product = order.products[productIndex];
        if (!product || product.status !== 'Active') {
            return res.status(400).json({ success: false, message: 'Product cannot be returned' });
        }

        product.status = 'Return Requested';
        product.returnReason = reason;
        product.returnRequestedAt = new Date();

        // Check if all products are requested for return
        const activeProducts = order.products.filter(p => p.status === 'Active');
        if (activeProducts.length === 0) {
            order.status = 'Return Requested';
        }

        await order.save();

        // Create return document
        const returnDoc = new Return({
            orderId,
            user: req.user._id,
            reason,
            items: [{ productId: product.productId, quantity: product.quantity }],
            status: 'Pending'
        });
        await returnDoc.save();

        res.status(200).json({ success: true, message: 'Product return request submitted successfully' });
    } catch (error) {
        console.error('Return product error:', error);
        res.status(500).json({ success: false, message: 'Error submitting return request for product' });
    }
};

module.exports = exports;