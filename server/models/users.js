'use strict';

const config = require('../lib/config');
const knex = require('../lib/knex');
const hasher = require('node-object-hash')();
const { enforce, filterObject } = require('../lib/helpers');
const interoperableErrors = require('../../shared/interoperable-errors');
const passwordValidator = require('../../shared/password-validator')();
const dtHelpers = require('../lib/dt-helpers');
const tools = require('../lib/tools-async');
const crypto = require('crypto');

const bluebird = require('bluebird');

const bcrypt = require('bcrypt-nodejs');
const bcryptHash = bluebird.promisify(bcrypt.hash);
const bcryptCompare = bluebird.promisify(bcrypt.compare);

/*
const mailer = require('../lib/mailer');
const mailerSendMail = bluebird.promisify(mailer.sendMail);
*/

const passport = require('../lib/passport');

const namespaceHelpers = require('../lib/namespace-helpers');

const allowedKeys = new Set(['username', 'name', 'email', 'password', 'phone_cell', 'address', 'namespace', 'role']);
const ownAccountAllowedKeys = new Set(['name', 'email', 'password', 'phone_cell', 'address']);
const hashKeys = new Set(['username', 'name', 'email', 'namespace', 'role']);
const shares = require('./shares');
const contextHelpers = require('../lib/context-helpers');

function hash(entity) {
    return hasher.hash(filterObject(entity, hashKeys));
}

async function _getByTx(tx, context, key, value, extraColumns = []) {
    const columns = ['id', 'username', 'name', 'email', 'phone_cell', 'address', 'namespace', 'role', ...extraColumns];

    const user = await tx('users').select(columns).where(key, value).first();

    if (!user) {
        shares.throwPermissionDenied();
    }

    // Note that getRestrictedAccessToken relies to this check to see whether a user may impersonate another. If "manageUsers" here were to be changed to something like "viewUsers", then
    // a corresponding check has to be added to getRestrictedAccessToken
    await shares.enforceEntityPermission(context, 'namespace', user.namespace, 'manageUsers');

    return user;
}

async function _getBy(context, key, value, extraColumns = []) {
    return await knex.transaction(async tx => {
        return await _getByTx(tx, context, key, value, extraColumns);
    });
}

async function getById(context, id) {
    return await _getBy(context, 'id', id);
}

async function serverValidate(context, data, isOwnAccount) {
    const result = {};

    if (!isOwnAccount) {
        await shares.enforceTypePermission(context, 'namespace', 'manageUsers');
    }

    if (!isOwnAccount && data.username) {
        const query = knex('users').select(['id']).where('username', data.username);

        if (data.id) {
            // Id is not set in entity creation form
            query.andWhereNot('id', data.id);
        }

        const user = await query.first();
        result.username = {
            exists: !!user
        };
    }

    if (isOwnAccount && data.currentPassword) {
        const user = await knex('users').select(['id', 'password']).where('id', data.id).first();

        result.currentPassword = {};
        result.currentPassword.incorrect = !await bcryptCompare(data.currentPassword, user.password);
    }

    if (data.email) {
        const query = knex('users').select(['id']).where('email', data.email);

        if (data.id) {
            // Id is not set in entity creation form
            query.andWhereNot('id', data.id);
        }

        const user = await query.first();

        result.email = {};
        result.email.invalid = await tools.validateEmail(data.email) !== 0;
        result.email.exists = !!user;
    }

    return result;
}

async function listDTAjax(context, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{ entityTypeId: 'namespace', requiredOperations: ['manageUsers'] }],
        params,
        builder => builder
            .from('users')
            .innerJoin('namespaces', 'namespaces.id', 'users.namespace')
            .innerJoin('generated_role_names', 'generated_role_names.role', 'users.role')
            .where('generated_role_names.entity_type', 'global'),
        [ 'users.id', 'users.username', 'users.name', 'users.email', 'namespaces.name', 'generated_role_names.name' ]
    );
}

async function _validateAndPreprocess(tx, entity, isCreate, isOwnAccount = false) {
    if (entity.email !== null) { // The email may be NULL. This means no password reminders can be sent. This is used by the importers if they create synthetic users to match users existing in a 3rd party system.
        enforce(await tools.validateEmail(entity.email) === 0, 'Invalid email');

        const otherUserWithSameEmailQuery = tx('users').where('email', entity.email);
        if (!isCreate) {
            otherUserWithSameEmailQuery.andWhereNot('id', entity.id);
        }

        if (await otherUserWithSameEmailQuery.first()) {
            throw new interoperableErrors.DuplicitEmailError();
        }
    }

    await namespaceHelpers.validateEntity(tx, entity);

    if (!isOwnAccount) {
        const otherUserWithSameUsernameQuery = tx('users').where('username', entity.username);
        if (!isCreate) {
            otherUserWithSameUsernameQuery.andWhereNot('id', entity.id);
        }

        if (await otherUserWithSameUsernameQuery.first()) {
            throw new interoperableErrors.DuplicitNameError();
        }
    }

    enforce(entity.role in config.roles.global, 'Unknown role');

    if (entity.password === null) {
        // Password may be NULL. This means there is no password and the user cannot login.
        // This is used from importers if they create synthetic users to match users existing in a 3rd party system.

    } else if (entity.password) {
        const passwordValidatorResults = passwordValidator.test(entity.password);
        if (passwordValidatorResults.errors.length > 0) {
            // This is not an interoperable error because this is not supposed to happen unless the client is tampered with.
            throw new Error('Invalid password');
        }

        entity.password = await bcryptHash(entity.password, null, null);
    } else {
        delete entity.password;
    }
}

async function createTx(tx, context, user) {
    let id;
    await shares.enforceEntityPermissionTx(tx, context, 'namespace', user.namespace, 'manageUsers');

    await _validateAndPreprocess(tx, user, true);

    const ids = await tx('users').insert(filterObject(user, allowedKeys));
    id = ids[0];

    await shares.rebuildPermissionsTx(tx, { userId: id });

    return id;
}

async function create(context, user) {
    return await knex.transaction(async tx => {
        return await createTx(tx, context, user);
    });
}

async function updateWithConsistencyCheck(context, user, isOwnAccount) {
    await knex.transaction(async tx => {
        const existing = await tx('users').where('id', user.id).first();
        if (!existing) {
            shares.throwPermissionDenied();
        }

        const existingHash = hash(existing);
        if (existingHash !== user.originalHash) {
            throw new interoperableErrors.ChangedError();
        }

        if (!isOwnAccount) {
            await shares.enforceEntityPermissionTx(tx, context, 'namespace', user.namespace, 'manageUsers');
            await shares.enforceEntityPermissionTx(tx, context, 'namespace', existing.namespace, 'manageUsers');
        }

        await _validateAndPreprocess(tx, user, false, isOwnAccount);

        if (isOwnAccount && user.password) {
            if (!await bcryptCompare(user.currentPassword, existing.password)) {
                throw new interoperableErrors.IncorrectPasswordError();
            }
        }

        await tx('users').where('id', user.id).update(filterObject(user, isOwnAccount ? ownAccountAllowedKeys : allowedKeys));

        // Removes the default shares based on the user role and rebuilds permissions.
        // rebuildPermissions adds the default shares based on the user role, which will reflect the changes
        // done to the user.
        if (existing.namespace !== user.namespace || existing.role !== user.role) {
            await shares.removeDefaultShares(tx, existing);
        }

        await shares.rebuildPermissionsTx(tx, { userId: user.id });
    });
}

async function remove(context, userId) {
    enforce(userId !== 1, 'Admin cannot be deleted');
    enforce(context.user.id !== userId, 'User cannot delete himself/herself');

    await knex.transaction(async tx => {
        const existing = await tx('users').where('id', userId).first();
        if (!existing) {
            shares.throwPermissionDenied();
        }

        await shares.enforceEntityPermissionTx(tx, context, 'namespace', existing.namespace, 'manageUsers');

        await tx('users').where('id', userId).del();
    });
}

async function getByAccessToken(context, accessToken) {
    return await _getBy(context, 'access_token', accessToken);
}

async function getByUsername(context, username) {
    return await _getBy(context, 'username', username);
}

async function getByUsernameTx(tx, context, username) {
    return await _getByTx(tx, context, 'username', username);
}


async function getByUsernameIfPasswordMatch(context, username, password) {
    try {
        const user = await _getBy(context, 'username', username, ['password']);

        if (user.password === null) {
            throw new interoperableErrors.IncorrectPasswordError();
        }

        if (!await bcryptCompare(password, user.password)) {
            throw new interoperableErrors.IncorrectPasswordError();
        }

        delete user.password;

        return user;

    } catch (err) {
        if (err instanceof interoperableErrors.NotFoundError) {
            throw new interoperableErrors.IncorrectPasswordError();
        }

        throw err;
    }
}

async function getAccessToken(userId) {
    const user = await _getBy(contextHelpers.getAdminContext(), 'id', userId, ['access_token']);
    return user.access_token;
}

async function resetAccessToken(userId) {
    const token = crypto.randomBytes(20).toString('hex').toLowerCase();
    await knex('users').where({id: userId}).update({access_token: token});
    return token;
}

async function sendPasswordReset(locale, usernameOrEmail) {
    await knex.transaction(async tx => {
        const user = await tx('users').where('username', usernameOrEmail).orWhere('email', usernameOrEmail).select(['id', 'username', 'email', 'name']).first();

        if (user) {
            const resetToken = crypto.randomBytes(16).toString('base64').replace(/[^a-z0-9]/gi, '');

            await tx('users').where('id', user.id).update({
                reset_token: resetToken,
                reset_expire: new Date(Date.now() + 60 * 60 * 1000)
            });

            const serviceUrl = config.server.url;
            const adminEmail = config.server.email;

            /*
            await mailerSendMail({
                from: {
                    address: adminEmail
                },
                to: {
                    address: user.email
                },
                subject: t('Mailer password change request')
            }, {
                html: 'emails/password-reset-html.hbs',
                text: 'emails/password-reset-text.hbs',
                data: {
                    title: 'Mailtrain',
                    username: user.username,
                    name: user.name,
                    confirmUrl: urllib.resolve(serviceUrl, `/login/reset/${encodeURIComponent(user.username)}/${encodeURIComponent(resetToken)}`)
                }
            });
            */
        }
        // We intentionally silently ignore the situation when user is not found. This is not to reveal if a user exists in the system.
    });
}

async function isPasswordResetTokenValid(username, resetToken) {
    const user = await knex('users').select(['id']).where({username, reset_token: resetToken}).andWhere('reset_expire', '>', new Date()).first();
    return !!user;
}

// TODO - change reset_expire to timestamp
async function resetPassword(username, resetToken, password) {
    await knex.transaction(async tx => {
        const user = await tx('users').select(['id']).where({
            username,
            reset_token: resetToken
        }).andWhere('reset_expire', '>', new Date()).first();

        if (user) {
            const passwordValidatorResults = passwordValidator.test(password);
            if (passwordValidatorResults.errors.length > 0) {
                // This is not an interoperable error because this is not supposed to happen unless the client is tampered with.
                throw new Error('Invalid password');
            }

            password = await bcryptHash(password, null, null);

            await tx('users').where({username}).update({
                password,
                reset_token: null,
                reset_expire: null
            });
        } else {
            throw new interoperableErrors.InvalidTokenError();
        }
    });
}



const restrictedAccessTokenMethods = {};
const restrictedAccessTokens = new Map();

/*
The handler returns permissions in the following form:
permissions: {
    template: {
        1: new Set(['execute']) // only execute for template #1
    },
    signalSet: new Set(['query']), // only query for all signal sets
    signal: true // all permissions for any signal
}
 */
function registerRestrictedAccessTokenMethod(method, getHandlerFromParams) {
    restrictedAccessTokenMethods[method] = getHandlerFromParams;
}

async function getRestrictedAccessToken(context, method, params, impersonateUserId) {
    let userId;
    if (impersonateUserId) {
        await getById(context, impersonateUserId); // If we can get the user, it means we have manageUsers permission, which gives us enough credentials to impersonate the user
        userId = impersonateUserId;
    } else {
        userId = context.user.id;
    }

    const token = crypto.randomBytes(24).toString('hex').toLowerCase();
    const tokenEntry = {
        token,
        userId,
        handler: await restrictedAccessTokenMethods[method](params),
        method,
        params,
        expires: Date.now() + 120 * 1000
    };

    restrictedAccessTokens.set(token, tokenEntry);

    return token;
}

async function refreshRestrictedAccessToken(context, token) {
    const tokenEntry = restrictedAccessTokens.get(token);

    if (tokenEntry && tokenEntry.userId === context.user.id) {
        tokenEntry.expires = Date.now() + 120 * 1000
    } else {
        shares.throwPermissionDenied();
    }
}

async function getByRestrictedAccessToken(token) {
    const now = Date.now();
    for (const entry of restrictedAccessTokens.values()) {
        if (entry.expires < now) {
            restrictedAccessTokens.delete(entry.token);
        }
    }

    const tokenEntry = restrictedAccessTokens.get(token);

    if (tokenEntry) {
        const user = await getById(contextHelpers.getAdminContext(), tokenEntry.userId);
        user.restrictedAccessMethod = tokenEntry.method;
        user.restrictedAccessHandler = tokenEntry.handler;
        user.restrictedAccessToken = tokenEntry.token;
        user.restrictedAccessParams = tokenEntry.params;

        return user;

    } else {
        shares.throwPermissionDenied();
    }
}


module.exports.listDTAjax = listDTAjax;
module.exports.remove = remove;
module.exports.updateWithConsistencyCheck = updateWithConsistencyCheck;
module.exports.create = create;
module.exports.createTx = createTx;
module.exports.hash = hash;
module.exports.getById = getById;
module.exports.serverValidate = serverValidate;
module.exports.getByAccessToken = getByAccessToken;
module.exports.getByUsername = getByUsername;
module.exports.getByUsernameTx = getByUsernameTx;
module.exports.getByUsernameIfPasswordMatch = getByUsernameIfPasswordMatch;
module.exports.getAccessToken = getAccessToken;
module.exports.resetAccessToken = resetAccessToken;
module.exports.sendPasswordReset = sendPasswordReset;
module.exports.isPasswordResetTokenValid = isPasswordResetTokenValid;
module.exports.resetPassword = resetPassword;
module.exports.getByRestrictedAccessToken = getByRestrictedAccessToken;
module.exports.getRestrictedAccessToken = getRestrictedAccessToken;
module.exports.refreshRestrictedAccessToken = refreshRestrictedAccessToken;
module.exports.registerRestrictedAccessTokenMethod = registerRestrictedAccessTokenMethod;
