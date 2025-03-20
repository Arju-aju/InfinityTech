const express = require('express');
const path = require('path');
const session = require('express-session');
const dotenv = require('dotenv').config();
const morgan = require('morgan');
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

// Morgan logging middleware
app.use(morgan('dev'));

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
app.use('/manifest.json', express.static(path.join(__dirname, 'public', 'manifest.json')));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
        cookie: { 
            maxAge: 1000 * 60 * 60 * 24, 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production'
        },
    })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

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

// Helmet CSP configuration
// app.use(
//     helmet({
//         contentSecurityPolicy: {
//             directives: {
//                 defaultSrc: ["'self'"],
//                 scriptSrc: [
//                     "'self'",
//                     "'unsafe-inline'",
//                     "'unsafe-eval'",
//                     "https://cdn.jsdelivr.net",
//                     "https://unpkg.com",
//                     "https://cdn.tailwindcss.com",
//                     "https://code.jquery.com",
//                     "https://cdnjs.cloudflare.com",
//                     "https://checkout.razorpay.com",
//                     "https://api.razorpay.com",
//                     "https://www.google.com",
//                     "https://maps.googleapis.com"
//                 ],
//                 styleSrc: [
//                     "'self'",
//                     "'unsafe-inline'",
//                     "https://cdn.jsdelivr.net",
//                     "https://cdn.tailwindcss.com",
//                     "https://cdnjs.cloudflare.com",
//                     "https://unpkg.com",
//                     "https://fonts.googleapis.com"
//                 ],
//                 connectSrc: [
//                     "'self'",
//                     "'unsafe-inline'",  
//                     "http://localhost:3000", 
//                     "https://unpkg.com",
//                     "https://cdn.jsdelivr.net",
//                     "https://lumberjack.razorpay.com",
//                     "https://api.razorpay.com",
//                     "https://checkout.razorpay.com",
//                     "https://www.google.com",
//                     "https://maps.googleapis.com",
//                 ],
//                 frameSrc: [
//                     "'self'",
//                     "https://api.razorpay.com",
//                     "https://checkout.razorpay.com",
//                     "https://www.google.com",
//                     "https://maps.google.com",
                    
//                 ],
//                 imgSrc: [
//                     "'self'",
//                     "data:",
//                     "https:",
//                     "blob:",
//                     "https://maps.gstatic.com",
//                     "https://*.googleapis.com",
//                     "https://checkout.razorpay.com"
//                 ],
//                 fontSrc: [
//                     "'self'",
//                     "https://cdnjs.cloudflare.com",
//                     "https://fonts.gstatic.com",
//                     "data:"
//                 ],
//                 mediaSrc: ["'self'", "https:", "blob:", "https://*.amazonaws.com"],
//                 objectSrc: ["'none'"],
//                 formAction: [
//                     "'self'",
//                     "https://api.razorpay.com",
//                     "https://checkout.razorpay.com"
//                 ],
//                 upgradeInsecureRequests: []
//             }
//         },
//         crossOriginEmbedderPolicy: false,
//         crossOriginResourcePolicy: { policy: "cross-origin" },
//         dnsPrefetchControl: false,
//         frameguard: false,
//         hsts: {
//             maxAge: 15552000,
//             includeSubDomains: true,
//             preload: true
//         },
//         referrerPolicy: { policy: "strict-origin-when-cross-origin" },
//         xssFilter: true,
//         noSniff: true
//     })
// );

// Routes
app.use('/', userRouter);
app.use('/admin', adminRouter);

// 404 handler
app.use((req, res, next) => {
    console.log(`404 Error: ${req.method} ${req.url}`); 
    if (req.xhr || req.headers.accept?.includes('json')) {
        res.status(404).json({ success: false, message: 'API route not found' });
    } else {
        res.status(404).render('404', { title: 'Page Not Found' });
    }
});

// Global error handler
app.use(errorHandler);

// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

module.exports = app;
