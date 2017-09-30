'use strict';

import moment from "moment";
import axios from "../lib/axios";
import { getRestUrl } from "../lib/access";

export class TimeseriesSource {
    constructor(signalCid, attrs = ['min', 'avg', 'max']) {
        this.cid = signalCid; // e.g. daf_turbidity
        this.attrs = attrs;
    }
}

class DataAccess {
    constructor() {
        this.resetFetchQueue();
        this.cache = {};
    }

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
            // const mainBuckets = [];

            const response = await axios.post(getRestUrl('/signals-query'), fetchTaskData.reqData);

            const signalsData = response.data;

            for (const signalData of signalsData) {
                if (signalData.prev) {
                    signalData.prev.ts = moment(signalData.prev.ts);
                }

                if (signalData.next) {
                    signalData.next.ts = moment(signalData.next.ts);
                }

                for (const entry of signalData.main) {
                    entry.ts = moment(entry.ts);
                }
            }

            fetchTaskData.successful(signalsData);
        } catch (err) {
            fetchTaskData.failed(err);
        }
    }

    async getSignals(tsSources, intervalAbsolute) {
        const reqData = tsSources.map(tsSource => ({
            cid: tsSource.cid,
            attrs: tsSource.attrs,
            interval: intervalAbsolute
        }));

        const fetchTaskData = this.fetchTaskData;
        const startIdx = fetchTaskData.reqData.length;

        fetchTaskData.reqData.push(...reqData);
        
        this.scheduleFetchTask();

        const responseData = await fetchTaskData.promise;
        return responseData.slice(startIdx, startIdx + tsSources.length);
    }
}

export const dataAccess = new DataAccess();
