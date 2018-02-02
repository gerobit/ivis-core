'use strict';

import React, { Component } from "react";
import { translate } from "react-i18next";
import { Table } from "../../lib/table";
import { Panel } from "../../lib/panel";
import { NavButton, requiresAuthenticatedUser, Toolbar, withPageHelpers } from "../../lib/page";
import { Icon } from "../../lib/bootstrap-components";
import axios from "../../lib/axios";
import { withAsyncErrorHandler, withErrorHandling } from "../../lib/error-handling";
import moment from "moment";

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class List extends Component {
    constructor(props) {
        super(props);

        this.state = {};

        const t = props.t;
    }

    @withAsyncErrorHandler
    async fetchPermissions() {
        const request = {
            createCropSeason: {
                entityTypeId: 'namespace',
                requiredOperations: ['createCropSeason']
            }
        };

        const result = await axios.post('/rest/permissions-check', request);

        this.setState({
            createPermitted: result.data.createCropSeason
        });
    }

    componentDidMount() {
        this.fetchPermissions();
    }

    render() {
        const t = this.props.t;
        ['crop_seasons.id', 'crop_seasons.name', 'crop_seasons.description', 'farms.name', 'crops.name', 'start', 'end']

        const columns = [
            { data: 0, title: t('Id') },
            { data: 1, title: t('Name') },
            { data: 2, title: t('Description') },
            { data: 3, title: t('Farm') },
            { data: 4, title: t('Crop')},
            { data: 5, title: t('Start'), render: data => moment(data).fromNow()  },
            { data: 6, title: t('End'), render: data => moment(data).fromNow()  },
            {
                actions: data => {
                    const actions = [];
                    const perms = data[7];

                    if (perms.includes('createCropSeason')) {
                        actions.push({
                            label: <Icon icon="edit" title={t('Edit')} />,
                            link: `/settings/crop-seasons/${data[0]}/edit`
                        });
                    }

                    return actions;
                }, title: t('Actions')
            }
        ];


        return (
            <Panel title={t('Crop Seasons')}>
                {this.state.createPermitted &&
                    <Toolbar>
                        <NavButton linkTo="/settings/crop-seasons/create" className="btn-primary" icon="plus" label={t('Create Crop Season')} />
                    </Toolbar>
                }
                <Table withHeader dataUrl="/rest/crop-seasons-table" columns={columns} />
            </Panel>
        );
    }
}