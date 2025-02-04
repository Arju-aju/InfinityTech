const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true,
        unique: true
    },
    brand: {
        type: String,
        required: [true, 'Brand is required'],
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: 'LaptopCategory',
        required: [true, 'Category is required']
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative']
    },
    discountPercentage: {
        type: Number,
        min: [0, 'Discount cannot be negative'],
        max: [100, 'Discount cannot exceed 100%'],
        default: 0
    },
    stock: {
        type: Number,
        required: [true, 'Stock is required'],
        min: [0, 'Stock cannot be negative'],
        default: 0
    },
    specifications: {
        processor: {
            type: String,
            required: [true, 'Processor specification is required'],
            trim: true
        },
        ram: {
            type: String,
            required: [true, 'RAM specification is required'],
            trim: true
        },
        storage: {
            type: String,
            required: [true, 'Storage specification is required'],
            trim: true
        },
        graphics: {
            type: String,
            required: [true, 'Graphics specification is required'],
            trim: true
        }
    },
    images: [{
        type: String,
        required: [true, 'At least one product image is required']
    }],
    isListed: {
        type: Boolean,
        default: true // Field to mark product as featured
    },
    isDeleted: {
        type: Boolean,
        default: false // Soft delete flag
    }
}, {
    timestamps: true
});

// Add virtual field for discounted price
productSchema.virtual('discountedPrice').get(function() {
    if (!this.discountPercentage) return this.price;
    return this.price * (1 - this.discountPercentage / 100);
});

// Ensure virtuals are included in JSON output
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);