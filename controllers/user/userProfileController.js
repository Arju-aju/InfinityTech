const { profile } = require("winston");
const User = require("../../models/userSchema");

exports.loadProfile = async (req, res) => {
    try {
        const userId = req.user._id;

        const user = await User.findById(userId)
            // .populate('cart')
            // .populate('orderHistory')
            // .populate('searchHistory.category')
            .lean();

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Format dates for better readability
        const memberSince = new Date(user.createdOn).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });

        // Enhanced user profile response
        const userProfile = {
            name: user.name,
            email: user.email,
            phone: user.phone || 'Not provided',
            memberSince,
            status: user.isBlocked ? 'Blocked' : 'Active',
            isVerified: user.isVerified,
            wallet: user.wallet || 0,
            profileImage: user.profileImage || '/api/placeholder/120/120',
            
            // Recent orders (last 3)
            // recentOrders: (user.orderHistory || [])
            //     .slice(-3)
            //     .map(order => ({
            //         orderId: order._id,
            //         totalAmount: order.totalAmount,
            //         status: order.status,
            //         items: order.items?.length || 0,
            //         date: new Date(order.createdAt).toLocaleDateString()
            //     })),

            // Enhanced wallet details
            // walletSummary: {
            //     balance: user.wallet || 0,
            //     referralCode: user.referalCode,
            //     referralRedeemed: user.redemmed || false,
            //     referralUsers: user.redemmedUsers?.length || 0
            // },

            // Account verification details
            accountDetails: {
                isAdmin: user.isAdmin || false,
                isVerified: user.isVerified,
                googleLinked: !!user.googleId,
                verificationStatus: user.isVerified ? 'Verified' : 'Unverified'
            }
        };
        res.render('user/profile',{
            userProfile
        })
        

    } catch (error) {
        console.error('Error loading profile:', error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};