const User = require('../../models/userSchema');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

// Configure nodemailer
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

exports.getForgotPasswordPage = (req, res) => {
    res.render('forgotPassword', { title: 'Forgot Password' });
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        console.log('Processing forgot password for email:', email);

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ 
                message: 'If an account exists with this email, you will receive reset instructions.' 
            });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date();
        otpExpiry.setMinutes(otpExpiry.getMinutes() + 10); // OTP valid for 10 minutes

        user.resetPasswordOTP = { code: otp, expiresAt: otpExpiry };
        await user.save();

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset OTP',
            html: `
                <h1>Password Reset Request</h1>
                <p>Your OTP for password reset is: <strong>${otp}</strong></p>
                <p>This OTP will expire in 10 minutes.</p>
                <p>If you didn't request this, please ignore this email.</p>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`OTP ${otp} sent to ${email}`);
        
        res.status(200).json({ 
            message: 'OTP sent to your email',
            email: email 
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
    }
};

exports.getVerifyOTP = async (req, res) => {
    try {
        const { email } = req.query;
        res.render('user/forgotOtp', { email });
    } catch (error) {
        console.error('Error loading OTP verification page:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        console.log('Verifying OTP:', otp, 'for email:', email);

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.resetPasswordOTP?.code || !user.resetPasswordOTP?.expiresAt) {
            return res.status(400).json({ message: 'No OTP request found' });
        }

        if (new Date() > user.resetPasswordOTP.expiresAt) {
            user.resetPasswordOTP = { code: null, expiresAt: null };
            await user.save();
            return res.status(400).json({ message: 'OTP has expired' });
        }

        if (user.resetPasswordOTP.code !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        res.status(200).json({ 
            message: 'OTP verified successfully',
            email: email 
        });
    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getResetPassword = async (req, res) => {
    try {
        const { email } = req.query;
        res.render('user/resetPassword', { email });
    } catch (error) {
        console.error('Error loading reset password page:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user.password = hashedPassword;
        user.resetPasswordOTP = { code: null, expiresAt: null };
        await user.save();

        res.status(200).json({ message: 'Password reset successful' });
    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};