'use strict';

let passport = require('passport');
let LocalStrategy = require('passport-local').Strategy;

let csrf = require('csurf');

const users = require('../models/users');
const panels = require('../models/panels');
const { nodeifyPromise, nodeifyFunction } = require('./nodeify');
const interoperableErrors = require('../../shared/interoperable-errors');
const contextHelpers = require('./context-helpers');

module.exports.csrfProtection = csrf({
    cookie: true
});


module.exports.loggedIn = (req, res, next) => {
    if (!req.user) {
        next(new interoperableErrors.NotLoggedInError());
    } else {
        next();
    }
};

module.exports.authBySSLCert = (req, res, next) => {
    nodeifyPromise((async () => {
        if (!req.socket || !req.socket.authorized) {
            throw new interoperableErrors.NotAuthorizedError();
        } else {

            const cert = req.socket.getPeerCertificate();

            const user = await users.getByUsername(cert.subject.CN);
            req.user = user;
        }
    })(), next);
};

module.exports.authByPanelToken = (req, res, next) => {
    nodeifyPromise((async () => {
        const accessToken = req.params.accessToken;

        if (accessToken) {
            const {userId, panelId} = await panels.getAccessToken(accessToken);
            const user = await users.getById(contextHelpers.getAdminContext(), userId);
            req.user = user;
            req.panelId = panelId;
        }
    })(), next);
};


module.exports.setupRegularAuth = app => {
    app.use(passport.initialize());
    app.use(passport.session());
};

module.exports.restLogout = (req, res) => {
    req.logout();
    res.json();
};

module.exports.restLogin = (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return next(err);
        }

        if (!user) {
            return next(new interoperableErrors.IncorrectPasswordError());
        }

        req.logIn(user, err => {
            if (err) {
                return next(err);
            }

            if (req.body.remember) {
                // Cookie expires after 30 days
                req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
            } else {
                // Cookie expires at end of session
                req.session.cookie.expires = false;
            }

            return res.json();
        });
    })(req, res, next);
};

passport.use(new LocalStrategy(nodeifyFunction(async (username, password) => {
    return await users.getByUsernameIfPasswordMatch(username, password);
})));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => nodeifyPromise(users.getById(contextHelpers.getAdminContext(), id), done));

