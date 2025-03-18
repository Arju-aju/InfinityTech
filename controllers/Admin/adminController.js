const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const LaptopCategory = require('../../models/categorySchema');
const Coupon = require('../../models/coupounSchema'); 
const Return = require('../../models/returnSchema');
const bcrypt = require('bcrypt');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

const pageerror = async (req, res) => {
    res.render('admin-error');
};

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

const applyCouponToOrder = async (req, res) => {
    try {
        const { orderId, couponCode } = req.body;
        const adminId = req.session.admin?.id;

        if (!adminId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const coupon = await Coupon.findOne({ code: couponCode });
        if (!coupon || !coupon.isActive || coupon.expiredOn < new Date()) {
            return res.status(400).json({ success: false, message: "Invalid or expired coupon" });
        }

        if (coupon.usageLimit && coupon.couponUsed >= coupon.usageLimit) {
            return res.status(400).json({ success: false, message: "Coupon usage limit reached" });
        }

        const order = await Order.findById(orderId);
        if (!order || order.status !== "Delivered" || order.orderAmount < coupon.minimumPrice) {
            return res.status(400).json({ success: false, message: "Order not eligible for this coupon" });
        }

        const discount = coupon.offerType === "percentage"
            ? (order.orderAmount * coupon.offerValue) / 100
            : coupon.offerValue;

        order.offerApplied = discount;
        order.couponApplied = coupon._id;
        await order.save();

        coupon.couponUsed += 1;
        await coupon.save();

        res.json({ success: true, message: "Coupon applied successfully", discount });
    } catch (error) {
        console.error("Error applying coupon:", error);
        res.status(500).json({ success: false, message: "Error applying coupon" });
    }
};

const loadDashboard = async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.redirect('/admin/login');
        }

        const userCount = await User.countDocuments({ isBlocked: false });
        const totalOrders = await Order.countDocuments();
        const totalSales = await Order.aggregate([
            { $match: { status: "Delivered" } },
            { $group: { _id: null, total: { $sum: "$orderAmount" } } }
        ]);

        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        const initialSales = await Order.aggregate([
            { $match: { status: "Delivered", orderDate: { $gte: thirtyDaysAgo, $lte: today } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    orders: { $sum: 1 },
                    sales: { $sum: "$orderAmount" },
                    totalItems: { $sum: { $sum: "$products.quantity" } },
                    totalCouponsUsed: { $sum: { $cond: [{ $ne: ["$couponApplied", null] }, 1, 0] } },
                    couponDeductions: { $sum: "$offerApplied" }
                }
            },
            {
                $project: {
                    date: "$_id",
                    orders: 1,
                    sales: 1,
                    totalItems: 1,
                    totalCouponsUsed: 1,
                    couponDeductions: 1,
                    _id: 0
                }
            },
            { $sort: { date: 1 } }
        ]);

        const couponStats = await Coupon.aggregate([
            {
                $group: {
                    _id: null,
                    totalCoupons: { $sum: 1 },
                    activeCoupons: { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
                    totalUsage: { $sum: "$couponUsed" }
                }
            }
        ]);

        const returnStats = await Return.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);

        res.render('adminDashboard', {
            path: req.path,
            userCount,
            totalOrders,
            totalSales: totalSales[0]?.total || 0,
            initialSales: JSON.stringify(initialSales),
            couponStats: JSON.stringify(couponStats[0] || { totalCoupons: 0, activeCoupons: 0, totalUsage: 0 }),
            returnStats: JSON.stringify(returnStats)
        });
    } catch (error) {
        console.error("Dashboard error:", error);
        res.redirect('/admin/pageerror');
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
                res.clearCookie('connect.sid');
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
        const { startDate, endDate, timeFrame = 'daily' } = req.query;
        const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        let dateFormat;
        switch (timeFrame) {
            case 'daily':
                dateFormat = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } };
                break;
            case 'weekly':
                dateFormat = { $week: "$orderDate" };
                break;
            case 'monthly':
                dateFormat = { $month: "$orderDate" };
                break;
            case 'yearly':
                dateFormat = { $year: "$orderDate" };
                break;
            default:
                dateFormat = { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } };
        }

        const salesData = await Order.aggregate([
            { $match: { orderDate: { $gte: start, $lte: end }, status: "Delivered" } },
            {
                $group: {
                    _id: dateFormat,
                    orders: { $sum: 1 },
                    sales: { $sum: "$orderAmount" },
                    totalItems: { $sum: { $sum: "$products.quantity" } },
                    totalCouponsUsed: { $sum: { $cond: [{ $ne: ["$couponApplied", null] }, 1, 0] } },
                    couponDeductions: { $sum: "$offerApplied" }
                }
            },
            {
                $project: {
                    date: "$_id",
                    orders: 1,
                    sales: 1,
                    totalItems: 1,
                    totalCouponsUsed: 1,
                    couponDeductions: 1,
                    _id: 0
                }
            },
            { $sort: { date: 1 } }
        ]);

        const paymentMethodStats = await Order.aggregate([
            { $match: { orderDate: { $gte: start, $lte: end }, status: "Delivered" } },
            { $group: { _id: "$paymentMethod", count: { $sum: 1 } } }
        ]);

        const summary = salesData.reduce(
            (acc, curr) => ({
                totalSales: acc.totalSales + curr.sales,
                totalOrders: acc.totalOrders + curr.orders,
                totalItems: acc.totalItems + curr.totalItems,
                totalCouponsUsed: acc.totalCouponsUsed + curr.totalCouponsUsed,
                couponDeductions: acc.couponDeductions + curr.couponDeductions,
                avgOrderValue: (acc.totalSales + curr.sales) / (acc.totalOrders + curr.orders) || 0
            }),
            { totalSales: 0, totalOrders: 0, totalItems: 0, totalCouponsUsed: 0, couponDeductions: 0, avgOrderValue: 0 }
        );

        res.json({
            success: true,
            data: { salesData, summary, paymentMethodStats, timeFrame }
        });
    } catch (error) {
        console.error("Error fetching sales report:", error);
        res.status(500).json({ success: false, message: "Error fetching sales report" });
    }
};

const getTopSellers = async (req, res) => {
    try {
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

const getDetailedOrders = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        const orders = await Order.find({
            orderDate: { $gte: start, $lte: end }
        }).populate('userId', 'name').lean();

        res.status(200).json(orders);
    } catch (error) {
        console.error("Error fetching detailed orders:", error);
        res.status(500).json({ success: false, message: "Error fetching detailed orders", error: error.message });
    }
};

module.exports = {
    pageerror,
    loadLogin,
    login,
    loadDashboard,
    logout,
    getSalesReport,
    getTopSellers,
    applyCouponToOrder,
    getDetailedOrders
};