const User = require('../../models/userSchema');
const bcrypt = require('bcrypt');



const pageerror = async(req,res) => {
    res.render('admin-error')
}

const loadLogin = (req, res) => {
    try {
        if (req.session.admin) {
            return res.redirect('/admin/dashboard');
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
        
        // Add validation for email and password
        if (!email || !password) {
            return res.render('adminLogin', { 
                message: 'Email and password are required' 
            });
        }

        // Find admin user - notice the isAdmin: 1 condition
        const admin = await User.findOne({ email: email, isAdmin: 1 });
        
        if (!admin) {
            return res.render('adminLogin', { 
                message: 'Invalid admin credentials' 
            });
        }

        // Always use await with bcrypt.compare
        const passwordMatch = await bcrypt.compare(password, admin.password);
        
        if (passwordMatch) {
            req.session.admin = {
                id: admin._id,
                email: admin.email
            };
            return res.redirect('/admin/dashboard');
        } else {
            return res.render('adminLogin', { 
                message: 'Invalid password' 
            });
        }
    } catch (error) {
        console.error("Login error", error);
        return res.render('adminLogin', { 
            message: 'An error occurred during login' 
        });
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

const logout = async(req,res)=>{
    try {
        
        req.session.destroy(err => {
            if(err){
                console.log('Error destroying session',err);
                return res.redirect('/pageerror')
            }
            res.redirect('/admin/login')
        })

    } catch (error) {

        console.log(('Unexpected error during logout',error));
        res.redirect('/pageerror')
        
    }
}

module.exports = {
    pageerror,
    loadLogin,
    login,
    loadDashboard,
    logout,
};