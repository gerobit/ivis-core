'use strict';

const isemail = require('isemail');

module.exports = {
    validateEmail
};

async function validateEmail(address, checkBlocked) {
    let user = (address || '').toString().split('@').shift().toLowerCase().replace(/[^a-z0-9]/g, '');

    if (checkBlocked && blockedUsers.indexOf(user) >= 0) {
        throw new Error(`Blocked email address "${address}"`);
    }

    const result = await new Promise(resolve => {
        const result = isemail.validate(address, {
            checkDNS: true,
            errorLevel: 1
        }, resolve);
    });

    return result;
}
