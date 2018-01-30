'use strict';

import React, { Component } from "react";
import { translate } from "react-i18next";
import { Table } from "../../lib/table";
import { Panel } from "../../lib/panel";
import { NavButton, requiresAuthenticatedUser, Toolbar, withPageHelpers } from "../../lib/page";
import { Icon } from "../../lib/bootstrap-components";
import axios from "../../lib/axios";
import { withAsyncErrorHandler, withErrorHandling } from "../../lib/error-handling";
import moment from "moment";
import * as d3Scale from "d3-scale";
import * as d3Selection from "d3-selection";

import { select } from "d3-selection";
import { transition } from "d3-transition";
import { easeLinear } from "d3-ease";
import * as d3 from 'd3';

//import '../../ivis-ws/event-drops/src/style.css';
//import '../../ivis-ws/event-drops/demo/demo.css';
import eventDrops from '../../ivis-ws/event-drops/src/index';

const repositories = require('../../ivis-ws/attic/data.json');
const { gravatar, humanizeDate } = require('../../ivis-ws/attic/utils');

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class FarmsEvents extends Component {
    constructor(props) {
        super(props);

        const repositoriesData = repositories.map(repository => ({
            name: repository.name,
            data: repository.commits,
        }));

        this.state = { repositoriesData: repositoriesData };
        const t = props.t;
        this.chart = null;

        this.renderStats = (data) => {
            const newScale = d3Selection.event ? d3Selection.event.transform.rescaleX(this.chart.scales.x) :
                this.chart.scales.x;

            const filteredCommits = data.reduce((total, repository) => {
                const filteredRow = this.chart.visibleDataInRow(repository.data, newScale);
                return total + filteredRow.length;
            }, 0);

            const numberCommits = global.document.getElementById('numberCommits');
            const zoomStart = global.document.getElementById('zoomStart');
            const zoomEnd = global.document.getElementById('zoomEnd');

            numberCommits.textContent = +filteredCommits;

            // retrieve start and end dates
            zoomStart.textContent = newScale.domain()[0].toLocaleDateString('en-US');
            zoomEnd.textContent = newScale.domain()[1].toLocaleDateString('en-US');
        };
    }

    componentDidMount() {
        this.createEventTimeline(true);
    }

    componentDidUpdate(prevProps, prevState, prevContext) {
        console.log('cdu');
        console.log('event', d3Selection.event);
        //const forceRefresh = prevState.repositoriesData !== this.state.repositoriesData;
        //this.createEventTimeline(forceRefresh);
    }

    createEventTimeline(forceRefresh) {
        if (forceRefresh === false)
            return;

        const colors = d3Scale.schemeCategory10;
        const FONT_SIZE = 12; // in pixels
        const TOOLTIP_WIDTH = 30; // in rem

        // we're gonna create a tooltip per drop to prevent from transition issues
        const showTooltip = (commit) => {
            select('#tooltip').selectAll('.tooltip').remove();

            const tooltip = select('#tooltip')
                .append('div')
                .attr('class', 'tooltip')
                .style('opacity', 0); // hide it by default

            const t = transition().duration(500).ease(easeLinear);

            tooltip
                .transition(t)
                .on('start', () => {
                    select('.tooltip').style('display', 'block');
                })
                .style('opacity', 1);

            const rightOrLeftLimit = FONT_SIZE * TOOLTIP_WIDTH;

            const direction = d3Selection.event.pageX > rightOrLeftLimit ? 'right' : 'left';

            const ARROW_MARGIN = 1.65;
            const ARROW_WIDTH = FONT_SIZE;
            const left = direction === 'right'
                ? d3Selection.event.pageX - rightOrLeftLimit
                : d3Selection.event.pageX - ((ARROW_MARGIN * (FONT_SIZE - ARROW_WIDTH)) / 2);

            tooltip.html(`
                <g className="commit">
                    <img className="avatar" src="${gravatar(commit.author.email)}" alt="${commit.author.name}" title="${commit.author.name}" />
                    <div className="content">
                        <h3 className="message">${commit.message}</h3>
                        <p>
                            <a href="https://www.github.com/${commit.author.name}" className="author">${commit.author.name}</a>
                            on <span className="date">${humanizeDate(new Date(commit.date))}</span> -
                            <a className="sha" href="${commit.sha}">${commit.sha.substr(0, 10)}</a>
                        </p>
                    </div>
                </g>
                `
            );
            //console.log(d3Selection.event.pageY, left)
            tooltip
                .style('left', `${left}px`)
                .style('top', `${d3Selection.event.pageY - 100}px`)
                .classed(direction, true);
        };

        const hideTooltip = () => {
            const t = transition().duration(500);

            select('.tooltip')
                .transition(t)
                .on('end', function end() {
                    this.remove();
                })
                .style('opacity', 0);
        };

        const createChart = eventDrops({
            start: new Date(new Date().getTime() - (3600000 * 24 * 365)),
            end: new Date(),
            eventLineColor: (d, i) => colors[i],
            date: d => new Date(d.date),
            mouseover: showTooltip,
            mouseout: hideTooltip,
            zoomend: this.renderStats,
            //.hasBottomAxis(true)
            margin: {
                top: 10,
                left: 0,
                bottom: 80,
                right: 180
            }
        });

        //createChart.start(new Date(new Date().getTime() - (3600000 * 24 * 365))) // one year ago
        /*    .end(new Date())
             .eventLineColor((d, i) => colors[i])
             .date(d => new Date(d.date))
             .mouseover(showTooltip)
             .mouseout(hideTooltip)
             .zoomend(this.renderStats)
             //.hasBottomAxis(true)
             .margin({
                 top: 10,
                 left: 30,
                 bottom: 30,
                 right: 90
             });*/

        //console.log(Object.getOwnPropertyNames(createChart))
        //console.log(createChart)

        this.chart = select('#eventdrops-demo').
            datum(this.state.repositoriesData).
            call(createChart);

        this.renderStats(this.state.repositoriesData);
    }

    render() {
        const t = this.props.t;

        return (
            <Panel title={t('Farms Events')} >
                <div id="eventdrops-demo" style={{ width: '100%' }}> </div>
                <div id="tooltip"> </div>

                <p className="infos">
                    <span id="numberCommits" > </span>
                    commits found between
                     <span id="zoomStart">  </span>
                    and
                     <span id="zoomEnd">  </span>.
                </p>
            </Panel>
        );
    }
}