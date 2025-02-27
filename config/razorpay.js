const razorpay = require('razorpay')

require('dotenv').config()

exports.createRazorpayInstance = () => {
    return new razorpay({
        key_id:process.env.Test_Key_ID,
        key_secret:process.env.Test_Key_Secret
    })
}