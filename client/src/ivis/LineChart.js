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
import {dataAccess} from "./DataAccess";
import {withAsyncErrorHandler, withErrorHandling} from "../lib/error-handling";
import interoperableErrors from "../../../shared/interoperable-errors";
import PropTypes from "prop-types";
import {roundToMinAggregationInterval} from "../../../shared/signals";
import {IntervalSpec} from "./TimeInterval";
import {DataPathApproximator} from "./DataPathApproximator";
import {Tooltip} from "./Tooltip";


const SelectedState = {
    HIDDEN: 0,
    VISIBLE: 1,
    SELECTED: 2
};

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

        // This serves to remember the selection state for each point (circle).
        // This way, we can minimize the number of attr calls which are actually quite costly in terms of style recalculation
        this.avgLinePointsSelected = {};

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
            // console.log('props changed');
            this.setState({
                signalSetsData: null,
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
        // console.log('update');
        const forceRefresh = this.prevContainerNode !== this.containerNode
            || prevState.signalSetsData !== this.state.signalSetsData
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
        // console.log('fetch');
        const t = this.props.t;

        try {
            const signalSets = {};
            for (const setSpec of config.signalSets) {
                const signals = {};
                for (const sigSpec of setSpec.signals) {
                    if (sigSpec.xFun) {
                        signals[sigSpec.cid] = {
                            xFun: sigSpec.xFun
                        };
                    } else {
                        signals[sigSpec.cid] = ['min', 'avg', 'max'];
                    }
                }

                signalSets[setSpec.cid] = signals;
            }

            this.fetchDataCounter += 1;
            const fetchDataCounter = this.fetchDataCounter;

            const signalSetsData = await dataAccess.getSignalSets(signalSets, abs);

            if (this.fetchDataCounter === fetchDataCounter) {
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
        const config = this.props.config;

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

        console.log('createChart');

        const abs = this.getIntervalAbsolute();

        const points = {};
        let yMin, yMax;

        const yScaleConfig = config.yScale || {};
        yMin = yScaleConfig.includedMin;
        yMax = yScaleConfig.includedMax;

        let noData = true;

        console.log(this.state.signalSetsData);

        for (const sigSetConf of config.signalSets) {
            const {prev, main, next} = this.state.signalSetsData[sigSetConf.cid];

            let pts;

            if (main.length > 0) {
                pts = main.slice();

                if (prev) {
                    const prevInterpolated = {
                        ts: abs.from,
                        data: {}
                    };

                    for (const sigConf of sigSetConf.signals) {
                        prevInterpolated.data[sigConf.cid] = {};

                        for (const agg of ['min', 'avg', 'max']) {
                            const delta = (abs.from - prev.ts) / (pts[0].ts - prev.ts);
                            prevInterpolated.data[sigConf.cid][agg] = prev.data[sigConf.cid][agg] * (1 - delta) + pts[0].data[sigConf.cid][agg] * delta;
                        }
                    }

                    pts.unshift(prevInterpolated);
                }

                if (next) {
                    const nextInterpolated = {
                        ts: abs.to,
                        data: {}
                    };

                    for (const sigConf of sigSetConf.signals) {
                        nextInterpolated.data[sigConf.cid] = {};

                        for (const agg of ['min', 'avg', 'max']) {
                            const delta = (next.ts - abs.to) / (next.ts - pts[pts.length - 1].ts);
                            nextInterpolated.data[sigConf.cid][agg] = next.data[sigConf.cid][agg] * (1 - delta) + pts[pts.length - 1].data[sigConf.cid][agg] * delta;
                        }
                    }

                    pts.push(nextInterpolated);
                }

            } else if (main.length === 0 && prev && next) {
                const prevInterpolated = {
                    ts: abs.from,
                    data: {}
                };

                const nextInterpolated = {
                    ts: abs.to,
                    data: {}
                };

                for (const sigConf of sigSetConf.signals) {
                    prevInterpolated.data[sigConf.cid] = {};
                    nextInterpolated.data[sigConf.cid] = {};

                    for (const agg of ['min', 'avg', 'max']) {
                        const deltaFrom = (abs.from - prev.ts) / (next.ts - prev.ts);
                        const deltaTo = (abs.to - prev.ts) / (next.ts - prev.ts);
                        prevInterpolated.data[sigConf.cid][agg] = prev.data[sigConf.cid][agg] * (1 - deltaFrom) + next.data[sigConf.cid][agg] * deltaFrom;
                        nextInterpolated.data[sigConf.cid][agg] = prev.data[sigConf.cid][agg] * (1 - deltaTo) + next.data[sigConf.cid][agg] * deltaTo;
                    }
                }

                pts = [prevInterpolated, nextInterpolated];
            }

            if (pts) {
                for (let idx = 0; idx < pts.length; idx++) {
                    const pt = pts[idx];

                    for (const sigConf of sigSetConf.signals) {
                        const yDataMin = pt.data[sigConf.cid].min;
                        if (yMin === undefined || yMin > yDataMin) {
                            yMin = yDataMin;
                        }

                        const yDataMax = pt.data[sigConf.cid].max;
                        if (yMax === undefined || yMax < yDataMax) {
                            yMax = yDataMax;
                        }
                    }
                }

                points[sigSetConf.cid] = pts;
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
                .attr('x1', containerPos[0])
                .attr('x2', containerPos[0]);

            if (!self.cursorLineVisible) {
                self.cursorSelection.attr('visibility', 'visible');
                self.cursorLineVisible = true;
                console.log('visible');
            }

            if (noData) {
                return;
            }

            selection = {};
            let minDistance;

            // For each signal, select the point closest to the cursors
            for (const sigSetConf of config.signalSets) {
                const {main} = self.state.signalSetsData[sigSetConf.cid];
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

                    selection[sigSetConf.cid] = point;
                }
            }

            // Remove points that are not the the closest ones
            for (const sigSetConf of config.signalSets) {
                const point = selection[sigSetConf.cid];
                if (Math.abs(point.ts - ts) > minDistance) {
                    delete selection[sigSetConf.cid];
                }
            }


            let isSelection = false;

            // Draw the points including the small points on the paths that is hovered over
            for (const sigSetConf of config.signalSets) {
                const {main} = self.state.signalSetsData[sigSetConf.cid];

                const point = selection[sigSetConf.cid];

                if (point) {
                    isSelection = true;
                }

                for (const sigConf of sigSetConf.signals) {
                    if (main.length > 0) {
                        const showAllPoints = main.length <= width / 20
                            && avgLineApproximators[sigSetConf.cid][sigConf.cid].isPointContained(x, y);

                        self.avgLinePointsSelection[sigSetConf.cid][sigConf.cid].selectAll('circle').each(function (dt, idx) {
                            if (dt === point && self.avgLinePointsSelected[sigSetConf.cid][sigConf.cid][idx] !== SelectedState.SELECTED) {
                                select(this).attr('r', 6).attr('visibility', 'visible');
                                self.avgLinePointsSelected[sigSetConf.cid][sigConf.cid][idx] = SelectedState.SELECTED;
                            } else if (showAllPoints && dt !== point && self.avgLinePointsSelected[sigSetConf.cid][sigConf.cid][idx] !== SelectedState.VISIBLE) {
                                select(this).attr('r', 3).attr('visibility', 'visible');
                                self.avgLinePointsSelected[sigSetConf.cid][sigConf.cid][idx] = SelectedState.VISIBLE;
                            } else if (!showAllPoints && dt !== point && self.avgLinePointsSelected[sigSetConf.cid][sigConf.cid][idx] !== SelectedState.HIDDEN) {
                                select(this).attr('r', 3).attr('visibility', 'hidden');
                                self.avgLinePointsSelected[sigSetConf.cid][sigConf.cid][idx] = SelectedState.HIDDEN;
                            }
                        });
                    }
                }
            }


            selection = isSelection ? selection : null;

            mousePosition = {x: containerPos[0], y: containerPos[1]};

            self.setState({
                selection,
                mousePosition
            });
        };

        const deselectPoints = function () {
            if (self.cursorLineVisible) {
                self.cursorSelection.attr('visibility', 'hidden');
                self.cursorLineVisible = false;
            }

            if (noData) {
                return;
            }

            for (const sigSetConf of config.signalSets) {
                for (const sigConf of sigSetConf.signals) {
                    self.avgLinePointsSelection[sigSetConf.cid][sigConf.cid].selectAll('circle').each(function (dt, idx) {
                        if (self.avgLinePointsSelected[sigSetConf.cid][sigConf.cid][idx] !== SelectedState.HIDDEN) {
                            select(this).attr('visibility', 'hidden');
                            self.avgLinePointsSelected[sigSetConf.cid][sigConf.cid][idx] = SelectedState.HIDDEN;
                        }
                    });
                }
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

        const avgLine = sigCid => line()
            .x(d => xScale(d.ts))
            .y(d => yScale(d.data[sigCid].avg))
            .curve(curveMonotoneX);

        const minMaxArea = sigCid => area()
            .x(d => xScale(d.ts))
            .y0(d => yScale(d.data[sigCid].min))
            .y1(d => yScale(d.data[sigCid].max))
            .curve(curveMonotoneX);


        for (const sigSetConf of config.signalSets) {
            avgLineCircles[sigSetConf.cid] = {};
            avgLineApproximators[sigSetConf.cid] = {};

            this.avgLinePointsSelected[sigSetConf.cid] = {};

            if (points[sigSetConf.cid]) {
                const {main} = this.state.signalSetsData[sigSetConf.cid];

                for (const sigConf of sigSetConf.signals) {

                    const avgLineColor = rgb(sigConf.color);
                    this.avgLinePathSelection[sigSetConf.cid][sigConf.cid]
                        .datum(points[sigSetConf.cid])
                        .attr('fill', 'none')
                        .attr('stroke', avgLineColor.toString())
                        .attr('stroke-linejoin', 'round')
                        .attr('stroke-linecap', 'round')
                        .attr('stroke-width', 1.5)
                        .attr('d', avgLine(sigConf.cid));

                    const minMaxAreaColor = rgb(sigConf.color);
                    minMaxAreaColor.opacity = 0.5;
                    this.minMaxAreaPathSelection[sigSetConf.cid][sigConf.cid]
                        .datum(points[sigSetConf.cid])
                        .attr('fill', minMaxAreaColor.toString())
                        .attr('stroke', 'none')
                        .attr('stroke-linejoin', 'round')
                        .attr('stroke-linecap', 'round')
                        .attr('d', minMaxArea(sigConf.cid));

                    const circles = this.avgLinePointsSelection[sigSetConf.cid][sigConf.cid]
                        .selectAll('circle')
                        .data(main);

                    circles.enter().append('circle')
                        .merge(circles)
                        .attr('cx', d => xScale(d.ts))
                        .attr('cy', d => yScale(d.data[sigConf.cid].avg))
                        .attr('r', 3)
                        .attr('visibility', 'hidden')
                        .attr('fill', avgLineColor.toString());

                    this.avgLinePointsSelected[sigSetConf.cid][sigConf.cid] = Array(main.length).fill(SelectedState.HIDDEN);

                    circles.exit().remove();

                    avgLineCircles[sigSetConf.cid][sigConf.cid] = circles;

                    avgLineApproximators[sigSetConf.cid][sigConf.cid] = new DataPathApproximator(this.avgLinePathSelection[sigSetConf.cid][sigConf.cid].node(), xScale, yScale, width);
                }
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

            const paths = [];
            for (const sigSetConf of config.signalSets) {
                this.minMaxAreaPathSelection[sigSetConf.cid] = {};
                this.avgLinePathSelection[sigSetConf.cid] = {};
                this.avgLinePointsSelection[sigSetConf.cid] = {};

                for (const sigConf of sigSetConf.signals) {
                    paths.push(
                        <g key={sigSetConf.cid + " " + sigConf.cid}>
                            <path ref={node => this.minMaxAreaPathSelection[sigSetConf.cid][sigConf.cid] = select(node)}/>
                            <path ref={node => this.avgLinePathSelection[sigSetConf.cid][sigConf.cid] = select(node)}/>
                            <g ref={node => this.avgLinePointsSelection[sigSetConf.cid][sigConf.cid] = select(node)}/>
                        </g>
                    );
                }
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
                            signalSetsConfig={this.props.config.signalSets}
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
