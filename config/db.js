const mongoose = require('mongoose')
const env  = require('dotenv').config()

const connectDb = async()=>{
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
          })
        console.log(`Database Connected...`);
    } catch (error) {
        console.log(`Database connection error ${error.message}`);
        // process.exit(1)
    }
}

module.exports = connectDb