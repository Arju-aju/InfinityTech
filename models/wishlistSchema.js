const { required } = require('joi');
const mongoose = require('mongoose');
const { Schema } = mongoose;


const wishlistSchema  = new Schema ({
    user : {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    product: {
        type:  Schema.Types.ObjectId,
        ref :"Product",
        required: true
    },
    createdAt : {
        type: Date,
        default : Date.now
    }
})


module.exports = mongoose.model('Wishlist',wishlistSchema)