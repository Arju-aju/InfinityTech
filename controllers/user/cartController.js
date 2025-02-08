const User = require('../../models/userSchema'); 
const Cart = require('../../models/cartSchema');
const { default: mongoose } = require('mongoose');
const Product = require('../../models/productSchema');



const getCart = async (req, res) => {
    try {
        const userId = req.session.user._id;
        console.log('Fetching cart for user ID:', userId);

        // Fetch the cart from the Cart collection
        const cart = await Cart.findOne({ user: userId }).populate({
            path: 'items.product',
            select: 'name images price discountPercentage'
        });

        if (!cart || cart.items.length === 0) {
            console.log('Cart is empty for this user.');
            return res.render('user/cart', {
                cartItems: [],
                cartTotal: 0,
                message: {
                    type: req.flash('error').length ? 'error' : 'success',
                    content: req.flash('error')[0] || req.flash('success')[0]
                }
            });
        }

        console.log('Cart details:', cart);

        const cartItems = cart.items.map(item => {
            const product = item.product;
            const price = product.price;
            const discountedPrice = price - (price * (product.discountPercentage / 100));
            return {
                ...item.toObject(),
                product,
                discountedPrice,
                total: discountedPrice * item.quantity
            };
        });

        const cartTotal = cartItems.reduce((total, item) => total + item.total, 0);
        console.log('Cart Items:', cartItems);
        console.log('Cart Total:', cartTotal);

        res.render('user/cart', {
            cartItems,
            cartTotal,
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });

    } catch (error) {
        console.error('Error in getCart:', error);
        req.flash('error', 'Error loading cart');
        res.redirect('/');
    }
};



const addToCart = async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;
     
        console.log('product id vanoo>>>>',productId);
        const userId = req.session.user?._id;
        
        console.log('user vanitt indo=====>>>',userId);
        // Ensure productId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }

        // Find the product
        const product = await Product.findOne({
            _id: productId,
            isListed: true,
            isDeleted: false
        });
        console.log('product indo',product);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found or unavailable'
            });
        }

        // Calculate discounted price
        const discountedPrice = product.price * (1 - (product.discountPercentage / 100));
        console.log('discounted price>>>>',discountedPrice);
        // Find or create cart for the user
        let cart = await Cart.findOne({ user: new mongoose.Types.ObjectId(userId) });

        console.log('cartil indo>>>>>',cart);
        if (!cart) {
            cart = new Cart({ user: userId, items: [] });
        }

        // Check if product already exists in cart
        const existingItemIndex = cart.items.findIndex(
            item => item.product.toString() === productId.toString()
        );

        if (existingItemIndex > -1) {
            // Update existing item quantity
            console.log('product indodaaaaa cartil');
            cart.items[existingItemIndex].quantity += parseInt(quantity);
        } else {
            // Add new item to cart
            console.log('product varunindooooo');
            cart.items.push({
                product: productId,
                quantity: parseInt(quantity),
                price: discountedPrice
            });
        }
        // Save the cart
        await cart.save();
        
        // Populate product details for response
        await cart.populate('items.product');
        console.log('cartil sathanam indoo>>>>>',cart);

        res.json({
            success: true,
            message: 'Product added to cart successfully',
            cart: cart
        });

    } catch (error) {
        console.error('Error in addToCart:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding product to cart'
        });
    }
};

const removeFromCart = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized. Please log in.'
            });
        }

        const { productId } = req.params;
        const userId = req.session.user._id;

        // Find the user's cart
        const cart = await Cart.findOne({ user: userId });

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        // Remove the item using MongoDB's pull operator
        cart.items = cart.items.filter(item => 
            item.product.toString() !== productId.toString()
        );

        // Save the updated cart
        await cart.save();

        // Return the updated cart data
        const updatedCart = await Cart.findOne({ user: userId })
            .populate('items.product');

        res.json({
            success: true,
            message: 'Item removed from cart successfully',
            cart: updatedCart
        });

    } catch (error) {
        console.error('Error in removeFromCart:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing item from cart'
        });
    }
}

 const updateCartQuantity = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized. Please log in.'
            });
        }

        const { productId } = req.params;
        const { quantity } = req.body;
        const userId = req.session.user._id;

        // Find the cart for this user
        let cart = await Cart.findOne({ user: userId });
        
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        // Find the item in the cart
        const cartItemIndex = cart.items.findIndex(
            item => item.product.toString() === productId
        );

        if (cartItemIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Product not found in cart'
            });
        }

        // Calculate new quantity
        const currentQuantity = cart.items[cartItemIndex].quantity;
        const newQuantity = currentQuantity + parseInt(quantity);

        // If new quantity would be 0 or less, return error
        if (newQuantity < 1) {
            return res.status(400).json({
                success: false,
                message: 'Quantity cannot be less than 1'
            });
        }

        // Get the product to check stock and calculate price
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Check if new quantity exceeds stock
        if (newQuantity > product.stock) {
            return res.status(400).json({
                success: false,
                message: 'Requested quantity exceeds available stock'
            });
        }

        // Update quantity and price
        const discountedPrice = product.price * (1 - (product.discountPercentage / 100));
        cart.items[cartItemIndex].quantity = newQuantity;
        cart.items[cartItemIndex].price = discountedPrice;

        // Save the updated cart
        await cart.save();

        res.json({
            success: true,
            message: 'Cart quantity updated successfully',
            cart: cart
        });

    } catch (error) {
        console.error('Error in updateCartQuantity:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating cart quantity'
        });
    }
}




module.exports = {
    getCart,
    addToCart,
    removeFromCart,
    updateCartQuantity
};