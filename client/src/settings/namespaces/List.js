'use strict';

import React, {Component} from "react";
import {
    LinkButton,
    requiresAuthenticatedUser,
    Toolbar,
    withPageHelpers
} from "../../lib/page";
import {TreeTable} from "../../lib/tree";
import {
    withAsyncErrorHandler,
    withErrorHandling
} from "../../lib/error-handling";
import {Icon} from "../../lib/bootstrap-components";
import {Panel} from "../../lib/panel";
import {checkPermissions} from "../../lib/permissions";
import {getGlobalNamespaceId} from "../../../../shared/namespaces";
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
export default class List extends Component {
    constructor(props) {
        super(props);

        this.state = {};
        tableRestActionDialogInit(this);
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
        // noinspection JSIgnoredPromiseFromCall
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
                    label: <Icon icon="share" title={t('Share')}/>,
                    link: `/settings/namespaces/${node.key}/share`
                });
            }

            if (Number.parseInt(node.key) !== getGlobalNamespaceId()) {
                tableAddDeleteButton(actions, this, node.data.permissions, `rest/namespaces/${node.key}`, node.data.unsanitizedTitle, t('Deleting namespace ...'), t('Namespace deleted'));
            }

            return actions;
        };

        return (
            <Panel title={t('Namespaces')}>
                {tableRestActionDialogRender(this)}
                {this.state.createPermitted &&
                    <Toolbar>
                        <LinkButton to="/settings/namespaces/create" className="btn-primary" icon="plus" label={t('Create Namespace')}/>
                    </Toolbar>
                }

                <TreeTable ref={node => this.table = node} withHeader withDescription dataUrl="rest/namespaces-tree" actions={actions} />
            </Panel>
        );
    }
}
