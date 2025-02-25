const Wishlist = require('../../models/wishlistSchema')
const Product = require('../../models/productSchema')


exports.getWishlist = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }
        
        const user = req.session.user._id;
        const wishlistItems = await Wishlist.find({ user: user })
            .populate('product')
            .sort({ createdAt: -1 });

        console.log("Wishlist Items:", wishlistItems); // Debugging log

        res.render('wishlist', { wishlistItems }); // Corrected variable name
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        res.status(500).render('error', { 
            message: 'Failed to load wishlist. Please try again later.' 
        });
    }
};


exports.toggleWishlist = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Please log in to modify wishlist' });
        }

        const userId = req.session.user._id;
        const { productId } = req.body; // Make sure your frontend sends the productId in the request body

        if (!productId) {
            return res.status(400).json({ success: false, message: 'Product ID is required' });
        }

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Check if the product is already in the wishlist
        const existingItem = await Wishlist.findOne({ user: userId, product: productId });

        if (existingItem) {
            // Remove from wishlist
            await Wishlist.deleteOne({ user: userId, product: productId });
            return res.json({ success: true, message: 'Product removed from wishlist', added: false });
        } else {
            // Add to wishlist
            const wishlistItem = new Wishlist({ user: userId, product: productId });
            await wishlistItem.save();
            return res.json({ success: true, message: 'Product added to wishlist', added: true });
        }
    } catch (error) {
        console.error('Error toggling wishlist:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


exports.removeFromWishlist = async(req,res)=>{
    try {
        
        const {wishlistItemId} = req.params

        if(!wishlistItemId){
            return res.status(404).json({
                sucess:false,
                message:'Wishlist id is required'
            })
        }

        const deleteItem = await Wishlist.findByIdAndDelete(wishlistItemId)

        if(!deleteItem){
            return res.status(404).json({
                sucess:false,
                message:'Wishlist item not found'
            })
        }

        return res.status(200).json({
            success:true,
            message:'Item removed from wishlist Sucessfully'
        })

    } catch (error) {
        console.error('Error removing item from wishlist:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Server error while removing item from wishlist',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
