const Cart = require('../../models/cartSchema');
const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema');
const Coupon = require('../../models/coupounSchema'); // Assuming 'Coupon' model, update if different
const Wallet = require('../../models/walletSchema');
const { getBestOfferForProduct } = require('../../utils/offer');

// Get Checkout Page: Loads the checkout page with cart, addresses, wallet balance, and totals
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
    const shippingCharge = 50; // Fixed shipping charge of ₹50
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

// Place Order: Handles order placement for COD, Wallet, and other methods
exports.placeOrder = async (req, res) => {
  try {
    console.log('Place order request received:', req.body);
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
        status: 'Pending'
      };
    }));

    const subtotal = cartItemsWithOffers.reduce((acc, item) => acc + item.totalPrice, 0);
    const shippingCharge = 50; // Fixed shipping charge of ₹50
    const orderAmount = totalAmount || (subtotal + shippingCharge - (couponDiscount || 0));

    // COD restriction
    if (paymentMethod === 'cod' && orderAmount > 4000) {
      return res.status(400).json({ success: false, message: 'Cash on Delivery is not available for orders above ₹4000' });
    }

    // Wallet payment logic
    if (paymentMethod === 'wallet') {
      let wallet = await Wallet.findOne({ userId: req.user._id });
      if (!wallet) {
        wallet = new Wallet({ userId: req.user._id, balance: 0 });
        await wallet.save();
      }
      if (wallet.balance < orderAmount) {
        return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
      }
      wallet.balance -= orderAmount;
      wallet.transactions.push({
        amount: orderAmount,
        type: 'debit',
        description: `Order payment for order ID: ${new Date().getTime()}`,
        date: new Date(),
        time: new Date()
      });
      await wallet.save();
    } else if (paymentMethod !== 'cod' && paymentMethod !== 'razorpay') {
      return res.status(400).json({ success: false, message: 'Invalid payment method' });
    }

    const order = new Order({
      user: req.user._id,
      products: cartItemsWithOffers,
      deliveryAddress: selectedAddress,
      orderAmount,
      shippingCharge,
      paymentMethod,
      paymentStatus: paymentMethod === 'wallet' ? 'paid' : 'pending',
      orderStatus: 'Processing',
      orderDate: new Date(),
      couponCode: couponCode || null, // Store coupon code
      couponDiscount: couponDiscount || 0, // Store coupon discount
      couponApplied: couponCode ? (await Coupon.findOne({ code: couponCode }))._id : null // Reference to coupon
    });

    await order.save();
    await Cart.findByIdAndDelete(cart._id);

    res.json({ success: true, orderId: order._id, redirectUrl: `/orders/${order._id}` });
  } catch (error) {
    console.error('Order placement error:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Error placing order' });
  }
};

// Apply Coupon: Handles coupon application during checkout
exports.applyCoupon = async (req, res) => {
  try {
    console.log('Applying coupon:', req.body);
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

    const shippingCharge = 50; // Fixed shipping charge of ₹50
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
      couponCode, // Include couponCode in response
      message: 'Coupon applied successfully' 
    });
  } catch (error) {
    console.error('Coupon error:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Error applying coupon' });
  }
};

module.exports = exports;