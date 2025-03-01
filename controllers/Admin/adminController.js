const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const LaptopCategory = require('../../models/categorySchema');
const bcrypt = require('bcrypt');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');



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

        // Initial dashboard stats
        const userCount = await User.countDocuments({ isBlocked: false });
        const totalOrders = await Order.countDocuments();
        const totalSales = await Order.aggregate([
            { $match: { status: "Delivered" } },
            { $group: { _id: null, total: { $sum: "$orderAmount" } } }
        ]);

        res.render('adminDashboard', {
            userCount,
            totalOrders,
            totalSales: totalSales[0]?.total || 0
        });
    } catch (error) {
        console.error("Dashboard error:", error);
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

const getSalesReport = async (req, res) => {
    try {
        const { startDate, endDate, timeFrame } = req.query;
        
        // Set default dates if not provided
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        // Adjust end date to include the full day
        end.setHours(23, 59, 59, 999);

        // Define group by based on timeFrame
        let dateFormat;
        switch (timeFrame) {
            case 'weekly':
                dateFormat = { $week: "$orderDate" };
                break;
            case 'monthly':
                dateFormat = { $month: "$orderDate" };
                break;
            case 'yearly':
                dateFormat = { $year: "$orderDate" };
                break;
            default: // daily
                dateFormat = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } };
        }

        // Aggregate sales data
        const salesData = await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: start, $lte: end },
                    status: "Delivered"
                }
            },
            {
                $group: {
                    _id: dateFormat,
                    orders: { $sum: 1 },
                    sales: { $sum: "$orderAmount" },
                    totalItems: { $sum: { $sum: "$products.quantity" } },
                    totalCouponsUsed: { $sum: { $cond: [{ $ne: ["$couponApplied", null] }, 1, 0] } },
                    couponDeductions: { $sum: "$offerApplied" },
                    totalDiscounts: { $sum: "$offerApplied" },
                    netRevenue: { $sum: { $subtract: ["$orderAmount", "$offerApplied"] } }
                }
            },
            {
                $project: {
                    date: "$_id",
                    orders: 1,
                    sales: 1,
                    avgOrderValue: { $divide: ["$sales", "$orders"] },
                    totalItems: 1,
                    totalCouponsUsed: 1,
                    couponDeductions: 1,
                    totalDiscounts: 1,
                    netRevenue: 1,
                    _id: 0
                }
            },
            { $sort: { date: 1 } }
        ]);

        // Get payment method statistics
        const paymentMethodStats = await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: start, $lte: end },
                    status: "Delivered"
                }
            },
            {
                $group: {
                    _id: "$paymentMethod",
                    count: { $sum: 1 }
                }
            }
        ]);

        // Calculate summary
        const summary = salesData.reduce(
            (acc, curr) => ({
                totalSales: acc.totalSales + curr.sales,
                totalOrders: acc.totalOrders + curr.orders,
                totalItems: acc.totalItems + curr.totalItems,
                totalCouponsUsed: acc.totalCouponsUsed + curr.totalCouponsUsed,
                couponDeductions: acc.couponDeductions + curr.couponDeductions,
                totalDiscounts: acc.totalDiscounts + curr.totalDiscounts,
                netRevenue: acc.netRevenue + curr.netRevenue,
                avgOrderValue: (acc.totalSales + curr.sales) / (acc.totalOrders + curr.orders) || 0
            }),
            {
                totalSales: 0,
                totalOrders: 0,
                totalItems: 0,
                totalCouponsUsed: 0,
                couponDeductions: 0,
                totalDiscounts: 0,
                netRevenue: 0
            }
        );

        res.json({
            success: true,
            data: {
                salesData,
                summary,
                paymentMethodStats
            }
        });
    } catch (error) {
        console.error("Error fetching sales report:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching sales report"
        });
    }
};

// Get Top Sellers Data
const getTopSellers = async (req, res) => {
    try {
        // Top Products by sales
        const products = await Order.aggregate([
            { $match: { status: "Delivered" } },
            { $unwind: "$products" },
            {
                $group: {
                    _id: "$products.productId",
                    value: { $sum: "$products.totalPrice" },
                    quantity: { $sum: "$products.quantity" }
                }
            },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: "$product" },
            {
                $project: {
                    name: "$product.name",
                    value: 1,
                    quantity: 1
                }
            },
            { $sort: { value: -1 } },
            { $limit: 10 }
        ]);

        // Top Categories by items sold
        const categories = await Order.aggregate([
            { $match: { status: "Delivered" } },
            { $unwind: "$products" },
            {
                $lookup: {
                    from: "products",
                    localField: "products.productId",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: "$product" },
            {
                $group: {
                    _id: "$product.category",
                    value: { $sum: "$products.quantity" }
                }
            },
            {
                $lookup: {
                    from: "laptopcategories",
                    localField: "_id",
                    foreignField: "_id",
                    as: "category"
                }
            },
            { $unwind: "$category" },
            {
                $project: {
                    name: "$category.name",
                    value: 1
                }
            },
            { $sort: { value: -1 } },
            { $limit: 10 }
        ]);

        // Top Brands by sales
        const brands = await Order.aggregate([
            { $match: { status: "Delivered" } },
            { $unwind: "$products" },
            {
                $lookup: {
                    from: "products",
                    localField: "products.productId",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: "$product" },
            {
                $group: {
                    _id: "$product.brand",
                    value: { $sum: "$products.totalPrice" }
                }
            },
            {
                $project: {
                    name: "$_id",
                    value: 1
                }
            },
            { $sort: { value: -1 } },
            { $limit: 10 }
        ]);

        res.json({
            success: true,
            products,
            categories,
            brands
        });
    } catch (error) {
        console.error("Error fetching top sellers:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching top sellers"
        });
    }
};

module.exports = {
    pageerror,
    loadLogin,
    login,
    loadDashboard,
    logout,
    getSalesReport,
    getTopSellers
};