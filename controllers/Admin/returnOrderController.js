const ReturnRequest = require('../../models/returnSchema');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');


// Format price with INR symbol
const formatPrice = (price) => {
    return typeof price === 'number' ? `₹${price.toFixed(2)}` : '₹0.00';
};

// Format date to a readable string
const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

// Get status color for UI
const getStatusColor = (status) => {
    switch (status) {
        case 'Pending': return 'bg-yellow-600';
        case 'Approved': return 'bg-green-600';
        case 'Rejected': return 'bg-red-600';
        default: return 'bg-gray-600';
    }
};

// Fetch all return requests
exports.getReturnRequests = async (req, res) => {
    try {
        const returnRequests = await ReturnRequest.find()
            .populate('orderId', '_id') // Minimal population to avoid overload
            .populate('user', 'name')   // Adjust based on your user schema
            .populate('items.productId', 'name price images')
            .lean();

        const formattedRequests = returnRequests.map((request) => ({
            _id: request._id,
            orderId: request.orderId?._id || 'Unknown Order',
            returnStatus: request.status || 'Pending',
            reason: request.reason || 'No reason provided',
            comments: 'No comments', // Static for now; adjust if dynamic
            items: request.items.map((item) => ({
                productDetails: {
                    name: item.productId?.name || 'Unknown Product',
                    price: item.productId?.price || 0,
                    image: item.productId?.images?.[0] || '/images/placeholder-product.jpg',
                },
                quantity: item.quantity || 0,
                valid: true,
            })),
        }));

        res.render('returnOrder', {
            returnRequests: formattedRequests,
            formatPrice,
        });
    } catch (error) {
        console.error('Error fetching return requests:', error);
        req.flash('error', 'Error fetching return requests');
        res.status(500).render('error', { message: 'Server Error' });
    }
};

// Fetch details of a specific return request
exports.getReturnRequestDetails = async (req, res) => {
    try {
        const returnId = req.params.id;
        const returnRequest = await ReturnRequest.findById(returnId)
            .populate({
                path: 'orderId',
                select: '_id user createdAt', // Include user and createdAt from Order
                populate: {
                    path: 'user', // Populate nested user field
                    select: 'name email phone' // Fetch required user fields
                }
            })
            .populate('user', 'name email phone') // Direct user field in ReturnRequest (optional)
            .populate('items.productId', 'name price images')
            .lean();

        if (!returnRequest) {
            req.flash('error', 'Return request not found');
            return res.redirect('/admin/return/requests');
        }

        const formattedRequest = {
            _id: returnRequest._id,
            orderId: returnRequest.orderId || {}, // Ensure orderId is an object
            returnStatus: returnRequest.status || 'Pending',
            reason: returnRequest.reason || 'No reason provided',
            comments: 'No comments', // Static for now
            items: returnRequest.items.map((item) => ({
                productDetails: {
                    name: item.productId?.name || 'Unknown Product',
                    price: item.productId?.price || 0,
                    image: item.productId?.images?.[0] || '/images/placeholder-product.jpg',
                },
                quantity: item.quantity || 0,
                valid: true,
            })),
        };

        res.render('returnDetails', {
            returnRequest: formattedRequest,
            formatPrice,
            formatDate,
            getStatusColor,
        });
    } catch (error) {
        console.error('Error fetching return request details:', error);
        req.flash('error', 'Error fetching return request details');
        res.redirect('/admin/return/requests');
    }
};

// Approve a return request
exports.approveReturnRequest = async (req, res) => {
    try {
        const returnId = req.params.id;
        const returnDoc = await ReturnRequest.findById(returnId)
            .populate('orderId')
            .populate('items.productId', 'price');

        if (!returnDoc) {
            req.flash('error', 'Return request not found');
            return res.redirect('/admin/return/requests');
        }
        if (returnDoc.status !== 'Pending') {
            req.flash('error', 'Cannot approve this request');
            return res.redirect('/admin/return/requests');
        }

        const order = await Order.findById(returnDoc.orderId._id).populate('couponApplied');
        if (!order) {
            req.flash('error', 'Order not found');
            return res.redirect('/admin/return/requests');
        }

        // Calculate the refund amount for returned items
        let refundAmount = 0;
        let totalProductAmount = 0;

        // Calculate total product amount in the order for proportion calculation
        for (const product of order.products) {
            totalProductAmount += product.price * product.quantity;
        }

        // Calculate the refund amount for returned items
        for (const item of returnDoc.items) {
            const product = item.productId;
            refundAmount += product.price * item.quantity;
        }

        // Adjust for coupon discount (if applied)
        if (order.couponDiscount > 0) {
            const totalOrderAmount = totalProductAmount;
            const couponDiscount = order.couponDiscount || 0;
            const discountProportion = refundAmount / totalOrderAmount;
            const couponAdjustment = couponDiscount * discountProportion;
            refundAmount -= couponAdjustment;
        }

        // Adjust for shipping charge (proportional to the returned items)
        const shippingCharge = order.shippingCharge || 0;
        const shippingProportion = refundAmount / totalProductAmount;
        const shippingAdjustment = shippingCharge * shippingProportion;
        refundAmount += shippingAdjustment;

        // Ensure refund amount is not negative
        if (refundAmount < 0) refundAmount = 0;

        // Update product status in the order
        let updated = false;
        for (const item of returnDoc.items) {
            const product = order.products.find((p) =>
                p.productId.toString() === item.productId._id.toString()
            );
            if (product) {
                console.log(`Found product: ${product.productId}, Current Status: ${product.status}`);
                if (product.status === 'Return Requested') {
                    product.status = 'Returned';
                    updated = true;
                    console.log(`Updated product ${product.productId} status to 'Returned'`);
                }
            } else {
                console.log(`Product ${item.productId._id} not found in order ${order._id}`);
            }
        }

        // Mark the products array as modified
        if (updated) {
            order.markModified('products');
            await order.save();
            console.log('Order saved with updated product statuses');
        } else {
            console.log('No products updated in the order');
        }

        // Update return request status
        returnDoc.status = 'Approved';
        await returnDoc.save();

        // Add refund amount to user's wallet
        let wallet = await Wallet.findOne({ userId: returnDoc.user });
        if (!wallet) {
            wallet = new Wallet({
                userId: returnDoc.user,
                balance: 0,
                transactions: []
            });
        }

        wallet.balance += refundAmount;
        wallet.transactions.push({
            amount: refundAmount,
            type: 'credit',
            date: new Date(),
            time: new Date(),
            description: `Refund for return request #${returnDoc._id.toString().substring(0, 8)} (includes proportional shipping)`
        });
        await wallet.save();

        req.flash('success', `Return request approved successfully. ${formatPrice(refundAmount)} credited to wallet (includes proportional shipping).`);
        res.redirect('/admin/return/requests');
    } catch (error) {
        console.error('Error approving return request:', error);
        req.flash('error', 'Error approving return request');
        res.redirect('/admin/return/requests');
    }
};

// Reject a return request
exports.rejectReturnRequest = async (req, res) => {
    try {
        const returnId = req.params.id;
        const returnDoc = await ReturnRequest.findById(returnId).populate('orderId');
        if (!returnDoc) {
            req.flash('error', 'Return request not found');
            return res.redirect('/admin/return/requests');
        }
        if (returnDoc.status !== 'Pending') {
            req.flash('error', 'Cannot reject this request');
            return res.redirect('/admin/return/requests');
        }

        const order = await Order.findById(returnDoc.orderId?._id);
        if (order) {
            for (const item of returnDoc.items) {
                const product = order.products.find((p) =>
                    p.productId.equals(item.productId)
                );
                if (product && product.status === 'Return Requested') {
                    product.status = 'Active'; // Revert to Active if rejected
                }
            }
            await order.save();
        }

        returnDoc.status = 'Rejected';
        await returnDoc.save();

        req.flash('success', 'Return request rejected successfully');
        res.redirect('/admin/return/requests');
    } catch (error) {
        console.error('Error rejecting return request:', error);
        req.flash('error', 'Error rejecting return request');
        res.redirect('/admin/return/requests');
    }
};

exports.getTransactionHistory = async (req, res) => {
    try {
        const wallet = await Wallet.findOne({ userId: req.user._id });
        res.render('user/transaction-history', { 
            wallet, 
            user: req.user 
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

module.exports = exports;