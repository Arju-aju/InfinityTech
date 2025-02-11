const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
        required: false,
        unique: false,
        sparse: true,
        default: null
    },
    googleId: {
        type: String,
        default: null
    },
    password: {
        type: String,
        required: false
    },
    isVerified: {  // ✅ Add this field
        type: Boolean,
        default: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    // cart: {  
    //     type: Schema.Types.ObjectId,
    //     ref: "Cart",
    //     default: null
    // },
    wallet: {
        type: Number,
        default: 0
    },
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: 'Order'
    }],
    createdOn: {
        type: Date,
        default: Date.now,
    },
    referalCode: {
        type: String,
        required: false
    },
    redemmed: {
        type: Boolean,
        default: false
    },
    redemmedUsers: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    resetPasswordOTP: {
        code: {
            type: String,
            default: null
        },
        expiresAt: {
            type: Date,
            default: null
        }
    },
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: 'Category',
            required: true
        },
        brand: {
            type: String,
        },
        searchOn: {
            type: Date,
            default: Date.now
        }
    }]
});

const User = mongoose.model("User", userSchema);
module.exports = User;
