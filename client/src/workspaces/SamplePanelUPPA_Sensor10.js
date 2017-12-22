'use strict';

import React, { Component } from "react";
import { Panel } from "../lib/panel";
import { withErrorHandling, withAsyncErrorHandler } from "../lib/error-handling";
import { LineChart } from "../ivis/LineChart";
import { TimeRangeSelector } from "../ivis/TimeRangeSelector";
import { translate } from "react-i18next";
import { TimeContext, withIntervalAccess } from "../ivis/TimeContext";
import { rgb } from "d3-color";
import { IntervalAbsolute } from "../ivis/TimeInterval";
import moment from "moment";

@translate()
@withErrorHandling
export default class Home extends Component {
    constructor(props) {
        super(props);

        const t = props.t;

        this.state = {
            config: {
                yScale: {
                    includedMin: 0,
                    includedMax: 100
                },
                signalSets: [
                    {
                        cid: 'UPPA_Sensor10',
                        signals: [
                            {
                                cid: 'TC',
                                label: t('Sensor 10: Temperature'),
                                color: rgb(70, 130, 180)
                            }
                        ]
                    },
                    {
                        cid: 'UPPA_Sensor3',
                        signals: [
                            {
                                cid: 'TC',
                                label: t('Sensor 3: Temperature'),
                                color: rgb(250, 100, 100)
                            }/*,
                            {
                                cid: 'Sum',
                                label: t('Sum'),
                                color: rgb(0, 0, 160),
                                xFun: (ts, ys) => ({ avg: ys.UPPA_Sensor3.TC.avg + ys.UPPA_Sensor10.TC.avg})
                            }*/
                        ]
                    }
                ]
            }
        };
    }
    
    render() {
        const t = this.props.t;

        return (
            <Panel>
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
            </Panel>
        );
    }
}