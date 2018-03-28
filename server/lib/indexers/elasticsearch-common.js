'use strict';

// Gets the name of an index for a signal set
function getIndexName(cid){
    return 'signal_set_' + cid;
}

function getTableName(cid){
    return 'signal_set_' + cid;
}

const columnPrefixes = ['val_', 'max_', 'min_', 'avg_'];
// Gets a map from table columns to index document properties
async function getColumnMap(tx, cid){
    const columns = await tx('signals')
        .innerJoin('signal_sets', 'signal_sets.id', 'signals.set')
        .where('signal_sets.cid', cid)
        .select('signals.id', 'signals.cid');

    const signalMap = {ts: 'ts', first_ts: 'first_ts', last_ts: 'last_ts'};
    for(const column of columns){
        for(const prefix of columnPrefixes){
            signalMap[prefix + column.cid] = prefix + column.cid + '_' + column.id;
        }
    }
    return signalMap;
}


// Converts an table row to an elasticsearch document
function convertRecord(dbRecord, columnMap){
    const esDoc = {};
    for(const column in dbRecord){
        const mapped = columnMap[column];
        if(mapped){
            esDoc[mapped] = dbRecord[column];
        }
    }
    return esDoc;
}

// Convert records to elasticsearch bulk insert commands
function convertRecordsToBulk(records, indexName, columnMap){
    const bulk = [];

    for(const record of records){
        bulk.push({index:{_index: indexName, _type: 'doc'}});
        bulk.push(convertRecord(record, columnMap));
    }

    return bulk;
}

module.exports = {
    getIndexName,
    getTableName,
    getColumnMap,
    convertRecordsToBulk
};