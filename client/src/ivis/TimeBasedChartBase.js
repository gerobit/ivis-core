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

            for (const sigSetConf of this.props.signalSetsConfig) {
                const sel = this.props.selection[sigSetConf.cid];

                if (sel) {
                    ts = sel.ts;
                    for (const sigConf of sigSetConf.signals) {
                        rows.push(
                            <div key={sigSetConf.cid + " " + sigConf.cid}>
                                <span className={tooltipStyles.signalColor} style={{color: sigConf.color}}><Icon icon="minus"/></span>
                                <span className={tooltipStyles.signalLabel}>{sigConf.label}:</span>
                                {this.props.getSignalValues(this, sigSetConf.cid, sigConf.cid, sel.data[sigConf.cid])}
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

export const RenderStatus = {
    SUCCESS: 0,
    NO_DATA: 1
};

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
            signalsData: null,
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
        if (nextProps.config !== this.props.config || nextAbs !== this.getIntervalAbsolute()) {
            this.setState({
                signalSetsData: null,
                statusMsg: t('Loading...')
            });

            this.fetchData(nextAbs, nextProps.config);
        }
    }

    componentDidMount() {
        window.addEventListener('resize', this.resizeListener);

        this.fetchData(this.getIntervalAbsolute(), this.props.config);

        // this.createChart() is not needed here because at this point, we are missing too many things to actually execute it
    }

    componentDidUpdate(prevProps, prevState, prevContext) {
        const forceRefresh = this.prevContainerNode !== this.containerNode
            || prevState.signalSetsData !== this.state.signalSetsData
            || prevProps.config !== this.props.config
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

/*you should create a clipPath in the svg that is on line 317 (in the TimeBasedChartBase)
the clipPath should be a rectangle over the chart area
and then add the clipPath to the <g> on line 318.
the rectangle of the clipPath will have to be modified when the chart resizes
that can be done for instance on line 229
it will be a similar rectangle with the attributes similar to lines 260 and 261

*/