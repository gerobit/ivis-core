'use strict';

import React, {Component} from "react";
import moment from "moment";
import axios from "../lib/axios";
import {withErrorHandling, withAsyncErrorHandler} from "../lib/error-handling";
import {withIntervalAccess} from "../ivis/TimeContext";
import PropTypes from "prop-types";
import {getUrl} from "../lib/urls";
import {IntervalAbsolute} from "./TimeInterval";

// How many aggregationIntervals before and after an absolute interval is search for prev/next values. This is used only in aggregations to avoid unnecessary aggregations.
const prevNextSize = 100;

export function forAggs(signals, fn) {
    const result = {};
    const aggs = Object.keys(signals[0]);
    for (const agg of aggs) {
        result[agg] = fn(...signals.map(d => d[agg]));
    }

    return result;
}


export const TimeSeriesPointType = {
    LTE: 'lte',
    LT: 'lt',
    GT: 'gt',
    GTE: 'gte'
};

class DataAccess {
    constructor() {
        this.resetFetchQueue();
        this.cache = {};
    }

    async query(queries) {
        const fetchTaskData = this.fetchTaskData;
        const startIdx = fetchTaskData.reqData.length;

        fetchTaskData.reqData.push(...queries);

        this.scheduleFetchTask();

        const resData = await fetchTaskData.promise;

        return resData.slice(startIdx, startIdx + queries.length);
    }


    /*
      sigSets = {
        [sigSetCid]: {
          tsSigCid: 'ts',
          signals: [sigCid]
        }
      }
    */
    async getTimeSeriesPoint(sigSets, ts, timeseriesPointType = TimeSeriesPointType.LT) {
        const reqData = [];

        for (const sigSetCid in sigSets) {
            const sigSet = sigSets[sigSetCid];
            const tsSig = sigSet.tsSigCid || 'ts';

            const qry = {
                sigSetCid,
                ranges: [
                    {
                        sigCid: tsSig,
                        [timeseriesPointType]: ts.toISOString()
                    }
                ]
            };


            const signals = [tsSig, ...sigSet.signals];

            qry.docs = {
                signals,
                sort: [
                    {
                        sigCid: tsSig,
                        order: (timeseriesPointType === TimeSeriesPointType.LT || timeseriesPointType === TimeSeriesPointType.LTE) ? 'desc' : 'asc'
                    },
                ],
                limit: 1
            };

            reqData.push(qry);
        }

        const responseData = await this.query(reqData);

        const result = {};
        let idx = 0;
        for (const sigSetCid in sigSets) {
            const sigSetRes = responseData[idx];
            const sigSet = sigSets[sigSetCid];
            const tsSig = sigSet.tsSigCid || 'ts';

            if (sigSetRes.docs.length > 0) {
                const doc = sigSetRes.docs[0];

                const data = {};
                for (const sigCid of sigSet.signals) {
                    data[sigCid] = doc[sigCid];
                }

                result[sigSetCid] = {
                    ts: moment(doc[tsSig]),
                    data: data
                }
            }

            idx += 1;
        }

        return result;
    }

    /*
      sigSets = {
        [sigSetCid]: {
          tsSigCid: 'ts',
          signals: {
            [sigCid]: [aggs]
          }
        }
      }
    */
    async getTimeseries(sigSets, intervalAbsolute) {
        const reqData = [];

        const fetchDocs = intervalAbsolute.aggregationInterval && intervalAbsolute.aggregationInterval.valueOf() === 0;

        for (const sigSetCid in sigSets) {
            const sigSet = sigSets[sigSetCid];
            const tsSig = sigSet.tsSigCid || 'ts';

            const prevQry = {
                sigSetCid,
                ranges: [
                    {
                        sigCid: tsSig,
                        lt: intervalAbsolute.from.toISOString()
                    }
                ]
            };

            const mainQry = {
                sigSetCid,
                ranges: [
                    {
                        sigCid: tsSig,
                        gte: intervalAbsolute.from.toISOString(),
                        lt: intervalAbsolute.to.toISOString()
                    }
                ]
            };

            const nextQry = {
                sigSetCid,
                ranges: [
                    {
                        sigCid: tsSig,
                        gte: intervalAbsolute.to.toISOString()
                    }
                ]
            };


            if (fetchDocs) {
                const signals = [tsSig, ...Object.keys(sigSet.signals)];

                prevQry.docs = {
                    signals,
                    sort: [
                        {
                            sigCid: tsSig,
                            order: 'desc'
                        },
                    ],
                    limit: 1
                };

                mainQry.docs = {
                    signals,
                };

                nextQry.docs = {
                    signals,
                    sort: [
                        {
                            sigCid: tsSig,
                            order: 'asc'
                        },
                    ],
                    limit: 1
                };

            } else {
                const sigs = {};

                prevQry.ranges[0].gte = moment(intervalAbsolute.from).subtract(intervalAbsolute.aggregationInterval * prevNextSize).toISOString();
                nextQry.ranges[0].lt = moment(intervalAbsolute.from).add(intervalAbsolute.aggregationInterval * prevNextSize).toISOString();

                for (const sigCid in sigSet.signals) {
                    const sig = sigSet.signals[sigCid];

                    if (Array.isArray(sig)) {
                        sigs[sigCid] = sig;
                    } else {
                        if (sig.mutate) {
                            sigs[sigCid] = sig.aggs;
                        }
                    }
                }

                const aggregationIntervalMs = intervalAbsolute.aggregationInterval.asMilliseconds();
                const offsetDuration = moment.duration(intervalAbsolute.from.valueOf() % aggregationIntervalMs);

                prevQry.aggs = [
                    {
                        sigCid: tsSig,
                        step: intervalAbsolute.aggregationInterval.toString(),
                        offset: offsetDuration.toString(),
                        minDocCount: 1,
                        signals: sigs,
                        order: 'desc',
                        limit: 1
                    }
                ];

                mainQry.aggs = [
                    {
                        sigCid: tsSig,
                        step: intervalAbsolute.aggregationInterval.toString(),
                        offset: offsetDuration.toString(),
                        minDocCount: 1,
                        signals: sigs
                    }
                ];

                nextQry.aggs = [
                    {
                        sigCid: tsSig,
                        step: intervalAbsolute.aggregationInterval.toString(),
                        offset: offsetDuration.toString(),
                        minDocCount: 1,
                        signals: sigs,
                        order: 'asc',
                        limit: 1
                    }
                ];
            }

            reqData.push(prevQry);
            reqData.push(mainQry);
            reqData.push(nextQry);
        }

        const responseData = await this.query(reqData);

        const result = {};
        let idx = 0;
        for (const sigSetCid in sigSets) {
            const sigSetResPrev = responseData[idx];
            const sigSetResMain = responseData[idx + 1];
            const sigSetResNext = responseData[idx + 2];

            const sigSet = sigSets[sigSetCid];
            const tsSig = sigSet.tsSigCid || 'ts';

            const processDoc = doc => {
                const data = {};
                for (const sigCid in sigSet.signals) {
                    const sig = sigSet.signals[sigCid];
                    const sigData = {};

                    let sigAggs;
                    if (Array.isArray(sig)) {
                        sigAggs = sig;
                    } else {
                        if (sig.mutate) {
                            sigAggs = sig.aggs;
                        }
                    }

                    for (const sigAgg of sigAggs) {
                        sigData[sigAgg] = doc[sigCid];
                    }

                    data[sigCid] = sigData;
                }

                return data;
            };

            const sigSetRes = {
                main: []
            };

            if (fetchDocs) {
                if (sigSetResPrev.docs.length > 0) {
                    const doc = sigSetResPrev.docs[0];
                    sigSetRes.prev = {
                        ts: moment(doc[tsSig]),
                        data: processDoc(doc)
                    }
                }

                for (const doc of sigSetResMain.docs) {
                    sigSetRes.main.push({
                        ts: moment(doc[tsSig]),
                        data: processDoc(doc)
                    });
                }

                if (sigSetResNext.docs.length > 0) {
                    const doc = sigSetResNext.docs[0];
                    sigSetRes.next = {
                        ts: moment(doc[tsSig]),
                        data: processDoc(doc)
                    }
                }

            } else {
                if (sigSetResPrev.aggs[0].length > 0) {
                    const agg = sigSetResPrev.aggs[0][0];
                    sigSetRes.prev = {
                        ts: moment(agg.key),
                        data: agg.values
                    }
                }

                for (const agg of sigSetResMain.aggs[0]) {
                    sigSetRes.main.push({
                        ts: moment(agg.key),
                        data: agg.values
                    });
                }

                if (sigSetResNext.aggs[0].length > 0) {
                    const agg = sigSetResNext.aggs[0][0];
                    sigSetRes.prev = {
                        ts: moment(agg.key),
                        data: agg.values
                    }
                }
            }

            for (const sigCid in sigSet.signals) {
                const sig = sigSet.signals[sigCid];

                if (!Array.isArray(sig)) {
                    if (sig.generate) {
                        if (sigSetRes.prev) {
                            sigSetRes.prev.data[sigCid] = sig.generate(sigSetRes.prev.ts, sigSetRes.prev.data);
                        }

                        if (sigSetRes.next) {
                            sigSetRes.next.data[sigCid] = sig.generate(sigSetRes.next.ts, sigSetRes.next.data);
                        }

                        for (const mainRes of sigSetRes.main) {
                            mainRes.data[sigCid] = sig.generate(mainRes.ts, mainRes.data);
                        }

                    } else if (sig.mutate) {
                        if (sigSetRes.prev) {
                            sigSetRes.prev.data[sigCid] = sig.mutate(sigSetRes.prev.data[sigCid], sigSetRes.prev.ts, sigSetRes.prev.data);
                        }

                        if (sigSetRes.next) {
                            sigSetRes.next.data[sigCid] = sig.mutate(sigSetRes.next.data[sigCid], sigSetRes.next.ts, sigSetRes.next.data);
                        }

                        for (const mainRes of sigSetRes.main) {
                            mainRes.data[sigCid] = sig.mutate(mainRes.data[sigCid], mainRes.ts, mainRes.data);
                        }
                    }
                }
            }

            result[sigSetCid] = sigSetRes;
            idx += 3;
        }

        return result;
    }


    /* Private methods */
    resetFetchQueue() {
        const fetchTaskData = {};

        fetchTaskData.scheduled = false;
        fetchTaskData.reqData = [];
        fetchTaskData.promise = new Promise((resolve, reject) => {
            fetchTaskData.successful = resolve;
            fetchTaskData.failed = reject;
        });

        this.fetchTaskData = fetchTaskData;
    }

    scheduleFetchTask() {
        if (!this.fetchTaskData.scheduled) {
            this.fetchTaskData.scheduled = true;
            setTimeout(() => this.executeFetchTask(), 0);
        }
    }

    async executeFetchTask() {
        const fetchTaskData = this.fetchTaskData;
        this.resetFetchQueue();

        try {
            const response = await axios.post(getUrl('rest/signals-query'), fetchTaskData.reqData);

            const signalsData = response.data;
            fetchTaskData.successful(signalsData);
        } catch (err) {
            fetchTaskData.failed(err);
        }
    }
}

export const dataAccess = new DataAccess();

export class DataAccessSession {
    constructor() {
        this.requestNos = {};
    }

    async _getLatest(type, fn) {
        this.requestNos[type] = (this.requestNos[type] || 0) + 1;

        const requestNo = this.requestNos[type];

        const result = await fn();

        if (requestNo == this.requestNos[type]) {
            return result;
        } else {
            return null;
        }
    }

    async getLatestTimeSeriesPoint(sigSets, ts, timeseriesPointType = TimeSeriesPointType.LTE) {
        return await this._getLatest('timeseriesPoint', async () => await dataAccess.getTimeSeriesPoint(sigSets, ts, timeseriesPointType));
    }

    async getLatestTimeseries(sigSets, intervalAbsolute) {
        return await this._getLatest('timeseries', async () => await dataAccess.getTimeseries(sigSets, intervalAbsolute));
    }
}

@withErrorHandling
@withIntervalAccess()
export class TimeSeriesProvider extends Component {
    constructor(props) {
        super(props);

        this.dataAccessSession = new DataAccessSession();
        this.state = {
            signalSetsData: null
        }
    }

    static propTypes = {
        intervalFun: PropTypes.func,
        signalSets: PropTypes.object.isRequired,
        renderFun: PropTypes.func.isRequired
    }

    static defaultProps = {
        intervalFun: intervalAbsolute => intervalAbsolute
    }

    componentWillReceiveProps(nextProps, nextContext) {
        const nextAbs = this.getIntervalAbsolute(nextProps, nextContext);
        if (nextAbs !== this.getIntervalAbsolute()) {
            this.fetchData(nextAbs);
        }
    }

    componentDidMount() {
        this.fetchData(this.getIntervalAbsolute());
    }

    @withAsyncErrorHandler
    async fetchData(abs) {
        try {
            const signalSetsData = await this.dataAccessSession.getLatestTimeseries(this.props.signalSets, this.props.intervalFun(this.getIntervalAbsolute));

            if (signalSetsData) {
                this.setState({
                    signalSetsData
                });
            }
        } catch (err) {
            throw err;
        }
    }

    render() {
        if (this.state.signalSetsData) {
            return this.props.renderFun(this.state.signalSetsData)
        } else {
            return null;
        }
    }
}

export const TimeSeriesPointPredefs = {
    CURRENT: {
        getTs: intv => moment(),
        pointType: TimeSeriesPointType.LTE
    }
};

@withErrorHandling
@withIntervalAccess()
export class TimeSeriesPointProvider extends Component {
    constructor(props) {
        super(props);

        this.dataAccessSession = new DataAccessSession();
        this.state = {
            signalSetsData: null
        }
    }

    static propTypes = {
        tsSpec: PropTypes.object,
        signalSets: PropTypes.object.isRequired,
        renderFun: PropTypes.func.isRequired
    }

    static defaultProps = {
        tsSpec: TimeSeriesPointPredefs.CURRENT
    }

    componentWillReceiveProps(nextProps, nextContext) {
        const nextAbs = this.getIntervalAbsolute(nextProps, nextContext);
        if (nextAbs !== this.getIntervalAbsolute()) {

            this.fetchData(nextAbs);
        }
    }

    componentDidMount() {
        this.fetchData(this.getIntervalAbsolute());
    }

    @withAsyncErrorHandler
    async fetchData(abs) {
        try {
            const ts = this.props.tsSpec.getTs(abs);
            const signalSetsData = await this.dataAccessSession.getLatestTimeSeriesPoint(this.props.signalSets, ts, this.props.tsSpec.pointType);

            if (signalSetsData) {
                this.setState({
                    signalSetsData
                });
            }
        } catch (err) {
            throw err;
        }
    }

    render() {
        if (this.state.signalSetsData) {
            return this.props.renderFun(this.state.signalSetsData)
        } else {
            return null;
        }
    }
}
