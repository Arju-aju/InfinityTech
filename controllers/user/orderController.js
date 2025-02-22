const Order = require('../../models/orderSchema');

exports.getOrdersList = async (req, res) => {
    try {
        // Get the logged-in user's ID
        const userId = req.user._id;

        // Fetch orders and populate product details
        const orders = await Order.find({ user: userId })
            .populate({
                path: 'products.productId',
                select: 'name images price'
            })
            .sort({ createdAt: -1 });

        // Debugging to check product details
        console.log('Orders:', JSON.stringify(orders, null, 2));

        // Render orders page
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

        // Find the order and populate necessary fields
        const order = await Order.findOne({ _id: orderId, user: userId })
            .populate('user', 'name email phone')
            .populate({
                path: 'products.productId',
                select: 'name images price'
            });
        
        console.log('1>>>>>>>>',order.products[0].productId.images[0]);

        

        if (!order) {
            return res.status(404).render('error', {
                message: 'Order not found'
            });
        }

        // Render the order details page
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
        const { reason } = req.body;

        // Input validation
        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cancellation reason is required' 
            });
        }

        // Find order with authentication check
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

        // Check if order can be cancelled (Pending, Processing, Shipped)
        const allowedStatuses = ['Pending', 'Processing', 'Shipped'];
        if (!allowedStatuses.includes(order.status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Only orders that are Pending, Processing, or Shipped can be cancelled' 
            });
        }

        // Update order status
        order.status = 'Cancelled';
        order.cancellationReason = reason.trim();
        await order.save();

        // Redirect to orders page after successful cancellation
        return res.redirect('/user/orders'); // <-- Redirects to orders page

    } catch (error) {
        console.error('Cancel order error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'An internal server error occurred',
            error: error.message
        });
    }
};
