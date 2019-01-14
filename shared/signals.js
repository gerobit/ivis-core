'use strict';

const moment = require('moment');


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
    deserializeFromDb,
    serializeToDb
};
