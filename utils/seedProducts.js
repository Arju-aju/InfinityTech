const mongoose = require('mongoose');
const Product = require('../models/productSchema');
const Category = require('../models/categorySchema');

async function seedProducts() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://127.0.0.1:27017/InfinityTech');
        
        // Get a category ID (you'll need at least one category in the database)
        const category = await Category.findOne();
        if (!category) {
            console.error('No categories found. Please create a category first.');
            return;
        }

        // Sample products data
        const products = [
            {
                name: 'MacBook Pro M2 Pro',
                brand: 'Apple',
                category: category._id,
                price: 199900,
                discountPercentage: 60,
                stock: 15,
                description: 'Latest MacBook Pro with M2 Pro chip',
                specifications: {
                    processor: 'Apple M2 Pro',
                    ram: '16GB',
                    storage: '512GB SSD',
                    graphics: 'Integrated 16-core GPU'
                },
                images: ['/images/default-product.jpg'],
                isListed: true
            },
            {
                name: 'Dell XPS 15',
                brand: 'Dell',
                category: category._id,
                price: 149900,
                discountPercentage: 58,
                stock: 25,
                description: 'Premium Dell XPS laptop',
                specifications: {
                    processor: 'Intel i9-12900HK',
                    ram: '32GB',
                    storage: '1TB SSD',
                    graphics: 'NVIDIA RTX 3060'
                },
                images: ['/images/default-product.jpg'],
                isListed: true
            },
            {
                name: 'Lenovo ThinkPad X1',
                brand: 'Lenovo',
                category: category._id,
                price: 129900,
                discountPercentage: 45,
                stock: 30,
                description: 'Business laptop with premium features',
                specifications: {
                    processor: 'Intel i7-1260P',
                    ram: '16GB',
                    storage: '512GB SSD',
                    graphics: 'Intel Iris Xe'
                },
                images: ['/images/default-product.jpg'],
                isListed: true
            },
            {
                name: 'HP Spectre x360',
                brand: 'HP',
                category: category._id,
                price: 139900,
                discountPercentage: 52,
                stock: 20,
                description: 'Premium convertible laptop',
                specifications: {
                    processor: 'Intel i7-1255U',
                    ram: '16GB',
                    storage: '1TB SSD',
                    graphics: 'Intel Iris Xe'
                },
                images: ['/images/default-product.jpg'],
                isListed: true,
                createdAt: new Date() // This will be a new arrival
            }
        ];

        // Clear existing products
        await Product.deleteMany({});

        // Insert new products
        await Product.insertMany(products);

        console.log('Products seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding products:', error);
        process.exit(1);
    }
}

seedProducts();
