'use strict';

import React, { Component } from "react";
import { translate } from "react-i18next";
import { Panel } from "../../lib/panel";
import { requiresAuthenticatedUser, withPageHelpers } from "../../lib/page";
import axios from "../../lib/axios";
import { withAsyncErrorHandler, withErrorHandling } from "../../lib/error-handling";
import moment from "moment";
import { LineChart } from "../../ivis/LineChart";
import { TimeRangeSelector } from "../../ivis/TimeRangeSelector";
import { TimeContext, withIntervalAccess } from "../../ivis/TimeContext";
import { rgb } from "d3-color";
import { IntervalAbsolute } from "../../ivis/TimeInterval";

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class FarmPanel extends Component {
    constructor(props) {
        super(props);
        this.state = {
            config: {
                yScale: {
                    includedMin: 0,
                    includedMax: 100
                }
            }
        };

        this.colors = [rgb(70, 130, 180), rgb(170, 30, 80), rgb(70, 230, 10), rgb(17, 130, 100)];
    }

    @withAsyncErrorHandler
    async componentDidMount() {
        const t = this.props.t;
        const result = await axios.get(`/rest/farmsensors/${this.props.farm.id}`);
        const sensors = result.data;

        let signalSetsArray = [];
        let idxColor = 0;
        for (const sensor of sensors) {
            let signalSetDic = null;

            for (const ssd of signalSetsArray)
                if (ssd.cid === sensor.ssCid)
                    signalSetDic = ssd;

            if (signalSetDic === null) {
                signalSetDic = {};
                signalSetDic.cid = sensor.ssCid;
                signalSetDic.signals = [];
                signalSetsArray.push(signalSetDic);
            }

            signalSetDic.signals.push({
                cid: sensor.sCid,
                label: t(signalSetDic.cid + ':' + sensor.sCid),
                color: this.colors[idxColor++ % 4]
            });
        }

        const sigSets = {
            signalSets: signalSetsArray
        }
        const state = Object.assign(this.state.config, sigSets)
        this.setState({ state });
    }

    render() {
        const t = this.props.t;

        return (
            <Panel title={t(this.props.farm.name + '\'s Farm View')} >
                {(!!this.state.config.signalSets &&
                    this.state.config.signalSets.length > 0) &&
                    <TimeContext>
                        <div className="row">
                            <div className="col-xs-12">
                                <TimeRangeSelector />
                            </div>
                            <div className="col-xs-12">
                                <div>
                                    <LineChart
                                        onClick={(selection, position) => { console.log(selection); console.log(position); }}
                                        config={this.state.config}
                                        height={500}
                                        margin={{ left: 40, right: 5, top: 5, bottom: 20 }}
                                    />
                                </div>
                            </div>
                        </div>
                    </TimeContext>
                }
            </Panel>
        );
    }
}