const Cart = require('../../models/cartSchema');
const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema');
const Coupon = require('../../models/coupounSchema');
const Wallet = require('../../models/walletSchema');
const { getBestOfferForProduct } = require('../../utils/offer');
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.Test_Key_ID,
  key_secret: process.env.Test_Key_Secret,
});

// Get Checkout Page
exports.getCheckout = async (req, res) => {
  try {
    console.log('Fetching checkout page for user:', req.user._id);
    const cart = await Cart.findOne({ user: req.user._id })
      .populate({ path: 'items.product', select: 'name images price' });

    if (!cart || cart.items.length === 0 || cart.items.filter(item => item.product).length === 0) {
      console.log('No valid cart found, redirecting to cart');
      return res.redirect('/cart');
    }
    cart.items = cart.items.filter(item => item.product);

    const addressDoc = await Address.findOne({ userID: req.user._id });
    const addresses = addressDoc ? addressDoc.address : [];
    const defaultAddressIndex = addresses.findIndex(addr => addr.isDefault) !== -1 ? addresses.findIndex(addr => addr.isDefault) : 0;

    const wallet = await Wallet.findOne({ userId: req.user._id }) || { balance: 0 };

    const cartItemsWithOffers = await Promise.all(cart.items.map(async (item) => {
      const offerDetails = await getBestOfferForProduct(item.product).catch(err => {
        console.error(`Error getting offer for product ${item.product._id}:`, err);
        return null;
      });
      return {
        ...item.toObject(),
        offerDetails: offerDetails || { finalPrice: item.product.price, discountPercentage: 0, appliedOfferType: 'none' },
        total: (offerDetails?.finalPrice || item.product.price) * item.quantity
      };
    }));

    const subtotal = cartItemsWithOffers.reduce((acc, item) => acc + item.total, 0);
    const shippingCharge = 50;
    const totalAmount = subtotal + shippingCharge;

    console.log('Rendering checkout page with totals:', { subtotal, shippingCharge, totalAmount });
    res.render('user/checkout', {
      cart,
      cartItemsWithOffers,
      addresses,
      defaultAddressIndex,
      subtotal,
      shippingCharge,
      totalAmount,
      walletBalance: wallet.balance,
      user: req.user
    });
  } catch (error) {
    console.error('Checkout page error:', error.message, error.stack);
    res.status(500).render('error', { message: 'Error loading checkout page' });
  }
};

// Create Razorpay Order
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { addressId, couponCode, couponDiscount } = req.body;
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const addressDoc = await Address.findOne({ userID: req.user._id });
    const selectedAddress = addressDoc?.address.find(addr => addr._id.toString() === addressId);
    if (!selectedAddress) {
      return res.status(400).json({ success: false, message: 'Invalid delivery address' });
    }

    const cartItemsWithOffers = await Promise.all(cart.items.filter(item => item.product).map(async (item) => {
      const offerDetails = await getBestOfferForProduct(item.product).catch(() => null);
      const finalPrice = offerDetails?.finalPrice || item.product.price;
      return {
        productId: item.product._id,
        quantity: item.quantity,
        price: item.product.price,
        finalPrice,
        totalPrice: finalPrice * item.quantity,
        status: 'Ordered'
      };
    }));

    const subtotal = cartItemsWithOffers.reduce((acc, item) => acc + item.totalPrice, 0);
    const shippingCharge = 50;
    const totalAmount = subtotal + shippingCharge - (couponDiscount || 0);

    const options = {
      amount: totalAmount * 100, // Convert to paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    };

    const razorpayOrder = await razorpay.orders.create(options);
    res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      amount: options.amount,
      orderId: razorpayOrder.id,
    });
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    res.status(500).json({ success: false, message: 'Error creating Razorpay order' });
  }
};

// Verify Payment and Place Order
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, addressId, totalAmount, couponCode, couponDiscount } = req.body;
    const crypto = require('crypto');
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed', showFailureModal: true, redirectUrl: '/checkout' });
    }

    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    const addressDoc = await Address.findOne({ userID: req.user._id });
    const selectedAddress = addressDoc?.address.find(addr => addr._id.toString() === addressId);

    const cartItemsWithOffers = await Promise.all(cart.items.filter(item => item.product).map(async (item) => {
      const offerDetails = await getBestOfferForProduct(item.product).catch(() => null);
      const finalPrice = offerDetails?.finalPrice || item.product.price;
      return {
        productId: item.product._id,
        quantity: item.quantity,
        price: item.product.price,
        finalPrice,
        totalPrice: finalPrice * item.quantity,
        status: 'Ordered'
      };
    }));

    const order = new Order({
      user: req.user._id,
      products: cartItemsWithOffers,
      deliveryAddress: selectedAddress,
      orderAmount: totalAmount,
      shippingCharge: 50,
      paymentMethod: 'razorpay',
      paymentStatus: 'paid',
      status: 'Processing',
      orderDate: new Date(),
      couponCode: couponCode || null,
      couponDiscount: couponDiscount || 0,
      couponApplied: couponCode ? (await Coupon.findOne({ code: couponCode }))?._id : null,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
    });

    await order.save();
    await Cart.findByIdAndDelete(cart._id);

    res.json({ success: true, orderId: order._id, redirectUrl: `/orders/${order._id}`, showSuccessModal: true });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ success: false, message: 'Error verifying payment', showFailureModal: true, redirectUrl: '/checkout' });
  }
};

// Place Order (COD and Wallet)
exports.placeOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod, totalAmount, couponCode, couponDiscount } = req.body;

    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart || cart.items.length === 0 || cart.items.filter(item => item.product).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid cart found' });
    }

    const addressDoc = await Address.findOne({ userID: req.user._id });
    const selectedAddress = addressDoc?.address.find(addr => addr._id.toString() === addressId);
    if (!selectedAddress) {
      return res.status(400).json({ success: false, message: 'Invalid delivery address' });
    }

    const cartItemsWithOffers = await Promise.all(cart.items.filter(item => item.product).map(async (item) => {
      const offerDetails = await getBestOfferForProduct(item.product).catch(err => {
        console.error(`Error getting offer for product ${item.product._id}:`, err);
        return null;
      });
      const finalPrice = offerDetails?.finalPrice || item.product.price;
      return {
        productId: item.product._id,
        quantity: item.quantity,
        price: item.product.price,
        finalPrice,
        totalPrice: finalPrice * item.quantity,
        status: 'Ordered'
      };
    }));

    const subtotal = cartItemsWithOffers.reduce((acc, item) => acc + item.totalPrice, 0);
    const shippingCharge = 50;
    const orderAmount = totalAmount || (subtotal + shippingCharge - (couponDiscount || 0));

    if (paymentMethod === 'cod' && orderAmount > 7000) {
      return res.status(400).json({ success: false, message: 'Cash on Delivery is not available for orders above ₹7000', showFailureModal: true });
    }

    let wallet;
    let paymentSuccess = false;

    if (paymentMethod === 'wallet') {
      wallet = await Wallet.findOne({ userId: req.user._id }) || new Wallet({ userId: req.user._id, balance: 0 });
      if (wallet.balance < orderAmount) {
        return res.status(400).json({ success: false, message: 'Insufficient wallet balance', showFailureModal: true });
      }
      wallet.balance -= orderAmount;
      wallet.transactions.push({
        amount: orderAmount,
        type: 'debit',
        description: `Order payment attempt at ${new Date().toISOString()}`,
        date: new Date(),
        time: new Date()
      });
      await wallet.save();
      paymentSuccess = true;
    } else if (paymentMethod === 'cod') {
      paymentSuccess = true;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid payment method', showFailureModal: true });
    }

    if (paymentSuccess) {
      const order = new Order({
        user: req.user._id,
        products: cartItemsWithOffers,
        deliveryAddress: selectedAddress,
        orderAmount,
        shippingCharge,
        paymentMethod,
        paymentStatus: paymentMethod === 'wallet' ? 'paid' : 'pending',
        status: 'Processing',
        orderDate: new Date(),
        couponCode: couponCode || null,
        couponDiscount: couponDiscount || 0,
        couponApplied: couponCode ? (await Coupon.findOne({ code: couponCode }))?._id : null
      });

      await order.save();
      await Cart.findByIdAndDelete(cart._id);

      return res.json({
        success: true,
        orderId: order._id,
        redirectUrl: `/orders/${order._id}`,
        message: 'Order placed successfully',
        showSuccessModal: true
      });
    }
  } catch (error) {
    console.error('Order placement error:', error.message, error.stack);
    if (req.body.paymentMethod === 'wallet') {
      const wallet = await Wallet.findOne({ userId: req.user._id });
      if (wallet && wallet.transactions.some(t => t.description.includes('Order payment attempt'))) {
        wallet.balance += req.body.totalAmount;
        wallet.transactions.push({
          amount: req.body.totalAmount,
          type: 'credit',
          description: `Refund for failed order attempt at ${new Date().toISOString()}`,
          date: new Date(),
          time: new Date()
        });
        await wallet.save();
      }
    }
    res.status(500).json({
      success: false,
      redirectUrl: '/checkout',
      message: error.message || 'Error processing order',
      showFailureModal: true
    });
  }
};

// Apply Coupon
exports.applyCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body;

    if (!couponCode) {
      return res.status(400).json({ success: false, message: 'Coupon code is required' });
    }

    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart || cart.items.length === 0 || cart.items.filter(item => item.product).length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
    if (!coupon || new Date(coupon.expiredOn) < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired coupon' });
    }

    if (coupon.usageLimit && coupon.couponUsed >= coupon.usageLimit) {
      return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
    }

    let userCouponData = coupon.users.find(u => u.userId.toString() === req.user._id.toString());
    if (userCouponData && userCouponData.usageCount >= coupon.usagePerUserLimit) {
      return res.status(400).json({ success: false, message: 'You have reached the usage limit for this coupon' });
    }

    const subtotal = cart.items.filter(item => item.product).reduce((acc, item) => acc + item.product.price * item.quantity, 0);
    if (subtotal < coupon.minimumPrice) {
      return res.status(400).json({ success: false, message: `Minimum purchase of ₹${coupon.minimumPrice} required` });
    }

    let discount = coupon.offerType === 'percentage'
      ? Math.min((subtotal * coupon.offerValue) / 100, coupon.maxDiscount || Infinity)
      : coupon.offerValue;

    const shippingCharge = 50;
    const discountedTotal = subtotal + shippingCharge - discount;

    if (!userCouponData) {
      coupon.users.push({ userId: req.user._id, usageCount: 1 });
    } else {
      userCouponData.usageCount += 1;
    }
    coupon.couponUsed += 1;
    if (coupon.usageLimit && coupon.couponUsed >= coupon.usageLimit) {
      coupon.isActive = false;
    }
    await coupon.save();

    res.json({
      success: true,
      discount,
      discountedTotal,
      shippingCharge,
      couponCode,
      message: 'Coupon applied successfully'
    });
  } catch (error) {
    console.error('Coupon error:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Error applying coupon' });
  }
};

module.exports = exports;