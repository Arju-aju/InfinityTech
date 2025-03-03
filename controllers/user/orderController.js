const Order = require('../../models/orderSchema');
const Return = require('../../models/returnSchema');
const { refundToWallet } = require('./walletController'); // Import refundToWallet

exports.getOrdersList = async (req, res) => {
    try {
        const userId = req.user._id;
        const orders = await Order.find({ user: userId })
            .populate({
                path: 'products.productId',
                select: 'name images price'
            })
            .sort({ createdAt: -1 });

        console.log('Orders:', JSON.stringify(orders, null, 2));
        res.render('user/orders', { orders });
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

        const order = await Order.findOne({ _id: orderId, user: userId })
            .populate('user', 'name email phone')
            .populate({
                path: 'products.productId',
                select: 'name images price'
            });

        if (!order) {
            return res.status(404).render('error', {
                message: 'Order not found'
            });
        }

        res.render('user/orderDetails', { order });
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

        if (!reason) {
            req.flash('error_msg', 'Cancellation reason is required');
            return res.redirect(`/orders/${orderId}`);
        }

        const order = await Order.findById(orderId);
        if (!order) {
            req.flash('error_msg', 'Order not found');
            return res.redirect('/orders');
        }

        const cancellableStatuses = ['Pending', 'Processing', 'Shipped', 'Out for Delivery'];
        if (!cancellableStatuses.includes(order.status)) {
            req.flash('error_msg', 'This order cannot be cancelled');
            return res.redirect(`/orders/${orderId}`);
        }

        order.status = 'Cancelled';
        order.cancellationReason = reason;
        order.cancelDate = new Date().toISOString();
        await order.save();

        // Refund to wallet
        const refundAmount = order.orderAmount;
        await refundToWallet(orderId, order.user, refundAmount, `Refund for cancelled order #${orderId}`);

        req.flash('success_msg', 'Order cancelled successfully and amount refunded to wallet');
        res.redirect('/orders');
    } catch (error) {
        console.error('Error cancelling order:', error);
        req.flash('error_msg', 'Server error while cancelling order');
        res.redirect(`/orders/${orderId}`);
    }
};

exports.returnOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            req.flash('error_msg', 'Order not found');
            return res.redirect('/orders');
        }

        if (order.status !== 'Delivered') {
            req.flash('error_msg', 'Only delivered orders can be returned');
            return res.redirect(`/orders/${orderId}`);
        }

        order.status = 'Return Requested';
        order.returnReason = reason;
        order.returnRequestedAt = new Date();
        await order.save();

        const returnDoc = new Return({
            orderId,
            user: req.user._id,
            reason,
            items: order.products.map(p => ({ productId: p.productId, quantity: p.quantity })),
            status: 'Pending' // Added status field
        });
        await returnDoc.save();

        // Note: Refund is not immediate here; it waits for approval
        req.flash('success_msg', 'Return request submitted successfully');
        res.redirect(`/orders/${orderId}`);
    } catch (error) {
        console.error('Error in returnOrder:', error);
        req.flash('error_msg', 'Server error while submitting return request');
        res.redirect(`/orders/${orderId}`);
    }
};

// Optional: Admin approval for returns
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
        await order.save();

        returnDoc.status = 'Approved';
        await returnDoc.save();

        // Refund to wallet upon approval
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