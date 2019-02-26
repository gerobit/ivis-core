"use strict";

const confObjects = new Map();
const hooks = new Map();

function set(name, service) {
    confObjects.set(name, service);
}

function setDefault(name, service) {
    if (!confObjects.has(name)) {
        confObjects.set(name, service);
    }
};

function get(name, defaultValue) {
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

function on(name, callback) {
    let listeners = hooks.get(name);

    if (!listeners) {
        listeners = [];
        hooks.set(name, listeners);
    }

    listeners.push(callback);
}

function invoke(name, ...args) {
    let listeners = hooks.get(name);

    if (listeners) {
        for (const listener of listeners) {
            listener(...args);
        }
    }
}

async function invokeAsync(name, ...args) {
    let listeners = hooks.get(name);

    if (listeners) {
        for (const listener of listeners) {
            await listener(...args);
        }
    }
}

export default {
    set,
    setDefault,
    get,
    on,
    invoke,
    invokeAsync
}