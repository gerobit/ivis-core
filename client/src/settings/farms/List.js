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

        const t = props.t;
    }

    @withAsyncErrorHandler
    async fetchPermissions() {
        const request = {
            createFarm: {
                entityTypeId: 'namespace',
                requiredOperations: ['createFarm']
            }
        };

        const result = await axios.post('/rest/permissions-check', request);

        this.setState({
            createPermitted: result.data.createFarm
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
            { data: 3, title: t('Address') },
            { data: 4, title: t('User') },
            { data: 5, title: t('Created'), render: data => moment(data).fromNow() },
            { data: 6, title: t('Namespace') },
            {
                actions: data => {
                    const actions = [];
                    const perms = data[7];

                    if (perms.includes('edit')) {
                        actions.push({
                            label: <Icon icon="edit" title={t('Edit')}/>,
                            link: `/settings/farms/${data[0]}/edit`
                        });
                    }

                    actions.push({
                        label: <Icon icon="th-list" title={t('Panels')}/>,
                        link: `/settings/farms/${data[0]}/signal-set`
                    });


                    if (perms.includes('share')) {
                        actions.push({
                            label: <Icon icon="share" title={t('Share')}/>,
                            link: `/settings/farms/${data[0]}/share`
                        });
                    }

                    return actions;
                }
            }
        ];


        return (
            <Panel title={t('Farms')}>
                {this.state.createPermitted &&
                    <Toolbar>
                        <NavButton linkTo="/settings/farms/create" className="btn-primary" icon="plus" label={t('Create Farm')}/>
                    </Toolbar>
                }
                <Table withHeader dataUrl="/rest/farms-table" columns={columns} />
            </Panel>
        );
    }
}