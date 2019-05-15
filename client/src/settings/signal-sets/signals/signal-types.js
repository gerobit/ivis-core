'use strict';
import {SignalType} from "../../../../../shared/signals";

export function getSignalTypes(t) {
    return {
        [SignalType.INTEGER]: t('Integer'),
        [SignalType.LONG]: t('Long'),
        [SignalType.FLOAT]: t('Float'),
        [SignalType.DOUBLE]: t('Double'),
        [SignalType.BOOLEAN]: t('Boolean'),
        [SignalType.KEYWORD]: t('Keyword'),
        [SignalType.TEXT]: t('Text'),
        [SignalType.DATE_TIME]: t('Date/Time'),
        [SignalType.PAINLESS]: t('Painless Script'),
        [SignalType.PAINLESS_DATE_TIME]: t('Painless Script returning Date/Time')
    }
}