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

/*
  - parent === null means that the first element of path is to be interpreted as root (/)
  - except for the case above, the parent must always end with /
  - path must not be empty
 */
function resolveAbs(parent, path) {
    let result;
    if (parent === null) {
        const pathElems = path.split('/');
        pathElems.shift();

        if (pathElems.length === 0) {
            result = ['', ''];
        } else {
            result = ['', ...pathElems]
        }
    } else {
        result = parent.split('/');  // at this point parent always ends with slash
        result.pop();

        const pathElems = path.split('/');

        if (pathElems[0] === '') { // path is absolute
            result = pathElems;
        } else {
            for (const el of pathElems) {
                if (el === '..') {
                    if (result.length > 1) { // We require the parent path to always start with '' (i.e. it is absolute)
                        result.pop();
                    } else {
                        throw new Exception(`Invalid path ${path}`);
                    }
                } else {
                    result.push(el);
                }
            }
        }
    }

    return result.join('/');
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