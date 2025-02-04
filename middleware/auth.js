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