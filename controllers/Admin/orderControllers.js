const Order = require('../../models/orderSchema');

const OrderPerPage = 10;

exports.getOrders = async (req, res) => {
    try {
        const { search, status, startDate, endDate, minAmount, maxAmount } = req.query;

        let query = {};

        // Check if search is a valid ObjectId (for order ID search)
        if (search) {
            if (mongoose.Types.ObjectId.isValid(search)) {
                query._id = search; // Exact match for ObjectId
            }
        }

        // Status filter
        if (status && status !== 'All') {
            query.status = status;
        }

        // Date range filter with proper checks
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        // Amount range filter
        if (minAmount || maxAmount) {
            query.orderAmount = {};
            if (minAmount) query.orderAmount.$gte = parseFloat(minAmount);
            if (maxAmount) query.orderAmount.$lte = parseFloat(maxAmount);
        }

        let orders = await Order.find(query)
            .populate({
                path: 'user',
                select: 'name email'
            })
            .populate({
                path: 'products.productId',
                select: 'name price image'
            })
            .sort({ createdAt: -1 })
            .lean();

        // If search is by user name, filter manually
        if (search && !mongoose.Types.ObjectId.isValid(search)) {
            const searchRegex = new RegExp(search, 'i');
            orders = orders.filter(order => order.user && searchRegex.test(order.user.name));
        }

        // Process orders to handle null/undefined values
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
            orders: processedOrders,
            filters: { search, status, startDate, endDate, minAmount, maxAmount }
        });
    } catch (error) {
        console.error('Error in getOrders:', error);
        res.status(500).render('error', {
            message: 'Error fetching orders',
            error: error.message
        });
    }
};
exports.toggleOrderStatus = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        console.log('orderId+++++++++++++++',orderId);
        const { status } = req.body;

        if (!orderId || !status) {
            return res.status(400).json({ success: false, message: 'Order ID and status are required' });
        }

        const validStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status value' });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
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
        // Fetch order details from the database
        const order = await Order.findById(orderId).populate('user').populate({
            path:'products.productId',
            select:'name images price'
        });
        console.log('OrderId>>>>>>>>>>>>>====',order);
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        
        // Format date if needed
        const formattedDate = new Date(order.createdAt).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        // Render viewDetails page with order data
        res.render('admin/viewdetails', { order: { ...order.toObject(), formattedDate } });
    } catch (error) {
        console.error('Error in toggleOrderStatus:', error);
        res.status(500).json({ success: false, message: 'Error viewing order details' });
    }
};


