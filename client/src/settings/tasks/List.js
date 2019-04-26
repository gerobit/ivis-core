'use strict';

import React, {Component} from "react";
import {translate} from "react-i18next";
import {Table} from "../../lib/table";
import {Panel} from "../../lib/panel";
import {
    LinkButton,
    requiresAuthenticatedUser,
    Toolbar,
    withPageHelpers
} from "../../lib/page";
import {Icon} from "../../lib/bootstrap-components";
import axios from "../../lib/axios";
import {
    withAsyncErrorHandler,
    withErrorHandling
} from "../../lib/error-handling";
import moment from "moment";
import {BuildState} from "../../../../shared/tasks";
import {getBuildStates} from "./states";
import {getUrl} from "../../lib/urls";
import {checkPermissions} from "../../lib/permissions";
import {
    tableAddDeleteButton,
    tableRestActionDialogRender,
    tableRestActionDialogInit
} from "../../lib/modals";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";


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

        this.buildStates = getBuildStates(props.t);
    }

    @withAsyncErrorHandler
    async fetchPermissions() {
        const result = await checkPermissions({
            createTask: {
                entityTypeId: 'namespace',
                requiredOperations: ['createTask']
            }
        });

        this.setState({
            createPermitted: result.data.createTask
        });
    }

    @withAsyncErrorHandler
    async rebuild(table, id) {
        await axios.post(getUrl(`rest/task-build/${id}`));
        table.refresh();
    }

    componentDidMount() {
        this.fetchPermissions();
    }

    componentWillUnmount() {
    }

    render() {
        const t = this.props.t;

        const columns = [
            {data: 1, title: t('Name')},
            {data: 2, title: t('Description')},
            {data: 3, title: t('Type')},
            {data: 4, title: t('Created'), render: data => moment(data).fromNow()},
            {data: 5, title: t('Build status'), render: data => this.buildStates[data]},
            {data: 6, title: t('Namespace')},
            {
                actions: data => {

                    const actions = [];
                    const perms = data[7];
                    const state = data[5];

                    let refreshTimeout;

                    if (perms.includes('edit')) {

                        if (state !== BuildState.FINISHED && state !== BuildState.UNINITIALIZED && state !== BuildState.FAILED) {
                            actions.push({
                                label: <Icon icon="spinner" family="fas" title={t('Processing')}/>
                            });

                            refreshTimeout = 1000;

                        } else {
                            actions.push({
                                label: <Icon icon="redo" family="fas" title={t('Rebuild')}/>,
                                action: (table) => this.rebuild(table, data[0])
                            });
                        }

                        actions.push({
                            label: <Icon icon="file-code" family="fas" title={t('Code')}/>,
                            link: `/settings/tasks/${data[0]}/develop`
                        });

                        actions.push({
                            label: <Icon icon="desktop" family="fas" title={t('View Build Output')}/>,
                            link: `/settings/tasks/${data[0]}/output`
                        });

                        actions.push({
                            label: <Icon icon="edit" title={t('Settings')}/>,
                            link: `/settings/tasks/${data[0]}/edit`
                        });
                    }

                    if (perms.includes('share')) {
                        actions.push({
                            label: <Icon icon="share" title={t('Share')}/>,
                            link: `/settings/tasks/${data[0]}/share`
                        });
                    }

                    tableAddDeleteButton(actions, this, perms,`rest/tasks/${data[0]}`, data[1], t('Deleting task ...'), t('Task deleted'));

                    return {refreshTimeout, actions};
                }
            }
        ];


        return (
            <Panel title={t('Tasks')}>
                {tableRestActionDialogRender(this)}
                {this.state.createPermitted &&
                <Toolbar>
                    <LinkButton to="/settings/tasks/create" className="btn-primary" icon="plus"
                                label={t('Create Task')}/>
                </Toolbar>
                }
                <Table ref={node => this.table = node} withHeader dataUrl="rest/tasks-table" columns={columns}/>
            </Panel>
        );
    }
}