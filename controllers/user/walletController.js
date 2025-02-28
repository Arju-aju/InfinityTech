const Wallet = require('../../models/walletSchema')
const Users = require('../../models/userSchema')
const Category = require('../../models/categorySchema')


exports.getWallet = async (req, res, next) => {
    try {
        const userId = req.session.user?._id;
        if (!userId) {
            throw new Error("User not authenticated");
        }

        const user = await Users.findById(userId);
        const categories = await Category.find({});
        let wallet = await Wallet.findOne({ userId });

        // If no wallet exists, create one with default values
        if (!wallet) {
            wallet = new Wallet({
                userId: userId,
                balance: 0,
                transactions: []
            });
            await wallet.save();
        }

        console.log(wallet);

        if (wallet && wallet.lastUpdated) {
            const formattedDate = new Intl.DateTimeFormat('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            }).format(wallet.lastUpdated);

            const formattedTime = new Intl.DateTimeFormat('en-GB', {
                hour: 'numeric',
                minute: 'numeric',
                hour12: true
            }).format(wallet.lastUpdated);

            wallet.formattedLastUpdated = `${formattedDate}, ${formattedTime}`;
        }

        const cardData = {
            cardNumber: '4532 9856 0987 1234',
            cardHolder: 'JOHN DOE',
            validThru: '12/25',
            cvv: '123'
        };

        console.log(wallet);
        return res.render('user/wallet', { user, categories, wallet, ...cardData });
    } catch (error) {
        console.error(error.message);
        let errorMessage = { message: "An error occurred. Please try again later." };
        next(error);
        return res.render('user/error', { error: errorMessage });
    }
};

exports.getWalletDetails = async (req, res, next) => {
    try {
        // Find the wallet by userId
        let wallet = await Wallet.findOne({ userId: req.user._id });

        // If no wallet is found, create a new one with an initial balance of 0
        if (!wallet) {
            wallet = new Wallet({
                userId: req.user._id,
                balance: 0,
                transactions: []
            });
            await wallet.save();
        }

        // Format the response data
        const responseData = {
            balance: wallet.balance,
            transactions: wallet.transactions.map(t => ({
                type: t.type,
                amount: t.amount,
                description: t.description,
                date: t.date.toLocaleDateString(),
                time: t.date.toLocaleTimeString()
            }))
        };

        // Send the wallet details as the response
        res.json(responseData);
    } catch (error) {
        console.error("Failed to retrieve wallet:", error);
        next(error)
        res.status(500).json({ message: 'Server error' });
    }
}

exports.getTransactionHistory = async (req, res, next) => {
    try {
        const sessionUserId = req.session.user?._id; // Renamed to avoid conflict
        if (!sessionUserId) {
            throw new Error("User not authenticated");
        }

        const user = await Users.findById(sessionUserId); // Pass sessionUserId directly
        const categories = await Category.find({});
        const announcements = await Announcement.find({});
        const wallet = await Wallet.findOne({ userId: sessionUserId });

        if (!wallet) {
            return res.status(404).render('user/error', { error: { message: "Wallet not found" } });
        }

        const transactions = wallet.transactions;

        let totalCredits = 0;
        let totalDebits = 0;
        transactions.forEach(transaction => {
            if (transaction.type === 'credit') {
                totalCredits += transaction.amount;
            } else if (transaction.type === 'debit') {
                totalDebits += transaction.amount;
            }
        });

        return res.render('user/transaction-history', {
            user,
            categories,
            announcements,
            transactions,
            totalTransactions: transactions.length,
            totalCredits,
            totalDebits,
            wallet
        });
    } catch (error) {
        console.error(error.message);
        let errorMessage = { message: "An error occurred. Please try again later." };
        next(error);
        return res.render('user/error', { error: errorMessage });
    }
};

exports.refundToWallet = async (orderId, userId, amount, description) => {
    try {
      let wallet = await Wallet.findOne({ userId });
  
      if (!wallet) {
        wallet = new Wallet({
          userId,
          balance: 0,
          transactions: []
        });
      }
  
      wallet.balance += amount;
      wallet.transactions.push({
        amount,
        type: 'credit',
        description,
        date: new Date(),
        time: new Date()
      });
  
      await wallet.save();
      return true;
    } catch (error) {
      console.error('Refund to Wallet Error:', error);
      throw error;
    }
  };