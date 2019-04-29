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
import {RunStatus} from "../../../../shared/jobs";
import {getJobStates} from "./states";
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

        this.jobStates = getJobStates(props.t);

        this.runSpecs = new Map();
    }

    @withAsyncErrorHandler
    async fetchPermissions() {
        const result = await checkPermissions({
            createJob: {
                entityTypeId: 'namespace',
                requiredOperations: ['createJob']
            }
        });

        this.setState({
            createPermitted: result.data.createJob
        });
    }

    @withAsyncErrorHandler
    async fetchRun(jobId, runId) {
        const result = await axios.get(getUrl(`rest/jobs/${jobId}/run/${runId}`));

        const status = result.data.status;

        if (status == null
            || status === RunStatus.INITIALIZATION
            || status === RunStatus.SCHEDULED
            || status === RunStatus.RUNNING) {
            const timeout = setTimeout(() => {
                this.fetchRun(jobId, runId);
            }, 1000);
            this.runSpecs.set(jobId, {id: runId, status: status, timeout: timeout});
        } else {
            this.runSpecs.delete(jobId);
        }
    }

    @withAsyncErrorHandler
    async run(table, id) {
        const runIdReq = await axios.post(getUrl(`rest/job-run/${id}`));
        const runId = runIdReq.data;
        this.runSpecs.set(id, {id: runId, status: RunStatus.INITIALIZATION, timeout: null});
        this.fetchRun(id, runId);
        table.refresh();
    }

    @withAsyncErrorHandler
    async stop(table, id) {
        const specs = this.runSpecs.get(id);
        if (specs) {
            await axios.post(getUrl(`rest/job-stop/${specs.id}`));
            if (specs.timeout) {
                clearTimeout(specs.timeout);
            }
            this.runSpecs.delete(id);
            table.refresh();
        }
    }

    componentDidMount() {
        this.fetchPermissions();
    }

    componentWillUnmount() {
        this.runSpecs.forEach((k, v) => {
            if (v && v.timeout) {
                clearTimeout(v.timeout)
            }
        });
    }

    render() {
        const t = this.props.t;

        const columns = [
            {data: 1, title: t('Name')},
            {data: 2, title: t('Description')},
            {data: 3, title: t('Task')},
            {data: 4, title: t('Created'), render: data => moment(data).fromNow()},
            {data: 5, title: t('State'), render: data => this.jobStates[data]},
            {data: 6, title: t('Trigger')},
            {data: 9, title: t('Namespace')},
            {
                actions: data => {

                    const actions = [];
                    const perms = data[10];
                    const runSpecs = this.runSpecs.get(data[0]);
                    let runStatus = null;
                    if (runSpecs) {
                        runStatus = runSpecs.status;
                    }
                    let refreshTimeout;

                    if (perms.includes('execute')) {
                            if (runStatus === RunStatus.INITIALIZATION
                                || runStatus === RunStatus.SCHEDULED
                                || runStatus === RunStatus.RUNNING) {
                                actions.push({
                                    label: <Icon icon="stop" family="fas" title={t('Stop')}/>,
                                    action: (table) => this.stop(table, data[0])
                                });

                                refreshTimeout = 1000;

                            } else {
                                actions.push({
                                    label: <Icon icon="play-circle" family="far" title={t('Run')}/>,
                                    action: (table) => this.run(table, data[0])
                                });
                            }
                    }

                    if (perms.includes('view')) {
                        actions.push({
                            label: <Icon icon="file-alt" family="far" title={t('Run logs')}/>,
                            link: `/settings/jobs/${data[0]}/log`
                        });
                    }

                    if (perms.includes('edit')) {

                        actions.push({
                            label: <Icon icon="edit" title={t('Settings')}/>,
                            link: `/settings/jobs/${data[0]}/edit`
                        });
                    }

                    if (perms.includes('share')) {
                        actions.push({
                            label: <Icon icon="share" title={t('Share')}/>,
                            link: `/settings/jobs/${data[0]}/share`
                        });
                    }

                    tableAddDeleteButton(actions, this, perms,`rest/jobs/${data[0]}`, data[1], t('Deleting job ...'), t('Job deleted'));
                    return {refreshTimeout, actions};
                }
            }
        ];

        const panelMenu = [];
        panelMenu.push({
            label: 'Running jobs',
            action: ''
        });

        return (
            <Panel title={t('Jobs')} onPanelMenuAction={action => {window.location.href = getUrl('settings/jobs/running')}} panelMenu={panelMenu}>
                {tableRestActionDialogRender(this)}
                {this.state.createPermitted &&
                <Toolbar>
                    <LinkButton to="/settings/jobs/create" className="btn-primary" icon="plus"
                               label={t('Create Job')}/>
                </Toolbar>
                }
                <Table ref={node => this.table = node} withHeader dataUrl="rest/jobs-table" columns={columns}/>
            </Panel>
        );
    }
};