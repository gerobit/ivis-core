'use strict';

import React, { Component } from "react";
import { translate } from "react-i18next";
import { requiresAuthenticatedUser, withPageHelpers } from "../lib/page";
import axios from "../lib/axios";
import { withAsyncErrorHandler, withErrorHandling } from "../lib/error-handling";
import { transition } from "d3-transition";
//import * as d3 from 'd3';
import * as d3 from 'd3/build/d3';
import eventDrops from 'event-drops';
import 'event-drops/dist/style.css';
import './demo.css';

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class EventTimeline extends Component {
    constructor(props) {
        super(props);
    }

    shouldComponentUpdate(nextProps) {
        if (nextProps.data !== this.props.data)
            return true;
        else
            return false;
    }

    componentDidUpdate(prevProps) {
        if (prevProps.data !== this.props.data) {
            //console.log(prevProps.data, this.props.data)
            //console.log(prevProps.tooltipSpec, this.props.tooltipSpec)

            if (this.props.tooltipSpec !== null && this.props.data !== null) {
                this.createEventTimeline();
            }
        }
    }


    /*componentWillReceiveProps(nextProps) {
        if (nextProps.data !== this.props.data) {
            this.createEventTimeline(nextProps.data);
        }

        //console.log(nextProps.data)

    }*/

    createEventTimeline() {
        console.log('createEventTimeline', this.props.data)

        const data = this.props.data;
        const tooltipSpec = this.props.tooltipSpec;

        const tooltip = d3
            .select('body')
            .append('div')
            .classed('tooltip', true)
            .style('opacity', 0);

        const chart = eventDrops({
            d3,
            zoom: {
                onZoomEnd: () => { }, //updateCommitsInformation(chart),
            },
            height: '800px',
            line: (line, index) => index % 2 ? 'lavenderBlush' : 'papayaWhip',
            drop: {
                date: d => new Date(d.date),
                onMouseOver: event => {
                    tooltip
                        .transition()
                        .duration(200)
                        .style('opacity', 1);
                    
                    let tooltipContent = '<div class="content">';
                    
                    for (const key in tooltipSpec) {
                        tooltipContent = tooltipContent.concat(`<p class="message">${tooltipSpec[key]} ${event[key]}</p>`);
                    }
                    
                    tooltipContent = tooltipContent.concat('</div>');
                    
                    tooltip
                        .html(tooltipContent)
                        .style('left', `${d3.event.pageX - 30}px`)
                        .style('top', `${d3.event.pageY + 20}px`);
                },
                onMouseOut: () => {
                    tooltip
                        .transition()
                        .duration(500)
                        .style('opacity', 0);
                },
            },
        });

        d3.select('#eventdrops-demo')
            .data([data])
            .call(chart);
    }

    render() {
        const t = this.props.t;

        return (
            <div>
                <div id="eventdrops-demo" style={{ width: '100%' }}> </div>
                <div id="tooltip"> </div>
            </div>
        );
    }
}