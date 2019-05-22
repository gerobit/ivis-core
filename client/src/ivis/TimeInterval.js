'use strict';

import moment
    from "moment";
import * as dateMath
    from "../lib/datemath";

const defaultChartWidth = 1000;

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

export function defaultGetMinAggregationInterval(minPointDistance = 0) {
    return (intv, absFrom, absTo) => {
        const dif = (absTo - absFrom) / (intv.conf.chartWidth || defaultChartWidth);

        if (dif * 10 <= minPointDistance) { // individual points should be at least 10 pixels apart
            return moment.duration(0, 's');
        }

        const bucketSize = dif * 2; // minimal allowed bucket size in milliseconds (2 pixels per data point)

        return predefAggregationIntervals.find(x => bucketSize <= x) || predefAggregationIntervals[predefAggregationIntervals.length - 1];
    }
}


export class IntervalSpec {
    constructor(from, to, aggregationInterval, refreshInterval) {
        this.from = from;
        this.to = to;
        this.aggregationInterval = aggregationInterval; /* null means auto, moment.duration(0, 's') means no aggregation */
        this.refreshInterval = refreshInterval;
    }

    exportData() {
        return {
            from: this.from,
            to: this.to,
            aggregationInterval: this.aggregationInterval && this.aggregationInterval.toISOString(),
            refreshInterval: this.refreshInterval && this.refreshInterval.toISOString()
        }
    }

    static fromExportedData(exportedData) {
        return new IntervalSpec(
            exportedData.from,
            exportedData.to,
            exportedData.aggregationInterval && moment.duration(exportedData.aggregationInterval),
            exportedData.refreshInterval && moment.duration(exportedData.refreshInterval)
        );
    }

    freeze() {
        const {from, to} = this.getAbsoluteFromTo();

        return new IntervalSpec(
            from.toISOString(),
            to.toISOString(),
            this.aggregationInterval,
            this.refreshInterval
        );
    }

    getAbsoluteFromTo() {
        const from = dateMath.parse(this.from, false);
        const to = dateMath.parse(this.to, true);

        return {from, to};
    }
}

export class IntervalAbsolute {
    constructor(from, to, aggregationInterval) {
        this.from = from;
        this.to = to;
        this.aggregationInterval = aggregationInterval; /* null means auto, moment.duration(0, 's') means no aggregation */
    }

    exportData() {
        return {
            from: this.from.toISOString(),
            to: this.to.toISOString(),
            aggregationInterval: this.aggregationInterval.toISOString()
        }
    }

    static fromExportedData(exportedData) {
        return new IntervalSpec(
            moment(exportedData.from),
            moment(exportedData.to),
            exportedData.aggregationInterval && moment.duration(exportedData.aggregationInterval)
        );
    }
}

export class IntervalHistory {
    constructor(specs, idx) {
        this.specs = specs;
        this.idx = idx;
    }
}

export class TimeInterval {
    constructor(onChange, data) {
        this.started = false;

        this.refreshTimeout = null;

        this.onChange = onChange;


        if (data && data.conf) {
            this.conf = data.conf;
        } else {
            this.conf = {};
        }

        if (!this.conf.getMinAggregationInterval) {
            this.conf.getMinAggregationInterval = defaultGetMinAggregationInterval();
        }

        if (!this.conf.chartWidth) {
            this.conf.chartWidth = 0;
        }


        if (data) {
            this.spec = data.spec;

            if (data.history) {
                this.history = data.history;
            }
        } else {
            this.spec = new IntervalSpec('now-6h', 'now', null /* null means auto */, moment.duration(1, 'm'));
        }

        if (!this.history) {
            this.history = {
                idx: 0,
                specs: [ this. spec ]
            };
        }

        if (data && data.absolute) {
            this.absolute = data.absolute;
        } else {
            this._computeAbsolute();
        }
    }

    exportData() {
        return {
            conf: {
                chartWidth: this.conf.chartWidth
            },
            spec: this.spec.exportData()
        };
    }

    static fromExportedData(onChange, exportedData) {
        const data = {
            conf: exportedData.conf,
            spec: IntervalSpec.fromExportedData(exportedData.spec)
        };

        return new TimeInterval(onChange, data);
    }

    freeze() {
        const intv = this.clone();
        intv.spec = intv.spec.freeze();

        return intv;
    }

    start() {
        this.started = true;
        this._scheduleRefreshTimeout();
    }

    stop() {
        this.started = false;
        clearTimeout(this.refreshTimeout);
    }

    setSpec(spec, replaceHistory = false) {
        const intv = this.clone();

        intv.spec = new IntervalSpec(
            spec.from !== undefined ? spec.from : this.spec.from,
            spec.to !== undefined ? spec.to : this.spec.to,
            spec.aggregationInterval !== undefined ? spec.aggregationInterval : this.spec.aggregationInterval,
            spec.refreshInterval !== undefined ? spec.refreshInterval : this.spec.refreshInterval
        );

        let specs;
        if (replaceHistory) {
            specs = intv.history.specs.slice(0, intv.history.idx);
        } else {
            specs = intv.history.specs.slice(0, intv.history.idx + 1);
        }

        specs.push(spec);
        intv.history = new IntervalHistory(specs, specs.length - 1);

        clearTimeout(this.refreshTimeout);
        if (this.started) {
            intv.start();
        }

        intv._computeAbsolute();
        intv._notifyChange('spec');

        return intv;
    }

    setConf(conf) {
        const intv = this.clone();
        Object.assign(intv.conf, conf);

        clearTimeout(this.refreshTimeout);
        if (this.started) {
            intv.start();
        }

        intv._computeAbsolute();
        intv._notifyChange('absolute');

        return intv;
    }

    refresh() {
        const intv = this.clone();

        clearTimeout(this.refreshTimeout);
        if (this.started) {
            intv.start();
        }

        intv._computeAbsolute();
        intv._notifyChange('absolute');

        return intv;
    }

    goBack() {
        if (this.history.idx > 0) {
            const intv = this.clone();

            intv.history = new IntervalHistory(intv.history.specs, intv.history.idx - 1);

            intv.spec = intv.history.specs[intv.history.idx];

            clearTimeout(this.refreshTimeout);
            if (this.started) {
                intv.start();
            }

            intv._computeAbsolute();
            intv._notifyChange('spec');

            return intv;
        } 
        
        return this;
    }

    goForward() {
        if (this.history.idx < this.history.specs.length - 1) {
            const intv = this.clone();

            intv.history = new IntervalHistory(intv.history.specs, intv.history.idx + 1);

            intv.spec = intv.history.specs[intv.history.idx];

            clearTimeout(this.refreshTimeout);
            if (this.started) {
                intv.start();
            }

            intv._computeAbsolute();
            intv._notifyChange('spec');
        }
        
        return this;
    }

    clone() {
        return new TimeInterval(this.onChange, this);
    }


    getMinAggregationInterval(absFrom, absTo) {
        return this.conf.getMinAggregationInterval(this, absFrom, absTo);
    }

    roundToMinAggregationInterval(absFrom, absTo) {
        const minAggInterval = this.getMinAggregationInterval(absFrom, absTo);
        if (minAggInterval.valueOf() === 0) {
            return {from: moment(absFrom), to: moment(absTo)};
        } else {
            const from = moment(Math.round(absFrom / minAggInterval) * minAggInterval);
            const to = moment(Math.round(absTo / minAggInterval) * minAggInterval);

            return {from, to};
        }
    }


    _computeAbsolute() {
        const {from, to} = this.spec.getAbsoluteFromTo();

        const minAggregationInterval = this.getMinAggregationInterval(from, to);

        let aggregationInterval;
        if (this.spec.aggregationInterval === null ||
            (this.spec.aggregationInterval.valueOf() !== 0 && this.spec.aggregationInterval < minAggregationInterval)) {
            aggregationInterval = minAggregationInterval;
        } else {
            aggregationInterval = this.spec.aggregationInterval;
        }

        this.absolute = new IntervalAbsolute(from, to, aggregationInterval);
    }

    _scheduleRefreshTimeout() {
        if (this.started && this.spec.refreshInterval) {
            this.refreshTimeout = setTimeout(() => {
                const intv = this.clone();
                intv.started = this.started;
                intv._computeAbsolute();
                intv._notifyChange('absolute');
                intv._scheduleRefreshTimeout();
            }, this.spec.refreshInterval.asMilliseconds());
        }
    }

    _notifyChange(type) {
        if (this.started) {
            if (this.onChange) {
                this.onChange(type, this);
            }
        }
    }
}
