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
        const userId = req.session.user?._id;

        if (!userId) {
            return res.redirect('/login');
        }

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid product ID' 
            });
        }

        // Find the product
        const product = await Product.findOne({
            _id: productId,
            isListed: true,
            isDeleted: false
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found or unavailable'
            });
        }

        if(product.stock < 6) {
            return res.status(400).json({
                success:false,
                 message: 'Out of stock'
            })
        }
        // Check if quantity exceeds 10
        if (quantity > 10) {
            return res.status(400).json({
                success: false,
                message: 'You cannot add more than 10 quantities of this product.'
            });
        }

        // Check if there's enough stock
        if (product.stock < quantity) {
            return res.status(400).json({
                success: false,
                message: `Only ${product.stock} items available in stock`
            });
        }

        // Calculate discounted price
        const discountedPrice = product.price * (1 - (product.discountPercentage / 100));

        // Find or create cart for the user
        let cart = await Cart.findOne({ user: new mongoose.Types.ObjectId(userId) });

        if (!cart) {
            cart = new Cart({ user: userId, items: [] });
        }

        // Check if product already exists in cart
        const existingItemIndex = cart.items.findIndex(
            item => item.product.toString() === productId.toString()
        );

        if (existingItemIndex > -1) {
            // Calculate new quantity for existing item
            let newQuantity = cart.items[existingItemIndex].quantity + parseInt(quantity);
            
            // Check if new total quantity exceeds 10
            if (newQuantity > 10) {
                return res.status(400).json({
                    success: false,
                    message: 'You cannot add more than 10 quantities of this product.'
                });
            }

            // Check if new total quantity exceeds stock
            if (newQuantity > product.stock) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot add more items. Only ${product.stock} available in stock`
                });
            }

            // Update existing item quantity
            cart.items[existingItemIndex].quantity = newQuantity;
        } else {
            // Add new item to cart
            newQuantity = parseInt(quantity);
            cart.items.push({
                product: productId,
                quantity: newQuantity,
                price: discountedPrice
            });
        }

        // Reduce the product stock
        product.stock -= parseInt(quantity);
        await product.save();

        // Save the cart
        await cart.save();
        
        // Populate product details for response
        await cart.populate('items.product');

        res.json({
            success: true,
            message: 'Product added to cart successfully',
            cart: cart,
            newQuantity: newQuantity,
            remainingStock: product.stock
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

        // Find the item being removed to get its quantity
        const removedItem = cart.items.find(item => 
            item.product.toString() === productId.toString()
        );

        if (!removedItem) {
            return res.status(404).json({
                success: false,
                message: 'Product not found in cart'
            });
        }

        // Update product stock
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Add the removed quantity back to stock
        product.stock += removedItem.quantity;
        await product.save();

        // Remove the item from cart
        cart.items = cart.items.filter(item => 
            item.product.toString() !== productId.toString()
        );

        // Save the updated cart
        await cart.save();

        // Calculate new cart total
        const cartTotal = cart.items.reduce((sum, item) => sum + item.total, 0);

        res.json({
            success: true,
            message: 'Item removed from cart successfully',
            cartTotal: cartTotal,
            isEmpty: cart.items.length === 0
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

        let cart = await Cart.findOne({ user: userId });

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        const cartItemIndex = cart.items.findIndex(
            item => item.product.toString() === productId
        );

        if (cartItemIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Product not found in cart'
            });
        }

        const currentQuantity = cart.items[cartItemIndex].quantity;
        const newQuantity = currentQuantity + parseInt(quantity);

        if (newQuantity > 10) {
            return res.status(400).json({
                success: false,
                message: 'Maximum quantity limit (10) reached for this product',
                currentQuantity: currentQuantity
            });
        }

        if (newQuantity < 1) {
            return res.status(400).json({
                success: false,
                message: 'Quantity cannot be less than 1',
                currentQuantity: currentQuantity
            });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        if (newQuantity > product.stock) {
            return res.status(400).json({
                success: false,
                message: 'Requested quantity exceeds available stock',
                currentQuantity: currentQuantity
            });
        }

        const discountedPrice = product.price * (1 - (product.discountPercentage / 100));
        cart.items[cartItemIndex].quantity = newQuantity;
        cart.items[cartItemIndex].price = discountedPrice;
        cart.items[cartItemIndex].total = discountedPrice * newQuantity;

        // Adjust the stock based on the difference in quantity
        const quantityDifference = newQuantity - currentQuantity;
        product.stock -= quantityDifference;
        await product.save();

        await cart.save();

        // Calculate new cart total
        const cartTotal = cart.items.reduce((sum, item) => sum + item.total, 0);

        res.json({
            success: true,
            message: 'Cart quantity updated successfully',
            newQuantity: newQuantity,
            total: cart.items[cartItemIndex].total.toFixed(2),
            cartTotal: cartTotal.toFixed(2)
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