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
export default class FarmsPanel extends Component {
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
    }

    render() {
        const t = this.props.t;

        const columns = [
            { data: 0, title: t('Id') },
            { data: 1, title: t('Name') },
            { data: 2, title: t('Description') },
            { data: 3, title: t('Address') },
            { data: 4, title: t('Created'), render: data => moment(data).fromNow() },
            { data: 5, title: t('Namespace') },
            {
                actions: data => {
                    const actions = [];
                    const perms = data[6];
                    actions.push({
                        label: <Icon icon="th-list" title={t('View')} />,
                        link: `/workspaces/farms/${data[0]}`
                    });

                    actions.push({
                        label: <Icon icon="th-list" title={t('Create Event')} />,
                        link: `/workspaces/farms/${data[0]}/events`
                    });

                    actions.push({
                        label: <Icon icon="th-list" title={t('Create Recommendation')} />,
                        link: `/workspaces/farms/${data[0]}/recommendations`
                    });

                    return actions;
                }, title: t('Actions')
            }
        ];

        /*
            we could for instance think about a map above the list.
            which may have some additional graphical elements and would lack ability to add farms, etc.
        */
        return (
            <Panel title={t('Farms Workspace')}>
                <Panel title={t('Your Farms Map')}>
                    Map Graphic
                </Panel>

                <Panel title={t('Your Farms')}>
                    <Table withHeader dataUrl="/rest/farms-table" columns={columns} />
                </Panel>

            </Panel>
        );
    }
}