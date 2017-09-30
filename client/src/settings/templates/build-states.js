'use strict';
import {BuildState} from "../../../../shared/build";

export function getBuildStates(t) {
    return {
        [BuildState.PROCESSING]: t('Processing'),
        [BuildState.SCHEDULED]: t('Scheduled'),
        [BuildState.FAILED]: t('Failed'),
        [BuildState.FINISHED]: t('Success')
    }
}