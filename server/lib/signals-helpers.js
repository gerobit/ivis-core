'use strict';

const getDSName = (signalName, type) => type + '_' + signalName;

const RecordType = {
    AGG: 'agg',
    VAL: 'val'
};


module.exports = {
    getDSName,
    RecordType
};