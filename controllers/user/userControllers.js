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
        });
    } catch (error) {
        console.error('Error loading login page:', error);
        res.redirect('/pageNotFound');
    }
};

// Login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid email or password' });
        }

        if (user.isBlocked) {
            return res.status(403).json({ success: false, message: 'Your account has been blocked. Please contact support' });
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(400).json({ success: false, message: 'Invalid email or password' });
        }

        req.session.user = user;
        return res.status(200).json({ success: true, message: `Welcome back, ${user.name}!`, redirect: '/' });
    } catch (error) {
        console.error(`Login error for email ${req.body.email}: ${error.message}`);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// Load Signup Page
const loadSignup = async (req, res) => {
    try {
        res.render('user/signup', {
            message: req.flash('success')[0] || req.flash('error')[0] || '',
            messageType: req.flash('success').length ? 'success' : req.flash('error').length ? 'error' : '',
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

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email is already registered' });
        }

        const otp = generateOtp();
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
            return res.status(500).json({ success: false, message: 'Failed to send verification email' });
        }

        return res.status(200).json({
            success: true,
            message: `OTP sent to ${email}`,
            redirect: '/verifyOtp',
        });
    } catch (error) {
        console.error('Signup error:', error);
        return res.status(500).json({ success: false, message: 'Server error during signup' });
    }
};

// Load Verify OTP Page
const loadverifyOtp = async (req, res) => {
    try {
        if (!req.session.tempUser) {
            return res.redirect('/signup');
        }
        res.render('verifyOtp', {
            email: req.session.tempUser.email,
            message: req.flash('success')[0] || req.flash('error')[0] || '',
            messageType: req.flash('success').length ? 'success' : req.flash('error').length ? 'error' : '',
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
            return res.status(400).json({ success: false, message: 'Session expired. Please sign up again' });
        }

        if (otp !== tempUser.otp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }

        if (new Date() > new Date(tempUser.otpExpiry)) {
            return res.status(400).json({ success: false, message: 'OTP has expired' });
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

        return res.status(200).json({
            success: true,
            message: `Welcome ${newUser.name}! Your email has been verified`,
            redirect: '/',
        });
    } catch (error) {
        console.error('OTP verification error:', error);
        return res.status(500).json({ success: false, message: 'Server error during verification' });
    }
};

// Resend OTP
const resendOtp = async (req, res) => {
    try {
        const tempUser = req.session.tempUser;
        if (!tempUser) {
            return res.status(400).json({ success: false, message: 'Session expired. Please sign up again' });
        }

        const otp = generateOtp();
        tempUser.otp = otp;
        tempUser.otpExpiry = new Date(Date.now() + 1 * 60 * 1000);
        req.session.tempUser = tempUser;

        const emailSent = await sendVerificationEmail(tempUser.email, otp);
        if (!emailSent) {
            return res.status(500).json({ success: false, message: 'Failed to resend OTP' });
        }

        return res.status(200).json({ success: true, message: `New OTP sent to ${tempUser.email}` });
    } catch (error) {
        console.error('Resend OTP error:', error);
        return res.status(500).json({ success: false, message: 'Server error during OTP resend' });
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
        if (req.session.user) {
            const user = await User.findById(req.session.user._id);
            if (!user) {
                req.session.destroy(() => res.redirect('/login?error=session_expired'));
                return;
            }
            if (user.isBlocked) {
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
            message: req.flash('success')[0] || req.flash('error')[0] || '',
            messageType: req.flash('success').length ? 'success' : req.flash('error').length ? 'error' : '',
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
            message: req.flash('success')[0] || req.flash('error')[0] || '',
            messageType: req.flash('success').length ? 'success' : req.flash('error').length ? 'error' : '',
        });
    } catch (error) {
        console.error('Error loading about page:', error);
        res.redirect('/pageNotFound');
    }
};

const loadContactPage = async (req, res) => {
    try {
        res.render('user/contact', {
            message: req.flash('success')[0] || req.flash('error')[0] || '',
            messageType: req.flash('success').length ? 'success' : req.flash('error').length ? 'error' : '',
        });
    } catch (error) {
        console.error('Error loading contact page:', error);
        res.redirect('/pageNotFound');
    }
};

// Handle Google Callback
const handleGoogleCallback = async (req, res) => {
    try {
        const user = req.user; // Provided by Passport
        const existingUser = await User.findOne({ email: user.email });

        if (!existingUser) {
            const newUser = new User({
                name: user.name,
                email: user.email,
                googleId: user.googleId,
                isVerified: true,
                isBlocked: false,
            });
            await newUser.save();
            req.session.user = {
                _id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                isVerified: true,
            };
            return res.redirect('/');
        }

        if (await checkUserBlockedStatus(existingUser, req, res)) {
            return; // Redirects to login if blocked
        }

        req.session.user = {
            _id: existingUser._id,
            name: existingUser.name,
            email: existingUser.email,
            isVerified: existingUser.isVerified,
        };
        res.redirect('/');
    } catch (error) {
        console.error('Google callback error:', error);
        res.redirect('/login?error=auth_failed');
    }
};

const loadPassword = async (req, res) => {
    try {
        res.render('user/changePassword', {
            message: req.flash('message') || null,
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
            return res.status(404).json({
                success: false,
                message: 'User not found with this email',
            });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetPasswordOTP = {
            code: otp,
            expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
        };
        await user.save();

        await sendOTPEmail(email, otp);

        res.status(200).json({
            success: true,
            message: 'OTP sent to your registered email',
        });
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.',
        });
    }
};

const changePassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        // Validate input
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Validate OTP
        if (!user.resetPasswordOTP || user.resetPasswordOTP.code !== otp || user.resetPasswordOTP.expiresAt < Date.now()) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        // Password strength validation
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({ success: false, message: 'Password does not meet complexity requirements' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and clear OTP
        user.password = hashedPassword;
        user.resetPasswordOTP = undefined;

        await user.save();

        return res.json({ success: true, message: 'Password changed successfully' });

    } catch (error) {
        console.error('Error changing password:', error);
        return res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
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
    changePassword ,
    loadPassword,
    handleGoogleCallback,
    sendOTPForPasswordChange,
};