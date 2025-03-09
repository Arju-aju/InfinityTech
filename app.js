const express = require('express');
const path = require('path');
const session = require('express-session');
const dotenv = require('dotenv').config();
const db = require('./config/db');
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter');
const passport = require('./config/passport');
const flash = require('connect-flash');
const helmet = require('helmet');
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
    path.join(__dirname, 'views/user'),
]);

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helmet configuration with updated CSP for Razorpay
// app.use(
//     helmet({
//         contentSecurityPolicy: {
//             useDefaults: true,
//             directives: {
//                 defaultSrc: ["'self'"],
//                 styleSrc: [
//                     "'self'",
//                     "'unsafe-inline'",
//                     'https://fonts.googleapis.com',
//                     'https://cdn.jsdelivr.net',
//                     'https://unpkg.com',
//                     'https://cdn.tailwindcss.com',
//                     'https://cdnjs.cloudflare.com',
//                 ],
//                 scriptSrc: [
//                     "'self'",
//                     "'unsafe-inline'",
//                     "'unsafe-eval'",
//                     'https://cdn.jsdelivr.net',
//                     'https://unpkg.com',
//                     'https://cdn.tailwindcss.com',
//                     'https://code.jquery.com',
//                     'https://cdn.jsdelivr.net/npm/sweetalert2@11',
//                     'https://cdnjs.cloudflare.com',
//                     'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js',
//                     'https://checkout.razorpay.com',
//                 ],
//                 frameSrc: [
//                     "'self'",
//                     'https://api.razorpay.com',
//                     'https://checkout.razorpay.com',
//                 ],
//                 connectSrc: [
//                     "'self'",
//                     'https://unpkg.com',
//                     'https://cdn.jsdelivr.net',
//                     'https://lumberjack.razorpay.com',
//                     'https://api.razorpay.com',
//                     'https://checkout.razorpay.com',
//                 ],
//                 imgSrc: [
//                     "'self'",
//                     'data:',
//                     'https://ui-avatars.com',
//                 ],
//                 fontSrc: [
//                     "'self'",
//                     'https://fonts.gstatic.com',
//                     'data:',
//                 ],
//                 upgradeInsecureRequests: [],
//             },
//         },
//         crossOriginEmbedderPolicy: false,
//     })
// );


// Custom middleware for AJAX responses
app.use((req, res, next) => {
    if (req.xhr || req.headers.accept?.includes('json')) {
        res.error = (status, message) => res.status(status).json({ success: false, message });
        res.success = (data, message = 'Success') => res.json({ success: true, message, data });
    }
    next();
});

// Session configuration
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'default-secret',
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 1000 * 60 * 60 * 24, httpOnly: true, secure: process.env.NODE_ENV === 'production' },
    })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Debug session and user
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log('Session:', req.session);
        console.log('User:', req.user);
        next();
    });
}

// Flash messages
app.use(flash());

// Global variables for templates
app.use((req, res, next) => {
    res.locals.user = req.session.user || req.user || null;
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

// Multer error handler
app.use(handleMulterError);

// Routes
app.use('/', userRouter);
app.use('/admin', adminRouter);

// 404 handler
app.use((req, res, next) => {
    res.status(404).render('404', { title: 'Page Not Found' });
});

// Global error handler
app.use(errorHandler);

// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

module.exports = app;
