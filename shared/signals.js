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
    DATE: 'raw_date',
    PAINLESS: 'derived_painless'
};

const RawSignalType = {
    INTEGER: SignalType.INTEGER,
    LONG: SignalType.LONG,
    FLOAT: SignalType.FLOAT,
    DOUBLE: SignalType.DOUBLE,
    BOOLEAN: SignalType.BOOLEAN,
    KEYWORD: SignalType.KEYWORD,
    DATE: SignalType.DATE
};

const DerivedSignalType = {
    PAINLESS: SignalType.PAINLESS
};


module.exports = {
    SignalType,
    DerivedSignalType,
    getMinAggregationInterval,
    roundToMinAggregationInterval
};