'use strict';

import React, {Component} from "react";
import moment
    from "moment";
import axios
    from "../lib/axios";
import {
    withAsyncErrorHandler,
    withErrorHandling
} from "../lib/error-handling";
import {intervalAccessMixin} from "../ivis/TimeContext";
import PropTypes
    from "prop-types";
import {getUrl} from "../lib/urls";
import {withComponentMixins} from "../lib/decorator-helpers";
import interoperableErrors
    from "../../../shared/interoperable-errors";

// How many aggregationIntervals before and after an absolute interval is search for prev/next values. This is used only in aggregations to avoid unnecessary aggregations.
const prevNextSize = 100;
const docsLimitDefault = 1000;

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

        this.queryTypes = {
            timeSeriesPoint: {
                getQueries: ::this.getTimeSeriesPointQueries,
                processResults: ::this.processTimeSeriesPointResults
            },
            timeSeries: {
                getQueries: ::this.getTimeSeriesQueries,
                processResults: ::this.processTimeSeriesResults
            },
            timeSeriesSummary: {
                getQueries: ::this.getTimeSeriesSummaryQueries,
                processResults: ::this.processTimeSeriesSummaryResults

            }
        };
    }

    async query(queries) {
        const reqData = [];
        const segments = [];
        let reqDataIdx = 0;

        for (const hlQuery of queries) {
            const qry = this.queryTypes[hlQuery.type].getQueries(...hlQuery.args);
            segments.push({
                start: reqDataIdx,
                len: qry.length
            });

            reqData.push(...qry);
            reqDataIdx += qry.length;
        }


        const fetchTaskData = this.fetchTaskData;
        const startIdx = fetchTaskData.reqData.length;

        fetchTaskData.reqData.push(...reqData);
        this.scheduleFetchTask();

        const resData = await fetchTaskData.promise;

        const responseData = resData.slice(startIdx, startIdx + reqData.length);


        const results = [];
        for (let idx = 0; idx < queries.length; idx++) {
            const hlQuery = queries[idx];
            const segment = segments[idx];

            const res = this.queryTypes[hlQuery.type].processResults(responseData.slice(segment.start, segment.start + segment.len), ...hlQuery.args);

            results.push(res);
        }

        return results;
    }


    /*
      sigSets = {
        [sigSetCid]: {
          tsSigCid: 'ts',
          signals: [sigCid]
        }
      }
    */
    getTimeSeriesPointQueries(sigSets, ts, timeSeriesPointType) {
        const reqData = [];

        for (const sigSetCid in sigSets) {
            const sigSet = sigSets[sigSetCid];
            const tsSig = sigSet.tsSigCid || 'ts';

            const qry = {
                sigSetCid,
                ranges: [
                    {
                        sigCid: tsSig,
                        [timeSeriesPointType]: ts.toISOString()
                    }
                ]
            };


            const signals = [tsSig, ...sigSet.signals];

            qry.docs = {
                signals,
                sort: [
                    {
                        sigCid: tsSig,
                        order: (timeSeriesPointType === TimeSeriesPointType.LT || timeSeriesPointType === TimeSeriesPointType.LTE) ? 'desc' : 'asc'
                    },
                ],
                limit: 1
            };

            reqData.push(qry);
        }

        return reqData;
    }

    processTimeSeriesPointResults(responseData, sigSets, timeSeriesPointType) {
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
    getTimeSeriesQueries(sigSets, intervalAbsolute, docsLimit = docsLimitDefault) {
        const reqData = [];
        const fetchDocs = intervalAbsolute.aggregationInterval.valueOf() === 0;

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
                    sort: [
                        {
                            sigCid: tsSig,
                            order: 'asc'
                        },
                    ],
                    limit: docsLimit
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
                nextQry.ranges[0].lt = moment(intervalAbsolute.to).add(intervalAbsolute.aggregationInterval * prevNextSize).toISOString();

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
                const offsetFromDuration = moment.duration(intervalAbsolute.from.valueOf() % aggregationIntervalMs);
                const offsetToDuration = moment.duration(intervalAbsolute.to.valueOf() % aggregationIntervalMs);

                prevQry.aggs = [
                    {
                        sigCid: tsSig,
                        step: intervalAbsolute.aggregationInterval.toString(),
                        offset: offsetFromDuration.toString(),
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
                        offset: offsetFromDuration.toString(),
                        minDocCount: 1,
                        signals: sigs
                    }
                ];

                nextQry.aggs = [
                    {
                        sigCid: tsSig,
                        step: intervalAbsolute.aggregationInterval.toString(),
                        offset: offsetToDuration.toString(),
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

        return reqData;
    }

    processTimeSeriesResults(responseData, sigSets, intervalAbsolute, docsLimit = docsLimitDefault) {
        const result = {};
        const fetchDocs = intervalAbsolute.aggregationInterval && intervalAbsolute.aggregationInterval.valueOf() === 0;

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
                main: [],
                isAggregated: !fetchDocs
            };

            if (fetchDocs) {
                if (sigSetResPrev.docs.length > 0) {
                    const doc = sigSetResPrev.docs[0];
                    sigSetRes.prev = {
                        ts: moment(doc[tsSig]),
                        data: processDoc(doc)
                    }
                }

                if (sigSetResMain.total <= docsLimit) {
                    for (const doc of sigSetResMain.docs) {
                        sigSetRes.main.push({
                            ts: moment(doc[tsSig]),
                            data: processDoc(doc)
                        });
                    }
                } else {
                    throw new interoperableErrors.TooManyPointsError();
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
                    sigSetRes.next = {
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
    getTimeSeriesSummaryQueries(sigSets, intervalAbsolute) {
        const reqData = [];

        for (const sigSetCid in sigSets) {
            const sigSet = sigSets[sigSetCid];
            const tsSig = sigSet.tsSigCid || 'ts';

            const qry = {
                sigSetCid,
                ranges: [
                    {
                        sigCid: tsSig,
                        gte: intervalAbsolute.from.toISOString(),
                        lt: intervalAbsolute.to.toISOString()
                    }
                ]
            };

            qry.summary = {
                signals: sigSet.signals
            };

            reqData.push(qry);
        }

        return reqData;
    }

    processTimeSeriesSummaryResults(responseData, sigSets, intervalAbsolute) {
        const result = {};
        let idx = 0;
        for (const sigSetCid in sigSets) {
            const sigSetRes = responseData[idx];
            result[sigSetCid] = sigSetRes.summary;
            idx += 1;
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

    async _getLatestMultiple(type, queries) {
        this.requestNos[type] = (this.requestNos[type] || 0) + 1;

        const requestNo = this.requestNos[type];

        const results = await dataAccess.query(queries);

        if (requestNo == this.requestNos[type]) {
            return results;
        } else {
            return null;
        }
    }

    async _getLatestOne(type, ...args) {
        const results = await this._getLatestMultiple(type, [{ type, args }]);
        if (results) {
            return results[0];
        } else {
            return null;
        }
    }

    async getLatestTimeSeriesPoint(sigSets, ts, timeseriesPointType = TimeSeriesPointType.LTE) {
        return await this._getLatestOne('timeSeriesPoint', sigSets, ts, timeseriesPointType);
    }

    async getLatestTimeSeries(sigSets, intervalAbsolute) {
        return await this._getLatestOne('timeSeries', sigSets, intervalAbsolute);
    }

    async getLatestTimeSeriesSummary(sigSets, intervalAbsolute) {
        return await this._getLatestOne('timeSeriesSummary', sigSets, intervalAbsolute);
    }

    async getLatestMixed(queries) {
        return await this._getLatestMultiple('mixed', queries);
    }
}


@withComponentMixins([
    withErrorHandling,
    intervalAccessMixin()
])
class TimeSeriesDataProvider extends Component {
    constructor(props) {
        super(props);

        this.dataAccessSession = new DataAccessSession();
        this.state = {
            signalSetsData: null
        }
    }

    static propTypes = {
        fetchDataFun: PropTypes.func.isRequired,
        renderFun: PropTypes.func.isRequired
    }

    componentDidUpdate(prevProps) {
        const prevAbs = this.getIntervalAbsolute(prevProps);
        if (prevAbs !== this.getIntervalAbsolute()) {
            this.fetchData();
        }
    }

    componentDidMount() {
        this.fetchData();
    }

    @withAsyncErrorHandler
    async fetchData() {
        try {
            const signalSetsData = await this.props.fetchDataFun(this.dataAccessSession, this.getIntervalAbsolute());

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


export class TimeSeriesProvider extends Component {
    static propTypes = {
        intervalFun: PropTypes.func,
        signalSets: PropTypes.object.isRequired,
        renderFun: PropTypes.func.isRequired
    }

    static defaultProps = {
        intervalFun: intervalAbsolute => intervalAbsolute
    }

    render() {
        return (
            <TimeSeriesDataProvider
                fetchDataFun={async (dataAccessSession, intervalAbsolute) => await dataAccessSession.getLatestTimeSeries(this.props.signalSets, this.props.intervalFun(intervalAbsolute))}
                renderFun={this.props.renderFun}
            />
        );
    }
}

export class TimeSeriesSummaryProvider extends Component {
    static propTypes = {
        intervalFun: PropTypes.func,
        signalSets: PropTypes.object.isRequired,
        renderFun: PropTypes.func.isRequired
    }

    static defaultProps = {
        intervalFun: intervalAbsolute => intervalAbsolute
    }

    render() {
        return (
            <TimeSeriesDataProvider
                fetchDataFun={async (dataAccessSession, intervalAbsolute) => await dataAccessSession.getLatestTimeSeriesSummary(this.props.signalSets, this.props.intervalFun(intervalAbsolute))}
                renderFun={this.props.renderFun}
            />
        );
    }
}

export const TimeSeriesPointPredefs = {
    CURRENT: {
        getTs: intv => moment(),
        pointType: TimeSeriesPointType.LTE
    }
};

export class TimeSeriesPointProvider extends Component {
    static propTypes = {
        tsSpec: PropTypes.object,
        signalSets: PropTypes.object.isRequired,
        renderFun: PropTypes.func.isRequired
    }

    static defaultProps = {
        tsSpec: TimeSeriesPointPredefs.CURRENT
    }

    render() {
        return (
            <TimeSeriesDataProvider
                fetchDataFun={async (dataAccessSession, intervalAbsolute) => await dataAccessSession.getLatestTimeSeriesPoint(this.props.signalSets, this.props.tsSpec.getTs(intervalAbsolute), this.props.tsSpec.pointType)}
                renderFun={this.props.renderFun}
            />
        );
    }
}
