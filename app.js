const express = require('express');
const path = require('path');
const session = require('express-session');
const dotenv = require('dotenv').config();
const db = require('./config/db');
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter');
const passport = require('./config/passport');
const flash = require('connect-flash');
const helmet = require("helmet");
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

// Configure Helmet with Tailwind-friendly CSP
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],

                // Allow styles from self, inline styles, and all required CDNs
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://fonts.googleapis.com",
                    "https://cdn.jsdelivr.net",
                    "https://unpkg.com",
                    "https://cdn.tailwindcss.com",
                    "https://cdnjs.cloudflare.com",
                    "https://fonts.cdnjs.cloudflare.com"
                ],

                // Allow scripts from self, inline scripts, and all required CDNs
                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://cdn.jsdelivr.net",
                    "https://unpkg.com",
                    "https://cdn.tailwindcss.com"
                ],

                // Allow images from self and data URIs (for base64 images)
                imgSrc: ["'self'", "data:"],

                // Allow fonts from required sources, including Font Awesome
                fontSrc: [
                    "'self'",
                    "https://fonts.gstatic.com",
                    "data:",
                    "https://fonts.cdnjs.cloudflare.com",
                    "https://cdnjs.cloudflare.com" // Added for Font Awesome fonts
                ],

                // External API & Script Access
                connectSrc: ["'self'", "https://unpkg.com", "https://cdn.jsdelivr.net"],

                // Fix 'upgrade-insecure-requests'
                upgradeInsecureRequests: [],
            },
        },
        crossOriginEmbedderPolicy: false,
    })
);

// Add middleware to handle AJAX requests
app.use((req, res, next) => {
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
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

// Global variables middleware
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

// Add Multer error handler before routes
app.use(handleMulterError);

// Public routes
app.use('/', userRouter);
app.use('/admin', adminRouter);

app.use((req, res, next) => {
    res.locals.searchQuery = req.query.q || ''; // Provide a default value
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
