const Order = require('../../models/orderSchema');

exports.getOrdersList = async (req, res) => {
    try {
        // Fetch all orders from the database for admin
        const orders = await Order.find().populate('products.productId');

        // Ensure the orders array is passed properly
        res.render('user/orders', { orders });
    } catch (error) {
        console.error('Get orders list error:', error);
        res.status(500).render('error', {
            message: 'Error retrieving orders list'
        });
    }
};

exports.getAdminOrdersList = async (req, res) => {
    try {
        const orders = await Order.find().populate('products.productId');

        res.render('user/orders', { orders: orders || [], message: orders.length ? null : 'No orders found.' });
    } catch (error) {
        console.error('Get admin orders list error:', error);
        res.status(500).render('error', { message: 'Error retrieving orders list' });
    }
};

exports.cancelOrder = async (req, res) => {
    try {
        const { reason } = req.body;
        const order = await Order.findOne({ _id: req.params.id, user: req.user._id });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.products[0].status !== 'Pending') {
            return res.status(400).json({ success: false, message: 'Only pending orders can be cancelled' });
        }

        order.products.forEach(product => {
            product.status = 'Cancelled';
        });

        order.cancellationReason = reason;
        await order.save();

        res.redirect(`/orders?message=Order cancelled successfully`);
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({ success: false, message: 'Error cancelling order' });
    }
};
