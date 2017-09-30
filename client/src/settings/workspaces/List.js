'use strict';

import React, {Component} from "react";
import {translate} from "react-i18next";
import {Table} from "../../lib/table";
import {Panel} from "../../lib/panel";
import {NavButton, requiresAuthenticatedUser, Toolbar, withPageHelpers} from "../../lib/page";
import {Icon} from "../../lib/bootstrap-components";
import axios from "../../lib/axios";
import {withAsyncErrorHandler, withErrorHandling} from "../../lib/error-handling";
import moment from "moment";

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class List extends Component {
    constructor(props) {
        super(props);

        this.state = {};
    }

    @withAsyncErrorHandler
    async fetchPermissions() {
        const request = {
            createWorkspace: {
                entityTypeId: 'namespace',
                requiredOperations: ['createWorkspace']
            }
        };

        const result = await axios.post('/rest/permissions-check', request);

        this.setState({
            createPermitted: result.data.createWorkspace
        });
    }

    componentDidMount() {
        this.fetchPermissions();
    }

    render() {
        const t = this.props.t;

        const columns = [
            { data: 1, title: "#" },
            {
                data: 2,
                title: "Name",
                actions: data => [
                    {
                        label: data[2],
                        link: `/workspaces/${data[0]}`
                    }
                ]
            },
            { data: 3, title: "Description" },
            { data: 4, title: t('Created'), render: data => moment(data).fromNow() },
            { data: 5, title: t('Namespace') },
            {
                actions: data => {
                    const actions = [];
                    const perms = data[7];

                    if (perms.includes('edit')) {
                        actions.push({
                            label: <Icon icon="edit" title={t('Edit')}/>,
                            link: `/settings/workspaces/${data[0]}/edit`
                        });
                    }

                    actions.push({
                        label: <Icon icon="th-list" title={t('Panels')}/>,
                        link: `/settings/workspaces/${data[0]}/panels`
                    });

                    if (perms.includes('share')) {
                        actions.push({
                            label: <Icon icon="share" title={t('Share')}/>,
                            link: `/settings/workspaces/${data[0]}/shares`
                        });
                    }

                    return actions;
                }
            }
        ];


        return (
            <Panel title={t('Workspaces')}>
                {this.state.createPermitted &&
                    <Toolbar>
                        <NavButton linkTo="/settings/workspaces/create" className="btn-primary" icon="plus" label={t('Create Workspace')}/>
                    </Toolbar>
                }
                <Table withHeader dataUrl="/rest/workspaces-table" columns={columns} />
            </Panel>
        );
    }
}