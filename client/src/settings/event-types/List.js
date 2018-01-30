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
            createEventTypes: {
                entityTypeId: 'namespace',
                requiredOperations: ['createEventTypes']
            }
        };

        const result = await axios.post('/rest/permissions-check', request);

        this.setState({
            createPermitted: result.data.createEventTypes
        });
    }

    componentDidMount() {
        this.fetchPermissions();
    }

    render() {
        const t = this.props.t;

        const columns = [
            { data: 0, title: t('Id') },
            { data: 1, title: t('Name') },
            { data: 2, title: t('Description') },
            { data: 3, title: t('Unit') },
            { data: 4, title: t('Namespace') },
            {
                actions: data => {
                    const actions = [];
                    //const perms = data[6];

                    //if (perms.includes('manageFarms')) {
                        actions.push({
                            label: <Icon icon="edit" title={t('Edit')} />,
                            link: `/settings/event-types/${data[0]}/edit`
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
                        <NavButton linkTo="/settings/event-types/create" className="btn-primary" icon="plus" label={t('Create Event Type')} />
                    </Toolbar>
                }
                <Table withHeader dataUrl="/rest/event-types-table" columns={columns} />
            </Panel>
        );
    }
}