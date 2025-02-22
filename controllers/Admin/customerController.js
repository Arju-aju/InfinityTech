const User = require('../../models/userSchema');

// Controller: customerController.js
const customerInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 3;
        const skip = (page - 1) * limit;

        // Get search and filter parameters
        const searchQuery = req.query.search || '';
        const statusFilter = req.query.status || 'all';
        
        // Build filter conditions
        let filterConditions = { isAdmin: 0 };
        
        // Add search condition if search query exists
        if (searchQuery) {
            filterConditions.$or = [
                { name: { $regex: searchQuery, $options: 'i' } },
                { email: { $regex: searchQuery, $options: 'i' } },
                { phone: { $regex: searchQuery, $options: 'i' } }
            ];
        }

        // Add status filter if not 'all'
        if (statusFilter !== 'all') {
            filterConditions.isBlocked = statusFilter === 'blocked';
        }

        // Get total count for pagination
        const totalItems = await User.countDocuments(filterConditions);
        const totalPages = Math.ceil(totalItems / limit);

        // Fetch filtered customers
        const customers = await User.find(filterConditions)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const startPage = Math.max(1, page - 2);
        const endPage = Math.min(totalPages, page + 2);

        const breadcrumbs = [{ name: 'Customers', url: '/admin/users' }];

        res.render('admin/customers', {
            customers,
            pagination: { 
                currentPage: page, 
                totalPages, 
                startPage, 
                endPage,
                searchQuery,
                statusFilter
            },
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