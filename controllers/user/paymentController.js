const {createRazorpayInstance} = require('../../config/razorpay')
const crypto = require('crypto');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const { log } = require('console');


const razorpayInstance = createRazorpayInstance()

exports.createRazorpayOrder = async (req, res) => {
  try {
    const { amount, addressId } = req.body;

    const options = {
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `receipt_${Date.now()}`
    };

    const order = await razorpayInstance.orders.create(options);
    res.json({
      success: true,
      orderId: order.id,
      amount: order.orderAmount,
      key: process.env.Test_Key_ID,
      addressId
    });
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    res.status(500).json({ success: false, message: 'Error creating order' });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, addressId, totalAmount } = req.body;

    const generatedSignature = crypto
      .createHmac('sha256', process.env.Test_Key_Secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    const addressDoc = await Address.findOne({ userID: req.user._id });
    const selectedAddress = addressDoc.address.find(addr => addr._id.toString() === addressId);

    const orderProducts = cart.items.map(item => ({
      productId: item.product._id,
      quantity: item.quantity,
      price: item.price,
      totalPrice: item.price * item.quantity,
      status: 'Pending'
    }));

    const order = new Order({
      user: req.user._id,
      products: orderProducts,
      deliveryAddress: selectedAddress,
      orderAmount: totalAmount,
      shippingCharge: cart.calculateTotal() < 500 ? 30 : 0,
      paymentMethod: 'razorpay',
      paymentStatus: 'paid',
      orderStatus: 'Processing',
      razorpayDetails: {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature
      }
    });

    await order.save();
    await Cart.findByIdAndDelete(cart._id);

    res.json({ success: true, orderId: order._id });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ success: false, message: 'Error verifying payment' });
  }
};