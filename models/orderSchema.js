const { ref, required } = require('joi');
const mongoose = require('mongoose');
const { Schema } = mongoose;

const orderSchema = new Schema ({
    user:{
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    products:[{
        productId:{
            type : Schema.Types.ObjectId,
            ref:'Product'
        },
        quantity:{
            type :Number,
            required:true
        },
        price:{
            type:Number,
            required:true
        },
        totalPrice: {
             type: Number, required: true
        },
        status: {
            type: String,
            enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
            default: "Pending",
        },
        createdAt: { 
            type: Date, 
            default: Date.now 
        },
    }],
    deliveryAddress: {
        type: Array,
        required: true
    },
    orderAmount: {
        type: Number,
        required: true
    },
   
    paymentMethod: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now,
        required: true
    },
    
}, { timestamps: true });


const Order  = mongoose.model("Order",orderSchema)

module.exports =Order