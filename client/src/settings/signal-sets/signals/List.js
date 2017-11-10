'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {translate} from "react-i18next";
import {Table} from "../../../lib/table";
import {Panel} from "../../../lib/panel";
import {NavButton, requiresAuthenticatedUser, Toolbar, withPageHelpers} from "../../../lib/page";
import {Icon} from "../../../lib/bootstrap-components";
import axios from "../../../lib/axios";
import {withAsyncErrorHandler, withErrorHandling} from "../../../lib/error-handling";
import moment from "moment";
import {getSignalTypes} from "./signal-types";

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class List extends Component {
    constructor(props) {
        super(props);

        this.state = {};

        this.signalTypes = getSignalTypes(props.t)
    }

    static propTypes = {
        signalSet: PropTypes.object
    }

    @withAsyncErrorHandler
    async fetchPermissions() {
        const request = {
            createSignal: {
                entityTypeId: 'namespace',
                requiredOperations: ['createSignal']
            }
        };

        const result = await axios.post('/rest/permissions-check', request);

        this.setState({
            createPermitted: result.data.createSignal && this.props.signalSet.permissions.includes('createSignal')
        });
    }

    componentDidMount() {
        this.fetchPermissions();
    }

    render() {
        const t = this.props.t;

        const columns = [
            { data: 1, title: t('Id') },
            { data: 2, title: t('Name') },
            { data: 3, title: t('Description') },
            { data: 4, title: t('Type'), render: data => this.signalTypes[data] },
            { data: 5, title: t('Created'), render: data => moment(data).fromNow() },
            { data: 6, title: t('Namespace') },
            {
                actions: data => {
                    const actions = [];
                    const perms = data[7];

                    if (perms.includes('edit')) {
                        actions.push({
                            label: <Icon icon="edit" title={t('Edit')}/>,
                            link: `/settings/signal-sets/${this.props.signalSet.id}/signals/${data[0]}/edit`
                        });
                    }

                    if (perms.includes('share')) {
                        actions.push({
                            label: <Icon icon="share" title={t('Share')}/>,
                            link: `/settings/signal-sets/${this.props.signalSet.id}/signals/${data[0]}/share`
                        });
                    }

                    return actions;
                }
            }
        ];


        return (
            <Panel title={t('Signals')}>
                {this.state.createPermitted &&
                    <Toolbar>
                        <NavButton linkTo={`/settings/signal-sets/${this.props.signalSet.id}/signals/create`} className="btn-primary" icon="plus" label={t('Create Signal')}/>
                    </Toolbar>
                }
                <Table withHeader dataUrl={`/rest/signals-table/${this.props.signalSet.id}`} columns={columns} />
            </Panel>
        );
    }
}