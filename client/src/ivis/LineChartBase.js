'use strict';

import React, {Component} from "react";

import {translate} from "react-i18next";
import {RenderStatus, TimeBasedChartBase, createBase} from "./TimeBasedChartBase";
import * as d3Axis from "d3-axis";
import * as d3Scale from "d3-scale";
import * as d3Array from "d3-array";
import * as d3Selection from "d3-selection";
import {select} from "d3-selection";
import * as d3Shape from "d3-shape";
import {rgb} from "d3-color";
import PropTypes from "prop-types";
import {DataPathApproximator} from "./DataPathApproximator";


const SelectedState = {
    HIDDEN: 0,
    VISIBLE: 1,
    SELECTED: 2
};


@translate()
export class LineChartBase extends Component {
    constructor(props){
        super(props);

        const t = props.t;

        this.linePathSelection = {};
        this.linePointsSelection = {};

        // This serves to remember the selection state for each point (circle).
        // This way, we can minimize the number of attr calls which are actually quite costly in terms of style recalculation
        this.linePointsSelected = {};

        this.boundCreateChart = ::this.createChart;
        this.boundGetGraphContent = ::this.getGraphContent;
    }

    static propTypes = {
        config: PropTypes.object.isRequired,
        contentComponent: PropTypes.func,
        contentRender: PropTypes.func,
        onClick: PropTypes.func,
        height: PropTypes.number,
        margin: PropTypes.object,
        withTooltip: PropTypes.bool,
        withBrush: PropTypes.bool,
        tooltipContentComponent: PropTypes.func,
        tooltipContentRender: PropTypes.func,

        signalAggs: PropTypes.array.isRequired,
        lineAgg: PropTypes.string.isRequired,
        getSignalValuesForDefaultTooltip: PropTypes.func,
        prepareData: PropTypes.func.isRequired,
        createChart: PropTypes.func.isRequired,
        getSignalGraphContent: PropTypes.func.isRequired,
        getLineColor: PropTypes.func,
        lineCurve: PropTypes.func,
        withPoints: PropTypes.bool,
        withYAxis: PropTypes.bool
    }

    static defaultProps = {
        getLineColor: color => color,
        lineCurve: d3Shape.curveMonotoneX,
        withPoints: true,
        withYAxis: false
    }

    createChart(base, xScale) {
        const self = this;
        const width = base.renderedWidth;
        const abs = base.getIntervalAbsolute();
        const config = this.props.config;
        const signalAggs = this.props.signalAggs;
        const lineAgg = this.props.lineAgg;
        const lineCurve = this.props.lineCurve;
        const withPoints = this.props.withPoints;
        const withYAxis = this.props.withYAxis;

        const points = {};
        let yMin, yMax;

        const yScaleConfig = config.yScale || {};
        yMin = yScaleConfig.includedMin;
        yMax = yScaleConfig.includedMax;

        let noData = true;

        for (const sigSetConf of config.signalSets) {
            const {prev, main, next} = base.state.signalSetsData[sigSetConf.cid];

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

                        for (const agg of signalAggs) {
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

                        for (const agg of signalAggs) {
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

                    for (const agg of signalAggs) {
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
                        for (const agg of signalAggs) {
                            const yDataMin = pt.data[sigConf.cid][agg];
                            if (yMin === undefined || yMin > yDataMin) {
                                yMin = yDataMin;
                            }

                            const yDataMax = pt.data[sigConf.cid][agg];
                            if (yMax === undefined || yMax < yDataMax) {
                                yMax = yDataMax;
                            }
                        }
                    }
                }

                points[sigSetConf.cid] = pts;
                noData = false;
            }
        }


        let yScale;
        if (yMin !== undefined && yMax !== undefined) {
            yScale = d3Scale.scaleLinear()
                .domain([yMin, yMax])
                .range([this.props.height - this.props.margin.top - this.props.margin.bottom, 0]);

            if (withYAxis) {
                const yAxis = d3Axis.axisLeft(yScale);

                base.yAxisSelection
                    .call(yAxis);
            }
        }
        
        
        
        const lineApproximators = {};
        const lineCircles = {};
        let selection = null;
        let mousePosition = null;

        const selectPoints = function () {
            const containerPos = d3Selection.mouse(base.containerNode);
            const x = containerPos[0] - self.props.margin.left;
            const y = containerPos[1] - self.props.margin.top;
            const ts = xScale.invert(x);

            base.cursorSelection
                .attr('x1', containerPos[0])
                .attr('x2', containerPos[0]);

            if (!base.cursorLineVisible) {
                base.cursorSelection.attr('visibility', 'visible');
                base.cursorLineVisible = true;
            }

            if (noData) {
                return;
            }

            selection = {};
            let minDistance;

            // For each signal, select the point closest to the cursors
            for (const sigSetConf of config.signalSets) {
                const {main} = base.state.signalSetsData[sigSetConf.cid];
                if (main.length > 0) {
                    const bisectTs = d3Array.bisector(d => d.ts).right;

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
                const point = selection[sigSetConf.cid];

                if (point) {
                    isSelection = true;
                }

                if (withPoints) {
                    const {main} = base.state.signalSetsData[sigSetConf.cid];

                    for (const sigConf of sigSetConf.signals) {
                        if (main.length > 0) {
                            const showAllPoints = main.length <= width / 20
                                && lineApproximators[sigSetConf.cid][sigConf.cid].isPointContained(x, y);

                            self.linePointsSelection[sigSetConf.cid][sigConf.cid].selectAll('circle').each(function (dt, idx) {
                                if (dt === point && self.linePointsSelected[sigSetConf.cid][sigConf.cid][idx] !== SelectedState.SELECTED) {
                                    select(this).attr('r', 6).attr('visibility', 'visible');
                                    self.linePointsSelected[sigSetConf.cid][sigConf.cid][idx] = SelectedState.SELECTED;
                                } else if (showAllPoints && dt !== point && self.linePointsSelected[sigSetConf.cid][sigConf.cid][idx] !== SelectedState.VISIBLE) {
                                    select(this).attr('r', 3).attr('visibility', 'visible');
                                    self.linePointsSelected[sigSetConf.cid][sigConf.cid][idx] = SelectedState.VISIBLE;
                                } else if (!showAllPoints && dt !== point && self.linePointsSelected[sigSetConf.cid][sigConf.cid][idx] !== SelectedState.HIDDEN) {
                                    select(this).attr('r', 3).attr('visibility', 'hidden');
                                    self.linePointsSelected[sigSetConf.cid][sigConf.cid][idx] = SelectedState.HIDDEN;
                                }
                            });
                        }
                    }
                }
            }


            selection = isSelection ? selection : null;

            mousePosition = {x: containerPos[0], y: containerPos[1]};

            base.setState({
                selection,
                mousePosition
            });
        };

        const deselectPoints = function () {
            if (base.cursorLineVisible) {
                base.cursorSelection.attr('visibility', 'hidden');
                base.cursorLineVisible = false;
            }

            if (noData) {
                return;
            }

            if (withPoints) {
                for (const sigSetConf of config.signalSets) {
                    for (const sigConf of sigSetConf.signals) {
                        self.linePointsSelection[sigSetConf.cid][sigConf.cid].selectAll('circle').each(function (dt, idx) {
                            if (self.linePointsSelected[sigSetConf.cid][sigConf.cid][idx] !== SelectedState.HIDDEN) {
                                select(this).attr('visibility', 'hidden');
                                self.linePointsSelected[sigSetConf.cid][sigConf.cid][idx] = SelectedState.HIDDEN;
                            }
                        });
                    }
                }
            }

            if (selection) {
                selection = null;
                mousePosition = null;

                base.setState({
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

        base.brushSelection
            .on('mouseenter', selectPoints)
            .on('mousemove', selectPoints)
            .on('mouseleave', deselectPoints)
            .on('click', click);


        if (noData) {
            return RenderStatus.NO_DATA;
        }


        const line = sigCid => d3Shape.line()
            .x(d => xScale(d.ts))
            .y(d => yScale(d.data[sigCid][lineAgg]))
            .curve(lineCurve);



        for (const sigSetConf of config.signalSets) {
            lineCircles[sigSetConf.cid] = {};
            lineApproximators[sigSetConf.cid] = {};

            this.linePointsSelected[sigSetConf.cid] = {};

            if (points[sigSetConf.cid]) {
                const {main} = base.state.signalSetsData[sigSetConf.cid];

                for (const sigConf of sigSetConf.signals) {

                    const lineColor = this.props.getLineColor(rgb(sigConf.color));
                    this.linePathSelection[sigSetConf.cid][sigConf.cid]
                        .datum(points[sigSetConf.cid])
                        .attr('fill', 'none')
                        .attr('stroke', lineColor.toString())
                        .attr('stroke-linejoin', 'round')
                        .attr('stroke-linecap', 'round')
                        .attr('stroke-width', 1.5)
                        .attr('d', line(sigConf.cid));

                    if (withPoints) {
                        const circles = this.linePointsSelection[sigSetConf.cid][sigConf.cid]
                            .selectAll('circle')
                            .data(main);

                        circles.enter().append('circle')
                            .merge(circles)
                            .attr('cx', d => xScale(d.ts))
                            .attr('cy', d => yScale(d.data[sigConf.cid][lineAgg]))
                            .attr('r', 3)
                            .attr('visibility', 'hidden')
                            .attr('fill', lineColor.toString());

                        this.linePointsSelected[sigSetConf.cid][sigConf.cid] = Array(main.length).fill(SelectedState.HIDDEN);

                        circles.exit().remove();

                        lineCircles[sigSetConf.cid][sigConf.cid] = circles;
                    }

                    lineApproximators[sigSetConf.cid][sigConf.cid] = new DataPathApproximator(this.linePathSelection[sigSetConf.cid][sigConf.cid].node(), xScale, yScale, width);
                }
            }
        }

        return this.props.createChart(createBase(base, this), xScale, yScale, points);
    }

    getGraphContent(base) {
        const config = this.props.config;
        const self = createBase(base, this);

        const paths = [];
        for (const sigSetConf of config.signalSets) {
            for (const sigConf of sigSetConf.signals) {
                paths.push(
                    <g key={sigSetConf.cid + " " + sigConf.cid}>
                        {this.props.getSignalGraphContent(self, sigSetConf.cid, sigConf.cid)}
                        <path ref={node => this.linePathSelection[sigSetConf.cid][sigConf.cid] = select(node)}/>
                        <g ref={node => this.linePointsSelection[sigSetConf.cid][sigConf.cid] = select(node)}/>
                    </g>
                );
            }
        }

        return paths;
    }

    render() {
        const props = this.props;

        for (const sigSetConf of props.config.signalSets) {
            this.linePathSelection[sigSetConf.cid] = {};
            this.linePointsSelection[sigSetConf.cid] = {};
        }

        return (
            <TimeBasedChartBase
                config={props.config}
                height={props.height}
                margin={props.margin}
                getQuerySignalAggs={() => props.signalAggs}
                prepareData={props.prepareData}
                createChart={this.boundCreateChart}
                getGraphContent={this.boundGetGraphContent}
                withTooltip={props.withTooltip}
                withBrush={props.withBrush}
                contentComponent={props.contentComponent}
                contentRender={props.contentRender}
                tooltipContentComponent={this.props.tooltipContentComponent}
                tooltipContentRender={this.props.tooltipContentRender}
                getSignalValuesForDefaultTooltip={this.props.getSignalValuesForDefaultTooltip}
            />
        );
    }
}
