'use strict';

import React, {Component} from "react";
import {
    createBase,
    isSignalVisible,
    RenderStatus
} from "./TimeBasedChartBase";
import {
    getAxisIdx,
    LineChartBase,
    pointsOnNoAggregation
} from "./LineChartBase";
import {select} from "d3-selection";
import * as d3Shape
    from "d3-shape";
import {rgb} from "d3-color";
import PropTypes
    from "prop-types";
import tooltipStyles
    from "./Tooltip.scss";
import {Icon} from "../lib/bootstrap-components";
import {format as d3Format} from "d3-format";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";

function getSignalValuesForDefaultTooltip(tooltipContent, sigSetConf, sigConf, sigSetCid, sigCid, signalData, isAgg) {
    const numberFormat = d3Format('.3f');

    const avg = numberFormat(signalData.avg);
    const min = numberFormat(signalData.min);
    const max = numberFormat(signalData.max);

    const unit = sigConf.unit;

    if (isAgg) {
        return (
            <span>
                <span className={tooltipStyles.signalVal}>Ø {avg} {unit}</span>
                <span className={tooltipStyles.signalVal}><Icon icon="chevron-left"/>{min} {unit} <Icon icon="ellipsis-h"/> {max} {unit}<Icon icon="chevron-right"/></span>
            </span>
        );
    } else {
        return <span className={tooltipStyles.signalVal}>{avg}</span>;
    }
}

@withComponentMixins([
    withTranslation
])
export class LineChart extends Component {
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
        tooltipExtraProps: PropTypes.object,

        getExtraQueries: PropTypes.func,
        prepareExtraData: PropTypes.func,
        getGraphContent: PropTypes.func,
        createChart: PropTypes.func,
        lineVisibility: PropTypes.func,
        lineCurve: PropTypes.func,

        controlTimeIntervalChartWidth: PropTypes.bool
    }

    static defaultProps = {
        margin: { left: 60, right: 5, top: 5, bottom: 20 },
        height: 500,
        withTooltip: true,
        withBrush: true,
        lineVisibility: pointsOnNoAggregation,
        controlTimeIntervalChartWidth: true,
        lineCurve: d3Shape.curveLinear
    }

    createChart(base, signalSetsData, baseState, abs, xScale, yScales, points, lineVisibility) {

        for (const sigSetConf of this.props.config.signalSets) {
            if (points[sigSetConf.cid]) {
                for (const sigConf of sigSetConf.signals) {
                    if (isSignalVisible(sigConf)) {
                        const sigCid = sigConf.cid;
                        const yScale = yScales[getAxisIdx(sigConf)];
                        const minMaxArea = d3Shape.area()
                            .defined(d => d.data[sigCid].min !== null && d.data[sigCid].max)
                            .x(d => xScale(d.ts))
                            .y0(d => yScale(d.data[sigCid].min))
                            .y1(d => yScale(d.data[sigCid].max))
                            .curve(this.props.lineCurve);

                        const minMaxAreaColor = rgb(sigConf.color);
                        minMaxAreaColor.opacity = 0.5;

                        this.areaPathSelection[sigSetConf.cid][sigCid]
                            .datum(points[sigSetConf.cid])
                            .attr('visibility', lineVisibility.lineVisible ? 'visible' : 'hidden')
                            .attr('fill', minMaxAreaColor.toString())
                            .attr('stroke', 'none')
                            .attr('stroke-linejoin', 'round')
                            .attr('stroke-linecap', 'round')
                            .attr('d', minMaxArea);
                    }
                }
            }
        }

        if (this.props.createChart) {
            return this.props.createChart(createBase(base, this), signalSetsData, baseState, abs, xScale, yScales, points);
        } else {
            return RenderStatus.SUCCESS;
        }
    }

    prepareData(base, signalSetsData, extraData) {
        const stateUpdate = {
            signalSetsData
        };

        if (this.props.prepareExtraData) {
            const processedExtraData = this.props.prepareExtraData(createBase(base, this), signalSetsData, extraData);
            for (const key in processedExtraData) {
                stateUpdate[key] = processedExtraData[key];
            }
        }

        return stateUpdate;
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
                signalAggs={['min', 'max', 'avg']}
                lineAgg="avg"
                getSignalValuesForDefaultTooltip={getSignalValuesForDefaultTooltip}
                prepareData={this.boundPrepareData}
                getExtraQueries={this.props.getExtraQueries}
                getGraphContent={this.props.getGraphContent}
                createChart={this.boundCreateChart}
                getSignalGraphContent={(base, sigSetCid, sigCid) => <path ref={node => this.areaPathSelection[sigSetCid][sigCid] = select(node)}/>}
                withTooltip={props.withTooltip}
                withBrush={props.withBrush}
                contentComponent={props.contentComponent}
                contentRender={props.contentRender}
                tooltipContentComponent={this.props.tooltipContentComponent}
                tooltipContentRender={this.props.tooltipContentRender}
                tooltipExtraProps={this.props.tooltipExtraProps}
                lineVisibility={this.props.lineVisibility}
                controlTimeIntervalChartWidth={this.props.controlTimeIntervalChartWidth}
                lineCurve={this.props.lineCurve}
            />
        );
    }
}
