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




exports.authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ message: "No token, authorization denied" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select("-password");
        if (!req.user) {
            return res.status(404).json({ message: "User not found" });
        }

        next();
    } catch (error) {
        console.error("Auth error:", error);
        res.status(401).json({ message: "Token is not valid" });
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