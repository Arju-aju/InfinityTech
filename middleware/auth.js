const User = require('../models/userSchema')

const checkBlockedStatus = async (req, res, next) => {
    try {
        if (req.session.user) {
            const user = await User.findById(req.session.user);
            
            if (user && user.isBlocked) {
                return req.session.destroy((err) => {
                    if (err) {
                        console.error('Error destroying session:', err);
                    }
                    
                    if (req.xhr || req.headers.accept.includes('json')) {
                        return res.status(403).json({
                            success: false,
                            message: 'Your account has been blocked. Please contact support.'
                        });
                    }
                    
                    res.redirect('/login?blocked=true');
                });
            }
        }
        next();
    } catch (error) {
        console.error('Error in checkBlockedStatus:', error);
        next();
    }
};

const userAuth = async (req, res, next) => {
    try {
        // Check if user is logged in
        if (!req.session.user) {
            return res.redirect('/login');
        }

        // Find user and check blocked status
        const user = await User.findById(req.session.user);
        
        if (!user || user.isBlocked) {
            // Destroy session
            return req.session.destroy((err) => {
                if (err) {
                    console.error('Error destroying session:', err);
                }
                // Redirect with blocked message if user is blocked
                const redirectUrl = user && user.isBlocked ? '/login?blocked=true' : '/login';
                res.redirect(redirectUrl);
            });
        }

        // User exists and is not blocked
        res.locals.user = user;
        next();
    } catch (error) {
        console.error('Error in userAuth middleware:', error);
        res.status(500).send('Internal server error');
    }
};

const adminAuth = (req,res,next)=>{
    User.findOne({isAdmin:true})
    .then(data => {
        if(data){
            next();
        }else{
            res.redirect('/admin/login')
        }
    })
    .catch(error =>{
        console.log('Error in admin auth middleware');
        res.status(500).send('Internal server error')
    })
}

const isUserLoggedIn = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        // Store the intended destination
        req.session.returnTo = req.originalUrl;
        res.redirect('/login');
    }
};

module.exports = {
    checkBlockedStatus,
    userAuth,
    adminAuth,
    isUserLoggedIn
}