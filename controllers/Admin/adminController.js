const User = require('../../models/userSchema');
const bcrypt = require('bcrypt');



const pageerror = async(req,res) => {
    res.render('admin-error')
}

const loadLogin = (req, res) => {
    try {
        if (req.session.admin) {
            return res.redirect('/admin/dashboard'); // Prevents logged-in admin from accessing login page
        }
        res.render('adminLogin', { message: null });
    } catch (error) {
        console.error('Error loading admin login:', error);
        res.status(500).send('Internal Server Error');
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.render('adminLogin', { message: 'Email and password are required' });
        }

        const admin = await User.findOne({ email: email, isAdmin: true });
        
        if (!admin) {
            return res.render('adminLogin', { message: 'Invalid admin credentials' });
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);
        
        if (passwordMatch) {
            req.session.admin = {
                id: admin._id,
                email: admin.email,
                isAdmin: admin.isAdmin
            };
            
            req.session.save((err) => {
                if (err) {
                    console.error("Session save error:", err);
                    return res.render('adminLogin', { message: 'An error occurred during login' });
                }
                res.redirect('/admin/dashboard');
            });
        } else {
            return res.render('adminLogin', { message: 'Invalid password' });
        }
    } catch (error) {
        console.error("Login error:", error);
        return res.render('adminLogin', { message: 'An error occurred during login' });
    }
};

const loadDashboard = async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.redirect('/admin/login');
        }
        res.render('adminDashboard');
    } catch (error) {
        console.error("Dashboard error", error);
        res.redirect('/admin/login');
    }
};

const logout = async (req, res) => {
    try {
        if (req.session) {
            req.session.destroy(err => {
                if (err) {
                    console.error('Error destroying session:', err);
                    return res.redirect('/admin/pageerror');
                }
                res.clearCookie('connect.sid'); // Clears session cookie
                res.redirect('/admin/login');
            });
        } else {
            res.redirect('/admin/login');
        }
    } catch (error) {
        console.error('Unexpected error during logout:', error);
        res.redirect('/admin/pageerror');
    }
};

module.exports = {
    pageerror,
    loadLogin,
    login,
    loadDashboard,
    logout,
};