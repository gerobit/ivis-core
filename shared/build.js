'use strict';

const BuildState = {
    SCHEDULED: 0,
    PROCESSING: 1,
    FINISHED: 2,
    FAILED: 3,
    MAX: 4
};

module.exports = {
    BuildState
};