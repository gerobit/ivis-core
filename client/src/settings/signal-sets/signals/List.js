'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {Table} from "../../../lib/table";
import {Panel} from "../../../lib/panel";
import {LinkButton, requiresAuthenticatedUser, Toolbar, withPageHelpers} from "../../../lib/page";
import {Icon} from "../../../lib/bootstrap-components";
import {HTTPMethod} from "../../../lib/axios";
import {withAsyncErrorHandler, withErrorHandling} from "../../../lib/error-handling";
import moment from "moment";
import {getSignalTypes} from "./signal-types";
import {
    RestActionModalDialog,
    tableAddDeleteButton,
    tableRestActionDialogInit,
    tableRestActionDialogRender
} from "../../../lib/modals";
import {checkPermissions} from "../../../lib/permissions";
import {IndexingStatus, DerivedSignalTypes} from "../../../../../shared/signals";
import {withComponentMixins} from "../../../lib/decorator-helpers";
import {withTranslation} from "../../../lib/i18n";

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class List extends Component {
    constructor(props) {
        super(props);

        this.state = {};
        tableRestActionDialogInit(this);

        this.signalTypes = getSignalTypes(props.t)
    }

    static propTypes = {
        action: PropTypes.string.isRequired,
        signalSet: PropTypes.object
    }

    @withAsyncErrorHandler
    async fetchPermissions() {
        const result = await checkPermissions({
            createSignal: {
                entityTypeId: 'namespace',
                requiredOperations: ['createSignal']
            }
        });

        this.setState({
            createPermitted: result.data.createSignal && this.props.signalSet.permissions.includes('createSignal'),
            reindexPermitted: this.props.signalSet.permissions.includes('reindex')
        });
    }

    needsReindex(){
        const indexing = JSON.parse(this.props.signalSet.indexing);
        return indexing.status === IndexingStatus.REQUIRED;
    }

    componentDidMount() {
        this.fetchPermissions();
    }

    render() {
        const t = this.props.t;

        const columns = [
            { data: 1, title: t('Id'), render: data => <code>{data}</code> },
            { data: 2, title: t('Name') },
            { data: 3, title: t('Description') },
            { data: 4, title: t('Type'), render: data => this.signalTypes[data] },
            { data: 5, title: t('Indexed'), render: data => data ? t('Y') : t('N') },
            { data: 6, title: t('Created'), render: data => moment(data).fromNow() },
            { data: 7, title: t('Namespace') },
            {
                actions: data => {
                    const actions = [];
                    const perms = data[8];
                    const signalType = data[4];

                    if (perms.includes('edit') && (!DerivedSignalTypes.has(signalType) || !this.props.signalSet.permissions.includes('manageScripts'))) {
                        actions.push({
                            label: <Icon icon="edit" title={t('Edit')}/>,
                            link: `/settings/signal-sets/${this.props.signalSet.id}/signals/${data[0]}/edit`
                        });
                    }

                    if (perms.includes('share')) {
                        actions.push({
                            label: <Icon icon="share" title={t('Share')}/>,
                            link: `/settings/signal-sets/${this.props.signalSet.id}/signals/${data[0]}/share`
                        });
                    }

                    tableAddDeleteButton(actions, this, perms, `rest/signals/${data[0]}`, data[2], t('Deleting signal ...'), t('Signal deleted'));

                    return actions;
                }
            }
        ];


        return (
            <Panel title={t('Signals')}>
                {tableRestActionDialogRender(this)}
                {this.state.reindexPermitted &&
                <RestActionModalDialog
                    title={t('Confirm reindexing')}
                    message={t('Do you want to reindex the values in this signal set? The operation may take time during which panels displaying the signal set will provide incomplete view.')}
                    visible={this.props.action === 'reindex'}
                    actionUrl={`rest/signal-set-reindex/${this.props.signalSet.id}`}
                    actionMethod={HTTPMethod.POST}
                    backUrl={`/settings/signal-sets/${this.props.signalSet.id}/signals`}
                    successUrl={`/settings/signal-sets/${this.props.signalSet.id}/signals`}
                    actionInProgressMsg={t('Starting reindexing ...')}
                    actionDoneMsg={t('Reindexing started')}/>
                }

                {this.state.reindexPermitted && this.needsReindex() && "The signal set has been changed. Reindex to finalize the change."}

                {(this.state.createPermitted || this.state.reindexPermitted) &&
                    <Toolbar>
                        {this.state.createPermitted && <LinkButton to={`/settings/signal-sets/${this.props.signalSet.id}/signals/create`} className="btn-primary" icon="plus" label={t('Create Signal')}/> }
                        {this.state.reindexPermitted && <LinkButton to={`/settings/signal-sets/${this.props.signalSet.id}/reindex`} className="btn-danger" icon="retweet" label={t('Reindex')}/> }
                    </Toolbar>
                }
                <Table ref={node => this.table = node} withHeader dataUrl={`rest/signals-table/${this.props.signalSet.id}`} columns={columns} />
            </Panel>
        );
    }
}