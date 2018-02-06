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
//import {event as d3Event, select} from "d3-selection";
//import eventDrops from 'event-drops';

//import eventDrops from '../../ivis-ws/event-drops/src/index';
//import '../../ivis-ws/event-drops/src/style.css';
const repositories = require('../../ivis-ws/attic/data.json');
const { gravatar, humanizeDate } = require('../../ivis-ws/attic/utils');

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class FarmEventsPanel extends Component {
    constructor(props) {
        super(props);

        this.state = {};

        const t = props.t;
    }

    @withAsyncErrorHandler
    async fetchPermissions() {
    }

    componentDidMount() {
        //this.fetchPermissions();
        this.createEventTimeline();
    }

    createEventTimeline() {

        const repositoriesData = repositories.map(repository => ({
            name: repository.name,
            data: repository.commits,
        }));

        const colors = d3Scale.schemeCategory10;
        const FONT_SIZE = 16; // in pixels
        const TOOLTIP_WIDTH = 30; // in rem
        // we're gonna create a tooltip per drop to prevent from transition issues
        const showTooltip = (commit) => {
            select('body').selectAll('.tooltip').remove();

            const tooltip = select('body')
                .append('div')
                .attr('class', 'tooltip')
                .style('opacity', 0); // hide it by default

            const t = transition().duration(250).ease(easeLinear);

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
                <div class="commit">
                    <img class="avatar" src="${gravatar(commit.author.email)}" alt="${commit.author.name}" title="${commit.author.name}" />
                    <div class="content">
                        <h3 class="message">${commit.message}</h3>
                        <p>
                            <a href="https://www.github.com/${commit.author.name}" class="author">${commit.author.name}</a>
                            on <span class="date">${humanizeDate(new Date(commit.date))}</span> -
                            <a class="sha" href="${commit.sha}">${commit.sha.substr(0, 10)}</a>
                        </p>
                    </div>
                </div>
                `
            );

            tooltip
                .style('left', `${left}px`)
                .style('top', `${d3Selection.event.pageY + 16}px`)
                .classed(direction, true);
        };

        const hideTooltip = () => {
            const t = transition().duration(1000);

            select('.tooltip')
                .transition(t)
                .on('end', function end() {
                    this.remove();
                })
                .style('opacity', 0);
        };

        const createChart = eventDrops()
            .start(new Date(new Date().getTime() - (3600000 * 24 * 365))) // one year ago
            .end(new Date())
            .eventLineColor((d, i) => colors[i])
            .date(d => new Date(d.date))
            .mouseover(showTooltip)
            .mouseout(hideTooltip)
            .zoomend(renderStats);

        const chart = select('#eventdrops-demo').
            datum(repositoriesData).
            call(createChart);

        const numberCommits = global.document.getElementById('numberCommits');
        const zoomStart = global.document.getElementById('zoomStart');
        const zoomEnd = global.document.getElementById('zoomEnd');

        const renderStats = (data) => {
            const newScale = event ? event.transform.rescaleX(chart.scales.x) : chart.scales.x;
            const filteredCommits = data.reduce((total, repository) => {
                const filteredRow = chart.visibleDataInRow(repository.data, newScale);
                return total + filteredRow.length;
            }, 0);

            numberCommits.textContent = +filteredCommits;
            zoomStart.textContent = newScale.domain()[0].toLocaleDateString('en-US');
            zoomEnd.textContent = newScale.domain()[1].toLocaleDateString('en-US');
        };

        renderStats(repositoriesData);
    }

    render() {
        const t = this.props.t;

        return (
            <Panel title={t(this.props.farm.name + '\'s Farm Events')}>
                <div id="eventdrops-demo" style="width: 90%;"></div>
                <p class="infos">
                    <span id="numberCommits"></span> commits found between <span id="zoomStart"></span>
                    and <span id="zoomEnd"></span>.
                </p>
            </Panel>
        );
    }
}