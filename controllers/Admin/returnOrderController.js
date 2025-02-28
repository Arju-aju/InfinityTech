const Return = require('../../models/returnSchema')
const Order = require('../../models/orderSchema')
const Product = require('../../models/productSchema')


exports.getReturnRequest = async (req,res) => {
    try {
        
        console.log('return page fetching......');
        const returnRequest = await Return.find()
            .populate({
                path:'orderId',
                select:'_id status orderAmount'
            })
            .populate({
                path:'user',
                select:'name email'
            })
            .populate({
                path:'items.productId',
                select: 'name price images'
            })


        
        const formattedRequest = returnRequest.map(request => {
            return {
                _id : request._id,
                orderId: request.orderId,
                reason: request.reason,
                comments: request.comments || 'No comments provided',
                returnStatus: request.returnStatus,
                items:request.items.map(items => ({
                    productDetails : {
                        name :items.productId.name,
                        price:items.productId.price,
                        image:items.productId.images[0]
                    },
                    quantity: items.quantity,
                    valid :true
                }))
            }
        })

        res.render('admin/returnOrder', {
            returnRequests: formattedRequest, // Changed to plural to match EJS
            formatPrice: (price) => `₹${price.toFixed(2)}`
        });

    } catch (error) {
        console.error(error);
            res.status(500).render('error', { message: 'Error fetching return requests' });
        }
}


exports.getReturnDetails = async (req, res) => {
    try {
        const returnOrder = await Return.findById(req.params.returnId)
            .populate({
                path: 'orderId',
                select: '_id status orderAmount products'
            })
            .populate({
                path: 'user',
                select: 'name email phone'
            })
            .populate({
                path: 'items.productId',
                select: 'name price discountPercentage images',
                options: { virtuals: true }
            });

        if (!returnOrder) {
            return res.status(404).render('error', { message: 'Return request not found' });
        }

        res.render('admin/returnDetails', {
            returnOrder,
            formatDate: (date) => new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            getStatusColor: (status) => {
                switch (status) {
                    case 'Requested': return 'bg-yellow-900 text-yellow-300';
                    case 'Approved': return 'bg-green-900 text-green-300';
                    case 'Rejected': return 'bg-red-900 text-red-300';
                    case 'Completed': return 'bg-purple-900 text-purple-300';
                    default: return 'bg-gray-900 text-gray-300';
                }
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('error', { message: 'Error fetching return details' });
    }
};


exports.approveReturn = async (req, res) => {
    try {
      const returnId = req.params.id;
      const returnRequest = await Return.findById(returnId).populate('orderId');
      if (!returnRequest) {
        req.flash('error_msg', 'Return request not found');
        return res.redirect('/admin/return/requests');
      }
  
      const order = returnRequest.orderId;
      order.status = 'Returned';
      await order.save();
  
      returnRequest.returnStatus = 'Approved';
      await returnRequest.save();
  
      // Refund to wallet
      const refundAmount = order.orderAmount;
      await refundToWallet(order._id, order.user, refundAmount, `Refund for returned order #${order._id}`);
  
      req.flash('success_msg', 'Return approved and amount refunded to wallet');
      res.redirect('/admin/return/requests');
    } catch (error) {
      console.error('Error approving return:', error);
      req.flash('error_msg', 'Server error while approving return');
      res.redirect('/admin/return/requests');
    }
  };

  exports.rejectReturn = async (req, res) => {
    try {
      const returnId = req.params.id;
      const returnRequest = await Return.findById(returnId).populate('orderId');
      if (!returnRequest) {
        req.flash('error_msg', 'Return request not found');
        return res.redirect('/admin/return/requests');
      }
  
      const order = returnRequest.orderId;
      order.status = 'Return Rejected';
      await order.save();
  
      returnRequest.returnStatus = 'Rejected';
      await returnRequest.save();
  
      req.flash('success_msg', 'Return request rejected');
      res.redirect('/admin/return/requests');
    } catch (error) {
      console.error('Error rejecting return:', error);
      req.flash('error_msg', 'Server error while rejecting return');
      res.redirect('/admin/return/requests');
    }
  };
