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

const DerivedSignalType = {
    PAINLESS: SignalType.PAINLESS
}


module.exports = {
    SignalType,
    DerivedSignalType
};