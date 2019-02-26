'use strict';

import React, {Component} from "react";
import {Table} from "../../lib/table";
import {Panel} from "../../lib/panel";
import {
    LinkButton,
    requiresAuthenticatedUser,
    Toolbar,
    withPageHelpers
} from "../../lib/page";
import {Icon} from "../../lib/bootstrap-components";
import {
    tableAddDeleteButton,
    tableRestActionDialogInit,
    tableRestActionDialogRender
} from "../../lib/modals";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";
import {withErrorHandling} from "../../lib/error-handling";

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

    render() {
        // There are no permissions checks here because this page makes no sense for anyone who does not have manageUsers permission
        // Once someone has this permission, then all on this page can be used.

        const t = this.props.t;

        const columns = [
            { data: 1, title: t('Username') },
            { data: 2, title: t('Full Name') },
            { data: 3, title: t('Email') },
            { data: 4, title: t('Namespace') },
            { data: 5, title: t('Role') }
        ];

        columns.push({
            actions: data => {
                const actions = [];

                actions.push({
                    label: <Icon icon="edit" title={t('Edit')}/>,
                    link: `/settings/users/${data[0]}/edit`
                });

                actions.push({
                    label: <Icon icon="share" title={t('Share')}/>,
                    link: `/settings/users/${data[0]}/shares`
                });

                tableAddDeleteButton(actions, this, null, `rest/users/${data[0]}`, data[1], t('Deleting user ...'), t('User deleted'));

                return actions;
            }
        });

        return (
            <Panel title={t('Users')}>
                {tableRestActionDialogRender(this)}
                <Toolbar>
                    <LinkButton to="/settings/users/create" className="btn-primary" icon="plus" label={t('Create User')}/>
                </Toolbar>

                <Table ref={node => this.table = node} withHeader dataUrl="rest/users-table" columns={columns} />
            </Panel>
        );
    }
}