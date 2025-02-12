const Cart =  require('../../models/cartSchema')
const Order = require('../../models/orderSchema')
const Address = require('../../models/addressSchema')



exports.getCheckout =  async(req,res)=> {
    try {
        // Get user's cart with populated product details
        const cart = await Cart.findOne({ user: req.user._id })
            .populate({
                path: 'items.product',
                select: 'name images'
            });

        if (!cart || cart.items.length === 0) {
            return res.redirect('/cart');
        }

        // Get user's addresses
        const addressDoc = await Address.findOne({ userID: req.user._id });
        const addresses = addressDoc ? addressDoc.address : [];

        res.render('checkout', {
            cart,
            addresses
        });
    } catch (error) {
        console.error('Checkout page error:', error);
        res.status(500).render('error', {
            message: 'Error loading checkout page'
        });
    }
}

exports.placeOrder = async (req, res) => {
    try {
        const { addressId, paymentMethod } = req.body;

        // Get user's cart
        const cart = await Cart.findOne({ user: req.user._id })
            .populate('items.product');

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }

        // Get selected address
        const addressDoc = await Address.findOne({ userID: req.user._id });
        const selectedAddress = addressDoc.address.find(addr => 
            addr._id.toString() === addressId
        );

        if (!selectedAddress) {
            return res.status(400).json({
                success: false,
                message: 'Invalid delivery address'
            });
        }

        // Create order products array
        const orderProducts = cart.items.map(item => ({
            productId: item.product._id,
            quantity: item.quantity,
            price: item.price,
            totalPrice: item.price * item.quantity,
            status: 'Pending'
        }));

        // Create new order
        const order = new Order({
            user: req.user._id,
            products: orderProducts,
            deliveryAddress: selectedAddress,
            orderAmount: cart.calculateTotal(),
            paymentMethod: paymentMethod
        });

        await order.save();

        // Clear user's cart
        await Cart.findByIdAndDelete(cart._id);

        // Redirect based on payment method
        res.redirect(`/orders/${order._id}?success=true`);


    } catch (error) {
        console.error('Order placement error:', error);
        res.status(500).json({
            success: false,
            message: 'Error placing order'
        });
    }
}
