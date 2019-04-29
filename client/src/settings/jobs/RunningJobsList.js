'use strict';

import React, {Component} from "react";
import {translate} from "react-i18next";
import {Table} from "../../lib/table";
import {Panel} from "../../lib/panel";
import {
    requiresAuthenticatedUser,
    withPageHelpers
} from "../../lib/page";
import {Icon} from "../../lib/bootstrap-components";
import axios from "../../lib/axios";
import {
    withAsyncErrorHandler,
    withErrorHandling
} from "../../lib/error-handling";
import moment from "moment";
import {getUrl} from "../../lib/urls";
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
    }

    @withAsyncErrorHandler
    async stop(table, id) {
        await axios.post(getUrl(`rest/job-stop/${id}`));
        table.refresh();
    }

    render() {
        const t = this.props.t;

        const columns = [
            {data: 0, title: t('Run ID')},
            {data: 2, title: t('Job name')},
            {data: 3, title: t('Running for'), render: data => moment(data).fromNow(true)},
            {data: 4, title: t('Status'), render: data => data},
            {
                actions: data => {

                    const actions = [];
                    const perms = data[5];

                    if (perms.includes('execute')) {
                        actions.push({
                            label: <Icon icon="stop" family="fas" title={t('Stop')}/>,
                            action: (table) => this.stop(table, data[0])
                        });
                    }

                    return {refreshTimeout: null, actions};
                }
            }
        ];


        return (
            <Panel title={t('Running jobs')}>
                <Table ref={node => this.table = node} withHeader dataUrl="rest/job-running-table" columns={columns} refreshInterval={1000}/>
            </Panel>
        );
    }
};