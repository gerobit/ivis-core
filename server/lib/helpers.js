'use strict';

function filterObject(obj, allowedKeys) {
    const result = {};
    for (const key in obj) {
        if (allowedKeys.has(key)) {
            result[key] = obj[key];
        }
    }

    return result;
}

function enforce(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}


module.exports = {
    filterObject,
    enforce
};
