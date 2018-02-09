'use strict';

import React, { Component } from "react";
import { translate } from "react-i18next";
import { Panel } from "../../lib/panel";
import { requiresAuthenticatedUser, withPageHelpers } from "../../lib/page";
import axios from "../../lib/axios";
import { withAsyncErrorHandler, withErrorHandling } from "../../lib/error-handling";
import { Table } from "../../lib/table";
import moment from "moment";
import { Icon } from "../../lib/bootstrap-components";

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class FarmsCropSeasonsPanel extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const t = this.props.t;
        const columns = [
            { data: 0, title: t('Id') },
            { data: 1, title: t('Name') },
            { data: 2, title: t('Description') },
            { data: 3, title: t('Farm') },
            { data: 4, title: t('Crop') },
            { data: 5, title: t('Start'), render: data => moment(data).fromNow() },
            { data: 6, title: t('End'), render: data => moment(data).fromNow() },
            {
                actions: data => {
                    const actions = [];
                    const perms = data[7];
                    //if (perms.includes('createCropSeason')) { }
                    actions.push({
                        label: <Icon icon="eye-open" title={t('Analysis')} />,
                        link: `/workspaces/crop-seasons/${data[0]}`
                    });

                    return actions;
                }, title: t('Actions')
            }
        ];

        return (
            <Panel title={t('Farms Crop Seasons')} >
                <Table withHeader dataUrl="/rest/crop-seasons-table" columns={columns} />
            </Panel>
        );
    }
}