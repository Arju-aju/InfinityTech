const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    brand: {
        type: String,
        required: true,
        trim: true
    },
    stock: {
        type: Number,
        required: true,
        min: 0
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    discountPercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: 'LaptopCategory',
        required: true
    },
    specifications: {
        processor: {
            type: String
        },
        ram: {
            type: String
        },
        storage: {
            type: String
        },
        graphics: {
            type: String
        }
    },
    images: [String],
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});


const Product = mongoose.model('Product', productSchema);

module.exports = Product;