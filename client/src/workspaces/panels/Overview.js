'use strict';

import React, {Component} from "react";
import PropTypes from 'prop-types';
import {translate} from "react-i18next";
import {Table} from "../../lib/table";
import {Panel} from "../../lib/panel";
import {requiresAuthenticatedUser, withPageHelpers} from "../../lib/page";
import {withErrorHandling} from "../../lib/error-handling";
import moment from "moment";

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
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
            { data: 4, title: t('Template') },
            { data: 5, title: t('Created'), render: data => moment(data).fromNow() },
            { data: 6, title: t('Namespace') }
        ];


        return (
            <Panel title={t('All Panels of Workspace "{{name}}"', {name: this.props.workspace.name})}>
                <Table withHeader dataUrl={`/rest/panels-table/${this.props.workspace.id}`} columns={columns} />
            </Panel>
        );
    }
}