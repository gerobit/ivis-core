'use strict';

import React, { Component } from "react";
import { translate } from "react-i18next";
import { requiresAuthenticatedUser, withPageHelpers } from "../lib/page";
import axios from "../lib/axios";
import { withAsyncErrorHandler, withErrorHandling } from "../lib/error-handling";
import { transition } from "d3-transition";
import * as d3 from 'd3/build/d3';
import eventDrops from 'event-drops';
import 'event-drops/dist/style.css';
import './demo.css';

//@withPageHelpers
//@withErrorHandling
@requiresAuthenticatedUser
export default class EventTimeline extends Component {
    constructor(props) {
        super(props);
        this.eventElem = null;
    }

    componentDidMount() {
        //console.log(this.props.data, this.props.tooltipSpec);
        if (this.props.tooltipSpec !== null && this.props.data !== null) {
            this.createEventTimeline();
        }
    }

    createEventTimeline() {
        const data = this.props.data;
        const tooltipSpec = this.props.tooltipSpec;
        this.tooltipNode
            .classed('tooltip', true)
            .style('opacity', 0);

        const chart = eventDrops({
            d3,
            zoom: {
                onZoomEnd: () => { },
            },
            height: '800',
            line: (line, index) => index % 2 ? 'lavenderBlush' : 'papayaWhip',
            drop: {
                date: d => new Date(d.date),
                onMouseOver: event => {
                    this.tooltipNode
                        .transition()
                        .duration(200)
                        .style('opacity', 0.8);

                    let tooltipContent = '<div class="content">';
                    for (const key in tooltipSpec) {
                        tooltipContent = tooltipContent.concat(`<p class="message">${tooltipSpec[key]} ${event[key]}</p>`);
                    }

                    tooltipContent = tooltipContent.concat('</div>');
                    //console.log(d3.event.pageX);
                    //const x = d3.event.pageX - 140;
                    //d3.event.pageX > 800 ? `${d3.event.pageX - 400}px` : `${d3.event.pageX - 200}px`

                    this.tooltipNode
                        .html(tooltipContent)
                        .style('left', `${d3.event.pageX - 600}px`)
                        .style('top', `${d3.event.pageY - 140}px`);
                },
                onMouseOut: () => {
                    this.tooltipNode
                        .transition()
                        .duration(300)
                        .style('opacity', 0);
                },
            },
        });

        this.eventElem
            .data([data])
            .call(chart);
    }

    render() {
        //console.log(this.props);

        return (
            <div ref={node => this.containerNode = node} height={this.props.height} width="100%">
                <div ref={node => this.eventElem = d3.select(node)} />
                <div ref={node => this.tooltipNode = d3.select(node)} />
            </div>
        );
    }
}


/*

    componentWillReceiveProps(nextProps) {
        console.log(nextProps.data, nextProps.tooltipSpec);

        if (nextProps.data !== this.props.data) {
            if (nextProps.tooltipSpec !== null && nextProps.data !== null) {
                this.createEventTimeline();
            }
        }
    }
    shouldComponentUpdate(nextProps) {
        console.log(this.props.data, this.props.tooltipSpec);

        if (nextProps.data !== this.props.data)
            return true;
        else
            return false;
    }

    componentDidUpdate(prevProps) {
        console.log(this.props.data, this.props.tooltipSpec);

        //if (prevProps.data !== this.props.data) {
        if (this.props.tooltipSpec !== null && this.props.data !== null) {
            this.createEventTimeline();
        }
        //}
    }

*/