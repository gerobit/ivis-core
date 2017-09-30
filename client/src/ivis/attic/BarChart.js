'use strict';

import React, { Component } from 'react';

import { axisBottom, axisLeft } from 'd3-axis';
import { scaleLinear, scaleBand } from 'd3-scale';
import { min, max } from 'd3-array';
import { select, mouse, event as d3Event } from 'd3-selection';
import { easePolyIn, easePolyOut } from 'd3-ease';
import 'd3-transition';
import { zoom } from 'd3-zoom';

export default class BarChart extends Component {
    constructor(props){
        super(props)

        this.state = {
            width: 0,
            tooltipText: null
        }

        this.resizeListener = ::this.onResize;
    }

    onResize() {
        this.setState({
            width: this.containerNode.clientWidth,
            displayedRange
        })
    }

    componentDidMount() {
        // console.log('mount');
        this.onResize();
        window.addEventListener('resize', this.resizeListener);
    }

    componentDidUpdate() {
        // console.log('update');
        this.createBarChart();
    }

    componentWillUnmount() {
        // console.log('unmount');
        window.removeEventListener('resize', this.resizeListener);
    }

    createBarChart() {
        if (this.state.width === 0) {
            return;
        }

        const yData = this.props.data.map(data => data.v);
        const yMax = max(yData);
        const yScale = scaleLinear()
            .domain([0, yMax])
            .range([this.props.height - this.props.margin.top - this.props.margin.bottom, 0]);

        const xData = this.props.data.map(data => data.t);
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

        const yAxis = axisLeft(yScale);

        const self = this;

        const zooming = zoom()
            .scaleExtent([1, Infinity])
            .translateExtent([[0, 0], [this.state.width - this.props.margin.left - this.props.margin.right, this.props.height - this.props.margin.top - this.props.margin.bottom]])
            .extent([[0, 0], [this.state.width - this.props.margin.left - this.props.margin.right, this.props.height - this.props.margin.top - this.props.margin.bottom]])
            .on("zoom", function() {
                if (d3Event.sourceEvent && d3Event.sourceEvent.type === "brush") return; // ignore zoom-by-brush
                const trans = d3Event.transform;

                console.log(trans);
                /*
                scaleX.domain(trans.rescaleX(x2).domain());
                focus.select(".area").attr("d", area);
                focus.select(".axis--x").call(xAxis);
                context.select(".brush").call(brush.move, scaleX.range().map(trans.invertX, trans));
                */
            });

        this.xAxisSelection
            .call(xAxis);

        this.yAxisSelection
            .call(yAxis);

        this.zoomSelection
            .call(zooming);

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
            .attr('width', xScale.bandwidth())
            .on('mouseover', function (data, idx) {
                const pos = mouse(self.containerNode);

                if (self.tooltipSelection) {
                    self.tooltipSelection
                        .attr('transform', `translate(${pos[0] + 5}, ${pos[1] + 5})`);
                }

                select(this)
                    .transition('fill')
                    .duration(80)
                    .ease(easePolyIn.exponent(3))
                    .style('fill', '#0076fc');

                select(this)
                    .transition('size')
                        .duration(100)
                        .ease(easePolyOut.exponent(4))
                        .attr('x', data => xScale(data.t) - 2)
                        .attr('y', data => yScale(data.v) - 2)
                        .attr('height', data => self.props.height - self.props.margin.top - self.props.margin.bottom - yScale(data.v) + 2)
                        .attr('width', xScale.bandwidth() + 4)
                    .transition()
                        .duration(50)
                        .ease(easePolyIn.exponent(4))
                        .attr('x', data => xScale(data.t))
                        .attr('y', data => yScale(data.v))
                        .attr('height', data => self.props.height - self.props.margin.top - self.props.margin.bottom - yScale(data.v))
                        .attr('width', xScale.bandwidth());

                self.setState({
                    tooltipText: `${idx} ... Proin dapibus nisi ut odio tincidunt luctus nec nec magna. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Vestibulum pulvinar vehicula augue. Praesent eleifend nunc tristique arcu dictum, sed faucibus ligula sollicitudin. Nunc rutrum tempus pharetra. Proin mollis leo sem, sit amet dignissim est lobortis eu. Nullam tincidunt nibh enim.`
                });
            })
            .on('mouseout', function () {
                select(this)
                    .transition('fill')
                        .duration(100)
                        .ease(easePolyIn.exponent(3))
                        .style('fill', '#fe9922');

                select(this)
                    .transition('size')
                        .duration(80)
                        .ease(easePolyIn.exponent(4))
                        .attr('x', data => xScale(data.t))
                        .attr('y', data => yScale(data.v))
                        .attr('height', data => self.props.height - self.props.margin.top - self.props.margin.bottom - yScale(data.v))
                        .attr('width', xScale.bandwidth());

                self.setState({
                    tooltipText: null
                });
            })
            .on('mousemove', function (data) {
                const pos = mouse(self.containerNode);

                if (self.tooltipSelection) {
                    self.tooltipSelection
                        .attr('transform', `translate(${pos[0] + 5}, ${pos[1] + 5})`);
                }
            });
    }

    render() {
        if (this.state.width === 0) {
            return <svg ref={node => this.containerNode = node} height={this.props.height} width="100%"/>;
        } else {
            return (
                <svg ref={node => this.containerNode = node} height={this.props.height} width="100%">
                    <g ref={node => this.contentSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
                    <rect ref={node => this.zoomSelection = select(node)}
                          transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}
                          width={this.state.width - this.props.margin.left - this.props.margin.right}
                          height={this.props.height - this.props.margin.top - this.props.margin.bottom}
                          style={{ cursor: 'move', fill: 'none', pointerEvents: 'all'}}/>
                    <g ref={node => this.xAxisSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.height - this.props.margin.bottom})`}/>
                    <g ref={node => this.yAxisSelection = select(node)} transform={`translate(${this.props.margin.left}, ${this.props.margin.top})`}/>
                    <g ref={node => this.tooltipSelection = select(node)} style={{ visibility: this.state.tooltipText ? 'visible' : 'hidden'}}>
                        <rect fill="#f66956" stroke="#000" strokeWidth="1.5" x="0" y="0" width="300" height="120" fillOpacity="0.2"/>
                        <foreignObject requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility" width="280" height="100" x="10" y="10" overflow="hidden">
                            <div>{this.state.tooltipText}</div>
                        </foreignObject>
                    </g>
                </svg>
            );
        }
    }
}
