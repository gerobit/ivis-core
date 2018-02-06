'use strict';

import React, { Component } from "react";
import { translate } from "react-i18next";
import { Panel } from "../../lib/panel";
import { requiresAuthenticatedUser, withPageHelpers } from "../../lib/page";
import axios from "../../lib/axios";
import { withAsyncErrorHandler, withErrorHandling } from "../../lib/error-handling";
import EventTimeline from "../../lib/event-timeline.js";
import moment from "moment";
import { event } from "d3/build/d3";

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class FarmsRecommendationsPanel extends Component {
    constructor(props) {
        super(props);
        this.state = {
            recommendationsData: null,
            tooltipSpec: null
        };
    }

    async componentDidMount() {
        const response = await axios.get('/rest/recommendations');

        let recommendationsDic = {};
        //['recommendations.id', 'farmer.name as farmer', 'advisor.name as advisor', 
        //        'farms.name as farm', 'event_types.name as event', 'recommendations.description', 'recommendations.to_be_happened', 'recommendations.quantity', 'recommendations.cost']
        for (const recommendation of response.data) {
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
            console.log(recommendation, recommendationsDic[recommendation]);
            const dict = {
                name: recommendation,
                data: [...recommendationsDic[recommendation]]
            }
            console.log('dict', dict);

            recommendationsData.push(dict);
        }

        const tooltipSpec = {
            farmer: 'Farmer:',
            advisor: 'Advisor:',
            farm: 'Farm:',
            description: 'Description:',
            quantity: 'Quantity:',
            cost: 'Cost:',
            d: 'Scheduled for '
        }

        this.setState({ tooltipSpec, recommendationsData: recommendationsData });
    }

    render() {
        const t = this.props.t;

        return (
            <Panel title={t('Farms Recommendations')} >
                <EventTimeline data={this.state.recommendationsData} tooltipSpec={this.state.tooltipSpec} />
            </Panel>
        );
    }
}