const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error('No email from Google'), null);

        // Check if user exists by googleId or email
        let user = await prisma.user.findFirst({
          where: { OR: [{ googleId: profile.id }, { email }] },
        });

        if (user) {
          // Update googleId if not set
          if (!user.googleId) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { googleId: profile.id, emailVerified: true },
            });
          }
        } else {
          // Create new user from Google profile
          user = await prisma.user.create({
            data: {
              name: profile.displayName || email.split('@')[0],
              email,
              googleId: profile.id,
              passwordHash: '', // No password for OAuth users
              role: 'resident',
              emailVerified: true,
              avatarUrl: profile.photos?.[0]?.value,
            },
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
