const mongoose = require('mongoose');
const { Schema } = mongoose;

const laptopCategorySchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    parentCategory: {
        type: Schema.Types.ObjectId,
        ref: 'LaptopCategory',
        default: null,
    },
    thumbnail: {
        type: String,
        required: false
    },
    createdOn: {
        type: Date,
        default: Date.now,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    isAvailable: {
        type: Boolean,
        default: true
    }
});

const LaptopCategory = mongoose.model('LaptopCategory', laptopCategorySchema);

module.exports = LaptopCategory;
