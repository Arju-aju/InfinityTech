const Cart = require('../../models/cartSchema');
const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema');
const Coupon = require('../../models/coupounSchema');
const { getBestOfferForProduct } = require('../../utils/offer');

// Get Checkout Page: Loads the checkout page with cart, addresses, and totals
exports.getCheckout = async (req, res) => {
  try {
    console.log('Fetching checkout page for user:', req.user._id);
    const cart = await Cart.findOne({ user: req.user._id })
      .populate({ path: 'items.product', select: 'name images price' });

    if (!cart) {
      console.log('No cart found for user, redirecting to cart');
      return res.redirect('/cart');
    }

    if (cart.items.length === 0) {
      console.log('Cart is empty (items array is empty), redirecting to cart');
      return res.redirect('/cart');
    }

    const validCartItems = cart.items.filter(item => item.product);
    if (validCartItems.length === 0) {
      console.log('No valid items in cart after filtering, redirecting to cart');
      return res.redirect('/cart');
    }
    cart.items = validCartItems;

    const addressDoc = await Address.findOne({ userID: req.user._id });
    const addresses = addressDoc ? addressDoc.address : [];
    const defaultAddressIndex = addresses.findIndex(addr => addr.isDefault);
    const selectedIndex = defaultAddressIndex !== -1 ? defaultAddressIndex : 0;

    const cartItemsWithOffers = await Promise.all(cart.items.map(async (item) => {
      try {
        const offerDetails = await getBestOfferForProduct(item.product);
        return {
          ...item.toObject(),
          offerDetails: offerDetails || {
            finalPrice: item.product.price,
            discountPercentage: 0,
            appliedOfferType: 'none'
          },
          total: (offerDetails ? offerDetails.finalPrice : item.product.price) * item.quantity
        };
      } catch (err) {
        console.error(`Error getting offer for product ${item.product._id}:`, err);
        return {
          ...item.toObject(),
          offerDetails: {
            finalPrice: item.product.price,
            discountPercentage: 0,
            appliedOfferType: 'none'
          },
          total: item.product.price * item.quantity
        };
      }
    }));

    const subtotal = cartItemsWithOffers.reduce((acc, item) => acc + item.total, 0);
    const shippingCharge = subtotal < 500 ? 30 : 0;
    const totalAmount = subtotal + shippingCharge;

    console.log('Rendering checkout page with totals:', { subtotal, shippingCharge, totalAmount });
    res.render('user/checkout', {
      cart,
      cartItemsWithOffers,
      addresses,
      defaultAddressIndex: selectedIndex,
      subtotal,
      shippingCharge,
      totalAmount,
      user: req.user
    });
  } catch (error) {
    console.error('Checkout page error:', error.message, error.stack);
    res.status(500).render('error', { message: 'Error loading checkout page' });
  }
};

// Place Order: Handles order placement for COD
exports.placeOrder = async (req, res) => {
  try {
    console.log('Place order request received:', req.body);
    console.log('User ID:', req.user._id);

    if (!req.user || !req.user._id) {
      console.log('User not authenticated');
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { addressId, paymentMethod, totalAmount } = req.body;
    if (paymentMethod !== 'cod') {
      return res.status(400).json({ success: false, message: 'Use Razorpay endpoint for non-COD payments' });
    }

    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    console.log('Cart found:', cart);

    if (!cart) {
      console.log('No cart found for user');
      return res.status(400).json({ success: false, message: 'No cart found for user' });
    }

    if (cart.items.length === 0) {
      console.log('Cart is empty');
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const validCartItems = cart.items.filter(item => item.product);
    console.log('Valid cart items:', validCartItems);

    if (validCartItems.length === 0) {
      console.log('No valid items in cart');
      return res.status(400).json({ success: false, message: 'No valid products in cart' });
    }

    const addressDoc = await Address.findOne({ userID: req.user._id });
    const selectedAddress = addressDoc?.address.find(addr => addr._id.toString() === addressId);
    if (!selectedAddress) {
      console.log('Invalid address');
      return res.status(400).json({ success: false, message: 'Invalid delivery address' });
    }

    const cartItemsWithOffers = await Promise.all(validCartItems.map(async (item) => {
      try {
        const offerDetails = await getBestOfferForProduct(item.product);
        const finalPrice = offerDetails ? offerDetails.finalPrice : item.product.price;
        return {
          productId: item.product._id,
          quantity: item.quantity,
          price: item.product.price,
          finalPrice: finalPrice,
          totalPrice: finalPrice * item.quantity,
          status: 'Pending'
        };
      } catch (err) {
        console.error(`Error getting offer for product ${item.product._id}:`, err);
        return {
          productId: item.product._id,
          quantity: item.quantity,
          price: item.product.price,
          finalPrice: item.product.price,
          totalPrice: item.product.price * item.quantity,
          status: 'Pending'
        };
      }
    }));

    const subtotal = cartItemsWithOffers.reduce((acc, item) => acc + item.totalPrice, 0);
    const shippingCharge = subtotal < 500 ? 30 : 0;
    const orderAmount = subtotal + shippingCharge;

    const order = new Order({
      user: req.user._id,
      products: cartItemsWithOffers,
      deliveryAddress: selectedAddress,
      orderAmount: totalAmount || orderAmount,
      shippingCharge,
      paymentMethod,
      paymentStatus: 'pending',
      orderStatus: 'Processing',
      orderDate: new Date()
    });

    console.log('Saving order:', order.toObject());
    await order.save();
    console.log('Order saved successfully:', order._id);

    await Cart.findByIdAndDelete(cart._id);
    console.log('Cart deleted successfully:', cart._id);

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
      console.log('No coupon code provided');
      return res.status(400).json({ success: false, message: 'Coupon code is required' });
    }

    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    console.log('Cart:', cart);
    if (!cart || cart.items.length === 0) {
      console.log('Cart is empty');
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const validItems = cart.items.filter(item => item.product);
    console.log('Valid items:', validItems);
    if (validItems.length === 0) {
      console.log('No valid items in cart');
      return res.status(400).json({ success: false, message: 'No valid products in cart' });
    }

    const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
    console.log('Coupon found:', coupon);
    if (!coupon) {
      console.log('Invalid or inactive coupon');
      return res.status(400).json({ success: false, message: 'Invalid or inactive coupon' });
    }

    const isExpired = new Date(coupon.expiredOn).getTime() < Date.now();
    console.log('Is coupon expired?', isExpired, 'Expired on:', coupon.expiredOn, 'Now:', new Date());
    if (isExpired) {
      console.log('Coupon expired');
      return res.status(400).json({ success: false, message: 'Coupon has expired' });
    }

    if (coupon.usageLimit && coupon.couponUsed >= coupon.usageLimit) {
      console.log('Coupon usage limit reached');
      return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
    }

    let userCouponData = coupon.users.find(u => u.userId.toString() === req.user._id.toString());
    if (userCouponData && userCouponData.usageCount >= coupon.usagePerUserLimit) {
      console.log('User has reached usage limit for this coupon');
      return res.status(400).json({ success: false, message: 'You have reached the usage limit for this coupon' });
    }

    const subtotal = validItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
    console.log('Subtotal:', subtotal, 'Minimum Price:', coupon.minimumPrice);
    if (subtotal < coupon.minimumPrice) {
      console.log('Minimum purchase not met');
      return res.status(400).json({ success: false, message: `Minimum purchase of ₹${coupon.minimumPrice} required` });
    }

    let discount = 0;
    if (coupon.offerType === 'percentage') {
      discount = Math.min((subtotal * coupon.offerValue) / 100, coupon.maxDiscount || Infinity);
    } else {
      discount = coupon.offerValue;
    }

    const shippingCharge = subtotal < 500 ? 30 : 0;
    const discountedTotal = subtotal + shippingCharge - discount;

    if (!userCouponData) {
      coupon.users.push({ userId: req.user._id, usageCount: 1 });
    } else {
      userCouponData.usageCount += 1;
    }

    coupon.couponUsed += 1;
    if (coupon.usageLimit && coupon.couponUsed >= coupon.usageLimit) {
      coupon.isActive = false;
      console.log('Coupon deactivated as usage limit reached');
    }

    await coupon.save();
    console.log('Coupon applied successfully:', { discount, discountedTotal, couponUsed: coupon.couponUsed });

    res.json({ 
      success: true, 
      discount, 
      discountedTotal, 
      message: 'Coupon applied successfully' 
    });
  } catch (error) {
    console.error('Coupon error:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Error applying coupon' });
  }
};

module.exports = exports;