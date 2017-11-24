'use strict';

import React, {Component} from "react";
import {Panel} from "../lib/panel";
import {withErrorHandling, withAsyncErrorHandler} from "../lib/error-handling";
import {AreaChart} from "../ivis/AreaChart";
import {TimeRangeSelector, PredefTimeRangeSelector} from "../ivis/TimeRangeSelector";
import {translate} from "react-i18next";
import {TimeContext, withIntervalAccess} from "../ivis/TimeContext";
import {rgb} from "d3-color";
import {dataAccess} from "../ivis/DataAccess";
import {IntervalAbsolute} from "../ivis/TimeInterval";
import moment from "moment";
import PropTypes from "prop-types";
import tooltipStyles from "../ivis/Tooltip.scss";
import * as dateMath from "../lib/datemath";
import {Icon} from "../lib/bootstrap-components";
import styles from "./Sample.scss";


class TooltipContent extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        signalSetsConfig: PropTypes.array.isRequired,
        selection: PropTypes.object
    }

    render() {
        if (this.props.selection) {
            const rows = [];
            let ts;

            for (const sigSetConf of this.props.signalSetsConfig) {
                const sel = this.props.selection[sigSetConf.cid];

                if (sel) {
                    ts = sel.ts;

                    for (const sigConf of sigSetConf.signals) {
                        const val = sel.data[sigConf.cid].max ? 'ON' : 'OFF';

                        rows.push(
                            <div key={sigSetConf.cid + " " + sigConf.cid}>
                                <span className={tooltipStyles.signalColor} style={{color: sigConf.color}}><Icon icon="minus"/></span>
                                <span className={tooltipStyles.signalLabel}>{sigConf.label}:</span>
                                <span className={tooltipStyles.signalAvg}>{val}</span>
                            </div>
                        );
                    }
                }
            }

            return (
                <div>
                    <div className={tooltipStyles.time}>{dateMath.format(ts)}</div>
                    {rows}
                </div>
            );

        } else {
            return null;
        }
    }
}



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
                    includedMax: 6
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
            }
        };

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

        const legendRows = [];
        for (const sigSetConf of this.state.config.signalSets) {
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
                        <div className="col-xs-12">
                            <PredefTimeRangeSelector ranges={this.ranges}/>
                        </div>
                        <div className="col-xs-12">
                            <div>
                                <AreaChart
                                    onClick={(selection, position) => {console.log(selection); console.log(position);}}
                                    config={this.state.config}
                                    height={500}
                                    margin={{ left: 0, right: 0, top: 5, bottom: 20 }}
                                    withTooltip
                                    tooltipContentComponent={TooltipContent}
                                />
                            </div>
                            <div className={styles.legend + ' row'}>
                                {legendRows}
                            </div>
                        </div>
                    </div>
                </TimeContext>
            </Panel>
        );
    }
}
