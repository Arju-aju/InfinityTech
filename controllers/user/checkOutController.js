// controllers/checkoutController.js
const mongoose = require('mongoose');
const Cart = require('../../models/cartSchema');
const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema');
const Wallet = require('../../models/walletSchema');
const Product = require('../../models/productSchema');
const Coupon = require('../../models/coupounSchema');
const { createRazorpayInstance } = require('../../config/razorpay');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit'); 

const razorpayInstance = createRazorpayInstance();

exports.renderCheckout = async (req, res) => {
  try {
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || !cart.items.length) {
      return res.redirect('/cart');
    }

    const addressDoc = await Address.findOne({ userID: userId });
    const addresses = addressDoc ? addressDoc.address : [];

    const wallet = await Wallet.findOne({ userId });
    const walletBalance = wallet ? wallet.balance : 0;

    const subtotal = cart.calculateTotal();
    const shippingCharge = subtotal > 500 ? 0 : 50;
    const totalAmount = subtotal + shippingCharge;

    const cartItemsWithOffers = cart.items.map(item => ({
      product: item.product,
      quantity: item.quantity,
      total: item.price * item.quantity,
      offerDetails: { discountPercentage: 0, appliedOfferType: 'none' }
    }));

    res.render('checkout', {
      user: req.user,
      addresses,
      defaultAddressIndex: 0,
      cartItemsWithOffers,
      subtotal,
      shippingCharge,
      totalAmount,
      walletBalance,
      message: req.flash('message')
    });
  } catch (error) {
    console.error('Error rendering checkout:', error);
    req.flash('message', { type: 'error', content: 'Error loading checkout page' });
    res.redirect('/cart');
  }
};

exports.initiateCheckout = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { addressId, paymentMethod, couponCode } = req.body;
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || !cart.items.length) throw new Error('Cart is empty');

    const address = await Address.findOne({ userID: userId, 'address._id': addressId });
    if (!address) throw new Error('Invalid address');

    const deliveryAddress = address.address.find(addr => addr._id.toString() === addressId);

    let subtotal = cart.calculateTotal();
    let shippingCharge = subtotal > 500 ? 0 : 50;
    let couponDiscount = 0;

    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode, active: true });
      if (!coupon || coupon.expiryDate < Date.now() || coupon.usedBy.includes(userId)) {
        throw new Error('Invalid or expired coupon');
      }
      couponDiscount = calculateCouponDiscount(subtotal, coupon);
      await Coupon.updateOne({ _id: coupon._id }, { $push: { usedBy: userId } });
    }

    const totalAmount = subtotal + shippingCharge - couponDiscount;

    if (paymentMethod === 'cod' && totalAmount > 4000) throw new Error('COD not available for orders above ₹4000');

    const orderItems = cart.items.map(item => ({
      productId: item.product._id,
      quantity: item.quantity,
      price: item.price,
      finalPrice: item.price,
      totalPrice: item.price * item.quantity
    }));

    const orderData = {
      user: userId,
      products: orderItems,
      deliveryAddress,
      orderAmount: totalAmount,
      shippingCharge,
      paymentMethod,
      couponCode: couponCode || null,
      couponDiscount,
      status: 'Pending',
      paymentStatus: 'pending'
    };

    switch (paymentMethod) {
      case 'cod':
        await handleCODOrder(orderData, cart, session, res);
        break;
      case 'wallet':
        await handleWalletOrder(orderData, cart, userId, session, res);
        break;
      case 'razorpay':
        await handleRazorpayOrder(orderData, cart, session, res);
        break;
      default:
        throw new Error('Invalid payment method');
    }
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({
      success: false,
      message: error.message,
      showFailureModal: true,
      redirectUrl: '/checkout'
    });
  } finally {
    session.endSession();
  }
};

exports.createRazorpayOrder = async (req, res) => {
  try {
    const { addressId, couponCode, couponDiscount } = req.body;
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    const address = await Address.findOne({ userID: userId, 'address._id': addressId });

    const deliveryAddress = address.address.find(addr => addr._id.toString() === addressId);
    const amount = Math.round((cart.calculateTotal() + 50 - (couponDiscount || 0)) * 100);

    const options = {
      amount,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);

    const order = await Order.create({
      user: userId,
      products: cart.items.map(item => ({
        productId: item.product._id,
        quantity: item.quantity,
        price: item.price,
        finalPrice: item.price,
        totalPrice: item.price * item.quantity
      })),
      deliveryAddress,
      orderAmount: amount / 100,
      shippingCharge: 50,
      paymentMethod: 'razorpay',
      paymentStatus: 'pending',
      couponCode: couponCode || null,
      couponDiscount: couponDiscount || 0,
      razorpayDetails: { orderId: razorpayOrder.id }
    });

    res.json({
      success: true,
      orderId: razorpayOrder.id,
      amount,
      key: process.env.Test_Key_ID,
      order: order._id
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.verifyPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, addressId, totalAmount, couponCode, couponDiscount } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', process.env.Test_Key_Secret).update(body).digest('hex');

    if (expectedSignature !== razorpay_signature) throw new Error('Invalid payment signature');

    const order = await Order.findOne({ 'razorpayDetails.orderId': razorpay_order_id }).populate('products.productId');
    if (!order) throw new Error('Order not found');

    order.paymentStatus = 'paid';
    order.status = 'Processing';
    order.razorpayDetails.paymentId = razorpay_payment_id;
    order.razorpayDetails.signature = razorpay_signature;

    await reduceStock(order.products, session);
    await order.save({ session });
    await Cart.findOneAndDelete({ user: req.user._id }, { session });

    await session.commitTransaction();
    await sendOrderConfirmationEmail(req.user.email, order);

    res.json({
      success: true,
      message: 'Payment verified successfully',
      redirectUrl: `/orders/${order._id}`
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({
      success: false,
      message: error.message,
      redirectUrl: '/orders'
    });
  } finally {
    session.endSession();
  }
};

exports.savePendingOrder = async (req, res) => {
  try {
    const { addressId, totalAmount, couponCode, couponDiscount, razorpayOrderId } = req.body;
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    const address = await Address.findOne({ userID: userId, 'address._id': addressId });

    const deliveryAddress = address.address.find(addr => addr._id.toString() === addressId);

    await Order.create({
      user: userId,
      products: cart.items.map(item => ({
        productId: item.product._id,
        quantity: item.quantity,
        price: item.price,
        finalPrice: item.price,
        totalPrice: item.price * item.quantity
      })),
      deliveryAddress,
      orderAmount: totalAmount,
      shippingCharge: 50,
      paymentMethod: 'razorpay',
      paymentStatus: 'failed',
      status: 'Pending',
      couponCode: couponCode || null,
      couponDiscount: couponDiscount || 0,
      razorpayDetails: { orderId: razorpayOrderId }
    });

    res.json({
      success: true,
      message: 'Pending order saved'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.retryPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order || order.paymentStatus !== 'failed') throw new Error('Invalid order or payment already completed');

    const options = {
      amount: Math.round(order.orderAmount * 100),
      currency: 'INR',
      receipt: `receipt_${orderId}`
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);
    order.razorpayDetails.orderId = razorpayOrder.id;
    await order.save();

    res.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: options.amount,
      key: process.env.Test_Key_ID
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate('products.productId').lean();

    if (!order) {
      return res.render('orderDetails', { order: null, success_msg: '', error_msg: 'Order not found' });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).render('orderDetails', { order: null, success_msg: '', error_msg: 'Unauthorized access' });
    }

    res.render('orderDetails', { order, success_msg: 'Order placed successfully!', error_msg: '' });
  } catch (error) {
    res.status(500).render('orderDetails', { order: null, success_msg: '', error_msg: 'Error loading order details' });
  }
};

exports.downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log(`[INFO] Fetching invoice for orderId: ${orderId}`);

    const order = await Order.findById(orderId)
      .populate('products.productId')
      .populate('user', 'name email');

    if (!order) {
      console.log(`[ERROR] Order ${orderId} not found`);
      return res.status(404).render('404', { message: 'Order not found' });
    }

    if (order.user._id.toString() !== req.user._id.toString()) {
      console.log(`[ERROR] Unauthorized access for user ${req.user._id} on order ${orderId}`);
      return res.status(403).render('404', { message: 'Unauthorized access to this order' });
    }

    if (order.paymentStatus !== 'paid') {
      return res.status(400).render('404', { message: 'Invoice available only for paid orders' });
    }

    console.log(`[INFO] Generating PDF for order ${orderId}`);
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: { Title: `Invoice #${order._id}`, Author: 'InfinityTech' },
    });

    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order._id}.pdf`);
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    // Define page dimensions
    const pageWidth = 595.28; // A4 width in points
    const margins = 50;
    const contentWidth = pageWidth - (margins * 2);
    
    // Set Rupee symbol
    const rupeeSymbol = '₹';

    // **Company Header Section**
    doc
      .font('Helvetica-Bold')
      .fontSize(26)
      .fillColor('#2D3748')
      .text('InfinityTech', margins, 30);

    doc
      .fontSize(10)
      .fillColor('#4A5568')
      .text('123 Business Street, City, Country', margins, 60)
      .text('Email: support@infinitytech.com', margins, 75);

    // **Invoice Details** - Right aligned
    const invoiceInfoX = margins;
    const invoiceInfoWidth = contentWidth;
    
    doc
      .fontSize(24)
      .fillColor('#2D3748')
      .text('INVOICE', invoiceInfoX, 30, { align: 'right', width: invoiceInfoWidth });

    doc
      .fontSize(12)
      .fillColor('#4A5568')
      .text(`Order #: ${order._id.toString().slice(-6)}`, invoiceInfoX, 60, { align: 'right', width: invoiceInfoWidth })
      .text(`Date: ${new Date(order.orderDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, invoiceInfoX, 75, { align: 'right', width: invoiceInfoWidth });

    // Divider line
    doc
      .moveTo(margins, 100)
      .lineTo(pageWidth - margins, 100)
      .strokeColor('#E2E8F0')
      .lineWidth(1)
      .stroke();

    // **Customer Information**
    doc
      .fontSize(14)
      .fillColor('#2D3748')
      .text('Bill To:', margins, 120);

    // Handle address properly
    doc
      .fontSize(12)
      .fillColor('#4A5568')
      .text(`${order.user.name}`, margins, 140);
    
    // Address lines
    let addressComponents = [];
    if (order.deliveryAddress.address) addressComponents.push(order.deliveryAddress.address);
    
    // City, State, Pincode formatting
    let locationParts = [];
    if (order.deliveryAddress.city) locationParts.push(order.deliveryAddress.city);
    if (order.deliveryAddress.state) locationParts.push(order.deliveryAddress.state);
    if (order.deliveryAddress.pincode) locationParts.push(order.deliveryAddress.pincode);
    
    // Show address line
    doc.text(addressComponents.join(', '), margins, 155);
    
    // Show city, state, pincode
    doc.text(locationParts.join(' , '), margins, 170);
    
    // Show email
    doc.text(`Email: ${order.user.email}`, margins, 185);

    // **Table Header**
    const tableTop = 220;
    
    // Define column widths proportionally
    const columnWidths = {
      item: Math.floor(contentWidth * 0.5),
      qty: Math.floor(contentWidth * 0.1),
      price: Math.floor(contentWidth * 0.2),
      total: Math.floor(contentWidth * 0.2)
    };
    
    // Calculate starting positions for each column
    const tableXPositions = {
      item: margins,
      qty: margins + columnWidths.item,
      price: margins + columnWidths.item + columnWidths.qty,
      total: margins + columnWidths.item + columnWidths.qty + columnWidths.price
    };

    // Create header background
    doc
      .fillColor('#2D3748')
      .rect(margins, tableTop, contentWidth, 25)
      .fill();

    // Add header text
    doc
      .fillColor('#FFFFFF')
      .fontSize(12)
      .text('Item', tableXPositions.item + 5, tableTop + 8, { width: columnWidths.item - 10 })
      .text('Qty', tableXPositions.qty + 5, tableTop + 8, { width: columnWidths.qty - 10, align: 'center' })
      .text('Price', tableXPositions.price + 5, tableTop + 8, { width: columnWidths.price - 10, align: 'right' })
      .text('Total', tableXPositions.total + 5, tableTop + 8, { width: columnWidths.total - 10, align: 'right' });

    // **Table Rows**
    let y = tableTop + 25;
    order.products.forEach((item, index) => {
      const productTotal = item.quantity * item.price;

      // Alternating row backgrounds
      if (index % 2 === 0) {
        doc
          .fillColor('#F7FAFC')
          .rect(margins, y, contentWidth, 25)
          .fill();
      }

      doc
        .fillColor('#4A5568')
        .fontSize(11)
        .text(item.productId.name, tableXPositions.item + 5, y + 8, { width: columnWidths.item - 10 })
        .text(item.quantity.toString(), tableXPositions.qty + 5, y + 8, { width: columnWidths.qty - 10, align: 'center' })
        .text(`${rupeeSymbol}${item.price.toFixed(2)}`, tableXPositions.price + 5, y + 8, { width: columnWidths.price - 10, align: 'right' })
        .text(`${rupeeSymbol}${productTotal.toFixed(2)}`, tableXPositions.total + 5, y + 8, { width: columnWidths.total - 10, align: 'right' });

      y += 25;
      if (y > 650) {
        doc.addPage();
        y = 50;
      }
    });

    // **Summary Section**
    const summaryTop = y + 30;
    const subtotal = order.products.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const totalBeforeDiscount = subtotal + order.shippingCharge;
    
    // Create two-column layout for summary
    const summaryLabelWidth = 150;
    const summaryValueWidth = 100;
    const summaryRightX = pageWidth - margins - summaryValueWidth;
    const summaryLeftX = summaryRightX - summaryLabelWidth;
    
    // Summary lines - properly aligned
    const summaryItems = [
      { label: 'Subtotal:', value: `${rupeeSymbol}${subtotal.toFixed(2)}` },
      { label: 'Shipping:', value: `${rupeeSymbol}${order.shippingCharge.toFixed(2)}` },
      { label: 'Total Before\nDiscount:', value: `${rupeeSymbol}${totalBeforeDiscount.toFixed(2)}` },
      { label: 'Discount:', value: `- ${rupeeSymbol}${order.couponDiscount.toFixed(2)}` }
    ];
    
    let summaryY = summaryTop;
    summaryItems.forEach(item => {
      // Label on left side
      doc
        .fontSize(12)
        .fillColor('#4A5568')
        .text(item.label, summaryLeftX, summaryY, { width: summaryLabelWidth, align: 'right' });
        
      // Value on right side
      doc
        .text(item.value, summaryRightX, summaryY, { width: summaryValueWidth, align: 'right' });
        
      summaryY += (item.label.includes('\n') ? 35 : 20); // Add extra space for multi-line labels
    });

    // Total Amount box
    const totalBoxY = summaryY + 5;
    doc
      .fillColor('#2D3748')
      .rect(summaryLeftX, totalBoxY, summaryLabelWidth + summaryValueWidth, 30)
      .fill();
      
    doc
      .fillColor('#FFFFFF')
      .fontSize(14)
      .text('Total Amount:', summaryLeftX + 10, totalBoxY + 9, { width: summaryLabelWidth - 10, align: 'left' })
      .text(`${rupeeSymbol}${order.orderAmount.toFixed(2)}`, summaryRightX, totalBoxY + 9, { width: summaryValueWidth, align: 'right' });

    // **Footer**
    doc
      .fontSize(10)
      .fillColor('#718096')
      .text('Thank you for your purchase!', margins, totalBoxY + 60, { align: 'center', width: contentWidth });

    doc.end();
    console.log(`[INFO] PDF generated for order ${orderId}`);
  } catch (error) {
    console.error(`[ERROR] Failed to generate invoice: ${error.message}`);
    res.status(500).render('404', { message: 'Error generating invoice' });
  }
};


async function handleCODOrder(orderData, cart, session, res) {
  orderData.paymentStatus = 'pending';
  orderData.status = 'Processing';

  const order = await Order.create([orderData], { session });
  await reduceStock(order[0].products, session);
  await Cart.findOneAndDelete({ user: orderData.user }, { session });

  await session.commitTransaction();
  await sendOrderConfirmationEmail(res.locals.user.email, order[0]);

  res.json({
    success: true,
    message: 'Order placed successfully',
    showSuccessModal: true,
    redirectUrl: `/orders/${order[0]._id}`
  });
}

async function handleWalletOrder(orderData, cart, userId, session, res) {
  const wallet = await Wallet.findOne({ userId });
  if (!wallet || wallet.balance < orderData.orderAmount) throw new Error('Insufficient wallet balance');

  orderData.paymentStatus = 'paid';
  orderData.status = 'Processing';

  const order = await Order.create([orderData], { session });

  wallet.balance -= orderData.orderAmount;
  wallet.transactions.push({ amount: orderData.orderAmount, type: 'debit', description: `Order #${order[0]._id}` });
  await wallet.save({ session });

  await reduceStock(order[0].products, session);
  await Cart.findOneAndDelete({ user: userId }, { session });

  await session.commitTransaction();
  await sendOrderConfirmationEmail(res.locals.user.email, order[0]);

  res.json({
    success: true,
    message: 'Order placed successfully with wallet payment',
    showSuccessModal: true,
    redirectUrl: `/orders/${order[0]._id}`
  });
}

async function handleRazorpayOrder(orderData, cart, session, res) {
  const order = await Order.create([orderData], { session });
  await session.commitTransaction();

  res.json({
    success: true,
    orderId: order[0]._id,
    redirectUrl: '/checkout/razorpay'
  });
}

async function reduceStock(products, session) {
  for (const item of products) {
    const product = await Product.findById(item.productId);
    if (product.stock < item.quantity) throw new Error(`Insufficient stock for ${product.name}`);
    product.stock -= item.quantity;
    await product.save({ session });
  }
}

function calculateCouponDiscount(subtotal, coupon) {
  if (coupon.discountType === 'percentage') {
    return (subtotal * coupon.discountValue) / 100;
  }
  return Math.min(coupon.discountValue, subtotal);
}

async function sendOrderConfirmationEmail(email, order) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Order Confirmation',
    html: `
      <h1>Order Confirmation</h1>
      <p>Thank you for your order #${order._id}</p>
      <p>Total Amount: ₹${order.orderAmount}</p>
      <p>Payment Method: ${order.paymentMethod}</p>
      <p>Status: ${order.status}</p>
      <p>View your order details: <a href="${process.env.APP_URL}/orders/${order._id}">here</a></p>
    `
  };

  await transporter.sendMail(mailOptions);
}

module.exports = exports;