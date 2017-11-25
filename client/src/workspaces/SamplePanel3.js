'use strict';

import React, {Component} from "react";
import {Panel} from "../lib/panel";
import {withErrorHandling} from "../lib/error-handling";
import {OnOffAreaChart} from "../ivis/OnOffAreaChart";
import {PredefTimeRangeSelector} from "../ivis/TimeRangeSelector";
import {translate} from "react-i18next";
import {TimeContext} from "../ivis/TimeContext";
import {rgb} from "d3-color";
import moment from "moment";
import styles from "./Sample.scss";
import {DataProvider} from "../ivis/DataAccess"
import {IntervalAbsolute} from "../ivis/TimeInterval";


@translate()
@withErrorHandling
export default class Home extends Component {
    constructor(props) {
        super(props);

        const t = props.t;

        const refreshInterval = moment.duration(1, 'm');
        const aggregationInterval = null; /* auto */

        this.ranges = [
            { from: 'now-5m', to: 'now', refreshInterval, aggregationInterval, label: t('Last 5 minutes') },
            { from: 'now-15m', to: 'now', refreshInterval, aggregationInterval, label: t('Last 15 minutes') },
            { from: 'now-30m', to: 'now', refreshInterval, aggregationInterval, label: t('Last 30 minutes') },
            { from: 'now-1h', to: 'now', refreshInterval, aggregationInterval, label: t('Last 1 hour') },
            { from: 'now-3h', to: 'now', refreshInterval, aggregationInterval, label: t('Last 3 hours') },
            { from: 'now-6h', to: 'now', refreshInterval, aggregationInterval, label: t('Last 6 hours') },
            { from: 'now-12h', to: 'now', refreshInterval, aggregationInterval, label: t('Last 12 hours') },
            { from: 'now-24h', to: 'now', refreshInterval, aggregationInterval, label: t('Last 24 hours') }
        ];
    }

    render() {
        const t = this.props.t;

        const chartConfig = {
            yScale: {
                includedMin: 0,
                includedMax: 5
            },
            signalSets: [
                {
                    cid: 'config',
                    signals: [
                        {
                            cid: 'ro',
                            label: t('RO'),
                            color: rgb(75, 172, 198)
                        },
                        {
                            cid: 'aop',
                            label: t('AOP'),
                            color: rgb(128, 100, 162)
                        },
                        {
                            cid: 'cwo',
                            label: t('CWO'),
                            color: rgb(155, 187, 89)
                        },
                        {
                            cid: 'uf',
                            label: t('UF'),
                            color: rgb(192, 80, 77)
                        },
                        {
                            cid: 'daf',
                            label: t('DAF'),
                            color: rgb(79, 129, 189)
                        },
                    ]
                }
            ]
        };

        const inputInfoSignalSets = {
            turbidity: {
                input: ['avg']
            },
            toc: {
                input: ['avg']
            },
            conductivity: {
                input: ['avg']
            }
        };

        const outputInfoSignalSets = {
            turbidity: {
                output: ['avg']
            },
            toc: {
                output: ['avg']
            },
            conductivity: {
                output: ['avg']
            }
        };

        const legendRows = [];
        for (const sigSetConf of chartConfig.signalSets) {
            for (const sigConf of sigSetConf.signals) {
                legendRows.push(
                    <div className="col-xs-2" key={sigSetConf.cid + " " + sigConf.cid}>
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
                        <div className="col-xs-12 col-sm-3 col-md-2">
                            <DataProvider
                                intervalFun={intv => new IntervalAbsolute(intv.to, intv.to, moment.duration(0, 's'))}
                                signalSets={inputInfoSignalSets}
                                renderFun={signalSetsData => (
                                    <div className={styles.info}>
                                        <h3>Current Inputs:</h3>
                                        <table className={styles.infoTable + ' table table-striped'}>
                                            <tr><td className={styles.infoTableLabel}>Turbidity:</td><td className={styles.infoTableValue}>{signalSetsData.turbidity.prev.data.input.avg}</td></tr>
                                            <tr><td className={styles.infoTableLabel}>TOC:</td><td className={styles.infoTableValue}>{signalSetsData.toc.prev.data.input.avg}</td></tr>
                                            <tr><td className={styles.infoTableLabel}>Conductivity:</td><td className={styles.infoTableValue}>{signalSetsData.conductivity.prev.data.input.avg}</td></tr>
                                        </table>
                                    </div>
                                )}
                            />
                        </div>
                        <div className="col-xs-12 col-sm-6 col-md-8">
                            <h3>Activated processes:</h3>
                            <div className={styles.intervalChooser}>
                                <PredefTimeRangeSelector ranges={this.ranges}/>
                            </div>
                            <OnOffAreaChart
                                config={chartConfig}
                                height={500}
                                margin={{ left: 15, right:15, top: 5, bottom: 20 }}
                                withTooltip
                                withBrush={false}
                            />
                            <div className={styles.legend}>
                                <div className="row">
                                    {legendRows}
                                </div>
                            </div>
                        </div>
                        <div className="col-xs-12 col-sm-3 col-md-2">
                            <DataProvider
                                intervalFun={intv => new IntervalAbsolute(intv.to, intv.to, moment.duration(0, 's'))}
                                signalSets={outputInfoSignalSets}
                                renderFun={signalSetsData => (
                                    <div className={styles.info}>
                                        <h3>Current Outputs:</h3>
                                        <table className={styles.infoTable + ' table table-striped'}>
                                            <tr><td className={styles.infoTableLabel}>Turbidity:</td><td className={styles.infoTableValue}>{signalSetsData.turbidity.prev.data.output.avg}</td></tr>
                                            <tr><td className={styles.infoTableLabel}>TOC:</td><td className={styles.infoTableValue}>{signalSetsData.toc.prev.data.output.avg}</td></tr>
                                            <tr><td className={styles.infoTableLabel}>Conductivity:</td><td className={styles.infoTableValue}>{signalSetsData.conductivity.prev.data.output.avg}</td></tr>
                                        </table>
                                    </div>
                                )}
                            />
                        </div>
                    </div>
                </TimeContext>
            </Panel>
        );
    }
}
