const express = require('express');
const path = require('path');
const session = require('express-session');
const dotenv = require('dotenv').config();
const db = require('./config/db');
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter');
const passport = require('./config/passport');
const flash = require('connect-flash');
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
    res.locals.error = req.flash('error');
    next();
});



// Add Multer error handler before routes
app.use(handleMulterError);


// Public routes
app.use('/', userRouter);
app.use('/admin', adminRouter);

// Add these logs to debug view resolution
// app.use((req, res, next) => {
//     console.log('Request URL:', req.url);
//     console.log('View Paths:', app.get('views'));
//     next();
// });

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
