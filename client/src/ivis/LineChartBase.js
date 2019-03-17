'use strict';

import React, {Component} from "react";
import {
    createBase,
    isSignalVisible,
    RenderStatus,
    TimeBasedChartBase
} from "./TimeBasedChartBase";
import * as d3Axis
    from "d3-axis";
import * as d3Scale
    from "d3-scale";
import * as d3Array
    from "d3-array";
import * as d3Selection
    from "d3-selection";
import {select} from "d3-selection";
import * as d3Shape
    from "d3-shape";
import {rgb} from "d3-color";
import PropTypes
    from "prop-types";
import {DataPathApproximator} from "./DataPathApproximator";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";


const SelectedState = {
    HIDDEN: 0,
    VISIBLE: 1,
    SELECTED: 2
};

export const PointsVisibility = {
    NEVER: 0,
    HOVER: 1,
    ALWAYS: 2
};

export function lineWithoutPoints() {
    return ({config, signalSetsData, width}) => {
        return {
            lineVisible: true,
            pointsVisible: false,
            selectedPointsVisible: false
        };
    };
}

export function lineWithPointsOnHover(widthFraction = 20) {
    return ({config, signalSetsData, width}) => {
        let pointsVisible = PointsVisibility.NEVER;

        for (const sigSetConf of config.signalSets) {
            const {main} = signalSetsData[sigSetConf.cid];

            if (main.length > 0 && main.length <= width / widthFraction) {
                for (const sigConf of sigSetConf.signals) {
                    if (isSignalVisible(sigConf)) {
                        pointsVisible = PointsVisibility.HOVER;
                        break;
                    }
                }
            }
        }

        return {
            lineVisible: true,
            pointsVisible,
            selectedPointsVisible: true
        };
    };
}

export function pointsOnNoAggregation({abs}) {
    if (abs.aggregationInterval && abs.aggregationInterval.valueOf() === 0) {
        return {
            lineVisible: false,
            pointsVisible: PointsVisibility.ALWAYS,
            selectedPointsVisible: true
        };
    } else {
        return {
            lineVisible: true,
            pointsVisible: PointsVisibility.NEVER,
            selectedPointsVisible: true
        };

    }
}

export function getAxisIdx(sigConf) {
    return sigConf.axis || 0;
}

@withComponentMixins([
    withTranslation
])
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
        this.boundGetQueries = ::this.getQueries;
        this.boundPrepareData = ::this.prepareData;
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
        tooltipExtraProps: PropTypes.object,

        signalAggs: PropTypes.array.isRequired,
        lineAgg: PropTypes.string.isRequired,
        getSignalValuesForDefaultTooltip: PropTypes.func,
        prepareData: PropTypes.func.isRequired,
        createChart: PropTypes.func.isRequired,
        getSignalGraphContent: PropTypes.func.isRequired,
        getLineColor: PropTypes.func,
        lineCurve: PropTypes.func,

        lineVisibility: PropTypes.func.isRequired,

        getExtraQueries: PropTypes.func,
        processGraphContent: PropTypes.func,

        controlTimeIntervalChartWidth: PropTypes.bool
    }

    static defaultProps = {
        getLineColor: color => color,
        lineCurve: d3Shape.curveLinear,
        withPoints: true
    }

    createChart(base, signalSetsData, baseState, abs, xScale) {
        const self = this;
        const width = base.renderedWidth;
        const config = this.props.config;
        const signalAggs = this.props.signalAggs;
        const lineAgg = this.props.lineAgg;
        const lineCurve = this.props.lineCurve;

        const lineVisibility = this.props.lineVisibility({config, signalSetsData, width, abs});
        const {lineVisible, pointsVisible, selectedPointsVisible} = lineVisibility;

        const points = {};

        const yMin = [];
        const yMax = [];

        const yAxes = config.yAxes || [{ visible: true }];

        for (let axisIdx = 0; axisIdx < yAxes.length; axisIdx++) {
            const yAxis = yAxes[axisIdx];
            yMin.push(yAxis.includedMin);
            yMax.push(yAxis.includedMax);
        }

        let noData = true;

        for (const sigSetConf of config.signalSets) {
            const {prev, main, next} = signalSetsData[sigSetConf.cid];

            let pts;

            if (main.length > 0) {
                pts = main.slice();

                if (prev) {
                    const prevInterpolated = {
                        ts: abs.from,
                        data: {}
                    };

                    for (const sigConf of sigSetConf.signals) {
                        if (isSignalVisible(sigConf)) {
                            prevInterpolated.data[sigConf.cid] = {};

                            for (const agg of signalAggs) {
                                const delta = (abs.from - prev.ts) / (pts[0].ts - prev.ts);
                                prevInterpolated.data[sigConf.cid][agg] = prev.data[sigConf.cid][agg] * (1 - delta) + pts[0].data[sigConf.cid][agg] * delta;
                            }
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
                        if (isSignalVisible(sigConf)) {
                            nextInterpolated.data[sigConf.cid] = {};

                            for (const agg of signalAggs) {
                                const delta = (next.ts - abs.to) / (next.ts - pts[pts.length - 1].ts);
                                nextInterpolated.data[sigConf.cid][agg] = next.data[sigConf.cid][agg] * (1 - delta) + pts[pts.length - 1].data[sigConf.cid][agg] * delta;
                            }
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
                    if (isSignalVisible(sigConf)) {
                        prevInterpolated.data[sigConf.cid] = {};
                        nextInterpolated.data[sigConf.cid] = {};

                        for (const agg of signalAggs) {
                            const deltaFrom = (abs.from - prev.ts) / (next.ts - prev.ts);
                            const deltaTo = (abs.to - prev.ts) / (next.ts - prev.ts);
                            prevInterpolated.data[sigConf.cid][agg] = prev.data[sigConf.cid][agg] * (1 - deltaFrom) + next.data[sigConf.cid][agg] * deltaFrom;
                            nextInterpolated.data[sigConf.cid][agg] = prev.data[sigConf.cid][agg] * (1 - deltaTo) + next.data[sigConf.cid][agg] * deltaTo;
                        }
                    }
                }

                pts = [prevInterpolated, nextInterpolated];
            }

            if (pts) {
                for (let idx = 0; idx < pts.length; idx++) {
                    const pt = pts[idx];

                    for (const sigConf of sigSetConf.signals) {
                        const axisIdx = getAxisIdx(sigConf);

                        if (isSignalVisible(sigConf)) {
                            for (const agg of signalAggs) {
                                const yDataMin = pt.data[sigConf.cid][agg];
                                if (yDataMin !== null && (yMin[axisIdx] === undefined || yMin[axisIdx] > yDataMin)) {
                                    yMin[axisIdx] = yDataMin;
                                }

                                const yDataMax = pt.data[sigConf.cid][agg];
                                if (yDataMax !== null && (yMax[axisIdx] === undefined || yMax[axisIdx] < yDataMax)) {
                                    yMax[axisIdx] = yDataMax;
                                }
                            }
                        }
                    }
                }

                points[sigSetConf.cid] = pts;
                noData = false;
            }
        }

        for (let axisIdx = 0; axisIdx < yAxes.length; axisIdx++) {
            if (yMin[axisIdx] !== null && yMax[axisIdx] !== null) {
                const yAxis = yAxes[axisIdx];

                if (yAxis.belowMin) {
                    yMin[axisIdx] -= (yMax[axisIdx] - yMin[axisIdx]) * yAxis.belowMin;
                }

                if (yAxis.limitMin !== undefined || yAxis.limitMin !== null) {
                    yMin[axisIdx] = yMin[axisIdx] < yAxis.limitMin ? yAxis.limitMin : yMin[axisIdx];
                }

                if (yAxis.aboveMax) {
                    yMax[axisIdx] += (yMax[axisIdx] - yMin[axisIdx]) * yAxis.aboveMax;
                }

                if (yAxis.limitMax !== undefined || yAxis.limitMax !== null) {
                    yMax[axisIdx] = yMax[axisIdx] < yAxis.limitMax ? yAxis.limitMax : yMax[axisIdx];
                }
            }
        }


        const yScales = [];
        let visibleAxisIdx = 0;

        base.yAxisSelection.selectAll('*').remove();

        for (let axisIdx = 0; axisIdx < yAxes.length; axisIdx++) {
            let yScale = null;
            if (yMin[axisIdx] !== undefined && yMax[axisIdx] !== undefined) {
                yScale = d3Scale.scaleLinear()
                    .domain([yMin[axisIdx], yMax[axisIdx]])
                    .range([this.props.height - this.props.margin.top - this.props.margin.bottom, 0]);
            }

            yScales.push(yScale);

            if (yScale && yAxes[axisIdx].visible) {
                let yAxis;
                let shift;
                let labelTranslate;

                const labelOffset = yAxes[axisIdx].labelOffset || 40;

                if (visibleAxisIdx === 0) {
                    yAxis = d3Axis.axisLeft(yScale);
                    shift = 0;
                    labelTranslate = -labelOffset;
                } else if (visibleAxisIdx === 1) {
                    yAxis = d3Axis.axisRight(yScale);
                    shift = width - this.props.margin.left - this.props.margin.right;
                    labelTranslate = shift + labelOffset;
                } else if (visibleAxisIdx === 2) {
                    yAxis = d3Axis.axisRight(yScale);
                    shift = 0;
                    labelTranslate = labelOffset;
                } else if (visibleAxisIdx === 3) {
                    yAxis = d3Axis.axisLeft(yScale);
                    shift = width - this.props.margin.left - this.props.margin.right;
                    labelTranslate = shift - labelOffset;
                } else {
                    throw new Error("At most 4 visible y axes are supported.");
                }

                base.yAxisSelection.append('g').attr("transform", "translate( " + shift + ", 0 )").call(yAxis);
                base.yAxisSelection.append('text')
                        .attr("transform", "rotate(-90)")
                        .attr("y", labelTranslate)
                        .attr("x",0 - (this.props.height / 2 + this.props.margin.top))
                        .style("text-anchor", "middle")
                        .style("font-size", 12)
                        .text(yAxes[axisIdx].label);

                visibleAxisIdx = +1;
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
                const {main} = signalSetsData[sigSetConf.cid];
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
                if (point && Math.abs(point.ts - ts) > minDistance) {
                    delete selection[sigSetConf.cid];
                }
            }


            let isSelection = false;

            for (const sigSetConf of config.signalSets) {
                const point = selection[sigSetConf.cid];

                if (point) {
                    isSelection = true;
                }
            }

            // Draw the points including the small points on the paths that is hovered over
            let showAllPoints;

            if (pointsVisible === PointsVisibility.ALWAYS) {
                showAllPoints = true;

            } else if (pointsVisible === PointsVisibility.HOVER) {
                showAllPoints = false;

                for (const sigSetConf of config.signalSets) {
                    for (const sigConf of sigSetConf.signals) {
                        const approximator = lineApproximators[sigSetConf.cid][sigConf.cid];
                        if (approximator && isSignalVisible(sigConf) && approximator.isPointContained(x, y)) {
                            showAllPoints = true;
                            break;
                        }
                    }
                }
            } else if (pointsVisible === PointsVisibility.NEVER) {
                showAllPoints = false;
            }

            for (const sigSetConf of config.signalSets) {
                const point = selection[sigSetConf.cid];

                const {main} = signalSetsData[sigSetConf.cid];

                if (main.length > 0) {
                    for (const sigConf of sigSetConf.signals) {
                        if (isSignalVisible(sigConf)) {
                            self.linePointsSelection[sigSetConf.cid][sigConf.cid].selectAll('circle').each(function (dt, idx) {
                                const selectState = self.linePointsSelected[sigSetConf.cid][sigConf.cid][idx];

                                if (dt === point) {
                                    if (selectedPointsVisible && selectState !== SelectedState.SELECTED) {
                                        select(this).attr('r', 6).attr('visibility', 'visible');
                                    } else if ((pointsVisible === PointsVisibility.ALWAYS || pointsVisible === PointsVisibility.HOVER) && selectState === SelectedState.HIDDEN) {
                                        select(this).attr('r', 3).attr('visibility', 'visible');
                                    }
                                    self.linePointsSelected[sigSetConf.cid][sigConf.cid][idx] = SelectedState.SELECTED;

                                } else if (showAllPoints && dt !== point && selectState !== SelectedState.VISIBLE) {
                                    select(this).attr('r', 3).attr('visibility', 'visible');
                                    self.linePointsSelected[sigSetConf.cid][sigConf.cid][idx] = SelectedState.VISIBLE;

                                } else if (!showAllPoints && dt !== point && selectState !== SelectedState.HIDDEN) {
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

            if (pointsVisible === PointsVisibility.HOVER || pointsVisible === PointsVisibility.NEVER) {
                for (const sigSetConf of config.signalSets) {
                    for (const sigConf of sigSetConf.signals) {
                        if (isSignalVisible(sigConf)) {
                            self.linePointsSelection[sigSetConf.cid][sigConf.cid].selectAll('circle').each(function (dt, idx) {
                                if (self.linePointsSelected[sigSetConf.cid][sigConf.cid][idx] !== SelectedState.HIDDEN) {
                                    select(this).attr('visibility', 'hidden');
                                    self.linePointsSelected[sigSetConf.cid][sigConf.cid][idx] = SelectedState.HIDDEN;
                                }
                            });
                        }
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

        for (const sigSetConf of config.signalSets) {
            lineCircles[sigSetConf.cid] = {};
            lineApproximators[sigSetConf.cid] = {};

            this.linePointsSelected[sigSetConf.cid] = {};

            if (points[sigSetConf.cid]) {
                const {main} = signalSetsData[sigSetConf.cid];

                for (const sigConf of sigSetConf.signals) {
                    if (isSignalVisible(sigConf)) {
                        const sigCid = sigConf.cid;
                        const yScale = yScales[getAxisIdx(sigConf)];

                        const line = d3Shape.line()
                            .defined(d => d.data[sigCid][lineAgg] !== null)
                            .x(d => xScale(d.ts))
                            .y(d => yScale(d.data[sigCid][lineAgg]))
                            .curve(lineCurve);

                        const lineColor = this.props.getLineColor(rgb(sigConf.color));
                        this.linePathSelection[sigSetConf.cid][sigCid]
                            .datum(points[sigSetConf.cid])
                            .attr('visibility', lineVisible ? 'visible' : 'hidden')
                            .attr('fill', 'none')
                            .attr('stroke', lineColor.toString())
                            .attr('stroke-linejoin', 'round')
                            .attr('stroke-linecap', 'round')
                            .attr('stroke-width', 1.5)
                            .attr('d', line);

                        if (pointsVisible === PointsVisibility.HOVER || pointsVisible === PointsVisibility.ALWAYS || selectedPointsVisible) {
                            const circles = this.linePointsSelection[sigSetConf.cid][sigCid]
                                .selectAll('circle')
                                .data(main);

                            circles.enter()
                                .append('circle')
                                .merge(circles)
                                .attr('cx', d => xScale(d.ts))
                                .attr('cy', d => yScale(d.data[sigCid][lineAgg]))
                                .attr('r', 3)
                                .attr('visibility', pointsVisible === PointsVisibility.ALWAYS ? 'visible' : 'hidden')
                                .attr('fill', lineColor.toString());

                            this.linePointsSelected[sigSetConf.cid][sigCid] = Array(main.length).fill(SelectedState.HIDDEN);

                            circles.exit().remove();

                            lineCircles[sigSetConf.cid][sigCid] = circles;
                        }

                        lineApproximators[sigSetConf.cid][sigCid] = new DataPathApproximator(this.linePathSelection[sigSetConf.cid][sigCid].node(), xScale, yScale, width);
                    }
                }
            }
        }

        return this.props.createChart(createBase(base, this), signalSetsData, baseState, abs, xScale, yScales, points, lineVisibility);
    }

    getGraphContent(base) {
        const config = this.props.config;
        const self = createBase(base, this);

        const paths = [];
        let sigSetIdx = 0;
        for (const sigSetConf of config.signalSets) {
            let sigIdx = 0;
            for (const sigConf of sigSetConf.signals) {
                if (isSignalVisible(sigConf)) {
                    paths.push(
                        <g key={`${sigSetIdx}-${sigIdx}`}>
                            {this.props.getSignalGraphContent(self, sigSetConf.cid, sigConf.cid)}
                            <path ref={node => this.linePathSelection[sigSetConf.cid][sigConf.cid] = select(node)}/>
                            <g ref={node => this.linePointsSelection[sigSetConf.cid][sigConf.cid] = select(node)}/>
                        </g>
                    );
                }

                sigIdx += 1;
            }

            sigSetIdx += 1;
        }

        if (this.props.getGraphContent) {
            return this.props.getGraphContent(self, paths);
        } else {
            return paths;
        }
    }

    getQueries(base, abs, config) {
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
                        aggs: this.props.signalAggs
                    };
                } else {
                    signals[sigSpec.cid] = this.props.signalAggs;
                }
            }

            signalSets[setSpec.cid] = {
                tsSigCid: setSpec.tsSigCid,
                signals
            };
        }

        const queries = [
            { type: 'timeSeries', args: [ signalSets, abs ] }
        ];

        if (this.props.getExtraQueries) {
            queries.push(...this.props.getExtraQueries(createBase(base, this), abs));
        }

        return queries;
    }

    prepareData(base, results) {
        return this.props.prepareData(createBase(base, this), results[0], results.slice(1));
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
                prepareData={this.boundPrepareData}
                getQueries={this.boundGetQueries}
                createChart={this.boundCreateChart}
                getGraphContent={this.boundGetGraphContent}
                withTooltip={props.withTooltip}
                withBrush={props.withBrush}
                contentComponent={props.contentComponent}
                contentRender={props.contentRender}
                tooltipContentComponent={this.props.tooltipContentComponent}
                tooltipContentRender={this.props.tooltipContentRender}
                tooltipExtraProps={this.props.tooltipExtraProps}
                getSignalValuesForDefaultTooltip={this.props.getSignalValuesForDefaultTooltip}
                controlTimeIntervalChartWidth={this.props.controlTimeIntervalChartWidth}
            />
        );
    }
}
