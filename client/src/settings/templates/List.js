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
import axios from "../../lib/axios";
import {
    withAsyncErrorHandler,
    withErrorHandling
} from "../../lib/error-handling";
import moment from "moment";
import {BuildState} from "../../../../shared/build";
import {getBuildStates} from "./build-states";
import {getUrl} from "../../lib/urls";
import {checkPermissions} from "../../lib/permissions";
import ivisConfig from "ivisConfig";
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

        this.buildStates = getBuildStates(props.t);
    }

    @withAsyncErrorHandler
    async fetchPermissions() {
        const result = await checkPermissions({
            createTemplate: {
                entityTypeId: 'namespace',
                requiredOperations: ['createTemplate']
            }
        });

        this.setState({
            createPermitted: result.data.createTemplate
        });
    }

    @withAsyncErrorHandler
    async rebuild(table, id) {
        await axios.post(getUrl(`rest/template-build/${id}`));
        table.refresh();
    }

    componentDidMount() {
        this.fetchPermissions();
    }

    render() {
        const t = this.props.t;

        const columns = [
            { data: 1, title: t('Name') },
            { data: 2, title: t('Description') },
            { data: 3, title: t('Type') },
            { data: 5, title: t('Created'), render: data => moment(data).fromNow() },
            { data: 6, title: t('Status'), render: data => this.buildStates[data] },
            { data: 7, title: t('Namespace') },
            {
                actions: data => {

                    const actions = [];
                    const perms = data[8];
                    const canEditPanel = data[4];
                    const state = data[6];
                    let refreshTimeout;

                    if (perms.includes('edit')) {

                        if (state === BuildState.PROCESSING || state === BuildState.SCHEDULED) {
                            actions.push({
                                label: <Icon icon="spinner" family="fa" title={t('Processing')}/>,
                            });

                            refreshTimeout = 1000;

                        } else if (state === BuildState.FINISHED || state === BuildState.FAILED) {
                            actions.push({
                                label: <Icon icon="repeat" title={t('Rebuild')}/>,
                                action: (table) => this.rebuild(table, data[0])
                            });
                        }

                        if (!canEditPanel || ivisConfig.globalPermissions.editTemplatesWithElevatedAccess) {
                            actions.push({
                                label: <Icon icon="file-code-o" family="fa" title={t('Code')}/>,
                                link: `/settings/templates/${data[0]}/develop`
                            });
                        }

                        actions.push({
                            label: <Icon icon="desktop" family="fa" title={t('View Build Output')}/>,
                            link: `/settings/templates/${data[0]}/output`
                        });

                        if (!canEditPanel || ivisConfig.globalPermissions.editTemplatesWithElevatedAccess) {
                            actions.push({
                                label: <Icon icon="edit" title={t('Settings')}/>,
                                link: `/settings/templates/${data[0]}/edit`
                            });
                        }
                    }

                    if (perms.includes('share')) {
                        actions.push({
                            label: <Icon icon="share" title={t('Share')}/>,
                            link: `/settings/templates/${data[0]}/shares`
                        });
                    }

                    tableDeleteDialogAddDeleteButton(actions, this, perms, data[0], data[1]);

                    return { refreshTimeout, actions };
                }
            }
        ];


        return (
            <Panel title={t('Templates')}>
                {tableDeleteDialogRender(this, `rest/templates`, t('Deleting template ...'), t('Template deleted'))}
                {this.state.createPermitted &&
                    <Toolbar>
                        <NavButton linkTo="/settings/templates/create" className="btn-primary" icon="plus" label={t('Create Template')}/>
                    </Toolbar>
                }
                <Table ref={node => this.table = node} withHeader dataUrl="rest/templates-table" columns={columns} />
            </Panel>
        );
    }
}