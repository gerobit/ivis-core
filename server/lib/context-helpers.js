'use strict';

function getRequestContext(req) {
    const context = {
        user: req.user,
        panelId: req.panelId
    };

    return context;
}

function getAdminContext() {
    const context = {
        user: {
            admin: true,
            id: 0,
            username: '',
            name: '',
            email: ''
        }
    };

    return context;
}

function getUserContext(context, user) {
    const newContext = {...context};
    newContext.user = user;

    return newContext;
}

module.exports = {
    getRequestContext,
    getAdminContext,
    getUserContext
};