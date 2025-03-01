const Cart = require('../../models/cartSchema');
const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema');
const Coupon = require('../../models/coupounSchema');

exports.getCheckout = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id })
            .populate({ path: 'items.product', select: 'name images price' });

        if (!cart || cart.items.length === 0) {
            return res.redirect('/cart');
        }

        const addressDoc = await Address.findOne({ userID: req.user._id });
        const addresses = addressDoc ? addressDoc.address : [];
        const defaultAddressIndex = addresses.findIndex(addr => addr.isDefault);
        const selectedIndex = defaultAddressIndex !== -1 ? defaultAddressIndex : 0;

        const subtotal = cart.items.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
        const shippingCharge = subtotal < 500 ? 30 : 0;
        const totalAmount = subtotal + shippingCharge;

        res.render('checkout', {
            cart,
            addresses,
            defaultAddressIndex: selectedIndex,
            subtotal,
            shippingCharge,
            totalAmount,
            user: req.user
        });
    } catch (error) {
        console.error('Checkout page error:', error);
        res.status(500).render('error', { message: 'Error loading checkout page' });
    }
};

exports.placeOrder = async (req, res) => {
    try {
        const { addressId, paymentMethod, totalAmount } = req.body;
        const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        const addressDoc = await Address.findOne({ userID: req.user._id });
        const selectedAddress = addressDoc?.address.find(addr => addr._id.toString() === addressId);
        if (!selectedAddress) {
            return res.status(400).json({ success: false, message: 'Invalid delivery address' });
        }

        const subtotal = cart.items.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
        const shippingCharge = subtotal < 500 ? 30 : 0;
        const orderProducts = cart.items.map(item => ({
            productId: item.product._id,
            quantity: item.quantity,
            price: item.product.price,
            totalPrice: item.product.price * item.quantity,
            status: 'Pending'
        }));

        const order = new Order({
            user: req.user._id,
            products: orderProducts,
            deliveryAddress: selectedAddress,
            orderAmount: totalAmount,
            shippingCharge,
            paymentMethod,
            paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid',
            orderStatus: 'Processing'
        });

        await order.save();
        await Cart.findByIdAndDelete(cart._id);

        res.json({ success: true, orderId: order._id });
    } catch (error) {
        console.error('Order placement error:', error);
        res.status(500).json({ success: false, message: 'Error placing order' });
    }
};

exports.applyCoupon = async (req, res) => {
    try {
        const { couponCode } = req.body;
        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        const coupon = await Coupon.findOne({ code: couponCode, status: 'active' });
        if (!coupon) {
            return res.status(400).json({ success: false, message: 'Invalid coupon' });
        }

        const isExpired = new Date(coupon.expirationDate).getTime() < Date.now();
        if (isExpired || (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)) {
            return res.status(400).json({ success: false, message: 'Coupon expired or usage limit reached' });
        }

        const subtotal = cart.items.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
        if (subtotal < coupon.minPurchase) {
            return res.status(400).json({ success: false, message: `Minimum purchase of ₹${coupon.minPurchase} required` });
        }

        let discount = 0;
        if (coupon.discountType === 'percentage') {
            discount = Math.min((subtotal * coupon.discountValue) / 100, coupon.maxDiscount || Infinity);
        } else {
            discount = coupon.discountValue;
        }

        const shippingCharge = subtotal < 500 ? 30 : 0;
        const discountedTotal = subtotal + shippingCharge - discount;

        await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });

        res.json({ success: true, discount, discountedTotal, message: 'Coupon applied successfully' });
    } catch (error) {
        console.error('Coupon error:', error);
        res.status(500).json({ success: false, message: 'Error applying coupon' });
    }
};
