const { required } = require('joi');
const mongoose = require('mongoose');
const { Schema } = mongoose;


const returnSchema = new Schema({
    orderId :{
        type: Schema.Types.ObjectId,
        ref:'Order',
        required:true
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required:true
    },
    reason:{
        type:String,
        required:true
    },
    requestDate:{
        type: Date,
        default: Date.now 
    },
    returnStatus:{
        type: String, 
        enum: ['Requested', 'Approved', 'Rejected', 'Completed'],
        default: 'Requested'
    },
    items: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        }
    }]
})


const Return = mongoose.model("Return", returnSchema);

module.exports = Return