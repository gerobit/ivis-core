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


module.exports = {
    TemplateType,
    parseCardinality
};