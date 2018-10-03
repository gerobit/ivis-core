'use strict';

module.exports = {
    enforce,
    filterObject,
    castToInteger
};

function enforce(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function filterObject(obj, allowedKeys) {
    const result = {};
    for (const key in obj) {
        if (allowedKeys.has(key)) {
            result[key] = obj[key];
        }
    }

    return result;
}

function castToInteger(id) {
    const val = parseInt(id);

    if (!Number.isInteger(val)) {
        throw new Error('Invalid id');
    }

    return val;
}