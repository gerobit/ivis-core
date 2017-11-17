'use strict';

import moment from "moment";
import axios from "../lib/axios";
import { getRestUrl } from "../lib/access";

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

    /*
      sigSets = {
        [sigSetCid]: {
          [sigCid]: [aggs]
        }
      }
    */
    async getSignalSets(sigSets, intervalAbsolute) {

        const reqData = [];
        const sigSetCids = [];

        for (const sigSetCid in sigSets) {
            const sigSet = sigSets[sigSetCid];

            sigSetCids.push(sigSetCid);

            const sigs = {};
            for (const sigCid in sigSet) {
                const sig = sigSet[sigCid];

                if (Array.isArray(sig)) {
                    sigs[sigCid] = sig;
                }
            }

            reqData.push({
                cid: sigSetCid,
                signals: sigs,
                interval: intervalAbsolute
            });
        }

        const fetchTaskData = this.fetchTaskData;
        const startIdx = fetchTaskData.reqData.length;

        fetchTaskData.reqData.push(...reqData);
        
        this.scheduleFetchTask();

        const responseData = await fetchTaskData.promise;

        const result = {};
        let idx = startIdx;
        for (const sigSetCid of sigSetCids) {
            const sigSetRes = responseData[idx];
            const sigSet = sigSets[sigSetCid];

            for (const sigCid in sigSet) {
                const sig = sigSet[sigCid];

                if (!Array.isArray(sig)) {
                    if (sig.xFun) {
                        if (sigSetRes.prev) {
                            sigSetRes.prev.data[sigCid] = sig.xFun(sigSetRes.prev.ts, sigSetRes.prev.data);
                        }

                        if (sigSetRes.next) {
                            sigSetRes.next.data[sigCid] = sig.xFun(sigSetRes.next.ts, sigSetRes.next.data);
                        }

                        for (const mainRes of sigSetRes.main) {
                            mainRes.data[sigCid] = sig.xFun(mainRes.ts, mainRes.data);
                        }
                    }
                }
            }

            result[sigSetCid] = sigSetRes;
            idx++;
        }

        return result;
    }
}

export const dataAccess = new DataAccess();
