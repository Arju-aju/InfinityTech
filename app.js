const express = require('express');
const path = require('path');
const session = require('express-session');
const dotenv = require('dotenv').config();
const db = require('./config/db');
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter');
const passport = require('./config/passport');
const flash = require('connect-flash');
const { checkBlockedStatus, userAuth } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const { handleMulterError } = require('./config/multer');

db();

const port = process.env.PORT || 3000;
const app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', [
    path.join(__dirname, 'views'),
    path.join(__dirname, 'views/admin'),
    path.join(__dirname, 'views/user')
]);

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add middleware to handle AJAX requests
app.use((req, res, next) => {
    // Check if request is AJAX
    if (req.xhr || req.headers.accept?.includes('json')) {
        res.error = (status, message) => {
            return res.status(status).json({
                success: false,
                message: message
            });
        };

        res.success = (data, message = 'Success') => {
            return res.json({
                success: true,
                message: message,
                data: data
            });
        };
    }
    next();
});

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

// Global variables middleware
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    next();
});

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    
    // Content Security Policy
    res.setHeader('Content-Security-Policy', `
        default-src 'self';
        script-src 'self' 'unsafe-inline' cdn.tailwindcss.com cdn.jsdelivr.net unpkg.com;
        style-src 'self' 'unsafe-inline' cdn.tailwindcss.com cdnjs.cloudflare.com fonts.googleapis.com unpkg.com cdn.jsdelivr.net;
        font-src 'self' fonts.gstatic.com cdnjs.cloudflare.com;
        img-src 'self' data: blob:;
        connect-src 'self';
    `.replace(/\s+/g, ' ').trim());
    
    next();
});

// Middleware for authentication
app.use((req, res, next) => {
    res.locals.isLoggedIn = !!req.session.user;
    next();
});

// Prevent caching
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// Add locals for templates
app.use((req, res, next) => {
    // Set default values for title and description
    res.locals.title = 'InfinityTech';
    res.locals.description = 'Your Ultimate Laptop Destination';
    next();
});

app.locals.formatPrice = (price) => {
    return price.toLocaleString('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

app.locals.calculateDiscountedPrice = (price, discountPercentage) => {
    if (!discountPercentage) return price;
    return price - (price * discountPercentage / 100);
};

// Check blocked status before all routes
app.use(checkBlockedStatus);

// Add Multer error handler before routes
app.use(handleMulterError);

// Routes that require authentication
app.use('/dashboard', userAuth, userRouter);
app.use('/profile', userAuth, userRouter);
// ... other protected routes

// Public routes
app.use('/', userRouter);
app.use('/admin', adminRouter);

// Add these logs to debug view resolution
app.use((req, res, next) => {
    console.log('Request URL:', req.url);
    console.log('View Paths:', app.get('views'));
    next();
});

// Error handling middleware
app.use((req, res, next) => {
    res.status(404).render('404', { title: 'Page Not Found' });
});

// Add global error handler last
app.use(errorHandler);

// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

module.exports = app;
