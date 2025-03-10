const ReturnRequest = require('../../models/returnSchema');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');

const formatPrice = (price) => {
    return typeof price === 'number' ? `₹${price.toFixed(2)}` : '₹0.00';
};

const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

const getStatusColor = (status) => {
    switch (status) {
        case 'Pending': return 'bg-yellow-600';
        case 'Approved': return 'bg-green-600';
        case 'Rejected': return 'bg-red-600';
        default: return 'bg-gray-600';
    }
};

exports.getReturnRequests = async (req, res) => {
    try {
        const returnRequests = await ReturnRequest.find()
            .populate('orderId')
            .populate('user')
            .populate('items.productId')
            .lean();
        const formattedRequests = returnRequests.map((request) => ({
            _id: request._id,
            orderId: request.orderId._id,
            returnStatus: request.status,
            reason: request.reason || 'No reason provided',
            comments: 'No comments',
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
        formattedRequests.forEach((request) => {
            request.items.forEach((item) => {
                item.formatPrice = formatPrice;
            });
        });
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

exports.getReturnRequestDetails = async (req, res) => {
    try {
        const returnId = req.params.id;
        const returnRequest = await ReturnRequest.findById(returnId)
            .populate('orderId')
            .populate('user')
            .populate('items.productId')
            .lean();
        if (!returnRequest) {
            req.flash('error', 'Return request not found');
            return res.redirect('/admin/return/requests');
        }
        const formattedRequest = {
            _id: returnRequest._id,
            orderId: returnRequest.orderId._id,
            returnStatus: returnRequest.status,
            reason: returnRequest.reason || 'No reason provided',
            comments: 'No comments',
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
        formattedRequest.items.forEach((item) => {
            item.formatPrice = formatPrice;
        });
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

exports.approveReturnRequest = async (req, res) => {
    try {
        const returnId = req.params.id;
        const returnDoc = await ReturnRequest.findById(returnId);
        if (!returnDoc) {
            req.flash('error', 'Return request not found');
            return res.redirect('/admin/return/requests');
        }
        if (returnDoc.status !== 'Pending') {
            req.flash('error', 'Cannot approve this request');
            return res.redirect('/admin/return/requests');
        }
        await exports.approveReturn(req, res); // Call the existing approveReturn function
    } catch (error) {
        console.error('Error approving return request:', error);
        req.flash('error', 'Error approving return request');
        res.redirect('/admin/return/requests');
    }
};

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
        const order = await Order.findById(returnDoc.orderId._id);
        for (const item of returnDoc.items) {
            const product = order.products.find(p => p.productId.equals(item.productId));
            if (product && product.status === 'Return Requested') {
                product.status = 'Active'; // Revert to Active if rejected
            }
        }
        await order.save();
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

module.exports = exports;