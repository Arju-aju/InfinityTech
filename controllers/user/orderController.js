const mongoose = require('mongoose');
const Order = require('../../models/orderSchema');
const Return = require('../../models/returnSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const { refundToWallet } = require('./walletController');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Get all orders for a user
exports.getOrdersList = async (req, res) => {
    try {
        const userId = req.user._id;
        const orders = await Order.find({ user: userId })
            .populate({
                path: 'products.productId',
                select: 'name images price'
            })
            .sort({ createdAt: -1 });
        const userProfile = await User.findById(userId).select('name email');
        res.render('user/orders', { orders, userProfile });
    } catch (error) {
        console.error('Get orders list error:', error);
        res.status(500).render('error', { message: 'Error retrieving your orders' });
    }
};

// Get specific order details
exports.getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.user._id;
        const order = await Order.findOne({ _id: orderId, user: userId })
            .populate('user', 'name email phone')
            .populate({
                path: 'products.productId',
                select: 'name images price'
            })
            .populate('couponApplied', 'code offerValue offerType');
        const userProfile = await User.findById(userId).select('name email');
        if (!order) {
            return res.status(404).render('error', { message: 'Order not found' });
        }
        order.status = order.status || 'Pending';
        res.render('user/orderDetails', { 
            order, 
            userProfile, 
            success_msg: req.flash('success_msg'), 
            error_msg: req.flash('error_msg') 
        });
    } catch (error) {
        console.error('Get order details error:', error);
        res.status(500).render('error', { message: 'Error retrieving order details' });
    }
};

// Download invoice
exports.downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.user._id;
        const order = await Order.findOne({ _id: orderId, user: userId })
            .populate('user', 'name email')
            .populate({
                path: 'products.productId',
                select: 'name price'
            });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const fileName = `invoice_${order._id}.pdf`;
        const filePath = path.join(__dirname, '../../public/invoices', fileName);
        const invoiceDir = path.join(__dirname, '../../public/invoices');
        if (!fs.existsSync(invoiceDir)) {
            fs.mkdirSync(invoiceDir, { recursive: true });
        }
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        doc.fontSize(25).fillColor('#4b5eAA').text('Invoice', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).fillColor('#333')
            .text('InfinityTech Solutions', { align: 'left' })
            .text('123 Business St, Bangalore, India', { align: 'left' })
            .text('Email: infinitytech@company.com', { align: 'left' })
            .moveDown();
        doc.fontSize(12).text(`Bill To: ${order.user.name}`, { align: 'right' })
            .text(`Email: ${order.user.email}`, { align: 'right' })
            .moveDown();
        doc.fontSize(14).fillColor('#4b5eAA').text(`Order #${order._id.toString().slice(-6)}`, { align: 'left' });
        doc.fontSize(12).fillColor('#333')
            .text(`Date: ${new Date(order.orderDate).toLocaleDateString('en-US')}`, { align: 'left' })
            .text(`Status: ${order.status}`, { align: 'left' })
            .moveDown();

        const tableTop = doc.y;
        doc.fontSize(12).fillColor('#fff').font('Helvetica-Bold')
            .rect(50, tableTop, 495, 20).fill('#4b5eAA')
            .fillColor('#fff')
            .text('Item', 55, tableTop + 5)
            .text('Quantity', 300, tableTop + 5)
            .text('Price', 400, tableTop + 5)
            .text('Total', 480, tableTop + 5, { align: 'right' });
        let y = tableTop + 25;
        order.products.forEach((product) => {
            doc.fillColor('#333').font('Helvetica')
                .text(`${product.productId.name} (${product.status})`, 55, y)
                .text(product.quantity, 300, y)
                .text(`₹${product.price.toFixed(2)}`, 400, y)
                .text(`₹${product.totalPrice.toFixed(2)}`, 480, y, { align: 'right' });
            y += 20;
        });
        doc.moveDown()
            .fontSize(12).fillColor('#333')
            .text(`Shipping Charge: ₹${order.shippingCharge.toFixed(2)}`, { align: 'right' })
            .text(`Coupon Discount: -₹${order.couponDiscount.toFixed(2)}`, { align: 'right' })
            .fontSize(14).fillColor('#4b5eAA')
            .text(`Total Amount: ₹${order.orderAmount.toFixed(2)}`, { align: 'right' });
        doc.moveDown(2)
            .fontSize(10).fillColor('#666')
            .text('Thank you for your purchase!', { align: 'center' })
            .text('Contact us at support@company.com for any queries.', { align: 'center' });
        doc.end();

        stream.on('finish', () => {
            res.download(filePath, fileName, (err) => {
                if (err) {
                    console.error('Error sending file:', err);
                }
                fs.unlink(filePath, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting file:', unlinkErr);
                });
            });
        });
    } catch (error) {
        console.error('Download invoice error:', error);
        res.status(500).json({ success: false, message: 'Error generating invoice' });
    }
};

// Cancel an entire order
exports.cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { reason } = req.body;
        const order = await Order.findOne({ _id: orderId, user: req.user._id })
            .populate('products.productId');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        if (!['Pending', 'Processing', 'Out for Delivery', 'Shipped'].includes(order.status)) {
            return res.status(400).json({ success: false, message: 'Order cannot be cancelled at this stage' });
        }
        order.status = 'Cancelled';
        order.cancellationReason = reason;
        order.cancelDate = new Date();
        let refundAmount = order.orderAmount;
        for (const product of order.products) {
            if (product.status === 'Ordered') {
                const productDoc = await Product.findById(product.productId._id);
                if (productDoc) {
                    productDoc.stock += product.quantity;
                    await productDoc.save();
                }
                product.status = 'Cancelled';
            }
        }
        if (order.paymentMethod !== 'cod' && refundAmount > 0) {
            await refundToWallet(order._id, order.user, refundAmount, `Refund for cancelled order #${order._id}`);
        }
        order.orderAmount = 0;
        order.couponDiscount = 0;
        order.shippingCharge = 0;
        await order.save();
        res.status(200).json({ success: true, message: 'Order cancelled successfully' });
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({ success: false, message: 'Error cancelling order' });
    }
};

// Return an entire order
exports.returnOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { reason } = req.body;
        const order = await Order.findOne({ _id: orderId, user: req.user._id });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        if (order.status !== 'Delivered') {
            return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
        }
        order.status = 'Return Requested';
        order.returnReason = reason;
        order.returnRequestedAt = new Date();
        for (const product of order.products) {
            if (product.status === 'Ordered') {
                product.status = 'Return Requested';
            }
        }
        await order.save();
        res.status(200).json({ success: true, message: 'Return request submitted successfully' });
    } catch (error) {
        console.error('Return order error:', error);
        res.status(500).json({ success: false, message: 'Error submitting return request' });
    }
};

// Cancel a specific product
exports.cancelProduct = async (req, res) => {
    try {
        const { id: orderId, productId } = req.params;
        const { reason } = req.body;
        const order = await Order.findOne({ _id: orderId, user: req.user._id })
            .populate('products.productId');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        if (!['Pending', 'Processing'].includes(order.status)) {
            return res.status(400).json({ success: false, message: 'Products can only be cancelled in Pending or Processing status' });
        }
        const productIndex = order.products.findIndex(p => p.productId._id.toString() === productId);
        if (productIndex === -1) {
            return res.status(400).json({ success: false, message: 'Product not found in order' });
        }
        const product = order.products[productIndex];
        if (product.status !== 'Ordered') {
            return res.status(400).json({ success: false, message: 'Product cannot be cancelled' });
        }

        const productTotalPrice = product.totalPrice;
        product.status = 'Cancelled';
        product.cancellationReason = reason;
        product.cancelDate = new Date();

        const activeProducts = order.products.filter(p => p.status === 'Ordered');
        const originalSubtotal = order.products.reduce((sum, p) => sum + p.totalPrice, 0);
        const newSubtotal = activeProducts.reduce((sum, p) => sum + p.totalPrice, 0);

        let refundAmount = productTotalPrice;
        if (order.couponDiscount > 0 && originalSubtotal > 0) {
            const couponDiscountPerProduct = order.couponDiscount * (productTotalPrice / originalSubtotal);
            refundAmount += couponDiscountPerProduct;
            order.couponDiscount = activeProducts.length > 0 ? (order.couponDiscount * newSubtotal) / originalSubtotal : 0;
        }
        order.orderAmount = newSubtotal + order.shippingCharge - order.couponDiscount;

        const productDoc = await Product.findById(product.productId._id);
        if (productDoc) {
            productDoc.stock += product.quantity;
            await productDoc.save();
        }

        if (order.paymentMethod !== 'cod' && refundAmount > 0) {
            await refundToWallet(order._id, order.user, refundAmount, `Refund for cancelled product ${product.productId.name} in order #${order._id}`);
        }

        if (activeProducts.length === 0) {
            order.status = 'Cancelled';
            order.orderAmount = 0;
            order.shippingCharge = 0;
            order.couponDiscount = 0;
        }

        await order.save();
        res.status(200).json({ success: true, message: 'Product cancelled successfully', order });
    } catch (error) {
        console.error('Cancel product error:', error);
        res.status(500).json({ success: false, message: 'Error cancelling product' });
    }
};

// Request return for a specific product
exports.requestReturn = async (req, res) => {
    try {
        const { id: orderId, productId } = req.params;
        const { reason } = req.body;
        const order = await Order.findOne({ _id: orderId, user: req.user._id })
            .populate('products.productId');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        if (order.status !== 'Delivered') {
            return res.status(400).json({ success: false, message: 'Only delivered products can be returned' });
        }
        const productIndex = order.products.findIndex(p => p.productId._id.toString() === productId);
        if (productIndex === -1) {
            return res.status(400).json({ success: false, message: 'Product not found in order' });
        }
        const product = order.products[productIndex];
        if (product.status !== 'Ordered') {
            return res.status(400).json({ success: false, message: 'Product cannot be returned' });
        }
        product.status = 'Return Requested';
        product.returnReason = reason;
        product.returnRequestedAt = new Date();

        const hasReturnRequested = order.products.some(p => p.status === 'Return Requested');
        if (hasReturnRequested && order.status === 'Delivered') {
            order.status = 'Return Requested';
            order.returnReason = reason;
            order.returnRequestedAt = new Date();
        }

        const returnDoc = new Return({
            orderId,
            user: req.user._id,
            reason,
            items: [{ productId: product.productId._id, quantity: product.quantity }],
            status: 'Pending'
        });
        await returnDoc.save();

        await order.save();
        res.status(200).json({ success: true, message: 'Product return request submitted successfully', order });
    } catch (error) {
        console.error('Return product error:', error);
        res.status(500).json({ success: false, message: 'Error submitting return request for product' });
    }
};

// Handle return request (admin)
exports.handleReturnRequest = async (req, res) => {
    try {
        const { orderId, productId, action } = req.params;
        const adminUser = await User.findById(req.user._id);
        if (!adminUser || !adminUser.isAdmin) {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const order = await Order.findById(orderId).populate('products.productId');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const productIndex = order.products.findIndex(p => p.productId._id.toString() === productId);
        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: 'Product not found in order' });
        }

        const product = order.products[productIndex];
        if (product.status !== 'Return Requested') {
            return res.status(400).json({ success: false, message: 'No return request found for this product' });
        }

        const returnDoc = await Return.findOne({ orderId, 'items.productId': productId, status: 'Pending' });
        if (!returnDoc) {
            return res.status(404).json({ success: false, message: 'Return request document not found' });
        }

        if (action === 'approve') {
            product.status = 'Returned';
            const refundAmount = product.totalPrice;

            const activeProducts = order.products.filter(p => p.status === 'Ordered');
            const originalSubtotal = order.products.reduce((sum, p) => sum + p.totalPrice, 0);
            const newSubtotal = activeProducts.reduce((sum, p) => sum + p.totalPrice, 0);

            let totalRefund = refundAmount;
            if (order.couponDiscount > 0 && originalSubtotal > 0) {
                const couponDiscountPerProduct = order.couponDiscount * (refundAmount / originalSubtotal);
                totalRefund += couponDiscountPerProduct;
                order.couponDiscount = activeProducts.length > 0 ? (order.couponDiscount * newSubtotal) / originalSubtotal : 0;
            }
            order.orderAmount = newSubtotal + order.shippingCharge - order.couponDiscount;

            const productDoc = await Product.findById(product.productId._id);
            if (productDoc) {
                productDoc.stock += product.quantity;
                await productDoc.save();
            }

            if (activeProducts.length === 0) {
                order.status = 'Returned';
                order.orderAmount = 0;
                order.shippingCharge = 0;
                order.couponDiscount = 0;
            }

            if (order.paymentMethod !== 'cod' && totalRefund > 0) {
                await refundToWallet(order._id, order.user, totalRefund, `Refund for approved return of product in order #${order._id}`);
            }

            returnDoc.status = 'Approved';
        } else if (action === 'reject') {
            product.status = 'Ordered';
            product.returnReason = null;
            product.returnRequestedAt = null;

            const hasPendingReturns = order.products.some(p => p.status === 'Return Requested');
            order.status = hasPendingReturns ? 'Return Requested' : 'Delivered';
            order.returnReason = hasPendingReturns ? order.returnReason : null;
            order.returnRequestedAt = hasPendingReturns ? order.returnRequestedAt : null;

            returnDoc.status = 'Rejected';
        } else {
            return res.status(400).json({ success: false, message: 'Invalid action' });
        }

        await order.save();
        await returnDoc.save();
        res.status(200).json({ success: true, message: `Return ${action}d successfully`, order });
    } catch (error) {
        console.error('Handle return request error:', error);
        res.status(500).json({ success: false, message: 'Error handling return request' });
    }
};

module.exports = exports;