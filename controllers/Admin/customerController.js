const User = require('../../models/userSchema');

const customerInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const totalItems = await User.countDocuments({ isAdmin: 0 });
        const totalPages = Math.ceil(totalItems / limit);

        const customers = await User.find({ isAdmin: 0 })
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const startPage = Math.max(1, page - 2);
        const endPage = Math.min(totalPages, page + 2);

        const breadcrumbs = [{ name: 'Customers', url: '/admin/users' }];

        res.render('admin/customers', {
            customers,
            pagination: { currentPage: page, totalPages, startPage, endPage },
            breadcrumbs,
            messages: {
                success: req.flash('success'),
                error: req.flash('error')
            }
        });
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).send('Server Error');
    }
};

const blockUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        user.isBlocked = !user.isBlocked;
        await user.save();

        res.status(200).json({
            success: true,
            message: `User has been ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`,
        });
    } catch (error) {
        console.error('Error in blockUser:', error);
        res.status(500).json({ success: false, message: "Failed to update user status" });
    }
};

module.exports = {
    customerInfo,
    blockUser,
};