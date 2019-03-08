'use strict';

import React, { Component } from 'react';

import { axisBottom, axisLeft } from 'd3-axis';
import { scaleLinear, scaleBand } from 'd3-scale';
import { min, max } from 'd3-array';
import { select, event as d3Event } from 'd3-selection';
import 'd3-transition';
import { brushX } from 'd3-brush';

export default class BarNavigator extends Component {
    constructor(props){
        super(props)

        this.state = {
            width: 0,
        }

        this.resizeListener = ::this.onResize;
    }

    onResize() {
        this.setState({
            width: this.containerNode.clientWidth
        })
    }

    componentDidMount() {
        this.onResize();
        window.addEventListener('resize', this.resizeListener);
    }

    componentDidUpdate() {
        this.createBarChart();
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.resizeListener);
    }

    createBarChart() {
        if (this.state.width === 0) {
            return;
        }

        const points = data.points;
        points.unshift({t: data.startTS, v: points[0].v});
        points.append({t: data.endTS, v: points[points.length - 1].v});

        const yData = this.props.data.points.map(data => data.v);
        const yMax = max(yData);
        const yScale = scaleLinear()
            .domain([0, yMax])
            .range([this.props.height - this.props.margin.top - this.props.margin.bottom, 0]);

        const xData = this.props.data.points.map(data => data.t);
        const xMin = min(xData);
        const xMax = max(xData);
        const xScale = scaleBand()
            .domain(xData)
            .rangeRound([0,this.state.width - this.props.margin.left - this.props.margin.right])
            .paddingInner(0.1);

        const xTicks = xScale.domain().filter((data, idx) => idx % 1 === 0);
        const xAxis = axisBottom(xScale)
            .tickValues(xTicks)
            .tickFormat(tick => Math.floor(tick / 1000 / 60))
            .tickSizeOuter(0);

        const self = this;

        const brush = brushX()
            .extent([[0, 0], [this.state.width - this.props.margin.left - this.props.margin.right, this.props.height - this.props.margin.top - this.props.margin.bottom]])
            .on("end", function brushed() {
                if (d3Event.sourceEvent && d3Event.sourceEvent.type === "zoom") return; // ignore brush-by-zoom
                const sel = d3Event.selection || xScale.range();
                const xl = roundToBand(sel[0], false);
                const xr = roundToBand(sel[1], true);

                if (xl !== sel[0] || xr !== sel[1]) {
                    self.brushSelection.call(brush.move, [xl, xr]);
                }
            });

        this.xAxisSelection
            .call(xAxis);

        this.brushSelection
            .call(brush);
            //.call(brush.move, xxScale.range());

        this.contentSelection
            .selectAll('rect')
            .data(this.props.data)
            .enter()
            .append('rect');

        this.contentSelection
            .selectAll('rect')
            .data(this.props.data)
            .exit()
            .remove();

        this.contentSelection
            .selectAll('rect')
            .data(this.props.data)
            .style('fill', '#fe9922')
            .attr('x', data => xScale(data.t))
            .attr('y', data => yScale(data.v))
            .attr('height', data => this.props.height - this.props.margin.top - this.props.margin.bottom - yScale(data.v))
            .attr('width', xScale.bandwidth());
    }

    render() {
        return (
            <svg ref={node => this.containerNode = node} height={this.props.height} width="100%">
                <g ref={node => this.contentSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
                <g ref={node => this.xAxisSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.height - this.props.margin.bottom})`}/>
                <g ref={node => this.brushSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
            </svg>
        );
    }
}
