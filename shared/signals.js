'use strict';

const moment = require('moment');

const manualMaxBuckets = 2000;

const predefAggregationIntervals = [
    moment.duration(1, 'ms'),
    moment.duration(5, 'ms'),
    moment.duration(10, 'ms'),
    moment.duration(50, 'ms'),
    moment.duration(100, 'ms'),
    moment.duration(200, 'ms'),
    moment.duration(500, 'ms'),
    moment.duration(1, 's'),
    moment.duration(2, 's'),
    moment.duration(5, 's'),
    moment.duration(10, 's'),
    moment.duration(15, 's'),
    moment.duration(30, 's'),
    moment.duration(1, 'm'),
    moment.duration(2, 'm'),
    moment.duration(5, 'm'),
    moment.duration(10, 'm'),
    moment.duration(15, 'm'),
    moment.duration(30, 'm'),
    moment.duration(1, 'h'),
    moment.duration(2, 'h'),
    moment.duration(4, 'h'),
    moment.duration(6, 'h'),
    moment.duration(12, 'h'),
    moment.duration(1, 'd'),
    moment.duration(2, 'd'),
    moment.duration(5, 'd'),
    moment.duration(1, 'w'),
    moment.duration(2, 'w'),
    moment.duration(1, 'M')
];

function getMinAggregationInterval(absFrom, absTo, maxBuckets = manualMaxBuckets) {
    const dif = (absTo - absFrom) / maxBuckets; // minimal allowed bucket size in milliseconds

    return predefAggregationIntervals.find(x => dif <= x) || predefAggregationIntervals[predefAggregationIntervals.length - 1];
}

function roundToMinAggregationInterval(absFrom, absTo, maxBuckets = manualMaxBuckets) {
    const minAggInterval = getMinAggregationInterval(absFrom, absTo);
    const from = moment(Math.round(absFrom / minAggInterval) * minAggInterval);
    const to = moment(Math.round(absTo / minAggInterval) * minAggInterval);

    return {from, to};
}


const SignalType = {
    INTEGER: 'raw_integer',
    LONG: 'raw_long',
    FLOAT: 'raw_float',
    DOUBLE: 'raw_double',
    BOOLEAN: 'raw_boolean',
    KEYWORD: 'raw_keyword',
    DATE_TIME: 'raw_date',
    PAINLESS: 'derived_painless'
};

const RawSignalTypes = new Set([SignalType.INTEGER, SignalType.LONG, SignalType.FLOAT, SignalType.DOUBLE, SignalType.BOOLEAN, SignalType.KEYWORD, SignalType.DATE_TIME]);
const DerivedSignalTypes = new Set([SignalType.PAINLESS]);
const AllSignalTypes = new Set([...RawSignalTypes, ...DerivedSignalTypes]);


const deserializeFromDb = {
    [SignalType.INTEGER]: x => x,
    [SignalType.LONG]: x => x,
    [SignalType.FLOAT]: x => x,
    [SignalType.DOUBLE]: x => x,
    [SignalType.BOOLEAN]: x => x,
    [SignalType.KEYWORD]: x => x,
    [SignalType.DATE_TIME]: x => moment.utc(x).toDate()
};

const serializeToDb = {
    [SignalType.INTEGER]: x => x,
    [SignalType.LONG]: x => x,
    [SignalType.FLOAT]: x => x,
    [SignalType.DOUBLE]: x => x,
    [SignalType.BOOLEAN]: x => x,
    [SignalType.KEYWORD]: x => x,
    [SignalType.DATE_TIME]: x => moment(x).format('YYYY-MM-DD HH:mm:ss.SSS')
};


const IndexingStatus = {
    READY: 0, // The index is in sync with the data
    REQUIRED: 1, // The index is out of sync with the data
    RUNNING: 2, // The index is currently being created, or indexer crashed during reindex
    SCHEDULED: 3, // The indexer is asked to update the index
};

const IndexMethod = {
    INCREMENTAL: 0,
    FULL: 1
};

module.exports = {
    SignalType,
    AllSignalTypes,
    RawSignalTypes,
    DerivedSignalTypes,
    IndexingStatus,
    IndexMethod,
    getMinAggregationInterval,
    roundToMinAggregationInterval,
    deserializeFromDb,
    serializeToDb
};
