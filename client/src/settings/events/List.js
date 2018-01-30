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
            createEvents: {
                entityTypeId: 'namespace',
                requiredOperations: ['createEvent']
            }
        };

        const result = await axios.post('/rest/permissions-check', request);

        this.setState({
            createPermitted: result.data.createEvents
        });
    }

    componentDidMount() {
        this.fetchPermissions();
    }

    render() {
        const t = this.props.t;
        //['events.id', 'users.name', 'farms.name', 'event_types.name', 'events.description', 
        //'events.happened', 'events.quantity', 'events.cost']

        const columns = [
            { data: 0, title: t('Id') },
            { data: 1, title: t('User (Farmer)') },
            { data: 2, title: t('Farm') },
            { data: 3, title: t('Event Type') },
            { data: 4, title: t('Description') },
            { data: 5, title: t('Happened') , render: data => moment(data).fromNow()},
            { data: 6, title: t('Quantity') },
            { data: 7, title: t('Cost') },
            {
                actions: data => {
                    const actions = [];
                    //const perms = data[6];

                    //if (perms.includes('manageFarms')) {
                    actions.push({
                        label: <Icon icon="edit" title={t('Edit')} />,
                        link: `/settings/events/${data[0]}/edit`
                    });
                    //}

                    return actions;
                }, title: t('Actions')
            }
        ];


        return (
            <Panel title={t('Crops')}>
                {this.state.createPermitted &&
                    <Toolbar>
                        <NavButton linkTo="/settings/events/create" className="btn-primary" icon="plus" label={t('Create Event')} />
                    </Toolbar>
                }
                <Table withHeader dataUrl="/rest/events-table" columns={columns} />
            </Panel>
        );
    }
}