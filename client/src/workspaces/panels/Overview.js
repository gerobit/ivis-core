'use strict';

import React, {Component} from "react";
import PropTypes
    from 'prop-types';
import {Table} from "../../lib/table";
import {Panel} from "../../lib/panel";
import {
    requiresAuthenticatedUser,
    withPageHelpers
} from "../../lib/page";
import {withErrorHandling} from "../../lib/error-handling";
import moment
    from "moment";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";
import {getBuiltinTemplateName} from "../../lib/builtin-templates";

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class Overview extends Component {
    constructor(props) {
        super(props);

        this.state = {};
    }

    static propTypes = {
        workspace: PropTypes.object
    }

    render() {
        const t = this.props.t;

        const columns = [
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
            { data: 4, title: t('Template'), render: (data, cmd, rowData) => data !== null ? data : getBuiltinTemplateName(rowData[5], t), orderable: false },
            { data: 6, title: t('Created'), render: data => moment(data).fromNow() },
            { data: 7, title: t('Namespace') }
        ];


        return (
            <Panel title={t('All Panels of Workspace "{{name}}"', {name: this.props.workspace.name})}>
                <Table withHeader dataUrl={`rest/panels-table/${this.props.workspace.id}`} columns={columns} />
            </Panel>
        );
    }
}