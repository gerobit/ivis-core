'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {translate} from "react-i18next";
import {Table} from "../../../lib/table";
import {Panel} from "../../../lib/panel";
import {
    NavButton,
    requiresAuthenticatedUser,
    Toolbar,
    withPageHelpers
} from "../../../lib/page";
import {Icon} from "../../../lib/bootstrap-components";
import {
    withAsyncErrorHandler,
    withErrorHandling
} from "../../../lib/error-handling";
import moment from "moment";
import {checkPermissions} from "../../../lib/permissions";
import {
    tableDeleteDialogAddDeleteButton,
    tableDeleteDialogInit,
    tableDeleteDialogRender
} from "../../../lib/modals";

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class List extends Component {
    constructor(props) {
        super(props);

        this.state = {};
        tableDeleteDialogInit(this);
    }

    static propTypes = {
        workspace: PropTypes.object
    }

    @withAsyncErrorHandler
    async fetchPermissions() {
        const result = await checkPermissions({
            createPanel: {
                entityTypeId: 'namespace',
                requiredOperations: ['createPanel']
            }
        });

        this.setState({
            createPermitted: result.data.createPanel && this.props.workspace.permissions.includes('createPanel')
        });
    }

    componentDidMount() {
        this.fetchPermissions();
    }

    render() {
        const t = this.props.t;

        const columns = [
            { data: 1, title: t('#') },
            {
                data: 2,
                title: t('Name'),
                actions: data => [
                    {
                        label: data[2],
                        link: `/workspaces/${this.props.workspace.id}/${data[0]}`
                    }
                ]
            },
            { data: 3, title: t('Description') },
            { data: 4, title: t('Template') },
            { data: 5, title: t('Created'), render: data => moment(data).fromNow() },
            { data: 6, title: t('Namespace') },
            {
                actions: data => {
                    const actions = [];
                    const perms = data[7];

                    if (perms.includes('edit')) {
                        actions.push({
                            label: <Icon icon="edit" title={t('Edit')}/>,
                            link: `/settings/workspaces/${this.props.workspace.id}/panels/${data[0]}/edit`
                        });
                    }

                    if (perms.includes('share')) {
                        actions.push({
                            label: <Icon icon="share" title={t('Share')}/>,
                            link: `/settings/workspaces/${this.props.workspace.id}/panels/${data[0]}/share`
                        });
                    }

                    tableDeleteDialogAddDeleteButton(actions, this, perms, data[0], data[2]);

                    return actions;
                }
            }
        ];


        return (
            <Panel title={t('Panels')}>
                {tableDeleteDialogRender(this, `rest/panels`, t('Deleting panel ...'), t('Panel deleted'))}
                {this.state.createPermitted &&
                    <Toolbar>
                        <NavButton linkTo={`/settings/workspaces/${this.props.workspace.id}/panels/create`} className="btn-primary" icon="plus" label={t('Create Panel')}/>
                    </Toolbar>
                }
                <Table ref={node => this.table = node} withHeader dataUrl={`rest/panels-table/${this.props.workspace.id}`} columns={columns} />
            </Panel>
        );
    }
}