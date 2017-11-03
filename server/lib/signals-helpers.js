'use strict';

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
    DerivedSignalType
};