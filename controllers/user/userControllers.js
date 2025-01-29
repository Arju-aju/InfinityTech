const User = require('../../models/userSchema')
const bcrypt = require("bcrypt")
const { ClientSession } = require('mongodb')
const nodemailer = require('nodemailer')
const env = require('dotenv').config()
const { userValidationRules, validate } = require('../../utils/validation')
const { validationResult } = require('express-validator')
const Product = require('../../models/productSchema')
const mongoose = require('mongoose')

// page not found
const pageNotFound = async(req,res)=>{
    try {
        res.render('page-404')
    } catch (error) {
        res.render('/pageNotFound')
    }
}

// Configure Nodemailer Transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendVerificationEmail = async (email, otp) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Email Verification OTP',
        text: `Your OTP for email verification is: ${otp}`
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

// Load Login Page
const loadLogin = async (req, res) => {
    try {
        res.render('user/login', {
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });
    } catch (error) {
        console.error('Error loading login page:', error);
        res.redirect('/pageNotFound');
    }
};

// Load Signup Page
const loadSignup = async (req, res) => {
    try {
        res.render('user/signup', {
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
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

        // Validate required fields
        if (!name || !email || !phone || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Validate name format
        const nameRegex = /^[a-zA-Z][a-zA-Z\s]*$/;
        if (!nameRegex.test(name)) {
            return res.status(400).json({
                success: false,
                message: 'Name must start with a letter and contain only letters and spaces'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address'
            });
        }

        // Validate phone number
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Phone number must be exactly 10 digits'
            });
        }

        // Validate password
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Check password match
        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email is already registered'
            });
        }

        // Generate OTP
        const otp = generateOtp();
        console.log(otp);
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Store user data in session
        req.session.tempUser = {
            name: name.trim(),
            email: email.toLowerCase(),
            phone,
            password: hashedPassword,
            otp,
            otpExpiry,
            isVerified: false,
            isBlocked: false
        };

        // Send verification email
        try {
            await sendVerificationEmail(email, otp);
        } catch (emailError) {
            console.error('Error sending verification email:', emailError);
            return res.status(500).json({
                success: false,
                message: 'Failed to send verification email. Please try again.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Registration successful! Please verify your email.',
            redirect: '/verifyOtp'
        });

    } catch (error) {
        console.error('Signup error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred during signup. Please try again.'
        });
    }
};

// Handle Login Submit
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if user is blocked
        if (user.isBlocked) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been blocked. Please contact support.'
            });
        }

        // Check if user is verified
        if (!user.isVerified) {
            return res.status(403).json({
                success: false,
                message: 'Please verify your email before logging in.'
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Set user session
        req.session.user = {
            _id: user._id,
            name: user.name,
            email: user.email,
            isVerified: user.isVerified
        };

        return res.status(200).json({
            success: true,
            message: 'Login successful!',
            redirect: '/'
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred during login. Please try again.'
        });
    }
};

// Load Verify OTP Page
const loadverifyOtp = async(req, res) => {
    try {
        // Check if there's signup data in session
        if (!req.session.tempUser) {
            return res.redirect('/signup');
        }
        
        return res.render('verifyOtp', {
            email: req.session.tempUser.email,
            message: req.query.message
        });

    } catch (error) {
        console.log(`verifyOtp page not loading ${error}`);
        res.status(500).send('Server Error');
    }
};

// Verify OTP
const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const tempUser = req.session.tempUser;

        if (!tempUser) {
            return res.status(400).json({
                success: false,
                message: 'Session expired. Please sign up again.'
            });
        }

        // Validate OTP
        if (otp !== tempUser.otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP. Please try again.'
            });
        }

        // Check OTP expiry
        if (new Date() > new Date(tempUser.otpExpiry)) {
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please request a new one.'
            });
        }

        // Create and save new user
        const newUser = new User({
            name: tempUser.name,
            email: tempUser.email,
            phone: tempUser.phone,
            password: tempUser.password,
            isVerified: true,
            isBlocked: false
        });

        await newUser.save();

        // Clear temporary session data
        delete req.session.tempUser;

        // Set user session
        req.session.user = {
            _id: newUser._id,
            name: newUser.name,
            email: newUser.email,
            isVerified: true
        };

        return res.status(200).json({
            success: true,
            message: 'Email verified successfully!',
            redirect: '/'
        });

    } catch (error) {
        console.error('OTP verification error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred during verification. Please try again.'
        });
    }
};

// Resend OTP
const resendOtp = async (req, res) => {
    try {
        const tempUser = req.session.tempUser;
        if (!tempUser) {
            return res.status(400).json({
                success: false,
                message: 'Session expired. Please try signing up again.'
            });
        }

        // Generate new OTP
        const otp = generateOtp();
        console.log('New OTP:', otp);
        
        // Update session with new OTP
        tempUser.otp = otp;
        tempUser.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        req.session.tempUser = tempUser;

        // Send verification email
        try {
            await sendVerificationEmail(tempUser.email, otp);
            return res.status(200).json({
                success: true,
                message: 'OTP has been resent to your email.'
            });
        } catch (emailError) {
            console.error('Error sending verification email:', emailError);
            return res.status(500).json({
                success: false,
                message: 'Failed to send verification email. Please try again.'
            });
        }

    } catch (error) {
        console.error('Error in resendOtp:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred. Please try again.'
        });
    }
};

// Logout
const logout = async (req, res) => {
    try {
        req.session.destroy();
        res.redirect('/login');
    } catch (error) {
        console.log("Logout error", error);
        res.redirect("/pageNotFound");
    }
};

// Load Home Page
const loadHomePage = async (req, res) => {
    try {
        // Calculate date 7 days ago for new arrivals
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        console.log('Debug: Fetching products...');

        // Log database connection status
        console.log('MongoDB Connection State:', mongoose.connection.readyState);

        // Fetch new arrivals (products added in last 7 days)
        const newArrivals = await Product.find({ 
            isDeleted: false,
            createdAt: { $gte: sevenDaysAgo }
        })
        .sort({ createdAt: -1 })
        .limit(8);

        // Fetch featured products (products with discount > 55%)
        const featuredProducts = await Product.find({ 
            isDeleted: false,
            discountPercentage: { $gt: 55 }
        })
        .sort({ discountPercentage: -1 })
        .limit(8);

        // Log query conditions and results
        console.log('Featured Products Query:', {
            isDeleted: false,
            discountPercentage: { $gt: 55 }
        });
        console.log('Featured Products Found:', JSON.stringify(featuredProducts, null, 2));

        // Fetch top-selling products
        const topSellingProducts = await Product.find({ 
            isDeleted: false
        })
        .sort({ salesCount: -1 })
        .limit(8);

        // Fetch products with discounts
        const dealProducts = await Product.find({ 
            isDeleted: false,
            discountPercentage: { $gt: 0 }
        })
        .sort({ discountPercentage: -1 })
        .limit(8);

        // Log all product counts
        console.log('Product Counts:', {
            newArrivals: newArrivals.length,
            featured: featuredProducts.length,
            topSelling: topSellingProducts.length,
            deals: dealProducts.length
        });

        // Render the page with products
        console.log('Debug: Rendering home page...');
        res.render('user/home', {
            newArrivals,
            featuredProducts,
            topSellingProducts,
            dealProducts,
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });
        console.log('Debug: Home page rendered successfully');
    } catch (error) {
        console.error('Error in loadHomePage:', error);
        req.flash('error', 'Error loading home page');
        res.redirect('/');
    }
};

// Static Pages
const loadAboutPage = async (req, res) => {
    try {
        res.render('user/about', {
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });
    } catch (error) {
        console.error('Error loading about page:', error);
        res.redirect('/pageNotFound');
    }
};

const loadContactPage = async (req, res) => {
    try {
        res.render('user/contact', {
            message: {
                type: req.flash('error').length ? 'error' : 'success',
                content: req.flash('error')[0] || req.flash('success')[0]
            }
        });
    } catch (error) {
        console.error('Error loading contact page:', error);
        res.redirect('/pageNotFound');
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
    loadHomePage
};
