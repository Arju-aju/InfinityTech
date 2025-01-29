const mongoose = require('mongoose')
const env  = require('dotenv').config()

const connectDb = async()=>{
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/infinityTech2')
        console.log(`Database Connected...`);
    } catch (error) {
        console.log(`Database connection error ${error.message}`);
        // process.exit(1)
    }
}

module.exports = connectDb