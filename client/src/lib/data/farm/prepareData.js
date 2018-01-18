function readingToPercent(r) {
    let v = 0;
    const reading = parseFloat(r);

    if (reading <= 100)
        v = 100;
    else if (reading <= 500)
        v = 120 - 0.2 * reading;
    else
        v = 40 - 0.04 * reading;

    return v;
}

/*
WS_FARM1_Sensor2:prev:data:SM1:{min: 957, max: 957, avg: 957} */
function prepareDataFun(data) {
    for(const sigSet in data) {
        const sigSetEntry = data[sigSet];
        //console.log(sigSetEntry);
        if(sigSetEntry.hasOwnProperty('prev') &&
            sigSetEntry.prev.hasOwnProperty('data'))
            for(const sig in sigSetEntry.prev.data) {
                sigSetEntry.prev.data[sig].min = readingToPercent(sigSetEntry.prev.data[sig].min);
                sigSetEntry.prev.data[sig].max = readingToPercent(sigSetEntry.prev.data[sig].max);
                sigSetEntry.prev.data[sig].avg = readingToPercent(sigSetEntry.prev.data[sig].avg);
            }
        
        if(sigSetEntry.hasOwnProperty('next') &&
            sigSetEntry.next.hasOwnProperty('data'))
            for(const sig in sigSetEntry.next.data) {
                sigSetEntry.next.data[sig].min = readingToPercent(sigSetEntry.next.data[sig].min);
                sigSetEntry.next.data[sig].max = readingToPercent(sigSetEntry.next.data[sig].max);
                sigSetEntry.next.data[sig].avg = readingToPercent(sigSetEntry.next.data[sig].avg);
            }
        
        if(sigSetEntry.hasOwnProperty('main'))
            for(const entry of sigSetEntry.main) {
                for(const sig in entry.data) {
                    entry.data[sig].min = readingToPercent(entry.data[sig].min);
                    entry.data[sig].max = readingToPercent(entry.data[sig].max);
                    entry.data[sig].avg = readingToPercent(entry.data[sig].avg);
                }
            }
    }

    return data;
}

module.exports = prepareDataFun