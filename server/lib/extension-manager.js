"use strict";

const confObjects = new Map();
const hooks = new Map();

module.exports.set = (name, service) => {
    confObjects.set(name, service);
};

module.exports.setDefault = (name, service) => {
    if (!confObjects.has(name)) {
        confObjects.set(name, service);
    }
};

module.exports.get = (name, defaultValue) => {
    if (confObjects.has(name)) {
        return confObjects.get(name)
    } else {
        if (defaultValue !== undefined) {
            return defaultValue;
        } else {
            throw new Error(`Undefined value for "${name}" and default not provided`);
        }
    }
};

module.exports.on = (name, callback) => {
    let listeners = hooks.get(name);

    if (!listeners) {
        listeners = [];
        hooks.set(name, listeners);
    }

    listeners.push(callback);
};

module.exports.invoke = (name, ...args) => {
    let listeners = hooks.get(name);

    if (listeners) {
        for (const listener of listeners) {
            listener(...args);
        }
    }
};

module.exports.invokeAsync = async (name, ...args) => {
    let listeners = hooks.get(name);

    if (listeners) {
        for (const listener of listeners) {
            await listener(...args);
        }
    }
};