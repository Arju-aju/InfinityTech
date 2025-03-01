const ReturnRequest = require('../../models/returnSchema')
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema')


const formatPrice = (price) => {
    return typeof price === 'number' ? `$${price.toFixed(2)}` : '$0.00';
  };

  exports.getReturnRequests = async (req, res) => {
    try {
      // Fetch orders with return-related statuses
      const returnStatuses = ["Return Requested", "Return Approved", "Return Rejected", "Returned"];
      const returnRequests = await Order.find({ status: { $in: returnStatuses } })
        .populate('user') // Populate user if needed
        .populate('products.productId') // Populate product details
        .lean();
  
      // Map orders to match the structure expected by return.ejs
      const formattedRequests = returnRequests.map((order) => {
        return {
          _id: order._id,
          orderId: order, // The order itself (since return.ejs uses orderId._id)
          returnStatus: order.status.replace("Return ", ""), // Map "Return Requested" to "Requested", etc.
          reason: order.returnReason || 'No reason provided',
          comments: 'No comments', // No comments field in Order schema; placeholder
          items: order.products.map((product) => ({
            productDetails: {
              name: product.productId?.name || 'Unknown Product',
              price: product.price || 0,
              image: product.productId?.images?.[0] || '/images/placeholder-product.jpg', // Use first image
            },
            quantity: product.quantity || 0,
            valid: true, // No valid field in schema; assume true for now
          })),
        };
      });
  
      // Attach formatPrice helper to each request for use in EJS
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
  
      // Format the order to match the return.ejs structure
      const returnRequest = {
        _id: order._id,
        orderId: order,
        returnStatus: order.status.replace("Return ", ""),
        reason: order.returnReason || 'No reason provided',
        comments: 'No comments', // Placeholder
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
  
      // Attach formatPrice helper
      returnRequest.items.forEach((item) => {
        item.formatPrice = formatPrice;
      });
  
      res.render('returnDetails', {
        returnRequest,
        formatPrice,
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
  
      // Only allow approving if status is "Return Requested"
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
  
      // Only allow rejecting if status is "Return Requested"
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
