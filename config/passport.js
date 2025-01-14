const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema'); // Correct model import
require('dotenv').config(); // Load environment variables

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: '/auth/google/callback',
        },
        async (req,accessToken, refreshToken, profile, done) => {
            try {
                // Check if profile.id exists
                if (!profile.id) {
                    throw new Error('Google profile ID is missing');
                }
                // Check if user already exists in the database
                let existingUser = await User.findOne({ email:profile.emails?.[0].value});

                if (existingUser) {
                    let user=existingUser
                    return done(null, user); // User exists
                }
                // Create a new user if not found
                const newUser = new User({
                    name: profile.displayName || 'Anonymous', // Fallback for displayName
                    email: profile.emails?.[0]?.value || 'NoEmailProvided', // Fallback for email
                    googleId: profile.id, // Google ID
                });
                if (!newUser.googleId || !newUser.email) {
                    throw new Error('Missing required fields from Google profile');
                }
                console.log("new user",newUser);
                await newUser.save();
                // req.session.user = newUser;

                // console.log("x",req.session.user);
                let user =newUser
                return done(null, user); // Pass new user to Passport
            } catch (error) {
                console.error('Error in Google strategy:', error);
                return done(error, null); // Handle error
            }
        }
    )
);

// Serialize user into the session
passport.serializeUser((user, done) => {
    done(null, user.id); // Serialize by user ID
});

// Deserialize user from the session
passport.deserializeUser((id, done) => {
    User
        .findById(id) // Correct model usage
        .then((user) => done(null, user))
        .catch((err) => done(err, null));
});

module.exports = passport;
