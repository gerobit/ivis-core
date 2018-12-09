'use strict';

import React, {Component} from "react";

import {translate} from "react-i18next";
import {RenderStatus, isSignalVisible} from "./TimeBasedChartBase";
import {LineChartBase} from "./LineChartBase";
import {select} from "d3-selection";
import * as d3Shape from "d3-shape";
import {rgb} from "d3-color";
import PropTypes from "prop-types";
import tooltipStyles from "./Tooltip.scss";

function getSignalValuesForDefaultTooltip(tooltipContent, sigSetCid, sigCid, signalData) {
    const val = signalData.max ? 'ON' : 'OFF';

    return (
        <span className={tooltipStyles.signalVal}>{val}</span>
    );
}

@translate()
export class OnOffAreaChart extends Component {
    constructor(props){
        super(props);

        const t = props.t;

        this.areaPathSelection = {};

        this.boundCreateChart = ::this.createChart;
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
        tooltipExtraProps: PropTypes.object
    }

    static defaultProps = {
        margin: { left: 5, right: 5, top: 5, bottom: 20 },
        height: 500,
        withTooltip: true,
        withBrush: true
    }

    prepareData(base, signalSetsData, extraData) {
        const data = signalSetsData;

        const signalSetsReverse = this.props.config.signalSets.slice().reverse();

        for (const setSpec of signalSetsReverse) {
            const signalsReverse = setSpec.signals.slice().reverse();

            const changeData = data => {
                let accumulator = 0;
                for (const sigSpec of signalsReverse) {
                    accumulator += data[sigSpec.cid].max;
                    data[sigSpec.cid].max = data[sigSpec.cid].max ? accumulator : 0;
                }
            };

            const sigSetData = data[setSpec.cid];
            if (sigSetData.prev) {
                changeData(sigSetData.prev.data);
            }
            for (const main of sigSetData.main) {
                changeData(main.data);
            }
            if (sigSetData.next) {
                changeData(sigSetData.next.data);
            }
        }

        return {
            signalSetsData: data
        };
    }

    createChart(base, baseState, abs, xScale, yScale, points) {
        const minMaxArea = sigCid => d3Shape.area()
            .x(d => xScale(d.ts))
            .y0(d => yScale(0))
            .y1(d => yScale(d.data[sigCid].max))
            .curve(d3Shape.curveStep);


        for (const sigSetConf of this.props.config.signalSets) {
            if (points[sigSetConf.cid]) {
                for (const sigConf of sigSetConf.signals) {
                    if (isSignalVisible(sigConf)) {
                        const minMaxAreaColor = rgb(sigConf.color);

                        this.areaPathSelection[sigSetConf.cid][sigConf.cid]
                            .datum(points[sigSetConf.cid])
                            .attr('fill', minMaxAreaColor.toString())
                            .attr('stroke', 'none')
                            .attr('stroke-linejoin', 'round')
                            .attr('stroke-linecap', 'round')
                            .attr('d', minMaxArea(sigConf.cid));
                    }
                }
            }
        }

        return RenderStatus.SUCCESS;
    }

    render() {
        const props = this.props;

        for (const sigSetConf of props.config.signalSets) {
            this.areaPathSelection[sigSetConf.cid] = {};
        }

        return (
            <LineChartBase
                config={props.config}
                height={props.height}
                margin={props.margin}
                signalAggs={['max']}
                lineAgg="max"
                getSignalValuesForDefaultTooltip={getSignalValuesForDefaultTooltip}
                prepareData={this.boundPrepareData}
                createChart={this.boundCreateChart}
                getSignalGraphContent={(base, sigSetCid, sigCid) => <path ref={node => this.areaPathSelection[sigSetCid][sigCid] = select(node)}/>}
                withTooltip={props.withTooltip}
                withBrush={props.withBrush}
                contentComponent={props.contentComponent}
                contentRender={props.contentRender}
                tooltipContentComponent={this.props.tooltipContentComponent}
                tooltipContentRender={this.props.tooltipContentRender}
                tooltipExtraProps={this.props.tooltipExtraProps}
                getLineColor={color => color.darker()}
                lineCurve={d3Shape.curveStep}
                withYAxis={false}
            />
        );
    }
}
