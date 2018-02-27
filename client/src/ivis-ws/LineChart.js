'use strict';

import React, { Component } from "react";

import { translate } from "react-i18next";
import { RenderStatus } from "./TimeBasedChartBase";
import { LineChartBase } from "./LineChartBase";
import { select } from "d3-selection";
import * as d3Shape from "d3-shape";
import { rgb } from "d3-color";
import PropTypes from "prop-types";
import tooltipStyles from "./Tooltip.scss";
import { format as d3Format } from "d3-format";

function getSignalValuesForDefaultTooltip(tooltipContent, sigSetCid, sigCid, signalData) {
    //FIXME: .3f to be decided based on data, if 1000 what will happen?
    const numberFormat = d3Format('.3f');

    const avg = numberFormat(signalData.avg);

    return (
        <span>
            <span className={tooltipStyles.signalVal}>{avg}</span>
        </span>
    );
}

@translate()
export class LineChart extends Component {
    constructor(props) {
        super(props);

        this.overIrrigazationZone = {};
        this.optimalZone = {};
        this.overDryZone = {};
        this.boundCreateChart = ::this.createChart;
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
        graphOptions: PropTypes.object
    }

    static defaultProps = {
        margin: { left: 40, right: 5, top: 5, bottom: 20 },
        height: 500,
        withTooltip: true,
        withBrush: true
    }


    createAreaZones(base, xScale, yScale) {
        const graphHeight = this.props.height - this.props.margin.top - this.props.margin.bottom;
        const graphWidth = base.base.renderedWidth - this.props.margin.left - this.props.margin.right;

        const overirr = this.props.graphOptions.areaZones.overIrrigationZone;
        const overdry = this.props.graphOptions.areaZones.overDryZone;

        const overIrHeight = (100 - overirr) / 100 * graphHeight;
        this.overIrrigazationZone
            .attr('y', yScale(100))
            .attr('x', 0)
            .attr('width', graphWidth)
            .attr('height', overIrHeight)
            .attr('stroke-width', 1)
            .attr('opacity', 0.3)
            .attr('fill', rgb(25, 25, 200).toString())


        const optimalHeight = graphHeight * (overirr - overdry) / 100;
        this.optimalZone
            .attr('y', overIrHeight)
            .attr('x', 0)
            .attr('width', graphWidth)
            .attr('height', optimalHeight)
            .attr('stroke-width', 1)
            .attr('opacity', 0.3)
            .attr('fill', rgb(25, 200, 25).toString())

        const dryHeight = (overdry) / 100 * graphHeight;
        this.overDryZone
            .attr('y', optimalHeight + overIrHeight)
            .attr('x', 0)
            .attr('width', graphWidth)
            .attr('height', dryHeight)
            .attr('stroke-width', 1)
            .attr('opacity', 0.3)
            .attr('fill', rgb(200, 25, 25).toString())
    }

    createChart(base, xScale, yScale, points) {
        if(this.props.graphOptions.areaZones && this.props.graphOptions.areaZones !== null) {
            this.createAreaZones(base, xScale, yScale);
        }
        return RenderStatus.SUCCESS;
    }

    render() {
        const props = this.props;

        return (
            <LineChartBase
                config={props.config}
                height={props.height}
                margin={props.margin}
                signalAggs={['min', 'max', 'avg']}
                lineAgg="avg"
                getSignalValuesForDefaultTooltip={getSignalValuesForDefaultTooltip}
                prepareData={(base, data) => props.config.prepareData(data)}
                createChart={this.boundCreateChart}
                getStaticGraphContent={(base) =>
                    <g>
                        <rect ref={node => this.overIrrigazationZone = select(node)} />
                        <rect ref={node => this.optimalZone = select(node)} />
                        <rect ref={node => this.overDryZone = select(node)} />
                    </g>
                }
                withTooltip={props.withTooltip}
                withBrush={props.withBrush}
                contentComponent={props.contentComponent}
                contentRender={props.contentRender}
                tooltipContentComponent={props.tooltipContentComponent}
                tooltipContentRender={props.tooltipContentRender}
                graphOptions={props.graphOptions}
            />
        );
    }
}

/*

    
    componentWillReceiveProps(nextProps) {
        if (nextProps.graphOptions.areaZones !== this.props.graphOptions.areaZones 
            && this.base !== null && this.xScale !== null && this.yScale !== null) {
            this.createAreaZones(this.base, this.xScale, this.yScale);
            console.log(nextProps);

        }
    }
shouldComponentUpdate(nextProps, nextState, nextContext) {
        const sCU = nextProps.config !== this.props.config
            || nextContext !== this.context;
        console.log(sCU);
        
        return sCU;
    }
    // Access parent context by defining contextTypes in LineChart.
    static contextTypes = {
        areaZones: PropTypes.object
    };

            if(this.context.areaZones) {
            overirr = this.context.areaZones.overIrrigationZone;
            overdry = this.context.areaZones.overDryZone;
        }
*/