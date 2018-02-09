'use strict';

import React, { Component } from "react";
import { translate } from "react-i18next";
import { Panel } from "../../lib/panel";
import { requiresAuthenticatedUser, withPageHelpers } from "../../lib/page";
import axios from "../../lib/axios";
import { withAsyncErrorHandler, withErrorHandling } from "../../lib/error-handling";
import EventTimeline from "../../lib/event-timeline.js";
import moment from "moment";

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class FarmsRecommendationsPanel extends Component {
    constructor(props) {
        super(props);
        this.state = {
            recommendationsData: null,
            tooltipSpecRec: null,
            eventsData: null, 
            tooltipSpecEvent: null
        };
    }

    async componentDidMount() {
        const responseRec = await axios.get('/rest/recommendations');

        let recommendationsDic = {};
        for (const recommendation of responseRec.data) {
            if (recommendationsDic.hasOwnProperty(recommendation.recommendation))
                recommendationsDic[recommendation.event].push({
                    date: recommendation.to_be_happened,
                    d: moment(new Date(recommendation.to_be_happened)).fromNow().toString(),
                    farmer: recommendation.farmer,
                    advisor: recommendation.advisor,
                    farm: recommendation.farm,
                    description: recommendation.description,
                    cost: recommendation.cost,
                    quantity: recommendation.quantity
                });
            else {
                recommendationsDic[recommendation.event] = [{
                    date: recommendation.to_be_happened,
                    d: moment(new Date(recommendation.to_be_happened)).fromNow().toString(),
                    farmer: recommendation.farmer,
                    advisor: recommendation.advisor,
                    farm: recommendation.farm,
                    description: recommendation.description,
                    cost: recommendation.cost,
                    quantity: recommendation.quantity
                }];
            }
        }

        let recommendationsData = [];
        for (const recommendation in recommendationsDic) {
            //console.log(recommendation, recommendationsDic[recommendation]);
            const dict = {
                name: recommendation,
                data: [...recommendationsDic[recommendation]]
            }
            recommendationsData.push(dict);
        }

        const tooltipSpecRec = {
            farmer: 'Farmer:',
            advisor: 'Advisor:',
            farm: 'Farm:',
            description: 'Description:',
            quantity: 'Quantity:',
            cost: 'Cost:',
            d: 'Scheduled for '
        }
        const responseEvent = await axios.get('/rest/events');

        let eventsDic = {};
        
        for (const event of responseEvent.data) {
            if (eventsDic.hasOwnProperty(event.event))
                eventsDic[event.event].push({
                    date: event.happened,
                    d: moment(new Date(event.happened)).fromNow().toString(),
                    user: event.user,
                    farm: event.farm,
                    description: event.description,
                    cost: event.cost,
                    quantity: event.quantity
                });
            else {
                eventsDic[event.event] = [{
                    date: event.happened,
                    d: moment(new Date(event.happened)).fromNow().toString(),
                    user: event.user,
                    farm: event.farm,
                    description: event.description,
                    cost: event.cost,
                    quantity: event.quantity
                }];
            }
        }

        let eventsData = [];

        for (const event in eventsDic) {
            //console.log(event, eventsDic[event]);
            const dict = {
                name: event,
                data: [...eventsDic[event]]
            }
            //console.log('dict', dict);

            eventsData.push(dict);
        }

        const tooltipSpecEvent = {
            user: 'User:',
            farm: 'Farm:',
            description: 'Description',
            quantity: 'Quantity:',
            cost: 'Cost:',
            d: 'Happend at'
        }

        this.setState({ tooltipSpecEvent, eventsData, 
            tooltipSpecRec, recommendationsData });
    }

    render() {
        const t = this.props.t;

        return (
            <Panel title={t('Farms Schedule and Timeline')} >
                <EventTimeline height={500} margin={{ left: 40, right: 5, top: 5, bottom: 20 }} data={this.state.recommendationsData} tooltipSpec={this.state.tooltipSpecRec} />
                <EventTimeline height={500} data={this.state.eventsData} tooltipSpec={this.state.tooltipSpecEvent} />
            </Panel>
        );
    }
}