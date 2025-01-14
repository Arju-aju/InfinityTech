const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userControllers');
const { use } = require('../app');
const passport = require('passport');
const { isUserLoggedIn } = require('../middleware/auth');
const { userAuth,adminAuth } = require('../middleware/auth');

router.get('/pageNotFound', userController.pageNotFound);
router.get('/', userController.loadHomePage);
router.get('/signup', userController.loadSignup);
router.post('/signup', userController.signup);
router.get('/verifyOtp', userController.loadverifyOtp);
router.post('/verifyOtp', userController.verifyOtp);
router.post('/resendOtp', userController.resendOtp);
router.get('/login', userController.loadLogin);
router.post('/login', userController.login);
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  req.session.user = req.user;
  res.redirect('/');
});

router.get('/logout', userController.logout);
router.get('/category/:id', userController.getCategoryProducts);
router.get('/categories', userController.getAllCategories);
router.get('/shop', userAuth, isUserLoggedIn, userController.loadShop);
router.get('/product/:id', userAuth, isUserLoggedIn, userController.getSingleProduct);

module.exports = router;
