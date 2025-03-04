const express = require('express');
const router = express.Router();

const userController = require('../controllers/user/userControllers');
const profileController = require('../controllers/user/userProfileController');
const productController = require('../controllers/user/productController');
const addressController = require('../controllers/user/addressController');
const cartController = require('../controllers/user/cartController');
const checkoutController = require('../controllers/user/checkOutController');
const orderController = require('../controllers/user/orderController');
const password = require('../controllers/user/password');
const wishlist = require('../controllers/user/wishlistController');
const walletController = require('../controllers/user/walletController');
const paymentController = require('../controllers/user/paymentController');

const { isAuthenticated, isNotAuthenticated, auth, authMiddleware } = require('../middleware/auth');
const passport = require('passport');

// Authentication routes
router.get('/signup', isAuthenticated, userController.loadSignup);
router.post('/signup', userController.signup);
router.get('/login', isAuthenticated, userController.loadLogin);
router.post('/login', isAuthenticated, userController.login);
router.get('/verifyOtp', userController.loadverifyOtp);
router.post('/verifyOtp', userController.verifyOtp);
router.post('/resendOtp', userController.resendOtp);
router.get('/logout', userController.logout);
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
    req.session.user = req.user;
    res.redirect('/');
});

router.get('/changePassword', userController.loadPassword);
router.post("/send-password-otp", userController.sendOTPForPasswordChange);
router.post('/change-password', userController.changePassword);
router.post('/changePasswordresendOtp', userController.resendOtp);

router.get('/forgotPassword', password.getForgotPasswordPage);
router.post('/forgotPassword', password.forgotPassword);
router.get('/forgotOtp', password.getVerifyOTP);
router.post('/forgotOtp', password.verifyOTP);
router.get('/resetPassword', password.getResetPassword);
router.post('/resetPassword', password.resetPassword);

// Product routes
router.get('/', userController.loadHomePage);
router.get('/shop', productController.loadShop);
router.get('/product/:id', auth, productController.getSingleProduct);
router.get('/categories', auth, productController.getAllCategories);
router.get('/category/:id', productController.getCategoryProducts);
router.get('/search', productController.searchProducts);

// Cart routes
router.get('/cart', auth, cartController.getCart);
router.post('/api/cart/add', auth, cartController.addToCart);
router.put('/cart/update/:productId', auth, cartController.updateCartQuantity);
router.delete('/cart/remove/:productId', auth, cartController.removeFromCart);

// Checkout routes
router.get('/checkout', auth, checkoutController.getCheckout);
router.post('/checkout/place-order', auth, checkoutController.placeOrder);
router.post('/apply-coupon', auth, checkoutController.applyCoupon);
router.post('/checkout/create-razorpay-order', auth, paymentController.createRazorpayOrder);
router.post('/verify-payment', auth, paymentController.verifyPayment);

// Order routes
router.get('/orders', auth, orderController.getOrdersList);
router.get('/orders/:id', auth, orderController.getOrderDetails);
router.post('/api/orders/:id/cancel', auth, orderController.cancelOrder);
router.post('/api/orders/:orderId/return', auth, orderController.returnOrder);

// Static pages
router.get('/about', userController.loadAboutPage);
router.get('/contact', userController.loadContactPage);

// Profile management
router.get('/profile', auth, profileController.loadProfile);
router.get("/edit-profile", profileController.getEditProfile);
router.post("/edit-profile", profileController.postEditProfile);

// Address Management
router.get('/address', addressController.getAddress);
router.post('/add-address', addressController.addAddress);
router.get('/edit-address/:id', addressController.editAddress);
router.post('/edit-address/:id', addressController.updateAddress);
router.post('/set-default-address/:id', addressController.setDefaultAddress);
router.delete('/delete-address/:id', addressController.deleteAddress);

// Wishlist
router.get('/wishlist', auth, wishlist.getWishlist);
router.post('/api/wishlist/toggle', auth, wishlist.toggleWishlist);
router.delete('/api/wishlist/remove/:wishlistItemId', auth, wishlist.removeFromWishlist);

// Wallet Management
router.get('/wallet', auth, walletController.getWallet);
router.get('/wallet/history', auth, walletController.getTransactionHistory);

module.exports = router;