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
import {
    withErrorHandling
} from "../../lib/error-handling";
import moment from "moment";
import {getRunStatuses} from "./states";
import {
    tableAddDeleteButton,
    tableRestActionDialogInit,
   tableRestActionDialogRender
} from "../../lib/modals";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class Log extends Component {
    constructor(props) {
        super(props);

        this.state = {};
        tableRestActionDialogInit(this);

        this.runStatuses = getRunStatuses(props.t);
    }

    render() {
        const t = this.props.t;
        const job = this.props.entity;

        const columns = [
            {data: 2, title: t('Started at'), render: data => moment(data).format('DD.MM.YYYY hh:mm:ss')},
            {data: 3, title: t('Finished at'), render: data => moment(data).format('DD.MM.YYYY hh:mm:ss')},
            {data: 4, title: t('Status'), render: data => this.runStatuses[data]},
            {
                actions: data => {

                    const actions = [];
                    const perms = data[5];

                    actions.push({
                        label: <Icon icon="file-alt" family="far" title={t('View run output')}/>,
                        link: `/settings/jobs/${data[1]}/log/${data[0]}`
                    });

                    tableAddDeleteButton(actions, this, perms, `rest/jobs/${job.id}/run/${data[0]}`, data[0], t('Deleting run ...'), t('Run deleted'));
                    return {undefined, actions};
                }
            }
        ];


        return (
            <Panel title={t('Runs for job with id ') + job.id}>
                {tableRestActionDialogRender(this)}
                <Table ref={node => this.table = node} withHeader dataUrl={"rest/job-runs-table/" + job.id}
                       columns={columns}/>
            </Panel>
        );
    }
}