const nodemailer = require('nodemailer');
require('dotenv').config();

// Create Nodemailer transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Generate a random 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via email
const sendOTPEmail = async (email, otp) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'InfinityTech - Email Verification Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #2845AE; padding: 20px; text-align: center;">
                        <h1 style="color: white; margin: 0;">InfinityTech</h1>
                    </div>
                    <div style="padding: 20px; border: 1px solid #e5e5e5; border-top: none;">
                        <h2 style="color: #2845AE; margin-top: 0;">Verify Your Email</h2>
                        <p>Thank you for registering with InfinityTech. Please use the following verification code to complete your registration:</p>
                        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; margin: 20px 0;">
                            <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px;">${otp}</span>
                        </div>
                        <p>This code will expire in 10 minutes.</p>
                        <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
                    </div>
                    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
                        <p>This is an automated message, please do not reply.</p>
                        <p>&copy; 2025 InfinityTech. All rights reserved.</p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('OTP Email sent:', info.messageId);
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
        
        // Log OTP for testing purposes
        console.log('Generated OTP for testing:', otp);
        
        return true;
    } catch (error) {
        console.error('Error sending OTP email:', error);
        throw error;
    }
};

// Verify OTP
const verifyOTP = (storedOTP, submittedOTP) => {
    return storedOTP === submittedOTP;
};

module.exports = {
    generateOTP,
    sendOTPEmail,
    verifyOTP
};
