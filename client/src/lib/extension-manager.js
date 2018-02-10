"use strict";

const confObjects = new Map();
const hooks = new Map();

function set(name, service) {
    confObjects.set(name, service);
}

function get(name, defaultValue) {
    return confObjects.get(name) || defaultValue
}

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
    get,
    on,
    invoke,
    invokeAsync
}