const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema'); 
require('dotenv').config(); 

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: '/auth/google/callback',
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Validate profile data
                if (!profile.id || !profile.emails?.[0]?.value) {
                    throw new Error('Google profile is missing required fields (ID or email)');
                }

                const email = profile.emails[0].value;
                const googleId = profile.id;
                const displayName = profile.displayName || 'Anonymous';

                // Check if user already exists in the database
                let user = await User.findOne({ email });

                if (user) {
                    // Update Google ID if missing
                    if (!user.googleId) {
                        user.googleId = googleId;
                        await user.save();
                    }
                    return done(null, user); 
                }

                // Create a new user if not found
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
                console.error('Error in Google strategy:', error);
                return done(error, null); 
            }
        }
    )
);

// Serialize user into the session
passport.serializeUser((user, done) => {
    done(null, user._id.toString()); 
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        if (!user) {
            return done(null, false); 
        }
        done(null, user); 
    } catch (error) {
        console.error('Error deserializing user:', error);
        done(error, null);
    }
});

module.exports = passport;