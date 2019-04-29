'use strict';
import {JobState, RunStatus} from "../../../../shared/jobs";

export function getJobStates(t) {
    return {
        [JobState.DISABLED]: t('Disabled'),
        [JobState.ENABLED]: t('Enabled'),
        [JobState.INVALID_PARAMS]: t('Task parameters invalidated')
    }
}

export function getRunStatuses(t) {
    return {
        [RunStatus.SUCCESS]: t('Success'),
        [RunStatus.FAILED]: t('Failed'),
        [RunStatus.SCHEDULED]: t('Scheduled'),
        [RunStatus.RUNNING]: t('Running'),
        [RunStatus.INITIALIZATION]: t('Preparing')
    }
}