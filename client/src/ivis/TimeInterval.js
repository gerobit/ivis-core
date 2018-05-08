'use strict';

import moment from "moment";
import * as dateMath from "../lib/datemath";
import {getMinAggregationInterval} from "../../../shared/signals";

const autoMaxBuckets = 500;

export class IntervalSpec {
    constructor(from, to, aggregationInterval, refreshInterval) {
        this.from = from;
        this.to = to;
        this.refreshInterval = refreshInterval;
        this.aggregationInterval = aggregationInterval; /* null means auto, moment.duration(0, 's') means no aggregation */
    }
}

export class IntervalAbsolute {
    constructor(from, to, aggregationInterval) {
        this.from = from;
        this.to = to;
        this.aggregationInterval = aggregationInterval; /* null means auto, moment.duration(0, 's') means no aggregation */
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

        if (data) {
            this.spec = data.spec;

            if (data.history) {
                this.history = data.history;
            }
        } else {
            this.spec = new IntervalSpec('now-7d', 'now', null /* null means auto */, moment.duration(1, 'm'));
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

        if (data && 'started' in data) {
            this.started = data.started;
        }
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

        intv._computeAbsolute();
        intv._notifyChange('spec');

        clearTimeout(this.refreshTimeout);
        intv._scheduleRefreshTimeout();

        return intv;
    }

    refresh() {
        const intv = this.clone();

        intv._computeAbsolute();
        intv._notifyChange('absolute');

        clearTimeout(this.refreshTimeout);
        intv._scheduleRefreshTimeout();
        
        return intv;
    }

    goBack() {
        if (this.history.idx > 0) {
            const intv = this.clone();

            intv.history = new IntervalHistory(intv.history.specs, intv.history.idx - 1);

            intv.spec = intv.history.specs[intv.history.idx];

            intv._computeAbsolute();
            intv._notifyChange('spec');

            clearTimeout(this.refreshTimeout);
            intv._scheduleRefreshTimeout();

            return intv;
        } 
        
        return this;
    }

    goForward() {
        if (this.history.idx < this.history.specs.length - 1) {
            const intv = this.clone();

            intv.history = new IntervalHistory(intv.history.specs, intv.history.idx + 1);

            intv.spec = intv.history.specs[intv.history.idx];

            intv._computeAbsolute();
            intv._notifyChange('spec');

            clearTimeout(this.refreshTimeout);
            intv._scheduleRefreshTimeout();
        }
        
        return this;
    }

    clone() {
        return new TimeInterval(this.onChange, this);
    }
    
    _computeAbsolute() {
        const from = dateMath.parse(this.spec.from, false);
        const to = dateMath.parse(this.spec.to, true);

        const minAggregationInterval = getMinAggregationInterval(from, to, autoMaxBuckets)

        let aggregationInterval;
        if (this.spec.aggregationInterval === null ||
            (this.spec.aggregationInterval.valueOf() !== 0 && this.spec.aggregationInterval < aggregationInterval)) {
            aggregationInterval = minAggregationInterval;
        } else {
            aggregationInterval = this.spec.aggregationInterval;
        }

        this.absolute = new IntervalAbsolute(from, to, aggregationInterval);
    }

    _scheduleRefreshTimeout() {
        if (this.spec.refreshInterval) {
            this.refreshTimeout = setTimeout(() => {
                const intv = this.clone();
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
