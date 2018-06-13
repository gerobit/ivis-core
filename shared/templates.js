'use strict';

const TemplateType = {
    JSX: 'jsx'
};

function parseCardinality(card) {
    if (!card) {
        return {min: 1, max: 1};
    }

    const matches = card.match(/(([0-9]+)[ ]*[.]{2}[ ]*)?([0-9]+|n)/);
    let min = matches[2];
    let max = matches[3];

    if (max === 'n') {
        max = Number.MAX_VALUE;

        if (min === undefined) {
            min = 0;
        } else {
            min = parseInt(min);
        }
    } else {
        max = parseInt(max);

        if (min === undefined) {
            min = max;
        } else {
            min = parseInt(min);
        }
    }

    return { min, max };
}

function resolveAbs(parent, path) {
    let parentElems = parent.split('/');
    parentElems.pop();

    const pathElems = path.split('/'); // parent always ends with slash

    if (pathElems.length > 0 && pathElems[0] === '') { // path is absolute
        parentElems = pathElems;
    } else {
        for (const el of pathElems) {
            if (el === '..') {
                if (parentElems.length > 1) { // We require the parent path to always start with '' (i.e. it is absolute)
                    parentElems.pop();
                } else {
                    throw new Exception(`Invalid path ${path}`);
                }
            } else {
                parentElems.push(el);
            }
        }
    }

    return parentElems.join('/');
}

const getFieldsetPrefix = (prefix, spec, idx) => {
    return resolveAbs(prefix, spec.id + '/' + (idx !== undefined ? `[${idx}]/` : ''));
};


module.exports = {
    TemplateType,
    parseCardinality,
    resolveAbs,
    getFieldsetPrefix
};