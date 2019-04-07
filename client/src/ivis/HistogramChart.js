'use strict';

import React, {Component} from "react";
import * as d3Axis from "d3-axis";
import * as d3Scale from "d3-scale";
import * as d3Format from "d3-format";
import * as d3Selection from "d3-selection";
import {select} from "d3-selection";
import {intervalAccessMixin} from "./TimeContext";
import {DataAccessSession} from "./DataAccess";
import {withAsyncErrorHandler, withErrorHandling} from "../lib/error-handling";
import PropTypes from "prop-types";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";
import {Tooltip} from "./Tooltip";
import {Icon} from "../lib/bootstrap-components";


const ConfigDifference = {
    NONE: 0,
    RENDER: 1,
    DATA: 2,
    DATA_WITH_CLEAR: 3
};

function compareConfigs(conf1, conf2) {
    let diffResult = ConfigDifference.NONE;

    if (conf1.sigSetCid !== conf2.sigSetCid || conf1.sigCid !== conf2.sigCid || conf1.tsSigCid !== conf2.tsSigCid) {
        diffResult = ConfigDifference.DATA_WITH_CLEAR;
    } else if (conf1.color !== conf2.color) {
        diffResult = ConfigDifference.RENDER;
    }

    return diffResult;
}

class TooltipContent extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        config: PropTypes.object.isRequired,
        signalSetsData: PropTypes.object,
        selection: PropTypes.object
    }

    render() {
        if (this.props.selection) {
            const step = this.props.signalSetsData.step;
            const bucket = this.props.selection;

            const keyF = d3Format.format("." + d3Format.precisionFixed(step) + "f");
            const probF = d3Format.format(".2f");

            return (
                <div>
                    <div>Range: <Icon icon="chevron-left"/>{keyF(bucket.key)} <Icon icon="ellipsis-h"/> {keyF(bucket.key + step)}<Icon icon="chevron-right"/></div>
                    <div>Count: {bucket.count}</div>
                    <div>Frequency: {probF(bucket.prob * 100)}%</div>
                </div>
            );

        } else {
            return null;
        }
    }
}


@withComponentMixins([
    withTranslation,
    withErrorHandling,
    intervalAccessMixin()
])
export class HistogramChart extends Component {
    constructor(props){
        super(props);

        const t = props.t;

        this.dataAccessSession = new DataAccessSession();
        this.state = {
            signalSetsData: null,
            statusMsg: t('Loading...'),
            width: 0,
            maxBucketCount: 0
        };

        this.resizeListener = () => {
            this.createChart(this.state.signalSetsData);
        };
    }

    static propTypes = {
        config: PropTypes.object.isRequired,
        height: PropTypes.number.isRequired,
        margin: PropTypes.object.isRequired,
        withBrush: PropTypes.bool,
        withTooltip: PropTypes.bool,

        minStep: PropTypes.number,
        minBarWidth: PropTypes.number
    }

    static defaultProps = {
        minBarWidth: 20,
        withBrush: true,
        withTooltip: true
    }

    componentDidMount() {
        window.addEventListener('resize', this.resizeListener);
        this.createChart(null, false);
    }

    componentDidUpdate(prevProps, prevState) {
        let signalSetsData = this.state.signalSetsData;

        const t = this.props.t;

        let configDiff = compareConfigs(this.props.config, prevProps.config);

        const considerTs = !!this.props.config.tsSigCid;
        if (considerTs) {
            const prevAbs = this.getIntervalAbsolute(prevProps);
            const prevSpec = this.getIntervalSpec(prevProps);

            if (prevSpec !== this.getIntervalSpec()) {
                configDiff = ConfigDifference.DATA_WITH_CLEAR;
            } else if (prevAbs !== this.getIntervalAbsolute()) { // If its just a regular refresh, don't clear the chart
                configDiff = ConfigDifference.DATA;
            }
        }

        if (prevState.maxBucketCount !== this.state.maxBucketCount) {
            configDiff = ConfigDifference.DATA;
        }

        if (configDiff === ConfigDifference.DATA || configDiff === ConfigDifference.DATA_WITH_CLEAR) {
            if (configDiff === ConfigDifference.DATA_WITH_CLEAR) {
                this.setState({
                    signalSetsData: null,
                    statusMsg: t('Loading...')
                });

                signalSetsData = null;
            }

            // noinspection JSIgnoredPromiseFromCall
            this.fetchData();

        } else {
            const forceRefresh = this.prevContainerNode !== this.containerNode
                || prevState.signalSetsData !== this.state.signalSetsData
                || configDiff !== ConfigDifference.NONE;

            this.createChart(signalSetsData, forceRefresh);
            this.prevContainerNode = this.containerNode;
        }
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.resizeListener);
    }

    @withAsyncErrorHandler
    async fetchData() {
        const t = this.props.t;
        const config = this.props.config;

        if (this.state.maxBucketCount > 0) {
            try {
                let filter;
                if (config.tsSigCid) {
                    const abs = this.getIntervalAbsolute();
                    filter = [
                        {
                            sigCid: config.tsSigCid,
                            gte: abs.from.toISOString(),
                            lt: abs.to.toISOString()
                        }
                    ];
                }

                const results = await this.dataAccessSession.getLatestHistogram(config.sigSetCid, [config.sigCid], this.state.maxBucketCount, this.props.minStep, filter);

                if (results) { // Results is null if the results returned are not the latest ones
                    this.setState({
                        signalSetsData: {
                            step: results.step,
                            offset: results.offset,
                            buckets: results.buckets[0]
                        }
                    });
                }
            } catch (err) {
                throw err;
            }
        }
    }

    createChart(signalSetsData, forceRefresh) {
        const t = this.props.t;
        const self = this;

        const width = this.containerNode.getClientRects()[0].width;

        if (this.state.width !== width) {
            const maxBucketCount = Math.ceil(width / this.props.minBarWidth);

            this.setState({
                width,
                maxBucketCount
            });
        }

        if (!forceRefresh && width === this.renderedWidth) {
            return;
        }
        this.renderedWidth = width;

        if (!signalSetsData) {
            return;
        }

        const noData = signalSetsData.buckets.length === 0;

        if (noData) {
            this.statusMsgSelection.text(t('No data.'));
            this.cursorSelection.attr('visibility', 'hidden');

            this.brushSelection
                .on('mouseenter', null)
                .on('mousemove', null)
                .on('mouseleave', null);

        } else {
            const xMin = signalSetsData.buckets[0].key;
            const xMax = signalSetsData.buckets[signalSetsData.buckets.length - 1].key + signalSetsData.step;

            let yMax = 0;
            let totalCount = 0;
            for (const bucket of signalSetsData.buckets) {
                if (bucket.count > yMax) {
                    yMax = bucket.count;
                }

                totalCount += bucket.count;
            }
            yMax /= totalCount;

            for (const bucket of signalSetsData.buckets) {
                bucket.prob = bucket.count / totalCount;
            }

            const ySize = this.props.height - this.props.margin.top - this.props.margin.bottom;
            const step = signalSetsData.step;
            const stepHalf = step / 2;
            const barColor = this.props.config.color;
            const pointColor = barColor.darker();

            const yScale = d3Scale.scaleLinear()
                .domain([0, yMax])
                .range([ySize, 0]);

            const xScale = d3Scale.scaleLinear()
                .domain([xMin, xMax])
                .range([0, width - this.props.margin.left - this.props.margin.right]);

            const xAxis = d3Axis.axisBottom(xScale)
                .tickSizeOuter(0);

            this.xAxisSelection.call(xAxis);

            const yAxis = d3Axis.axisLeft(yScale)
                .tickFormat(yScale.tickFormat(10, "-%"));

            this.yAxisSelection.call(yAxis);

            const barWidth = xScale(step) - xScale(0) - 1;

            const bars = this.barsSelection
                .selectAll('rect')
                .data(signalSetsData.buckets);

            bars.enter()
                .append('rect')
                .merge(bars)
                .attr('x', d => xScale(d.key))
                .attr('y', d => yScale(d.prob))
                .attr("width", barWidth)
                .attr("height", d => ySize - yScale(d.prob))
                .attr("fill", barColor);

            bars.exit()
                .remove();

            if (this.props.withBrush) {
                this.barPointSelection
                    .selectAll('circle')
                    .remove();

                this.brushSelection
                    .selectAll('rect')
                    .remove();

                this.brushSelection
                    .append('rect')
                    .attr('pointer-events', 'all')
                    .attr('cursor', 'crosshair')
                    .attr('x', 0)
                    .attr('y', 0)
                    .attr('width', width - this.props.margin.left - this.props.margin.right)
                    .attr('height', this.props.height - this.props.margin.top - this.props.margin.bottom)
                    .attr('visibility', 'hidden');

                let selection, mousePosition;

                const selectPoints = function () {
                    const containerPos = d3Selection.mouse(self.containerNode);
                    const x = containerPos[0] - self.props.margin.left;

                    const key = xScale.invert(x);
                    let newSelection = null;
                    for (const bucket of signalSetsData.buckets) {
                        if (bucket.key <= key) {
                            newSelection = bucket;
                        } else {
                            break;
                        }
                    }

                    if (selection !== newSelection) {
                        self.barPointSelection
                            .selectAll('circle')
                            .remove();

                        if (newSelection) {
                            self.barPointSelection
                                .append('circle')
                                .attr('cx', xScale(newSelection.key + stepHalf))
                                .attr('cy', yScale(newSelection.prob))
                                .attr('r', 3)
                                .attr('fill', pointColor);
                        }
                    }

                    self.cursorSelection
                        .attr('y1', self.props.margin.top)
                        .attr('y2', self.props.height - self.props.margin.bottom)
                        .attr('x1', containerPos[0])
                        .attr('x2', containerPos[0])
                        .attr('visibility', 'visible');

                    selection = newSelection;
                    mousePosition = {x: containerPos[0], y: containerPos[1]};

                    self.setState({
                        selection,
                        mousePosition
                    });
                };

                const deselectPoints = function () {
                    self.cursorSelection.attr('visibility', 'hidden');

                    if (selection) {
                        self.barPointSelection
                            .selectAll('circle')
                            .remove();
                    }

                    selection = null;
                    mousePosition = null;

                    self.setState({
                        selection,
                        mousePosition
                    });
                };

                this.brushSelection
                    .on('mouseenter', selectPoints)
                    .on('mousemove', selectPoints)
                    .on('mouseleave', deselectPoints);
            }
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

            return (
                <svg id="cnt" ref={node => this.containerNode = node} height={this.props.height} width="100%">
                    <g transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}>
                        <g ref={node => this.barsSelection = select(node)}/>
                        <g ref={node => this.barPointSelection = select(node)}/>
                    </g>
                    <g ref={node => this.xAxisSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.height - this.props.margin.bottom})`}/>
                    <g ref={node => this.yAxisSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
                    <line ref={node => this.cursorSelection = select(node)} strokeWidth="1" stroke="rgb(50,50,50)" visibility="hidden"/>
                    <text ref={node => this.statusMsgSelection = select(node)} textAnchor="middle" x="50%" y="50%" fontFamily="'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif" fontSize="14px"/>
                    {this.props.withTooltip &&
                    <Tooltip
                        config={this.props.config}
                        signalSetsData={this.state.signalSetsData}
                        containerHeight={this.props.height}
                        containerWidth={this.state.width}
                        mousePosition={this.state.mousePosition}
                        selection={this.state.selection}
                        contentRender={props => <TooltipContent {...props}/>}
                    />
                    }
                    <g ref={node => this.brushSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
                </svg>
            );
        }
    }
}
