'use strict';

import React, {Component} from "react";
import {translate} from "react-i18next";
import {NavButton, requiresAuthenticatedUser, Toolbar, withPageHelpers} from "../../lib/page";
import {TreeTable} from "../../lib/tree";
import {withAsyncErrorHandler, withErrorHandling} from "../../lib/error-handling";
import axios from "../../lib/axios";
import {Icon} from "../../lib/bootstrap-components";
import {Panel} from "../../lib/panel";
import {getUrl} from "../../lib/urls";
import {checkPermissions} from "../../lib/permissions";

@translate()
@withErrorHandling
@withPageHelpers
@requiresAuthenticatedUser
export default class List extends Component {
    constructor(props) {
        super(props);

        this.state = {};
    }

    @withAsyncErrorHandler
    async fetchPermissions() {
        const result = await checkPermissions({
            createNamespace: {
                entityTypeId: 'namespace',
                requiredOperations: ['createNamespace']
            }
        });

        this.setState({
            createPermitted: result.data.createNamespace
        });
    }

    componentDidMount() {
        this.fetchPermissions();
    }

    render() {
        const t = this.props.t;

        const actions = node => {
            const actions = [];

            if (node.data.permissions.includes('edit')) {
                actions.push({
                    label: <Icon icon="edit" title={t('Edit')}/>,
                    link: `/settings/namespaces/${node.key}/edit`
                });
            }

            if (node.data.permissions.includes('share')) {
                actions.push({
                    label: <Icon icon="share-alt" title={t('Share')}/>,
                    link: `/settings/namespaces/${node.key}/share`
                });
            }

            return actions;
        };

        return (
            <Panel title={t('Namespaces')}>
                {this.state.createPermitted &&
                    <Toolbar>
                        <NavButton linkTo="/settings/namespaces/create" className="btn-primary" icon="plus" label={t('Create Namespace')}/>
                    </Toolbar>
                }

                <TreeTable withHeader withDescription dataUrl="rest/namespaces-tree" actions={actions} />
            </Panel>
        );
    }
}
