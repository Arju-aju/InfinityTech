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
            .populate('couponApplied', 'code offerValue offerType'); // Populate coupon details if needed

        const userProfile = await User.findById(userId).select('name email');

        if (!order) {
            console.log('Order not found for ID:', orderId);
            return res.status(404).render('error', {
                message: 'Order not found'
            });
        }

        // Fallback for undefined status
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
            return res.status(404).json({ message: 'Order not found' });
        }

        if (!['Pending', 'Processing', 'Out for Delivery', 'Shipped'].includes(order.status)) {
            return res.status(400).json({ message: 'Order cannot be cancelled at this stage' });
        }

        order.status = 'Cancelled';
        order.cancellationReason = reason;
        order.cancelDate = new Date();
        await order.save();

        res.status(200).json({ success: true, message: 'Order cancelled successfully' });
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({ message: 'Error cancelling order' });
    }
};

exports.returnOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { reason } = req.body;

        const order = await Order.findOne({ _id: orderId, user: req.user._id });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.status !== 'Delivered') {
            return res.status(400).json({ message: 'Only delivered orders can be returned' });
        }

        order.status = 'Return Requested';
        order.returnReason = reason;
        order.returnRequestedAt = new Date();
        await order.save();

        res.status(200).json({ success: true, message: 'Return request submitted successfully' });
    } catch (error) {
        console.error('Return order error:', error);
        res.status(500).json({ message: 'Error submitting return request' });
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

        // Update all "Return Requested" products to "Returned"
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

exports.returnProduct = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { productIndex, reason } = req.body;

        const order = await Order.findOne({ _id: orderId, user: req.user._id });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.status !== 'Delivered') {
            return res.status(400).json({ message: 'Only delivered products can be returned' });
        }

        const product = order.products[productIndex];
        if (!product || product.status !== 'Delivered') {
            return res.status(400).json({ message: 'Product cannot be returned' });
        }

        product.status = 'Return Requested';
        product.returnReason = reason;
        await order.save();

        res.status(200).json({ success: true, message: 'Return request for product submitted successfully' });
    } catch (error) {
        console.error('Return product error:', error);
        res.status(500).json({ message: 'Error submitting return request for product' });
    }
};

exports.returnProduct = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { productIndex, reason } = req.body;

        if (!reason) {
            req.flash('error_msg', 'Return reason is required');
            return res.redirect(`/orders/${orderId}`);
        }

        const order = await Order.findById(orderId);
        if (!order) {
            req.flash('error_msg', 'Order not found');
            return res.redirect('/orders');
        }

        if (order.status !== 'Delivered') {
            req.flash('error_msg', 'Products can only be returned from delivered orders');
            return res.redirect(`/orders/${orderId}`);
        }

        const product = order.products[productIndex];
        if (!product || product.status !== 'Active') {
            req.flash('error_msg', 'Product cannot be returned');
            return res.redirect(`/orders/${orderId}`);
        }

        // Update product status
        product.status = 'Return Requested';
        product.returnReason = reason;
        product.returnRequestedAt = new Date();

        // Update overall order status if all products are requested for return
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

        req.flash('success_msg', 'Product return request submitted successfully');
        res.redirect(`/orders/${orderId}`);
    } catch (error) {
        console.error('Error returning product:', error);
        req.flash('error_msg', 'Server error while submitting product return request');
        res.redirect(`/orders/${orderId}`);
    }
};

module.exports = exports;