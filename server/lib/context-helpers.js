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
            id: 1,
            username: '',
            name: '',
            email: '',
            namespace: 1
        }
    };

    return context;
}

module.exports = {
    getRequestContext,
    getAdminContext
};