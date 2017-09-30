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
            createSignal: {
                entityTypeId: 'namespace',
                requiredOperations: ['createSignal']
            }
        };

        const result = await axios.post('/rest/permissions-check', request);

        this.setState({
            createPermitted: result.data.createSignal
        });
    }

    componentDidMount() {
        this.fetchPermissions();
    }

    render() {
        const t = this.props.t;

        const columns = [
            { data: 1, title: "Id" },
            { data: 2, title: "Name" },
            { data: 3, title: "Description" },
            {
                title: "Contains",
                render: (data, display, rowData) => {
                    if (rowData[4] && rowData[5]) {
                        return t('Aggs & Vals');
                    } else if (rowData[4]) {
                        return t('Aggs');
                    } else if (rowData[5]) {
                        return t('Vals');
                    } else {
                        return t('None');
                    }
                }
            },
            { data: 6, title: t('Created'), render: data => moment(data).fromNow() },
            { data: 7, title: t('Namespace') },
            {
                actions: data => {
                    const actions = [];
                    const perms = data[8];

                    if (perms.includes('edit')) {
                        actions.push({
                            label: <Icon icon="edit" title={t('Edit')}/>,
                            link: `/settings/signals/${data[0]}/edit`
                        });
                    }

                    if (perms.includes('share')) {
                        actions.push({
                            label: <Icon icon="share" title={t('Share')}/>,
                            link: `/settings/signals/${data[0]}/share`
                        });
                    }

                    return actions;
                }
            }
        ];


        return (
            <Panel title={t('Signals')}>
                {this.state.createPermitted &&
                    <Toolbar>
                        <NavButton linkTo="/settings/signals/create" className="btn-primary" icon="plus" label={t('Create Signal')}/>
                    </Toolbar>
                }
                <Table withHeader dataUrl="/rest/signals-table" columns={columns} />
            </Panel>
        );
    }
}