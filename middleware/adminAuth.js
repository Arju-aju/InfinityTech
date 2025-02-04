exports.preventBack = (req, res, next) => {
    if (req.session.admin) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
    next();
};