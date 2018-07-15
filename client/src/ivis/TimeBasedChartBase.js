'use strict';

import React, {Component} from "react";

import {translate} from "react-i18next";
import * as d3Axis from "d3-axis";
import * as d3Scale from "d3-scale";
import {event as d3Event, select} from "d3-selection";
import * as d3Brush from "d3-brush";
import {withIntervalAccess} from "./TimeContext";
import {
    DataAccessSession
} from "./DataAccess";
import {withAsyncErrorHandler, withErrorHandling} from "../lib/error-handling";
import interoperableErrors from "../../../shared/interoperable-errors";
import PropTypes from "prop-types";
import {roundToMinAggregationInterval} from "../../../shared/signals";
import {IntervalSpec} from "./TimeInterval";
import {Tooltip} from "./Tooltip";
import tooltipStyles from "./Tooltip.scss";
import * as dateMath from "../lib/datemath";
import {Icon} from "../lib/bootstrap-components";

export function createBase(base, self) {
    self.base = base;
    return self;
}

export function isSignalVisible(sigConf) {
    return ('label' in sigConf) && (!('enabled' in sigConf) || sigConf.enabled);
}

class TooltipContent extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        signalSetsConfig: PropTypes.array.isRequired,
        selection: PropTypes.object,
        getSignalValues: PropTypes.func.isRequired
    }

    render() {
        if (this.props.selection) {
            const rows = [];
            let ts;

            let sigSetIdx = 0;
            for (const sigSetConf of this.props.signalSetsConfig) {
                const sel = this.props.selection[sigSetConf.cid];

                if (sel) {
                    ts = sel.ts;
                    let sigIdx = 0;
                    for (const sigConf of sigSetConf.signals) {
                        if (isSignalVisible(sigConf)) {
                            rows.push(
                                <div key={`${sigSetIdx} ${sigIdx}`}>
                                    <span className={tooltipStyles.signalColor} style={{color: sigConf.color}}><Icon icon="minus"/></span>
                                    <span className={tooltipStyles.signalLabel}>{sigConf.label}:</span>
                                    {this.props.getSignalValues(this, sigSetConf.cid, sigConf.cid, sel.data[sigConf.cid])}
                                </div>
                            );
                        }

                        sigIdx += 1;
                    }
                }

                sigSetIdx += 1;
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

export const RenderStatus = {
    SUCCESS: 0,
    NO_DATA: 1
};



const ConfigDifference = {
    NONE: 0,
    RENDER: 1,
    DATA: 2
};

function compareConfigs(conf1, conf2) {
    let diffResult = ConfigDifference.NONE;

    function compareSignal(sig1, sig2) {
        if (sig1.cid !== sig2.cid || sig1.mutate !== sig2.mutate || sig1.generate !== sig2.generate) {
            diffResult = ConfigDifference.DATA;
        } else if (sig1.color !== sig2.color || sig1.label !== sig2.label || sig1.enabled !== sig2.enabled) {
            diffResult = ConfigDifference.RENDER;
        }
    }

    function compareSigSet(sigSet1, sigSet2) {
        if (sigSet1.cid !== sigSet2.cid) {
            diffResult = ConfigDifference.DATA;
            return;
        }

        if (sigSet1.signals.length !== sigSet2.signals.length) {
            diffResult = ConfigDifference.DATA;
            return;
        }

        for (let idx = 0; idx < sigSet1.signals.length; idx++) {
            compareSignal(sigSet1.signals[idx], sigSet2.signals[idx]);
            if (diffResult === ConfigDifference.DATA) {
                return;
            }
        }
    }

    function compareConf(conf1, conf2) {
        if (conf1.signalSets.length !== conf2.signalSets.length) {
            diffResult = ConfigDifference.DATA;
            return;
        }

        for (let idx = 0; idx < conf1.signalSets.length; idx++) {
            compareSigSet(conf1.signalSets[idx], conf2.signalSets[idx]);
            if (diffResult === ConfigDifference.DATA) {
                return;
            }
        }
    }

    compareConf(conf1, conf2);
    return diffResult;
}


@translate()
@withErrorHandling
@withIntervalAccess()
export class TimeBasedChartBase extends Component {
    constructor(props){
        super(props);

        const t = props.t;

        this.dataAccessSession = new DataAccessSession();
        this.state = {
            selection: null,
            mousePosition: null,
            signalSetsData: null,
            statusMsg: t('Loading...'),
            width: 0
        };

        this.resizeListener = () => this.createChart();
    }

    static propTypes = {
        config: PropTypes.object.isRequired,
        contentComponent: PropTypes.func,
        contentRender: PropTypes.func,
        height: PropTypes.number.isRequired,
        margin: PropTypes.object.isRequired,
        withBrush: PropTypes.bool,
        withTooltip: PropTypes.bool,
        tooltipContentComponent: PropTypes.func,
        tooltipContentRender: PropTypes.func,

        getQuerySignalAggs: PropTypes.func.isRequired,
        getSignalValuesForDefaultTooltip: PropTypes.func,
        prepareData: PropTypes.func.isRequired,
        createChart: PropTypes.func.isRequired,
        getGraphContent: PropTypes.func.isRequired,

        tooltipExtraProps: PropTypes.object
    }

    static defaultProps = {
        tooltipExtraProps: {}
    }

    componentWillReceiveProps(nextProps, nextContext) {
        const t = this.props.t;

        const nextAbs = this.getIntervalAbsolute(nextProps, nextContext);
        const nextSpec = this.getIntervalSpec(nextProps, nextContext);
        const configDiff = compareConfigs(nextProps.config, this.props.config);
        if (configDiff === ConfigDifference.DATA || nextSpec !== this.getIntervalSpec()) {
            this.setState({
                signalSetsData: null,
                statusMsg: t('Loading...')
            });

            this.fetchData(nextAbs, nextProps.config);

        } else if (nextAbs !== this.getIntervalAbsolute()) { // If its just a regular refresh, don't clear the chart
            this.fetchData(nextAbs, nextProps.config);
        }
    }

    componentDidMount() {
        window.addEventListener('resize', this.resizeListener);

        this.fetchData(this.getIntervalAbsolute(), this.props.config);

        // this.createChart() is not needed here because at this point, we are missing too many things to actually execute it
    }

    componentDidUpdate(prevProps, prevState, prevContext) {
        const configDiff = compareConfigs(prevProps.config, this.props.config);

        const forceRefresh = this.prevContainerNode !== this.containerNode
            || prevState.signalSetsData !== this.state.signalSetsData
            || configDiff !== ConfigDifference.NONE
            || this.getIntervalAbsolute(prevProps, prevContext) !== this.getIntervalAbsolute();

        this.createChart(forceRefresh);
        this.prevContainerNode = this.containerNode;
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.resizeListener);
    }

    @withAsyncErrorHandler
    async fetchData(abs, config) {
        const t = this.props.t;

        try {
            const signalSets = {};
            for (const setSpec of config.signalSets) {
                const signals = {};
                for (const sigSpec of setSpec.signals) {
                    if (sigSpec.generate) {
                        signals[sigSpec.cid] = {
                            generate: sigSpec.generate
                        };
                    } else if (sigSpec.mutate) {
                        signals[sigSpec.cid] = {
                            mutate: sigSpec.mutate,
                            aggs: this.props.getQuerySignalAggs(this, setSpec.cid, sigSpec.cid)
                        };
                    } else {
                        signals[sigSpec.cid] = this.props.getQuerySignalAggs(this, setSpec.cid, sigSpec.cid);
                    }
                }

                signalSets[setSpec.cid] = signals;
            }

            const rawSignalSetsData = await this.dataAccessSession.getLatestSignalSets(signalSets, abs);

            if (rawSignalSetsData) {
                const signalSetsData = this.props.prepareData(this, rawSignalSetsData);
                this.setState({
                    signalSetsData
                });
            }
        } catch (err) {
            if (err instanceof interoperableErrors.TooManyPointsError) {
                this.setState({
                    statusMsg: t('Too many data points.')
                });
                return;
            }

            throw err;
        }
    }

    createChart(forceRefresh) {
        const t = this.props.t;
        const self = this;

        const width = this.containerNode.clientWidth;

        if (this.state.width !== width) {
            this.setState({
                width
            });
        }

        if (!forceRefresh && width === this.renderedWidth) {
            return;
        }
        this.renderedWidth = width;

        if (!this.state.signalSetsData) {
            return;
        }

        const abs = this.getIntervalAbsolute();

        const xScale = d3Scale.scaleTime()
            .domain([abs.from, abs.to])
            .range([0, width - this.props.margin.left - this.props.margin.right]);

        const xAxis = d3Axis.axisBottom(xScale)
            .tickSizeOuter(0);

        this.xAxisSelection
            .call(xAxis);


        if (this.props.withBrush) {
            const brush = d3Brush.brushX()
                .extent([[0, 0], [width - this.props.margin.left - this.props.margin.right, this.props.height - this.props.margin.top - this.props.margin.bottom]])
                .on("end", function brushed() {
                    const sel = d3Event.selection;

                    if (sel) {
                        const rounded = roundToMinAggregationInterval(xScale.invert(sel[0]), xScale.invert(sel[1]));

                        const spec = new IntervalSpec(
                            rounded.from,
                            rounded.to,
                            null
                        );

                        self.getInterval().setSpec(spec);

                        self.brushSelection.call(brush.move, null);
                    }
                });

            this.brushSelection
                .call(brush);

        } else {
            this.brushSelection.append('rect')
                .attr('pointer-events', 'all')
                .attr('cursor', 'crosshair')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', width - this.props.margin.left - this.props.margin.right)
                .attr('height', this.props.height - this.props.margin.top - this.props.margin.bottom)
                .attr('visibility', 'hidden');
        }


        this.cursorLineVisible = false;
        this.cursorSelection
            .attr('y1', this.props.margin.top)
            .attr('y2', this.props.height - this.props.margin.bottom);


        const renderStatus = this.props.createChart(this, xScale);

        if (renderStatus == RenderStatus.NO_DATA) {
            this.statusMsgSelection.text(t('No data.'));
        }
    }

    render() {
        const config = this.props.config;

        if (!this.state.signalSetsData) {
            return (
                <svg ref={node => this.containerNode = node} height={this.props.height} width="100%">
                    <text textAnchor="middle" x="50%" y="50%" fontFamily="'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif" fontSize="14px">
                        {this.state.statusMsg}
                    </text>
                </svg>
            );

        } else {

            let content = null;
            const contentProps = {
                selection: this.state.selection,
                mousePosition: this.state.mousePosition,
                containerHeight: this.props.height,
                containerWidth: this.state.width
            };
            if (this.props.contentComponent) {
                content = <this.props.contentComponent {...contentProps}/>;
            } else if (this.props.contentRender) {
                content = this.props.contentRender(contentProps);
            }

            const tooltipExtraProps = {...this.props.tooltipExtraProps};

            if (this.props.tooltipContentComponent) {
                tooltipExtraProps.contentComponent = tooltipContentComponent;
            } else if (this.props.contentRender) {
                tooltipExtraProps.contentRender = tooltipContentRender;
            } else {
                tooltipExtraProps.contentRender = (props) => <TooltipContent getSignalValues={this.props.getSignalValuesForDefaultTooltip} {...props}/>;
            }


            return (
                <svg id="cnt" ref={node => this.containerNode = node} height={this.props.height} width="100%">
                    <g transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}>
                        {this.props.getGraphContent(this)}
                    </g>
                    <g ref={node => this.xAxisSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.height - this.props.margin.bottom})`}/>
                    <g ref={node => this.yAxisSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
                    <line ref={node => this.cursorSelection = select(node)} strokeWidth="1" stroke="rgb(50,50,50)" visibility="hidden"/>
                    <text ref={node => this.statusMsgSelection = select(node)} textAnchor="middle" x="50%" y="50%" fontFamily="'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif" fontSize="14px"/>
                    {this.props.withTooltip &&
                        <Tooltip
                            signalSetsConfig={this.props.config.signalSets}
                            containerHeight={this.props.height}
                            containerWidth={this.state.width}
                            mousePosition={this.state.mousePosition}
                            selection={this.state.selection}
                            {...tooltipExtraProps}
                        />
                    }
                    {content}
                    <g ref={node => this.brushSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
                </svg>
            );
        }
    }
}
