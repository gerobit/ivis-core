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

module.exports = {
    getRequestContext,
    getAdminContext
};