'use strict';
import {BuildState} from "../../../../shared/tasks";

export function getBuildStates(t) {
    return {
        [BuildState.PROCESSING]: t('Processing'),
        [BuildState.SCHEDULED]: t('Scheduled'),
        [BuildState.FAILED]: t('Failed'),
        [BuildState.FINISHED]: t('Success'),
        [BuildState.UNINITIALIZED]: t('Uninitialized'),
        [BuildState.INITIALIZING]: t('Initializing'),
    }
}

