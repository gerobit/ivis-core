"use strict";

import ivisConfig from "ivisConfig";

const builtinTemplates = ivisConfig.builtinTemplates;

export function getBuiltinTemplates() {
    return builtinTemplates;
}

export function getBuiltinTemplate(key) {
    return builtinTemplates[key];
}

export function getBuiltinTemplateName(key, t) {
    const builtinTemplate = builtinTemplates[key];

    if (builtinTemplate) {
        return t(builtinTemplate.name);
    } else {
        return null;
    }
}

export function anyBuiltinTemplate() {
    return Object.keys(builtinTemplates).length !== 0;
}