const Order =  require('../../models/orderSchema')

const OrderPerPage = 10

exports.getOrders = async(req,res) => {
    try {
        
        const page = parseInt(req.query.page) || 1
        const search = req.query.search || '';
        const status = req.query.status || '';
        const fromDate = req.query.fromDate || '';
        const toDate = req.query.toDate || '';

        const query = {}

        // Search filter
        if(search) {
            query.$or = [
                {orderId : {$regex: search , $options: 'i'}},
                {customerName: {$regex: search , $options :'i'}},
                {customerEmail : {$regex:search , $options :'i'}}
                
            ]
        }

        // Status filter
        if(status){
            query.status = status
        }


        // Date range filter
        if (fromDate || toDate) {
            query.orderDate = {};
            if (fromDate) {
                query.orderDate.$gte = new Date(fromDate);
            }
            if (toDate) {
                query.orderDate.$lte = new Date(toDate + 'T23:59:59.999Z');
            }
        }

         // Count total documents for pagination
        const totalItems = await Order.countDocuments(query)
        const totalPages = Math.ceil(totalItems/OrderPerPage)

           // Get orders with pagination
        const orders = await Order.find(query)
            .sort({orderDate:-1})
            .skip((page - 1) * OrderPerPage)
            .limit(OrderPerPage)

        // Build query string for pagination links
        const queryParams = new URLSearchParams({
            search,
            status,
            fromDate,
            toDate
        }).toString()


        //Render the template with data

        res.render('admin/orders',{
            orders,
            currentPage : page,
            totalPages,
            totalItems,
            limit:OrderPerPage,
            searchQuery:search,
            status,
            fromDate,
            toDate,
            queryString: queryParams
        })

    } catch (error) {
        console.error('Error in getOrders:', error);
        res.status(500).render('error', {
            message: 'Error loading orders',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
}

exports.getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;

        // Validate orderId
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Order ID'
            });
        }

        const order = await Order.findById(orderId)
            .populate('user', 'name email phone')
            .populate('products.productId', 'name price');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Return JSON response
        res.json(order);
    } catch (error) {
        console.error('Error in getOrderDetails:', error);
        res.status(500).json({
            success: false,
            message: 'Error loading order details',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderId, productId, status } = req.body;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const productIndex = order.products.findIndex(
            p => p._id.toString() === productId
        );

        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: 'Product not found in order' });
        }

        order.products[productIndex].status = status;
        await order.save();

        res.json({ success: true, message: 'Order status updated successfully' });
    } catch (error) {
        console.error('Error in updateOrderStatus:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating order status'
        });
    }
};

