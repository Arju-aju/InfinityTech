const ReturnRequest = require('../../models/returnSchema');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');

// Helper Functions
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
    case 'Requested': return 'bg-yellow-600';
    case 'Approved': return 'bg-green-600';
    case 'Rejected': return 'bg-red-600';
    case 'Completed': return 'bg-blue-600';
    default: return 'bg-gray-600';
  }
};

exports.getReturnRequests = async (req, res) => {
  try {
    const returnStatuses = ["Return Requested", "Return Approved", "Return Rejected", "Returned"];
    const returnRequests = await Order.find({ status: { $in: returnStatuses } })
      .populate('user')
      .populate('products.productId')
      .lean();

    const formattedRequests = returnRequests.map((order) => ({
      _id: order._id,
      orderId: order,
      returnStatus: order.status.replace("Return ", ""),
      reason: order.returnReason || 'No reason provided',
      comments: 'No comments',
      items: order.products.map((product) => ({
        productDetails: {
          name: product.productId?.name || 'Unknown Product',
          price: product.price || 0,
          image: product.productId?.images?.[0] || '/images/placeholder-product.jpg',
        },
        quantity: product.quantity || 0,
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
    const orderId = req.params.id;
    const order = await Order.findById(orderId)
      .populate('user')
      .populate('products.productId')
      .lean();

    if (!order) {
      req.flash('error', 'Order not found');
      return res.redirect('/admin/return/requests');
    }

    const returnRequest = {
      _id: order._id,
      orderId: order,
      returnStatus: order.status.replace("Return ", ""),
      reason: order.returnReason || 'No reason provided',
      comments: order.comments || 'No comments',
      items: order.products.map((product) => ({
        productDetails: {
          name: product.productId?.name || 'Unknown Product',
          price: product.price || 0,
          image: product.productId?.images?.[0] || '/images/placeholder-product.jpg',
        },
        quantity: product.quantity || 0,
        valid: true,
      })),
    };

    returnRequest.items.forEach((item) => {
      item.formatPrice = formatPrice;
    });

    res.render('returnDetails', {
      returnRequest,
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
    const orderId = req.params.id;
    const order = await Order.findById(orderId);

    if (!order) {
      req.flash('error', 'Order not found');
      return res.redirect('/admin/return/requests');
    }

    if (order.status !== 'Return Requested') {
      req.flash('error', 'Cannot approve this request');
      return res.redirect('/admin/return/requests');
    }

    order.status = 'Return Approved';
    await order.save();

    req.flash('success', 'Return request approved successfully');
    res.redirect('/admin/return/requests');
  } catch (error) {
    console.error('Error approving return request:', error);
    req.flash('error', 'Error approving return request');
    res.redirect('/admin/return/requests');
  }
};

exports.rejectReturnRequest = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId);

    if (!order) {
      req.flash('error', 'Order not found');
      return res.redirect('/admin/return/requests');
    }

    if (order.status !== 'Return Requested') {
      req.flash('error', 'Cannot reject this request');
      return res.redirect('/admin/return/requests');
    }

    order.status = 'Return Rejected';
    await order.save();

    req.flash('success', 'Return request rejected successfully');
    res.redirect('/admin/return/requests');
  } catch (error) {
    console.error('Error rejecting return request:', error);
    req.flash('error', 'Error rejecting return request');
    res.redirect('/admin/return/requests');
  }
};