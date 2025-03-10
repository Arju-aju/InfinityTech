const Order = require('../../models/orderSchema');
const Return = require('../../models/returnSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const { refundToWallet } = require('./walletController');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

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
        order.products.forEach((product, index) => {
            doc.fillColor('#333').font('Helvetica')
                .text(product.productId.name, 55, y)
                .text(product.quantity, 300, y)
                .text(`₹${product.productId.price.toFixed(2)}`, 400, y)
                .text(`₹${(product.quantity * product.productId.price).toFixed(2)}`, 480, y, { align: 'right' });
            y += 20;
        });

        doc.moveDown()
            .fontSize(14).fillColor('#4b5eAA').text(`Total Amount: ₹${order.orderAmount.toFixed(2)}`, { align: 'right' });

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

        // Update stock for all products
        for (const product of order.products) {
            const productDoc = await Product.findById(product.productId._id);
            if (productDoc) {
                productDoc.stock += product.quantity;
                await productDoc.save();
            }
            product.status = 'Cancelled';
        }

        if (order.paymentMethod !== 'COD') {
            await refundToWallet(order._id, order.user, order.orderAmount + order.couponDiscount, `Refund for cancelled order #${order._id}`);
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
            if (product.status === 'Active') {
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

exports.cancelProduct = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { productIndex, reason } = req.body;

        const order = await Order.findOne({ _id: orderId, user: req.user._id })
            .populate('products.productId');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (!['Pending', 'Processing'].includes(order.status)) {
            return res.status(400).json({ success: false, message: 'Products can only be cancelled in Pending or Processing status' });
        }

        const product = order.products[productIndex];
        if (!product) {
            return res.status(400).json({ success: false, message: 'Invalid product index' });
        }

        // Mark product as cancelled
        product.status = 'Cancelled';
        product.cancellationReason = reason;
        product.cancelDate = new Date();

        // Adjust order amount
        const productTotal = product.totalPrice;
        order.orderAmount -= productTotal;

        // Adjust coupon discount proportionally
        if (order.couponDiscount > 0) {
            const remainingProducts = order.products.filter(p => p.status !== 'Cancelled');
            if (remainingProducts.length > 0) {
                const originalSubtotal = order.products.reduce((sum, p) => sum + p.totalPrice, 0);
                const newSubtotal = remainingProducts.reduce((sum, p) => sum + p.totalPrice, 0);
                order.couponDiscount = Math.round((order.couponDiscount * newSubtotal) / originalSubtotal);
            } else {
                order.couponDiscount = 0;
            }
        }

        // Adjust shipping charge
        const remainingProducts = order.products.filter(p => p.status !== 'Cancelled');
        order.shippingCharge = remainingProducts.length > 0 ? 50 : 0;

        // Update stock
        const productDoc = await Product.findById(product.productId._id);
        if (productDoc) {
            productDoc.stock += product.quantity;
            await productDoc.save();
        }

        // Check if all products are cancelled
        if (remainingProducts.length === 0) {
            order.status = 'Cancelled';
            if (order.paymentMethod !== 'COD') {
                await refundToWallet(order._id, order.user, order.orderAmount + order.couponDiscount, `Refund for cancelled order #${order._id}`);
            }
        }

        await order.save();

        res.status(200).json({ success: true, message: 'Product cancelled successfully' });
    } catch (error) {
        console.error('Cancel product error:', error);
        res.status(500).json({ success: false, message: 'Error cancelling product' });
    }
};

exports.returnProduct = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { productIndex, reason } = req.body;

        const order = await Order.findOne({ _id: orderId, user: req.user._id })
            .populate('products.productId');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status !== 'Delivered') {
            return res.status(400).json({ success: false, message: 'Only delivered products can be returned' });
        }

        const product = order.products[productIndex];
        if (!product) {
            return res.status(400).json({ success: false, message: 'Invalid product index' });
        }

        // Mark product as return requested
        product.status = 'Return Requested';
        product.returnReason = reason;
        product.returnRequestedAt = new Date();

        // Check if all products are returned or cancelled
        const activeProducts = order.products.filter(p => p.status === 'Active');
        if (activeProducts.length === 0) {
            order.status = 'Return Requested';
        }

        // Create return document
        const returnDoc = new Return({
            orderId,
            user: req.user._id,
            reason,
            items: [{ productId: product.productId._id, quantity: product.quantity }],
            status: 'Pending'
        });
        await returnDoc.save();

        await order.save();

        res.status(200).json({ success: true, message: 'Product return request submitted successfully' });
    } catch (error) {
        console.error('Return product error:', error);
        res.status(500).json({ success: false, message: 'Error submitting return request for product' });
    }
};

exports.approveReturn = async (req, res) => {
    try {
        const { returnId } = req.params;

        const returnDoc = await Return.findById(returnId).populate('orderId');
        if (!returnDoc) {
            req.flash('error_msg', 'Return request not found');
            return res.redirect('/admin/returns');
        }

        const order = await Order.findById(returnDoc.orderId._id).populate('products.productId');
        if (!order) {
            req.flash('error_msg', 'Order not found');
            return res.redirect('/admin/returns');
        }

        let refundAmount = 0;
        for (const item of returnDoc.items) {
            const product = order.products.find(p => p.productId._id.equals(item.productId));
            if (product && product.status === 'Return Requested') {
                product.status = 'Returned';
                refundAmount += product.totalPrice;

                // Restore stock
                const productDoc = await Product.findById(product.productId._id);
                if (productDoc) {
                    productDoc.stock += product.quantity;
                    await productDoc.save();
                }
            }
        }

        // Adjust order amount and coupon
        order.orderAmount -= refundAmount;
        if (order.couponDiscount > 0) {
            const remainingProducts = order.products.filter(p => p.status !== 'Cancelled' && p.status !== 'Returned');
            if (remainingProducts.length > 0) {
                const originalSubtotal = order.products.reduce((sum, p) => sum + p.totalPrice, 0);
                const newSubtotal = remainingProducts.reduce((sum, p) => sum + p.totalPrice, 0);
                order.couponDiscount = Math.round((order.couponDiscount * newSubtotal) / originalSubtotal);
            } else {
                order.couponDiscount = 0;
            }
        }

        // Adjust shipping charge
        const remainingProducts = order.products.filter(p => p.status !== 'Cancelled' && p.status !== 'Returned');
        order.shippingCharge = remainingProducts.length > 0 ? 50 : 0;

        order.status = remainingProducts.length === 0 ? 'Returned' : 'Partially Returned';
        order.returnApprovedAt = new Date();

        await order.save();

        returnDoc.status = 'Approved';
        await returnDoc.save();

        if (refundAmount > 0 && order.paymentMethod !== 'COD') {
            await refundToWallet(order._id, order.user, refundAmount, `Refund for approved return of order #${order._id}`);
        }

        req.flash('success_msg', 'Return approved and amount refunded to user wallet');
        res.redirect('/admin/returns');
    } catch (error) {
        console.error('Error approving return:', error);
        req.flash('error_msg', 'Server error while approving return');
        res.redirect('/admin/returns');
    }
};

module.exports = exports;