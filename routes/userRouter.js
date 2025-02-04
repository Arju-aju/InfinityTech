const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userControllers');
const productController = require('../controllers/user/productController');
const { isAuthenticated, isNotAuthenticated } = require('../middleware/auth');
const passport = require('passport');

// Authentication routes
router.get('/signup', isAuthenticated, userController.loadSignup);
router.post('/signup', userController.signup);
router.get('/login', isAuthenticated, userController.loadLogin);
router.post('/login',     userController.login);
router.get('/verifyOtp',     userController.loadverifyOtp);
router.post('/verifyOtp',     userController.verifyOtp);
router.post('/resendOtp',     userController.resendOtp);
router.get('/logout', userController.logout);
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
    req.session.user = req.user;
    res.redirect('/');
});

// Product routes
router.get('/', userController.loadHomePage);
router.get('/shop', productController.loadShop);
router.get('/products/:id', productController.getSingleProduct);
router.get('/categories', productController.getAllCategories);
router.get('/category/:id', productController.getCategoryProducts);
router.get('/search', productController.searchProducts);

// Cart routes
router.get('/cart', productController.getCart);
router.post('/cart/add', productController.addToCart);
router.delete('/cart/remove/:productId', productController.removeFromCart);
router.put('/cart/update/:productId', productController.updateCartQuantity);

// Wishlist routes
router.get('/wishlist',  productController.getWishlist);
router.post('/wishlist/add',  productController.addToWishlist);
router.delete('/wishlist/remove/:productId', productController.removeFromWishlist);

// Static pages
router.get('/about', userController.loadAboutPage);
router.get('/contact', userController.loadContactPage);

module.exports = router;