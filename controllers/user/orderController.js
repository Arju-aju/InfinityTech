const Order = require('../../models/orderSchema');

exports.getOrdersList = async (req, res) => {
    try {
        // Get the logged-in user's ID
        const userId = req.user._id;

        const orders = await Order.find({user:userId})
        .populate({
            path: 'products.productId',
            select: 'name image price'
        })
        .sort({createdAt:-1})
        console.log('orders details varu>>>>>>>>>>>>',orders);
        res.render('user/orders',{orders})

    } catch (error) {
        console.error('Get orders list error:', error);
        res.status(500).render('error', {
            message: 'Error retrieving your orders'
        });
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
