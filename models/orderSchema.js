const mongoose = require('mongoose');
const { Schema } = mongoose;

const orderSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    products: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product'
        },
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        totalPrice: {
            type: Number,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    status: {
        type: String,
        enum: ["Pending", "Processing", "Shipped","Out for Delivery","Delivered","Cancelled","Return Requested","Return Approved","Returned Rejected","Returned",],
        default: "Pending",
    },
    deliveryAddress: {
        type: Object,
        required: true
    },
    orderAmount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['Credit Card', 'Debit Card','cod','razorpay', 'cash'],
        required: true
    },
    cancellationReason: {
        type: String,
        default: null
    },
    returnReason: {
        type: String,
        default: null
    },
    returnRequestedAt: {
        type: Date,
        default: null
    },
    orderDate: {
        type: Date,
        default: Date.now
    },
    couponApplied: {
        type: Schema.Types.ObjectId,
        ref: 'Coupoun',
        default: null
    },
    offerApplied: {
        type: Number,
        default: 0
    },
    cancelDate: {
        type: String,
        default: null
    }
}, { timestamps: true });

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;