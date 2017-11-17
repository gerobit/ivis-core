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

            reqData.push({
                cid: sigSetCid,
                signals: sigSet,
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
            result[sigSetCid] = responseData[idx];
            idx++;
        }

        return result;
    }
}

export const dataAccess = new DataAccess();
