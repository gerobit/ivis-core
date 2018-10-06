'use strict';

import React, {Component} from "react";
import {translate} from "react-i18next";
import {Table} from "../../lib/table";
import {Panel} from "../../lib/panel";
import {
    NavButton,
    requiresAuthenticatedUser,
    Toolbar,
    withPageHelpers
} from "../../lib/page";
import {Icon} from "../../lib/bootstrap-components";
import {
    withAsyncErrorHandler,
    withErrorHandling
} from "../../lib/error-handling";
import moment from "moment";
import {IndexingStatus} from "../../../../shared/signals";
import {checkPermissions} from "../../lib/permissions";
import ivisConfig from "ivisConfig";
import em from "../../lib/extension-manager";
import {
    tableDeleteDialogAddDeleteButton,
    tableDeleteDialogInit,
    tableDeleteDialogRender
} from "../../lib/modals";

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class List extends Component {
    constructor(props) {
        super(props);

        this.state = {};
        tableDeleteDialogInit(this);

        const t = props.t;
        this.indexingStates = {
            [IndexingStatus.READY]: t('Ready'),
            [IndexingStatus.REQUIRED]: t('Reindex required'),
            [IndexingStatus.SCHEDULED]: t('Indexing'),
            [IndexingStatus.RUNNING]: t('Indexing')
        }

        if (!em.get('settings.signalSetsAsSensors', false)) {
            this.labels = {
                'Create Signal Set': t('Create Signal Set'),
                'Signal Sets': t('Signal Sets')
            };
        } else {
            this.labels = {
                'Create Signal Set': t('Create Sensor Node'),
                'Signal Sets': t('Sensor Nodes')
            };
        }
    }

    @withAsyncErrorHandler
    async fetchPermissions() {
        const result = await checkPermissions({
            createSignalSet: {
                entityTypeId: 'namespace',
                requiredOperations: ['createSignalSet']
            }
        });

        this.setState({
            createPermitted: result.data.createSignalSet && ivisConfig.globalPermissions.allocateSignalSet
        });
    }

    componentDidMount() {
        this.fetchPermissions();
    }

    render() {
        const t = this.props.t;
        const labels = this.labels;

        const columns = [
            { data: 1, title: t('Id') },
            { data: 2, title: t('Name') },
            { data: 3, title: t('Description') },
            { data: 4, title: t('Status'), render: data => this.indexingStates[data.status] },
            { data: 5, title: t('Created'), render: data => moment(data).fromNow() },
            { data: 6, title: t('Namespace') },
            {
                actions: data => {
                    const actions = [];
                    const perms = data[7];

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

                    tableDeleteDialogAddDeleteButton(actions, this, perms, data[0], data[2]);

                    return actions;
                }
            }
        ];

        return (
            <Panel title={labels['Signal Sets']}>
                {tableDeleteDialogRender(this, `rest/signal-sets`, t('Deleting signal set ...'), t('Signal set deleted'))}
                {this.state.createPermitted &&
                    <Toolbar>
                        <NavButton linkTo="/settings/signal-sets/create" className="btn-primary" icon="plus" label={labels['Create Signal Set']}/>
                    </Toolbar>
                }
                <Table ref={node => this.table = node} withHeader dataUrl="rest/signal-sets-table" columns={columns} />
            </Panel>
        );
    }
}