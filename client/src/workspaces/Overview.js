'use strict';

import React, {Component} from "react";
import {Table} from "../lib/table";
import {Panel} from "../lib/panel";
import {
    requiresAuthenticatedUser,
    withPageHelpers
} from "../lib/page";
import {withErrorHandling} from "../lib/error-handling";
import moment
    from "moment";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";

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

    render() {
        const t = this.props.t;

        const columns = [
            {
                data: 2,
                title: t('Name'),
                actions: data => [
                    {
                        label: data[2],
                        link: `/workspaces/${data[0]}` + (data[6] ? '/' + data[6] : '') /* data[6] is the default_panel */
                    }
                ]
            },
            { data: 3, title: t('Description') },
            { data: 4, title: t('Created'), render: data => moment(data).fromNow() },
            { data: 5, title: t('Namespace') }
        ];


        return (
            <Panel title={t('All Workspaces')}>
                <Table withHeader dataUrl="rest/workspaces-table" columns={columns} />
            </Panel>
        );
    }
}