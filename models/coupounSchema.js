const mongoose = require('mongoose');
const { Schema } = mongoose;


const couponSchema = new Schema({
    code:{
        type:String,
        required:true,
        unique:true,
        uppercase: true,
        trim: true
    },
    discountType:{
        type:String,
        enum:['percentage','fixed'],
        required:true
    },
    discountValue:{
        type:Number,
        required:true
    },
    minPurchase: {
        type: Number,
        default: 0 // Minimum amount required to apply the coupon
    },
    maxDiscount: {
        type: Number,
        default: null // Maximum discount for percentage-based coupons
    },
    expirationDate: {
        type: Date,
        required: true
    },
    usageLimit: {
        type: Number,
        default: null // Null means unlimited usage
    },
    usedCount: {
    
        type: Number,
        default: 0 // Tracks how many times the coupon has been used
    },
    status: {
        type: String,
        enum: ['active', 'expired', 'disabled'],
        default: 'active'
    }

},{ timestamps: true });

module.exports = mongoose.model('Coupoun',couponSchema)