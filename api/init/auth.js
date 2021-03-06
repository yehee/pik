const GoogleStrategy = require('passport-google-oauth20').Strategy
const LocalStrategy = require('passport-local').Strategy
const passport = require('passport')
const path = require('path')
const session = require('express-session')
const User = require('../models/user')
const { ObjectId } = require('../controllers/util')

require('dotenv').config({ path: path.join(__dirname, '.env.local') })

const clientID = process.env.OAUTH_CLIENT_ID
const clientSecret = process.env.OAUTH_CLIENT_SECRET

module.exports = app => {
    app.use(session({
        cookie: { secure: false },
        resave: true,
        saveUninitialized: true,
        secret: 'anything',
    }))

    // Used to stuff a piece of information into a cookie
    passport.serializeUser((user, done) => {
        done(null, user._id)
    })

    // Used to decode the received cookie and persist session
    passport.deserializeUser((id, done) => {
        User.findById(ObjectId(id)).then(user => {
            done(null, user)
        })
    })

    // OAuth Strategy to get access_token
    passport.use(new GoogleStrategy({
        clientID,
        clientSecret,
        callbackURL: '/auth/google/callback',
    }, (accessToken, refreshToken, profile, done) => {
        const user = {
            givenName: profile.name.givenName,
            familyName: profile.name.familyName,
            email: profile.emails[0]?.value,
            imageUrl: profile.photos[0]?.value,
        }
        User.findOne({ email: user.email }).then(existingUser => {
            if (existingUser) {
                return done(null, existingUser)
            }
            new User(user)
                .save()
                .then(newUser => done(null, { _id: newUser._id, accessToken, refreshToken }))
        })
    }))

    // Local Strategy using username and password
    passport.use('new', new LocalStrategy({
        passReqToCallback: true,
    },
        (req, username, password, done) => {
            User.findOne({ username }, function (err, user) {
                if (err) return done(err)
                if (!user) {
                    new User(req.body)
                        .save()
                        .then(newUser => done(null, { _id: newUser._id }))
                } else if (user.password !== password) {
                    return done(null, false)
                } else {
                    return done(null, user)
                }
            })
        }
    ))

    passport.use('login', new LocalStrategy({
        passReqToCallback: true,
    },
        (req, username, password, done) => {
            User.findOne({ username }, function (err, user) {
                if (err) return done(err)
                if (!user || user.password !== password) return done(null, false)
                else return done(null, user)
            })
        }
    ))

    app.use(passport.initialize())
    app.use(passport.session())
}
