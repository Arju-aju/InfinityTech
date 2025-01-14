const User = require('../../models/userSchema')
const bcrypt = require("bcrypt")
const { ClientSession } = require('mongodb')
const nodemailer = require('nodemailer')
const env = require('dotenv').config()
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')


const pageNotFound = async(req,res)=>{

    try {
        
        res.render('page-404')

    } catch (error) {
        
        res.render('/pageNotFound')

    }
}

const loadHomePage = async (req, res) => {
    try {
        const isLoggedIn = req.session.user ? true : false;
        const username = req.session.user ? req.session.user.name : null;

        // Fetch available categories
        const categories = await Category.find({
            isAvailable: true
        }).select('name description thumbnail');

        // Fetch Flash Sale Products (products with highest discount)
        const flashSaleProducts = await Product.find({
            discountPercentage: { $gt: 0 }
        })
        .limit(4)
        .sort({ discountPercentage: -1 });

        // Fetch Best Selling Products (newest products for now)
        const bestSellingProducts = await Product.find()
        .limit(4)
        .sort({ createdAt: -1 });

        // Fetch Premium Gaming Product (highest priced product)
        const premiumProduct = await Product.findOne()
        .sort({ price: -1 });

        // Get unique brands
        const brands = await Product.distinct('brand');

        // Debug logs
        console.log({
            flashSaleCount: flashSaleProducts.length,
            bestSellingCount: bestSellingProducts.length,
            hasPremiumProduct: !!premiumProduct,
            brandCount: brands.length
        });

        res.render('home', { 
            isLoggedIn, 
            username,
            categories,
            flashSaleProducts,
            bestSellingProducts,
            premiumProduct,
            brands
        });
    } catch (error) {
        console.error("Error loading homepage:", error);
        res.status(500).send('Server Error');
    }
};


const loadSignup = async (req, res) => {
    try {
        const isLoggedIn = req.session.user ? true : false; 
        return res.render('signup', { isLoggedIn }); 
    } catch (error) {
        console.log(`Signup page not loading ${error}`);
        res.status(500).send('Server Error');
    }
};


const loadLogin = (req, res) => {
    try {
        if (req.session.user) {
            return res.redirect('/');
        }
        res.render('user/login', { 
            message: null,
            query: req.query  // Pass the query object to the template
        });
    } catch (error) {
        console.error('Error loading login page:', error);
        res.status(500).send('Internal Server Error');
    }
};


const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Configure Nodemailer Transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
    }
});

const sendVerificationEmail = async (email, otp) => {
    try {
        const mailOptions = {
            from: `"Your App" <${process.env.NODEMAILER_EMAIL}>`,
            to: email,
            subject: 'Email Verification OTP',
            text: `Your OTP is ${otp}. It expires in 10 minutes.`,
            html: `
                <div>
                    <h2>Email Verification</h2>
                    <p>Your OTP is:</p>
                    <h3>${otp}</h3>
                    <p>Please do not share this OTP with anyone.</p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent: ${info.response}`);
        return true;
    } catch (error) {
        console.error('Email sending error:', error);
        return false;
    }
};

const signup = async (req, res) => {
    try {
        const { name, email, phone, password, confirmPassword } = req.body;

        if (!name || !email || !phone || !password || !confirmPassword) {
            return res.render('signup', {
                message: 'All fields are required',
                formData: req.body
            });
        }

        if (password !== confirmPassword) {
            return res.render('signup', {
                message: 'Passwords do not match',
                formData: req.body
            });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('signup', {
                message: 'User already exists with this email',
                formData: req.body
            });
        }

        const otp = generateOtp();
        console.log(`Generated OTP for ${email}: ${otp}`);

        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.render('signup', {
                message: 'Failed to send verification email. Please try again.',
                formData: req.body
            });
        }

        req.session.userSignupData = {
            name,
            email,
            phone,
            password,
            otp,
            otpGeneratedAt: Date.now()
        };

        res.redirect('/verifyOtp');
    } catch (error) {
        console.error('Signup error:', error);
        res.render('signup', {
            message: 'An unexpected error occurred. Please try again.',
            formData: req.body
        });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email });

        if (!user) {
            return res.render('user/login', { 
                message: 'Invalid email or password' 
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            return res.render('user/login', { 
                message: 'Invalid email or password' 
            });
        }

        if (user.isBlocked) {
            return res.render('user/login', { 
                message: 'Your account has been blocked. Please contact support.' 
            });
        }

        req.session.user = user;

        // Check if there's a returnTo URL in the session
        const returnTo = req.session.returnTo || '/';
        delete req.session.returnTo; // Clear the returnTo value

        res.redirect(returnTo);

    } catch (error) {
        console.error('Login error:', error);
        res.render('user/login', { 
            message: 'An error occurred during login' 
        });
    }
};

const loadverifyOtp = async(req, res) => {
    try {
        // Check if there's signup data in session
        if (!req.session.userSignupData) {
            return res.redirect('/signup');
        }
        
        return res.render('verifyOtp', {
            email: req.session.userSignupData.email,
            message: req.query.message
        });

    } catch (error) {
        console.log(`verifyOtp page not loading ${error}`);
        res.status(500).send('Server Error');
    }
};

const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const sessionData = req.session.userSignupData;

        if (!sessionData) {
            return res.render('verifyOtp', {
                message: 'Session expired. Please sign up again.',
                email: ''
            });
        }

        const otpAge = Date.now() - sessionData.otpGeneratedAt;
        if (otpAge > 10 * 60 * 1000) {
            return res.render('verifyOtp', {
                message: 'OTP has expired. Please request a new OTP.',
                email: sessionData.email
            });
        }

        if (otp !== sessionData.otp) {
            return res.render('verifyOtp', {
                message: 'Invalid OTP. Please try again.',
                email: sessionData.email
            });
        }

        const hashedPassword = await bcrypt.hash(sessionData.password, 10);

        const newUser = new User({
            name: sessionData.name,
            email: sessionData.email,
            phone: sessionData.phone,
            password: hashedPassword,
            isVerified: true
        });

        await newUser.save();

        req.session.user = {
            id: newUser._id,
            name: newUser.name,
            email: newUser.email,
            isVerified: true
        };

        delete req.session.userSignupData; 

        res.redirect('/');
    } catch (error) {
        console.error('OTP Verification error:', error);
        res.render('verifyOtp', {
            message: 'An unexpected error occurred. Please try again.',
            email: req.session.userSignupData?.email || ''
        });
    }
};


const resendOtp = async (req, res) => {
    try {
        const sessionData = req.session.userSignupData;

        if (!sessionData) {
            return res.render('verifyOtp', {
                message: 'Session expired. Please sign up again.',
                email: ''
            });
        }

        const otp = generateOtp(); 
        
        console.log(`Resending OTP for ${sessionData.email}: ${otp}`);

        const emailSent = await sendVerificationEmail(sessionData.email, otp);
        
        if (!emailSent) {
            throw new Error('Email sending failed');
        }

        req.session.userSignupData = {
            ...sessionData,
            otp,
            otpGeneratedAt: Date.now()
        };

        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) reject(err);
                resolve();
            });
        });

        return res.render('verifyOtp', {
            message: 'New OTP has been sent to your email.',
            email: sessionData.email
        });
    } catch (error) {
        console.error('Resend OTP error:', error);
        return res.render('verifyOtp', {
            message: error.message || 'Failed to send OTP. Please try again.',
            email: req.session.userSignupData?.email || ''
        });
    }
};


const logout = async (req,res)=>{
    try {
        
        req.session.destroy((err)=>{
            if(err){
                console.log("Session destruction error", err.message);
                return res.redirect("/pageNotFound")
            }
            return res.redirect("/")
        })
     
    } catch (error) {
        
        console.log("Logout error", error);
        res.redirect("/pageNotFound")

    }
};

const getCategoryProducts = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const page = parseInt(req.query.page) || 1;
        const limit = 12; // Products per page
        
        // Get category details
        const category = await Category.findById(categoryId);
        if (!category || !category.isAvailable) {
            return res.redirect('/');
        }

        // Get products for this category with pagination
        const products = await Product.find({ 
            category: categoryId,
            isAvailable: true 
        })
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 });

        // Get total products count for pagination
        const totalProducts = await Product.countDocuments({ 
            category: categoryId,
            isAvailable: true 
        });

        const totalPages = Math.ceil(totalProducts / limit);

        res.render('user/categoryProducts', {
            category,
            products,
            pagination: {
                currentPage: page,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            },
            isLoggedIn: !!req.session.user
        });

    } catch (error) {
        console.error('Error fetching category products:', error);
        res.redirect('/');
    }
};

const getAllCategories = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 12; // Categories per page
        const skip = (page - 1) * limit;

        // Get total count
        const totalCategories = await Category.countDocuments();
        const totalPages = Math.ceil(totalCategories / limit);

        // Get paginated categories
        const categories = await Category.find()
            .select('name description thumbnail isAvailable')
            .sort({ name: 1 })
            .skip(skip)
            .limit(limit);

        res.render('user/allCategories', {
            categories,
            pagination: {
                currentPage: page,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            },
            isLoggedIn: !!req.session.user
        });

    } catch (error) {
        console.error('Error fetching categories:', error);
        res.redirect('/');
    }
};

const loadShop = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 12; // Products per page
        const skip = (page - 1) * limit;

        // Get total count for pagination
        const totalItems = await Product.countDocuments();
        const totalPages = Math.ceil(totalItems / limit);

        // Fetch products with pagination
        const products = await Product.find()
            .populate('category')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        // Calculate pagination details
        const startIndex = skip;
        const endIndex = Math.min(skip + limit, totalItems);
        const pageRange = 2;
        const startPage = Math.max(1, page - pageRange);
        const endPage = Math.min(totalPages, page + pageRange);

        res.render('user/shop', {
            products,
            isLoggedIn: !!req.session.user,
            username: req.session.user ? req.session.user.name : null,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                startIndex,
                endIndex,
                startPage,
                endPage,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });

    } catch (error) {
        console.error('Error loading shop:', error);
        res.status(500).send('Server Error');
    }
};

const getSingleProduct = async (req, res) => {
    try {
        // Check if user is logged in
        if (!req.session.user) {
            // Store the intended URL in session
            req.session.returnTo = `/product/${req.params.id}`;
            // Redirect to login with a message
            return res.redirect('/login?message=' + encodeURIComponent('Please login to view product details'));
        }

        const productId = req.params.id;
        const product = await Product.findById(productId).populate('category').lean();

        if (!product) {
            console.log('Product not found');
            return res.redirect('/shop');
        }

        // Debug log
        console.log('Product specifications:', product.specifications);

        // Find related products
        const relatedProductsQuery = {
            _id: { $ne: productId },
            $or: [
                { category: product.category._id },
                { brand: product.brand }
            ]
        };

        if (product.specifications && product.specifications.processor) {
            const processorBrand = product.specifications.processor.split(' ')[0];
            relatedProductsQuery.$or.push({
                'specifications.processor': { $regex: processorBrand, $options: 'i' }
            });
        }

        const relatedProducts = await Product.find(relatedProductsQuery)
            .populate('category')
            .limit(4)
            .lean();

        res.render('user/singleProduct', {
            product,
            relatedProducts,
            isLoggedIn: true, 
            username: req.session.user.name
        });

    } catch (error) {
        console.error('Error fetching product:', error);
        res.redirect('/shop');
    }
};

module.exports = {
    loadHomePage,
    pageNotFound,
    loadSignup,
    login,
    loadLogin,
    signup,
    verifyOtp,
    resendOtp,
    loadverifyOtp,
    logout,
    getCategoryProducts,
    getAllCategories,
    loadShop,
    getSingleProduct,
};
