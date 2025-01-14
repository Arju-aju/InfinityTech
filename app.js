const express = require('express');
const path = require('path');
const session = require('express-session');
const dotenv = require('dotenv').config();
const db = require('./config/db');
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter');
const passport = require('./config/passport');
const { checkBlockedStatus, userAuth } = require('./middleware/auth');

db();

const port = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add CSP headers
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "img-src 'self' data: https:; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com https://cdnjs.cloudflare.com; " +
        "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com; " +
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
        "connect-src 'self';"
    );
    next();
});

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production', // Secure cookies in production
            httpOnly: true,
            maxAge: 72 * 60 * 60 * 1000, // 3 days
        },
    })
);

app.use(passport.initialize());
app.use(passport.session());

// Prevent caching
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// Middleware for authentication
app.use((req, res, next) => {
    res.locals.isLoggedIn = !!req.session.user;
    next();
});

// Set view engine and view paths
app.set('view engine', 'ejs');
app.set('views', [
    path.join(__dirname, 'views'),
    path.join(__dirname, 'views/admin'),
    path.join(__dirname, 'views/user')
]);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Check blocked status before all routes
app.use(checkBlockedStatus);

// Add this before your routes
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

// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

module.exports = app;
