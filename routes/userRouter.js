const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userControllers');
const productController = require('../controllers/user/productController');
const { userAuth, redirectLoggedInUser, checkBlockedStatus } = require('../middleware/auth');
const passport = require('passport');

// Authentication routes
router.get('/signup', redirectLoggedInUser, userController.loadSignup);
router.post('/signup', redirectLoggedInUser, userController.signup);
router.get('/login', checkBlockedStatus, redirectLoggedInUser, userController.loadLogin);
router.post('/login', redirectLoggedInUser, userController.login);
router.get('/verifyOtp', redirectLoggedInUser, userController.loadverifyOtp);
router.post('/verifyOtp', redirectLoggedInUser, userController.verifyOtp);
router.post('/resendOtp', redirectLoggedInUser, userController.resendOtp);
router.get('/logout', userAuth, userController.logout);
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
router.get('/cart', userAuth, productController.getCart);
router.post('/cart/add', userAuth, productController.addToCart);
router.delete('/cart/remove/:productId', userAuth, productController.removeFromCart);
router.put('/cart/update/:productId', userAuth, productController.updateCartQuantity);

// Wishlist routes
router.get('/wishlist', userAuth, productController.getWishlist);
router.post('/wishlist/add', userAuth, productController.addToWishlist);
router.delete('/wishlist/remove/:productId', userAuth, productController.removeFromWishlist);

// Static pages
router.get('/about', userController.loadAboutPage);
router.get('/contact', userController.loadContactPage);

module.exports = router;