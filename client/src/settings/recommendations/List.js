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

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class List extends Component {
    constructor(props) {
        super(props);

        this.state = {};

        const t = props.t;
    }

    @withAsyncErrorHandler
    async fetchPermissions() {
        const request = {
            createRecommendation: {
                entityTypeId: 'namespace',
                requiredOperations: ['createRecommendation']
            }
        };

        const result = await axios.post('/rest/permissions-check', request);

        this.setState({
            createPermitted: result.data.createRecommendation
        });
    }

    componentDidMount() {
        this.fetchPermissions();
    }

    render() {
        const t = this.props.t;
        /*
      ['advisor.name', 'farmer.name', 'farms.name', 'event_types.name', 'recommendations.description', 'recommendations.to_be_happened', 
      'recommendations.quantity', 'recommendations.cost']     
        */
        const columns = [
            { data: 0, title: t('Id') },
            { data: 1, title: t('Advisor') },
            { data: 2, title: t('Farmer') },
            { data: 3, title: t('Farm') },
            { data: 4, title: t('Event Type') },
            { data: 5, title: t('Description') },
            { data: 6, title: t('Scheduled for'), render: data => moment(data).fromNow() },
            { data: 7, title: t('Quantity') },
            { data: 8, title: t('Cost') },
            {
                actions: data => {
                    const actions = [];
                    //const perms = data[6];

                    //if (perms.includes('manageFarms')) {
                    actions.push({
                        label: <Icon icon="edit" title={t('Edit')} />,
                        link: `/settings/recommendations/${data[0]}/edit`
                    });
                    //}

                    return actions;
                }, title: t('Actions')
            }
        ];


        return (
            <Panel title={t('Recommendations')}>
                {this.state.createPermitted &&
                    <Toolbar>
                        <NavButton linkTo="/settings/recommendations/create" className="btn-primary" icon="plus" label={t('Create Recommendation')} />
                    </Toolbar>
                }
                <Table withHeader dataUrl="/rest/recommendations-table" columns={columns} />
            </Panel>
        );
    }
}