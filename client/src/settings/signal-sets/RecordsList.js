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
    withAsyncErrorHandler,
    withErrorHandling
} from "../../lib/error-handling";
import moment
    from "moment";
import {IndexingStatus} from "../../../../shared/signals";
import {checkPermissions} from "../../lib/permissions";
import ivisConfig
    from "ivisConfig";
import em
    from "../../lib/extension-manager";
import {
    tableAddDeleteButton,
    tableRestActionDialogInit,
    tableRestActionDialogRender,
} from "../../lib/modals";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";
import PropTypes from "prop-types";
import {SignalType} from "../../../../shared/signals";

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

        const t = props.t;
    }

    static propTypes = {
        signalSet: PropTypes.object,
        signalsVisibleForList: PropTypes.array
    }

    render() {
        const t = this.props.t;

        const sigSetId = signalSet.id;

        const createPermitted = this.props.entity.permissions.includes('insertRecord');
        const editPermitted = this.props.entity.permissions.includes('editRecord');
        const deletePermitted = this.props.entity.permissions.includes('deleteRecord');

        const columns = [];

        let dataIdx = 0;
        for (const signal of this.props.signalsVisibleForList) {
            columns.push({
                data: dataIdx,
                title: signal.name,
                render: data => {
                    if (signal.type === SignalType.DATE_TIME) {
                        return moment.utc(data).toISOString();
                    } else {
                        return data.toString();
                    }
                }
            });

            dataIdx += 1;
        }

        columns.push({
            actions: data => {
                const actions = [];
                const recordId = data[0];

                if (editPermitted) {
                    actions.push({
                        label: <Icon icon="edit" title={t('Edit')}/>,
                        link: `/settings/signal-sets/${sigSetId}/records/${recordId}/edit`
                    });
                }

                if (deletePermitted) {
                    tableAddDeleteButton(actions, this, null, `rest/signal-set-records/${sigSetId}/${recordId}`, recordId, t('Deleting record ...'), t('Record deleted'));
                }

                return actions;
            }
        });

        return (
            <Panel title={t('Records')}>
                {tableRestActionDialogRender(this)}
                {createPermitted &&
                    <Toolbar>
                        <LinkButton to={`/settings/signal-sets/${sigSetId}/records/insert`} className="btn-primary" icon="plus" label={labels['Insert Record']}/>
                    </Toolbar>
                }
                <Table ref={node => this.table = node} withHeader dataUrl={`rest/signal-set-records-table/${sigSetId}`} columns={columns} />
            </Panel>
        );
    }
}