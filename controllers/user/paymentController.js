const { createRazorpayInstance } = require('../../config/razorpay');
const crypto = require('crypto');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');

const razorpayInstance = createRazorpayInstance();

exports.createRazorpayOrder = async (req, res) => {
    try {
        console.log('Creating Razorpay order:', req.body);
        const { amount, addressId } = req.body;

        const options = {
            amount: Math.round(amount * 100),
            currency: 'INR',
            receipt: `receipt_${Date.now()}`
        };

        const order = await razorpayInstance.orders.create(options);
        console.log('Razorpay order created:', order);

        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            key: process.env.Test_Key_ID,
            addressId
        });
    } catch (error) {
        console.error('Razorpay order creation error:', error.message, error.stack);
        res.status(500).json({ success: false, message: 'Error creating order' });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        console.log('Verifying Razorpay payment:', req.body);
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, addressId, totalAmount } = req.body;

        const generatedSignature = crypto
            .createHmac('sha256', process.env.Test_Key_Secret)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        console.log('Generated signature:', generatedSignature);
        if (generatedSignature !== razorpay_signature) {
            console.log('Signature mismatch');
            return res.status(400).json({ success: false, message: 'Payment verification failed' });
        }

        const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
        console.log('Cart:', cart);
        if (!cart || !cart.items.length) {
            console.log('Cart is empty or not found');
            return res.status(400).json({ success: false, message: 'Cart is empty or not found' });
        }

        const addressDoc = await Address.findOne({ userID: req.user._id });
        console.log('Address doc:', addressDoc);
        const selectedAddress = addressDoc?.address.find(addr => addr._id.toString() === addressId);
        console.log('Selected address:', selectedAddress);
        if (!selectedAddress) {
            console.log('Invalid address');
            return res.status(400).json({ success: false, message: 'Invalid delivery address' });
        }

        const validCartItems = cart.items.filter(item => item.product);
        if (validCartItems.length === 0) {
            console.log('No valid items in cart');
            return res.status(400).json({ success: false, message: 'No valid products in cart' });
        }

        const orderProducts = validCartItems.map(item => {
            console.log('Processing cart item:', item);
            return {
                productId: item.product._id,
                quantity: item.quantity,
                price: item.product.price,
                finalPrice: item.product.price, // Adjust if offers are applied
                totalPrice: item.product.price * item.quantity,
                status: 'Pending'
            };
        });

        const cartTotal = validCartItems.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
        const shippingCharge = cartTotal < 500 ? 30 : 0;

        const order = new Order({
            user: req.user._id,
            products: orderProducts,
            deliveryAddress: selectedAddress,
            orderAmount: totalAmount,
            shippingCharge,
            paymentMethod: 'razorpay',
            paymentStatus: 'paid',
            orderStatus: 'Processing',
            razorpayDetails: {
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                signature: razorpay_signature
            }
        });

        console.log('Order before saving:', order.toObject());
        await order.save();
        console.log('Order saved successfully:', order._id);

        // Only delete the cart after successful order creation
        await Cart.findByIdAndDelete(cart._id);
        console.log('Cart deleted successfully after order:', cart._id);

        res.json({ success: true, orderId: order._id });
    } catch (error) {
        console.error('Payment verification error:', error.message, error.stack);
        res.status(500).json({ success: false, message: 'Error verifying payment', error: error.message });
    }
};