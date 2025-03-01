const mongoose = require('mongoose');
const { Schema } = mongoose;

const couponSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    code: {
        type: String,
        required: true,
        unique: true
    },
    offerType: {
        type: String,
        enum: ['percentage', 'flat'],
        required: true
    },
    offerValue: {
        type: Number,
        required: true
    },
    minimumPrice: {
        type: Number,
        required: true
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    expiredOn: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    usageLimit: {
        type: Number,
        default: null
    },
    usagePerUserLimit: {
        type: Number,
        default: 1
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    couponUsed: {
        type: Number,
        default: 0
    }
});



module.exports = mongoose.model('Coupoun',couponSchema)