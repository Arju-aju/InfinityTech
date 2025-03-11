const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema');
require('dotenv').config();

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: 'https://infinitytech.space/auth/google/callback', // Absolute URL
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                console.log('Google Profile:', profile); // Debug log
                if (!profile.id || !profile.emails?.[0]?.value) {
                    throw new Error('Google profile is missing required fields (ID or email)');
                }

                const email = profile.emails[0].value;
                const googleId = profile.id;
                const displayName = profile.displayName || 'Anonymous';

                let user = await User.findOne({ email });

                if (user) {
                    if (!user.googleId) {
                        user.googleId = googleId;
                        await user.save();
                        console.log('Updated user with Google ID:', user);
                    }
                    return done(null, user);
                }

                user = new User({
                    name: displayName,
                    email: email,
                    googleId: googleId,
                    isVerified: true,
                    isBlocked: false,
                });

                await user.save();
                console.log('New Google user created:', user);
                return done(null, user);
            } catch (error) {
                console.error('Error in Google strategy:', error.message, error.stack);
                return done(error, null);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    console.log('Serializing user:', user._id); // Debug log
    done(null, user._id.toString());
});

passport.deserializeUser(async (id, done) => {
    try {
        console.log('Deserializing user ID:', id); // Debug log
        const user = await User.findById(id);
        if (!user) {
            console.log('User not found for ID:', id);
            return done(null, false);
        }
        console.log('Deserialized user:', user);
        return done(null, user);
    } catch (error) {
        console.error('Error deserializing user:', error.message, error.stack);
        return done(error, null);
    }
});

module.exports = passport;