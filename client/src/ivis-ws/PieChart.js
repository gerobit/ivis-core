'use strict';

import React, { Component } from "react";

import { translate } from "react-i18next";
import { withErrorHandling } from "../lib/error-handling";
import PropTypes from "prop-types";
import * as d3Scale from "d3-scale";
import * as d3Shape from "d3-shape";
import { select } from "d3-selection";
import './PieChart.css'

@translate()
@withErrorHandling
export class PieChart extends Component {
    constructor(props) {
        super(props);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.data !== this.props.data
            && this.props.data.length > 0) {
            //console.log(this.props.total, this.props);
            this.createChart();
            //this.props.total
        }
    }

    createChart() {
        const data = this.props.data;
        const t = this.props.t;
        this.titleSelection.text(t(this.props.title));

        const pieChartNode = select(this.pieChartNode),
            width = this.props.width - this.props.margin.left - this.props.margin.right,
            height = this.props.height - this.props.margin.top - this.props.margin.bottom,
            radius = Math.min(width, height) / 2,
            //move the center of the pie chart from 0, 0 to  width / 2, height / 2
            g = pieChartNode.append("g").attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

        const color = d3Scale.schemeCategory10; //d3Scale.scaleOrdinal(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);

        //this will create arc data for us given a list of values
        const pie = d3Shape.pie()
            .sort(null) //we must tell it how to access the value of each element in our data array
            .value(function (d) { return d.value; });

        //this will create <path> elements for us using arc data
        const path = d3Shape.arc()
            .outerRadius(radius - 10)
            .innerRadius(0);

        const label = d3Shape.arc()
            .outerRadius(radius - 40)
            .innerRadius(radius - 80);

        const arc = g.selectAll(".arc")
            .data(pie(data)) //associate the generated pie data (an array of arcs, each having startAngle, endAngle and value properties) 
            .enter() //this will create <g> elements for every "extra" data element that should be associated with a selection. The result is creating a <g> for every object in the data array
            .append("g") //create a group to hold each slice (we will have a <path> and a <text> element associated with each slice)
            .attr("class", "arc");

        arc.append("path")
            .attr("d", path) //this creates the actual SVG path using the associated data (pie) with the arc drawing function
            .attr("fill", function (d, i) { return color[i]; }); //set the color for each slice to be chosen from the color function defined above

        const total = this.props.total;
        arc.append("text")
            .attr("transform", function (d) { //set the label's origin to the center of the arc
                return "translate(" + label.centroid(d) + ")";
            }) //this gives us a pair of coordinates like [50, 50] 
            .attr("dy", "0.35em")
            //.attr("text-anchor", "middle")  //center the text on it's origin. It is already as part of CSS.
            .text(function (d) { return t(d.data.key + ':' + d.data.value + '(' + (d.data.value * 100 / total).toFixed(1) + '%)'); }); //FIXMEdoc: get the label from our original data array
    }

    render() {
        return (
            <svg ref={node => this.containerNode = node} width={this.props.width} height={this.props.height}>
                <text ref={node => this.titleSelection = select(node)} textAnchor="middle" x={this.props.width / 2} y={this.props.height} fontFamily="'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif" fontSize="15px" />
                <svg ref={node => this.pieChartNode = node} />
            </svg>
        );
    }
}

/*
                //d.innerRadius = 5; //we have to make sure to set these before calling arc.centroid
                //d.outerRadius = radius - 50;
width={this.props.width - 20} height={this.props.height - 20}
            width = +svg.attr("width"),
            height = +svg.attr("height"),
select("svg")
            .attr("transform", function (d) { return "translate(" + label.centroid(d) + ")"; })

    d3.csv("data.csv", function (d) {
        d.population = +d.population;
        return d;
    }, 
    
    componentWillReceiveProps(nextProps, nextContext) {
    
        const t = this.props.t;

   this.setState({
        signalSetsData: null,
        statusMsg: t('Loading...')
    });

}

componentDidMount() {
    // this.createChart() is not needed here because at this point, we are missing too many things to actually execute it
}
*/