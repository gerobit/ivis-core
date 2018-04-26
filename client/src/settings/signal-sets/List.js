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
import {IndexingStatus} from "../../../../shared/signals";

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class List extends Component {
    constructor(props) {
        super(props);

        this.state = {};

        const t = props.t;
        this.indexingStates = {
            [IndexingStatus.READY]: t('Ready'),
            [IndexingStatus.PENDING]: t('Indexing'),
            [IndexingStatus.RUNNING]: t('Indexing')
        }
    }

    @withAsyncErrorHandler
    async fetchPermissions() {
        const request = {
            createSignalSet: {
                entityTypeId: 'namespace',
                requiredOperations: ['createSignalSet']
            }
        };

        const result = await axios.post('/rest/permissions-check', request);

        this.setState({
            createPermitted: result.data.createSignalSet
        });
    }

    componentDidMount() {
        this.fetchPermissions();
    }

    render() {
        const t = this.props.t;


        const columns = [
            { data: 1, title: t('Id') },
            { data: 2, title: t('Name') },
            { data: 3, title: t('Description') },
            { data: 4, title: t('Type'), render: data => data ? t('Aggs'): t('Vals') },
            { data: 5, title: t('Status'), render: data => this.indexingStates[data.status] },
            { data: 6, title: t('Created'), render: data => moment(data).fromNow() },
            { data: 7, title: t('Namespace') },
            {
                actions: data => {
                    const actions = [];
                    const perms = data[8];

                    if (perms.includes('edit')) {
                        actions.push({
                            label: <Icon icon="edit" title={t('Edit')}/>,
                            link: `/settings/signal-sets/${data[0]}/edit`
                        });
                    }

                    actions.push({
                        label: <Icon icon="th-list" title={t('Signals')}/>,
                        link: `/settings/signal-sets/${data[0]}/signals`
                    });


                    if (perms.includes('share')) {
                        actions.push({
                            label: <Icon icon="share" title={t('Share')}/>,
                            link: `/settings/signal-sets/${data[0]}/share`
                        });
                    }

                    return actions;
                }
            }
        ];


        return (
            <Panel title={t('Signal Sets')}>
                {this.state.createPermitted &&
                    <Toolbar>
                        <NavButton linkTo="/settings/signal-sets/create" className="btn-primary" icon="plus" label={t('Create Signal Set')}/>
                    </Toolbar>
                }
                <Table withHeader dataUrl="/rest/signal-sets-table" columns={columns} />
            </Panel>
        );
    }
}