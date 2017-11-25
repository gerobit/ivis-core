'use strict';

import React, {Component} from "react";
import {Panel} from "../lib/panel";
import {withErrorHandling} from "../lib/error-handling";
import {LineChart} from "../ivis/LineChart";
import {TimeRangeSelector} from "../ivis/TimeRangeSelector";
import {translate} from "react-i18next";
import {TimeContext} from "../ivis/TimeContext";
import {rgb} from "d3-color";
import styles from "./Sample.scss";


@translate()
@withErrorHandling
export default class Home extends Component {
    constructor(props) {
        super(props);

        const t = props.t;
    }

    render() {
        const t = this.props.t;

        const chartConfig = {
            yScale: {
                includedMin: 0,
                includedMax: 100
            },
            signalSets: [
                {
                    cid: 'turbidity',
                    signals: [
                        {
                            cid: 'output',
                            label: t('Output'),
                            color: rgb(209, 147, 146)
                        },
                        {
                            cid: 'input',
                            label: t('Input'),
                            color: rgb(65, 111, 166)
                        },
                        {
                            cid: 'limit',
                            label: t('Limit'),
                            color: rgb(170, 70, 67)
                        },
                        {
                            cid: 'daf',
                            label: t('DAF'),
                            color: rgb(134, 164, 74)
                        },
                        {
                            cid: 'uf',
                            label: t('UF'),
                            color: rgb(110, 84, 141)
                        },
                        {
                            cid: 'cwo',
                            label: t('CWO'),
                            color: rgb(61, 150, 174)
                        },
                        {
                            cid: 'aop',
                            label: t('AOP'),
                            color: rgb(218, 129, 55)
                        },
                        {
                            cid: 'ro',
                            label: t('RO'),
                            color: rgb(142, 165, 203)
                        }
                    ]
                }
            ]
        };

        const legendRows = [];
        for (const sigSetConf of chartConfig.signalSets) {
            for (const sigConf of sigSetConf.signals) {
                legendRows.push(
                    <div className="col-xs-2 col-md-1" key={sigSetConf.cid + " " + sigConf.cid}>
                        <span className={styles.signalColor} style={{backgroundColor: sigConf.color}}></span>
                        <span className={styles.signalLabel}>{sigConf.label}</span>
                    </div>
                );
            }
        }

        return (
            <Panel>
                <TimeContext>
                    <div className="row">
                        <div className="col-xs-12">
                            <h3>Turbidity</h3>
                            <TimeRangeSelector/>
                            <LineChart
                                onClick={(selection, position) => {console.log(selection); console.log(position);}}
                                config={chartConfig}
                                height={500}
                                margin={{ left: 40, right: 5, top: 5, bottom: 20 }}
                            />
                            <div className={styles.legend}>
                                <div className="row">
                                    {legendRows}
                                </div>
                            </div>
                        </div>
                    </div>
                </TimeContext>
            </Panel>
        );
    }
}
