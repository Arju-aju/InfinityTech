const User = require('../../models/userSchema');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
require('dotenv').config();
const Product = require('../../models/productSchema');
const mongoose = require('mongoose');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendVerificationEmail = async (email, otp) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Email Verification OTP',
        text: `Your OTP for email verification is: ${otp}. Valid for 1 minute.`,
    };
    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

// Check if user is blocked
const checkUserBlockedStatus = async (user, req, res) => {
    try {
        if (user.isBlocked) {
            console.log(`User ${user.email} is blocked`);
            req.session.destroy((err) => {
                if (err) console.error('Session destroy error:', err);
                res.redirect('/login?error=blocked');
            });
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error in checkUserBlockedStatus:', error);
        throw error;
    }
};

// Page not found
const pageNotFound = async (req, res) => {
    try {
        res.render('page-404');
    } catch (error) {
        res.render('/pageNotFound');
    }
};

// Load Login Page
const loadLogin = async (req, res) => {
    try {
        res.render('user/login', {
            messages: req.flash() || { error: [], success: [] },
            email: '' // Ensure email field is empty unless preserved
        });
    } catch (error) {
        console.error('Error loading login page:', error);
        req.flash('error', 'Failed to load login page');
        res.redirect('/pageNotFound');
    }
};

// Login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Backend Validation
        if (!email || !email.trim()) {
            req.flash('error', 'Email is required');
            return res.redirect('/login');
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            req.flash('error', 'Please enter a valid email address');
            return res.redirect('/login');
        }

        if (!password) {
            req.flash('error', 'Password is required');
            return res.redirect('/login');
        }

        if (password.length < 6) {
            req.flash('error', 'Password must be at least 6 characters');
            return res.redirect('/login');
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            req.flash('error', 'Invalid email or password');
            return res.redirect('/login');
        }

        // Check if user is blocked
        if (user.isBlocked) {
            req.flash('error', 'Your account has been blocked. Please contact support');
            return res.redirect('/login');
        }

        // Verify password
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            req.flash('error', 'Invalid email or password');
            return res.redirect('/login');
        }

        // Successful login
        req.session.user = {
            _id: user._id,
            name: user.name,
            email: user.email,
            isVerified: user.isVerified
        };
        
        req.flash('success', `Welcome back, ${user.name}!`);
        return res.redirect('/');

    } catch (error) {
        console.error(`Login error for email ${req.body.email}: ${error.message}`);
        req.flash('error', 'An unexpected error occurred. Please try again.');
        return res.redirect('/login');
    }
};

// Load Signup Page
const loadSignup = async (req, res) => {
    try {
        res.render('user/signup', {
            messages: req.flash() || { error: [], success: [] },
        });
    } catch (error) {
        console.error('Error loading signup page:', error);
        res.redirect('/pageNotFound');
    }
};

// Handle Signup Submit
const signup = async (req, res) => {
    try {
        const { name, email, phone, password, confirmPassword } = req.body;

        // Backend Validation
        if (!name || !/^[a-zA-Z][a-zA-Z\s]*$/.test(name)) {
            req.flash('error', 'Name must start with a letter and contain only letters and spaces');
            return res.redirect('/signup');
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            req.flash('error', 'Please enter a valid email address');
            return res.redirect('/signup');
        }

        if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
            req.flash('error', 'Phone number must start with 6-9 and be 10 digits');
            return res.redirect('/signup');
        }

        if (!password || password.length < 6) {
            req.flash('error', 'Password must be at least 6 characters');
            return res.redirect('/signup');
        }

        if (password !== confirmPassword) {
            req.flash('error', 'Passwords do not match');
            return res.redirect('/signup');
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            req.flash('error', 'Email is already registered');
            return res.redirect('/signup');
        }

        const otp = generateOtp();
        console.log(`Generated OTP for ${email} during signup: ${otp}`);
        const otpExpiry = new Date(Date.now() + 1 * 60 * 1000);
        const hashedPassword = await bcrypt.hash(password, 10);

        req.session.tempUser = {
            name: name.trim(),
            email: email.toLowerCase(),
            phone,
            password: hashedPassword,
            otp,
            otpExpiry,
            isVerified: false,
            isBlocked: false,
        };

        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            req.flash('error', 'Failed to send verification email');
            return res.redirect('/signup');
        }

        req.flash('success', `OTP sent to ${email}`);
        return res.redirect('/verifyOtp');
    } catch (error) {
        console.error('Signup error:', error);
        req.flash('error', 'Server error during signup');
        return res.redirect('/signup');
    }
};

// Load Verify OTP Page
const loadverifyOtp = async (req, res) => {
    try {
        if (!req.session.tempUser) {
            req.flash('error', 'Session expired. Please sign up again');
            return res.redirect('/signup');
        }
        res.render('verifyOtp', {
            email: req.session.tempUser.email,
            messages: req.flash() || { error: [], success: [] },
        });
    } catch (error) {
        console.error('verifyOtp page error:', error);
        res.redirect('/pageNotFound');
    }
};

// Verify OTP
const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const tempUser = req.session.tempUser;

        if (!tempUser) {
            req.flash('error', 'Session expired. Please sign up again');
            return res.redirect('/signup');
        }

        if (otp !== tempUser.otp) {
            req.flash('error', 'Invalid OTP');
            return res.redirect('/verifyOtp');
        }

        if (new Date() > new Date(tempUser.otpExpiry)) {
            req.flash('error', 'OTP has expired');
            return res.redirect('/verifyOtp');
        }

        const newUser = new User({
            name: tempUser.name,
            email: tempUser.email,
            phone: tempUser.phone,
            password: tempUser.password,
            isVerified: true,
            isBlocked: false,
        });

        await newUser.save();
        delete req.session.tempUser;

        req.session.user = {
            _id: newUser._id,
            name: newUser.name,
            email: newUser.email,
            isVerified: true,
        };

        req.flash('success', `Welcome ${newUser.name}! Your email has been verified`);
        return res.redirect('/');
    } catch (error) {
        console.error('OTP verification error:', error);
        req.flash('error', 'Server error during verification');
        return res.redirect('/verifyOtp');
    }
};

// Resend OTP
const resendOtp = async (req, res) => {
    try {
        const tempUser = req.session.tempUser;
        if (!tempUser) {
            req.flash('error', 'Session expired. Please sign up again');
            return res.redirect('/signup');
        }

        const otp = generateOtp();
        console.log(`Resent OTP for ${tempUser.email}: ${otp}`);
        tempUser.otp = otp;
        tempUser.otpExpiry = new Date(Date.now() + 1 * 60 * 1000);
        req.session.tempUser = tempUser;

        const emailSent = await sendVerificationEmail(tempUser.email, otp);
        if (!emailSent) {
            req.flash('error', 'Failed to resend OTP');
            return res.redirect('/verifyOtp');
        }

        req.flash('success', `New OTP sent to ${tempUser.email}`);
        return res.redirect('/verifyOtp');
    } catch (error) {
        console.error('Resend OTP error:', error);
        req.flash('error', 'Server error during OTP resend');
        return res.redirect('/verifyOtp');
    }
};

// Logout
const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.error('Logout Error:', err);
                return res.status(500).send('Logout failed');
            }
            res.redirect('/');
        });
    } catch (error) {
        console.log('Logout error', error);
        res.redirect('/pageNotFound');
    }
};

// Load Home Page
const loadHomePage = async (req, res) => {
    try {
        console.log('Session in loadHomePage:', req.session);
        if (req.session.user) {
            const user = await User.findById(req.session.user._id);
            console.log('User found in loadHomePage:', user);
            if (!user) {
                console.log('User not found, destroying session');
                req.session.destroy(() => res.redirect('/login?error=session_expired'));
                return;
            }
            if (user.isBlocked) {
                console.log('User is blocked, destroying session');
                req.session.destroy(() => res.redirect('/login?error=blocked'));
                return;
            }
            req.session.user = user;
        }

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const newArrivals = await Product.find({
            isListed: true,
            isDeleted: false,
            createdAt: { $gte: sevenDaysAgo },
        })
            .sort({ createdAt: -1 })
            .limit(8);

        const featuredProducts = await Product.find({
            isDeleted: false,
            discountPercentage: { $gt: 55 },
        })
            .sort({ discountPercentage: -1 })
            .limit(8);

        const topSellingProducts = await Product.find({
            isDeleted: false,
        })
            .sort({ salesCount: -1 })
            .limit(8);

        const dealProducts = await Product.find({
            isDeleted: false,
            discountPercentage: { $gt: 0 },
        })
            .sort({ discountPercentage: -1 })
            .limit(8);

        res.render('user/home', {
            user: req.session.user || null,
            newArrivals,
            featuredProducts,
            topSellingProducts,
            dealProducts,
            messages: req.flash() || { error: [], success: [] },
        });
    } catch (error) {
        console.error('Error in loadHomePage:', error);
        res.redirect('/');
    }
};

// Static Pages
const loadAboutPage = async (req, res) => {
    try {
        res.render('user/about', {
            messages: req.flash() || { error: [], success: [] },
        });
    } catch (error) {
        console.error('Error loading about page:', error);
        res.redirect('/pageNotFound');
    }
};

const loadContactPage = async (req, res) => {
    try {
        res.render('user/contact', {
            messages: req.flash() || { error: [], success: [] },
        });
    } catch (error) {
        console.error('Error loading contact page:', error);
        res.redirect('/pageNotFound');
    }
};

// Handle Google Callback
const handleGoogleCallback = async (req, res) => {
    console.log('Entered handleGoogleCallback');
    try {
        console.log('req.user from Passport:', req.user);
        if (!req.user) {
            throw new Error('Passport failed to provide user data');
        }

        const user = req.user;
        console.log('Looking up user with email:', user.email);
        const existingUser = await User.findOne({ email: user.email });
        console.log('Existing user:', existingUser);

        if (!existingUser) {
            const newUser = new User({
                name: user.name,
                email: user.email,
                googleId: user.googleId,
                isVerified: true,
                isBlocked: false,
            });
            console.log('Saving new user:', newUser);
            await newUser.save();
            req.session.user = {
                _id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                isVerified: true,
            };
            console.log('Session after new user:', req.session);
            req.flash('success', `Welcome ${newUser.name}!`);
            return res.redirect('/');
        }

        // Check if the user is blocked
        if (existingUser.isBlocked) {
            console.log('Blocked user attempted Google login:', existingUser.email);
            req.flash('error', 'Your account has been blocked. Please contact support.');
            return res.redirect('/login');
        }

        // If not blocked, proceed with login
        req.session.user = {
            _id: existingUser._id,
            name: existingUser.name,
            email: existingUser.email,
            isVerified: existingUser.isVerified,
        };
        console.log('Session after existing user:', req.session);
        req.flash('success', `Welcome back ${existingUser.name}!`);
        return res.redirect('/');
    } catch (error) {
        console.error('Google callback error:', error.message, error.stack);
        req.flash('error', 'Authentication failed. Please try again.');
        return res.redirect('/login');
    }
};

const loadPassword = async (req, res) => {
    try {
        res.render('user/changePassword', {
            messages: req.flash() || { error: [], success: [] },
        });
    } catch (error) {
        console.error('Error loading change password page:', error);
        res.redirect('/pageNotFound');
    }
};

const sendOTPForPasswordChange = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            req.flash('error', 'User not found with this email');
            return res.redirect('/changePassword');
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`Generated OTP for password change for ${email}: ${otp}`);
        user.resetPasswordOTP = {
            code: otp,
            expiresAt: Date.now() + 10 * 60 * 1000,
        };
        await user.save();

        await sendVerificationEmail(email, otp);

        req.flash('success', 'OTP sent to your registered email');
        return res.redirect('/changePassword');
    } catch (error) {
        console.error('Error sending OTP:', error);
        req.flash('error', 'Server error. Please try again later.');
        return res.redirect('/changePassword');
    }
};

const changePassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            req.flash('error', 'All fields are required');
            return res.redirect('/changePassword');
        }

        const user = await User.findOne({ email });

        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/changePassword');
        }

        if (!user.resetPasswordOTP || user.resetPasswordOTP.code !== otp || user.resetPasswordOTP.expiresAt < Date.now()) {
            req.flash('error', 'Invalid or expired OTP');
            return res.redirect('/changePassword');
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            req.flash('error', 'Password does not meet complexity requirements');
            return res.redirect('/changePassword');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.resetPasswordOTP = undefined;
        await user.save();

        req.flash('success', 'Password changed successfully');
        return res.redirect('/changePassword');
    } catch (error) {
        console.error('Error changing password:', error);
        req.flash('error', 'Server error. Please try again later.');
        return res.redirect('/changePassword');
    }
};

module.exports = {
    pageNotFound,
    loadLogin,
    loadSignup,
    signup,
    login,
    logout,
    loadverifyOtp,
    verifyOtp,
    resendOtp,
    loadAboutPage,
    loadContactPage,
    loadHomePage,
    changePassword,
    loadPassword,
    handleGoogleCallback,
    sendOTPForPasswordChange,
};