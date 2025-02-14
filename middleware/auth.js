const jwt = require("jsonwebtoken");
const User = require("../models/userSchema");



exports.isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return res.redirect("/dashboard"); // Redirect logged-in users away from login/signup
    }
    next();
};

exports.isNotAuthenticated = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login'); // Prevent non-logged-in users from accessing protected routes
    }
    next();
};




exports.authMiddleware = async (req, res, next) => {

    try {
        const userID = req.session?.user?._id;
        if (!userID) {
            req.session.destroy(() => res.redirect('/login'));
            return;
        }

        const user = await User.findById(userID);
        if (!user) {
            req.session.destroy(() => res.redirect('/login'));
            return;
        }

        // If user is blocked, destroy session & redirect to login
        if (user.isBlocked) {
            req.session.destroy(() => res.redirect('/login?error=blocked'));
            return;
        }

        req.user = user; // Attach user to request for later use
        next();
    } catch (error) {
        console.error("Auth middleware error:", error);
        res.status(500).json({ message: "Internal server error" });
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