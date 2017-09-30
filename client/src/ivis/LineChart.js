'use strict';

import React, {Component} from "react";

import {translate} from "react-i18next";
import {axisBottom, axisLeft} from "d3-axis";
import {scaleLinear, scaleTime} from "d3-scale";
import {bisector, max, min} from "d3-array";
import {event as d3Event, mouse, select} from "d3-selection";
import {brushX} from "d3-brush";
import {area, curveMonotoneX, line} from "d3-shape";
import {rgb} from "d3-color";
import {withIntervalAccess} from "./TimeContext";
import {dataAccess, TimeseriesSource} from "./DataAccess";
import {withAsyncErrorHandler, withErrorHandling} from "../lib/error-handling";
import interoperableErrors from "../../../shared/interoperable-errors";
import PropTypes from "prop-types";
import {roundToMinAggregationInterval} from "../../../shared/signals";
import {IntervalSpec} from "./TimeInterval";
import {DataPathApproximator} from "./DataPathApproximator";
import {Tooltip} from "./Tooltip";


@translate()
@withErrorHandling
@withIntervalAccess()
export class LineChart extends Component {
    constructor(props){
        super(props);

        const t = props.t;

        this.fetchDataCounter = 0;

        this.avgLinePathSelection = {};
        this.minMaxAreaPathSelection = {};
        this.avgLinePointsSelection = {};

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
        onClick: PropTypes.func,
        height: PropTypes.number,
        margin: PropTypes.object,
        withTooltip: PropTypes.bool,
        tooltipContentComponent: PropTypes.func,
        tooltipContentRender: PropTypes.func
    }

    static defaultProps = {
        margin: { left: 40, right: 5, top: 5, bottom: 20 },
        height: 500
    }

    componentWillReceiveProps(nextProps, nextContext) {
        const t = this.props.t;

        const nextAbs = this.getIntervalAbsolute(nextProps, nextContext);
        if (nextProps.config !== this.props.config || nextAbs !== this.getIntervalAbsolute()) {
            console.log('props changed');
            this.setState({
                signalsData: null,
                statusMsg: t('Loading...')
            });

            this.fetchData(nextAbs, nextProps.config);
        }
    }

    componentDidMount() {
        // console.log('mount');
        window.addEventListener('resize', this.resizeListener);

        this.fetchData(this.getIntervalAbsolute(), this.props.config);

        // this.createChart() is not needed here because at this point, we are missing too many things to actually execute it
    }

    componentDidUpdate(prevProps, prevState, prevContext) {
        console.log('update');
        const forceRefresh = this.prevContainerNode !== this.containerNode
            || prevState.signalsData !== this.state.signalsData
            || prevProps.config !== this.props.config
            || this.getIntervalAbsolute(prevProps, prevContext) !== this.getIntervalAbsolute();

        this.createChart(forceRefresh);
        this.prevContainerNode = this.containerNode;
    }

    componentWillUnmount() {
        // console.log('unmount');
        window.removeEventListener('resize', this.resizeListener);
    }

    @withAsyncErrorHandler
    async fetchData(abs, config) {
        console.log('fetch');
        const t = this.props.t;

        try {
            const tsSources = config.signals.map(signalSpec => new TimeseriesSource(signalSpec.cid));

            this.fetchDataCounter += 1;
            const fetchDataCounter = this.fetchDataCounter;

            const signalsData = await dataAccess.getSignals(tsSources, abs);

            if (this.fetchDataCounter === fetchDataCounter) {
                this.setState({
                    signalsData
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

        if (!this.state.signalsData) {
            return;
        }

        console.log('createChart');

        const abs = this.getIntervalAbsolute();

        const points = {};
        let yMin, yMax;

        const yScaleConfig = this.props.config.yScale || {};
        yMin = yScaleConfig.includedMin;
        yMax = yScaleConfig.includedMax;

        let noData = true;

        for (let idx = 0; idx < this.state.signalsData.length; idx++) {
            const {prev, main, next} = this.state.signalsData[idx];

            let pts;

            if (main.length > 0) {
                pts = main.slice();

                if (prev) {
                    const prevInterpolated = {
                        ts: abs.from
                    };

                    for (const attr of ['min', 'avg', 'max']) {
                        const delta = (abs.from - prev.ts) / (pts[0].ts - prev.ts);
                        prevInterpolated[attr] = prev[attr] * (1 - delta) + pts[0][attr] * delta;
                    }

                    pts.unshift(prevInterpolated);
                }

                if (next) {
                    const nextInterpolated = {
                        ts: abs.to
                    };

                    for (const attr of ['min', 'avg', 'max']) {
                        const delta = (next.ts - abs.to) / (next.ts - pts[pts.length - 1].ts);
                        nextInterpolated[attr] = next[attr] * (1 - delta) + pts[pts.length - 1][attr] * delta;
                    }

                    pts.push(nextInterpolated);
                }

            } else if (main.length === 0 && prev && next) {
                const prevInterpolated = {
                    ts: abs.from
                };

                const nextInterpolated = {
                    ts: abs.to
                };

                for (const attr of ['min', 'avg', 'max']) {
                    const deltaFrom = (abs.from - prev.ts) / (next.ts - prev.ts);
                    const deltaTo = (abs.to - prev.ts) / (next.ts - prev.ts);
                    prevInterpolated[attr] = prev[attr] * (1 - deltaFrom) + next[attr] * deltaFrom;
                    nextInterpolated[attr] = prev[attr] * (1 - deltaTo) + next[attr] * deltaTo;
                }

                pts = [prevInterpolated, nextInterpolated];
            }

            if (pts) {
                for (const attr of ['min', 'avg', 'max']) {
                    const yData = pts.map(data => data[attr]);
                    const yDataMin = min(yData);
                    const yDataMax = max(yData);

                    if (yMin === undefined || yMin > yDataMin) {
                        yMin = yDataMin;
                    }

                    if (yMax === undefined || yMax < yDataMax) {
                        yMax = yDataMax;
                    }
                }

                points[idx] = pts;
                noData = false;
            }
        }


        const xScale = scaleTime()
            .domain([abs.from, abs.to])
            .range([0, width - this.props.margin.left - this.props.margin.right]);

        const xAxis = axisBottom(xScale)
            .tickSizeOuter(0);

        this.xAxisSelection
            .call(xAxis);

        let yScale;
        if (yMin !== undefined && yMax !== undefined) {
            yScale = scaleLinear()
                .domain([yMin, yMax])
                .range([this.props.height - this.props.margin.top - this.props.margin.bottom, 0]);

            const yAxis = axisLeft(yScale);

            this.yAxisSelection
                .call(yAxis);
        }


        const brush = brushX()
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


        this.cursorSelection
            .attr('y1', this.props.margin.top)
            .attr('y2', this.props.height - this.props.margin.bottom);


        const avgLineApproximators = {};
        const avgLineCircles = {};
        let selection = null;
        let mousePosition = null;

        const selectPoints = function () {
            const containerPos = mouse(self.containerNode);
            const x = containerPos[0] - self.props.margin.left;
            const y = containerPos[1] - self.props.margin.top;
            const ts = xScale.invert(x);

            self.cursorSelection
                .attr('visibility', 'visible')
                .attr('x1', containerPos[0])
                .attr('x2', containerPos[0]);

            if (noData) {
                return;
            }

            selection = {};
            let minDistance;

            // For each signal, select the point closest to the cursors
            for (let idx = 0; idx < self.state.signalsData.length; idx++) {
                const {main} = self.state.signalsData[idx];

                if (main.length > 0) {
                    const bisectTs = bisector(d => d.ts).right;

                    let pointIdx = bisectTs(main, ts);

                    if (pointIdx >= main.length) {
                        pointIdx -= 1;
                    } else if (main.length > 1 && pointIdx > 0) {
                        const leftTs = main[pointIdx - 1].ts;
                        const rightTs = main[pointIdx].ts;

                        if (ts - leftTs < rightTs - ts) {
                            pointIdx -= 1;
                        }
                    }

                    const point = main[pointIdx];

                    const distance = Math.abs(point.ts - ts);
                    if (minDistance === undefined || minDistance > distance) {
                        minDistance = distance;
                    }

                    selection[idx] = point;
                }
            }

            // Remove points that are not the the closest ones
            for (const idx in selection) {
                const point = selection[idx];
                if (Math.abs(point.ts - ts) > minDistance) {
                    delete selection[idx];
                }
            }


            const existingSelectionPoints = self.state.selection || {};

            // Draw the points including the small points on the paths that is hovered over
            for (let idx = 0; idx < self.state.signalsData.length; idx++) {
                const {main} = self.state.signalsData[idx];

                if (main.length > 0) {
                    const point = selection[idx];

                    const showAllPoints = main.length <= width / 20
                        && avgLineApproximators[idx].isPointContained(x, y);

                    self.avgLinePointsSelection[idx].selectAll('circle')
                        .attr('r', d => d === point ? 6 : 3)
                        .attr('visibility', d => d === point || showAllPoints ? 'visible' : 'hidden');
                }
            }


            selection = Object.keys(selection).length > 0 ? selection : null;

            mousePosition = {x: containerPos[0], y: containerPos[1]};

            self.setState({
                selection,
                mousePosition
            });
        };

        const deselectPoints = function () {
            self.cursorSelection.attr('visibility', 'hidden');

            if (noData) {
                return;
            }

            for (let idx = 0; idx < self.state.signalsData.length; idx++) {
                self.avgLinePointsSelection[idx].selectAll('circle').attr('visibility', 'hidden');
            }

            if (selection) {
                selection = null;
                mousePosition = null;

                self.setState({
                    selection,
                    mousePosition
                });
            }
        };

        const click = function () {
            if (self.props.onClick) {
                self.props.onClick(selection, mousePosition);
            }
        };

        this.brushSelection
            .on('mouseenter', selectPoints)
            .on('mousemove', selectPoints)
            .on('mouseleave', deselectPoints)
            .on('click', click);



        if (noData) {
            this.statusMsgSelection.text(t('No data.'));
            return;
        }

        const avgLine = line()
            .x(d => xScale(d.ts))
            .y(d => yScale(d.avg))
            .curve(curveMonotoneX);

        const minMaxArea = area()
            .x(d => xScale(d.ts))
            .y0(d => yScale(d.min))
            .y1(d => yScale(d.max))
            .curve(curveMonotoneX);


        for (let idx = 0; idx < this.state.signalsData.length; idx++) {
            if (points[idx]) {
                const signalSpec = this.props.config.signals[idx];
                const {main} = this.state.signalsData[idx];

                const avgLineColor = rgb(signalSpec.color);
                this.avgLinePathSelection[idx]
                    .datum(points[idx])
                    .attr('fill', 'none')
                    .attr('stroke', avgLineColor.toString())
                    .attr('stroke-linejoin', 'round')
                    .attr('stroke-linecap', 'round')
                    .attr('stroke-width', 1.5)
                    .attr('d', avgLine);

                const minMaxAreaColor = rgb(signalSpec.color);
                minMaxAreaColor.opacity = 0.5;
                this.minMaxAreaPathSelection[idx]
                    .datum(points[idx])
                    .attr('fill', minMaxAreaColor.toString())
                    .attr('stroke', 'none')
                    .attr('stroke-linejoin', 'round')
                    .attr('stroke-linecap', 'round')
                    .attr('d', minMaxArea);

                const circles = this.avgLinePointsSelection[idx]
                    .selectAll('circle')
                    .data(main);

                circles.enter().append('circle')
                    .merge(circles)
                    .attr('cx', d => xScale(d.ts))
                    .attr('cy', d => yScale(d.avg))
                    .attr('r', 3)
                    .attr('visibility', 'hidden')
                    .attr('fill', avgLineColor.toString());

                circles.exit().remove();

                avgLineCircles[idx] = circles;

                avgLineApproximators[idx] = new DataPathApproximator(this.avgLinePathSelection[idx].node(), xScale, yScale, width);
            }
        }
    }

    render() {
        if (!this.state.signalsData) {
            return (
                <svg ref={node => this.containerNode = node} height={this.props.height} width="100%">
                    <text textAnchor="middle" x="50%" y="50%" fontFamily="'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif" fontSize="14px">
                        {this.state.statusMsg}
                    </text>
                </svg>
            );

        } else {

            const paths = [];
            for (let idx = 0; idx < this.state.signalsData.length; idx++) {
                paths.push(
                    <g key={idx}>
                        <path ref={node => this.minMaxAreaPathSelection[idx] = select(node)}/>
                        <path ref={node => this.avgLinePathSelection[idx] = select(node)}/>
                        <g ref={node => this.avgLinePointsSelection[idx] = select(node)}/>
                    </g>
                );
            }

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

            return (
                <svg id="cnt" ref={node => this.containerNode = node} height={this.props.height} width="100%">
                    <g transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}>
                        {paths}
                    </g>
                    <g ref={node => this.xAxisSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.height - this.props.margin.bottom})`}/>
                    <g ref={node => this.yAxisSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
                    <line ref={node => this.cursorSelection = select(node)} strokeWidth="1" stroke="rgb(50,50,50)" visibility="hidden"/>
                    <text ref={node => this.statusMsgSelection = select(node)} textAnchor="middle" x="50%" y="50%" fontFamily="'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif" fontSize="14px"/>
                    {this.props.withTooltip &&
                        <Tooltip
                            signalConfig={this.props.config.signals}
                            containerHeight={this.props.height}
                            containerWidth={this.state.width}
                            mousePosition={this.state.mousePosition}
                            selection={this.state.selection}
                            contentComponent={this.props.tooltipContentComponent}
                            contentRender={this.props.tooltipContentRender}
                        />
                    }
                    {content}
                    <g ref={node => this.brushSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
                </svg>
            );
        }
    }
}
