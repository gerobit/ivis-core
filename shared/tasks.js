'use strict';


const TaskType = {
    NUMPY: 'numpy',
    PYTHON: 'python'
};

if (Object.freeze) {
    Object.freeze(TaskType)
}

const BuildState = {
    SCHEDULED: 0,
    PROCESSING: 1,
    FINISHED: 2,
    FAILED: 3,
    UNINITIALIZED: 4,
    INITIALIZING: 5
};

if (Object.freeze) {
    Object.freeze(BuildState)
}

function getFinalStates() {
    return [BuildState.FINISHED, BuildState.FAILED, BuildState.UNINITIALIZED, BuildState.MAX];
}

function getTransitionStates() {
    return [BuildState.INITIALIZING, BuildState.PROCESSING, BuildState.SCHEDULED];
}

function isTransitionState(state) {
    return getTransitionStates().includes(state);
}

module.exports = {
    TaskType,
    BuildState,
    getFinalStates,
    getTransitionStates,
    isTransitionState
};