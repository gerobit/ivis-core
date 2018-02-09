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
export default class FarmsEventsPanel extends Component {
    constructor(props) {
        super(props);
        this.state = { eventsData: null, 
            tooltipSpec: null };
    }

    async componentDidMount() {
        const response = await axios.get('/rest/events');

        let eventsDic = {};
        
        for (const event of response.data) {
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
            console.log(event, eventsDic[event]);
            const dict = {
                name: event,
                data: [...eventsDic[event]]
            }
            console.log('dict', dict);

            eventsData.push(dict);
        }

        const tooltipSpec = {
            user: 'User:',
            farm: 'Farm:',
            description: 'Description',
            quantity: 'Quantity:',
            cost: 'Cost:',
            d: 'Happend at'
        }

        this.setState({ tooltipSpec, eventsData: eventsData });
    }

    render() {
        const t = this.props.t;

        return (
            <Panel title={t('Farms Events')} >
                <EventTimeline data={this.state.eventsData} tooltipSpec={this.state.tooltipSpec} />
            </Panel>
        );
    }
}