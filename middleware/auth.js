const jwt = require("jsonwebtoken");
const User = require("../models/userSchema");



exports.isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/'); // Prevent logged-in users from accessing login/signup
    }
    next();
};

exports.isNotAuthenticated = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login'); // Prevent non-logged-in users from accessing protected routes
    }
    next();
};




exports.authMiddleware = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized. Please log in.",
        });
    }

    // Check if the user is blocked
    if (req.session.user.isBlocked) {
        req.session.destroy(() => {
            return res.status(403).json({
                success: false,
                message: "Your account has been blocked. Please contact support.",
            });
        });
    } else {
        next();
    }
};

exports.auth = async (req, res, next) => {
    try {
        // Check if user is logged in via session
        console.log('req.user: ',req.user)
        console.log('req.session.user>>',req.session.user);
        
        if (!req.session.user) {
            return res.status(401).json({ message: "Authentication required>>>>" });
        }

        // Find the user in the database
        const user = await User.findById(req.session.user._id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Attach user info to req object
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ message: "Internal server error" });
    }
};