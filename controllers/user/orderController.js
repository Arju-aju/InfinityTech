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

      const orderId = req.params.id;

      const { reason } = req.body;

          if (!reason) {
        return res.status(400).json({ message: 'Cancellation reason is required' });
      }
      
      // Find the order in the database
      const order = await Order.findById(orderId);


      if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }


        // Check if the order can be cancelled
        const cancellableStatuses = ['Pending', 'Processing', 'Shipped', 'Out for Delivery'];
        console.log('Order Status:', order.status);
        if (!cancellableStatuses.includes(order.status)) {
            return res.status(400).json({ message: 'This order cannot be cancelled' });
        }

        // Update the order status and save the reason
        order.status = 'Cancelled';
        order.cancellationReason = reason;
        order.cancelledAt = new Date();

        await order.save();
        console.log('Order cancelled successfully');

        return res.status(200).json({ message: 'Order cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling order:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};


exports.returnOrder = async (req, res) => {
    try {
        console.log('1>>>>>>>>>>>>> chayiyan pokuvattoo');
        const { id } = req.params;
        const { reason } = req.body;
        console.log('2>>>>>>>>>>>>>',id);
        console.log('3>>>>>>>>>>>',reason);
        const order = await Order.findById(id);
        console.log('4>>>>>>>>>>>',order);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.status !== 'Delivered') {
            return res.status(400).json({ message: 'Only delivered orders can be returned' });
        }

        // Update order status to 'Return Requested'
        order.status = 'Return Requested';
        order.returnReason = reason; // Store return reason
        await order.save();

        res.status(200).json({ message: 'Return request submitted successfully' });
    } catch (error) {
        console.error('Return Request Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};