const Order = require('../../models/orderSchema')

exports.getOrderDetails =  async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            user: req.user._id
        }).populate('products.productId');

        if (!order) {
            return res.status(404).render('error', {
                message: 'Order not found'
            });
        }

        res.render('order', { order, successMessage: req.flash('success') || [] });


    } catch (error) {
        console.error('Get order details error:', error);
        res.status(500).render('error', {
            message: 'Error retrieving order details'
        });
    }
}

exports.cancelOrder = async (req,res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            user: req.user._id
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check if order can be cancelled (only pending orders)
        if (order.products[0].status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: 'Only pending orders can be cancelled'
            });
        }

        // Update all products in the order to cancelled status
        order.products.forEach(product => {
            product.status = 'Cancelled';
        });

        await order.save();

        // Redirect back to order details with success message
        res.redirect(`/orders/${order._id}?message=Order cancelled successfully`);

    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling order'
        });
    }
}