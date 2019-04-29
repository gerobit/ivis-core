'use strict';

import React, {Component} from "react";
import {Table} from "../../lib/table";
import {Panel} from "../../lib/panel";
import {LinkButton, requiresAuthenticatedUser, Toolbar, withPageHelpers} from "../../lib/page";
import {Icon} from "../../lib/bootstrap-components";
import {withErrorHandling} from "../../lib/error-handling";
import moment from "moment";
import {SignalType} from "../../../../shared/signals";
import {SignalSetType} from "../../../../shared/signal-sets";
import {tableAddDeleteButton, tableRestActionDialogInit, tableRestActionDialogRender,} from "../../lib/modals";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";
import PropTypes from "prop-types";
import base64url from 'base64-url';


@withComponentMixins([
    withTranslation,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class RecordsList extends Component {
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
        const signalSet = this.props.signalSet;
        const sigSetId = signalSet.id;

        const isComputed = signalSet.type === SignalSetType.COMPUTED;
        const createPermitted = !isComputed && signalSet.permissions.includes('insertRecord');
        const editPermitted = !isComputed && signalSet.permissions.includes('editRecord');
        const deletePermitted = !isComputed && signalSet.permissions.includes('deleteRecord');

        const columns = [];
        columns.push(
            {
                data: 0,
                title: t('ID'),
                render: data => <code>{data}</code>
            }
        );

        let dataIdx = 1;
        for (const signal of this.props.signalsVisibleForList) {
            columns.push({
                data: dataIdx,
                title: signal.name,
                render: data => {
                    if (data !== null) {
                        if (signal.type === SignalType.DATE_TIME) {
                            return moment(data).toLocaleString();
                        } else {
                            return data.toString();
                        }
                    } else {
                        return <code>{t('N/A')}</code>;
                    }
                }
            });

            dataIdx += 1;
        }

        if (!isComputed) {
            columns.push({
                actions: data => {
                    const actions = [];
                    const recordId = data[0];
                    const recordIdBase64 = base64url.encode(recordId);

                    if (editPermitted) {
                        actions.push({
                            label: <Icon icon="edit" title={t('Edit')}/>,
                            link: `/settings/signal-sets/${sigSetId}/records/${recordIdBase64}/edit`
                        });
                    }

                    if (deletePermitted) {
                        tableAddDeleteButton(actions, this, null, `rest/signal-set-records/${sigSetId}/${recordIdBase64}}`, recordId, t('Deleting record ...'), t('Record deleted'));
                    }

                    return actions;
                }
            });
        }

        let content;
        if (isComputed) {
            content = t('Not implemented yet for computed sets');
        } else {
            content = <>{tableRestActionDialogRender(this)}
                {createPermitted &&
                <Toolbar>
                    <LinkButton to={`/settings/signal-sets/${sigSetId}/records/create`} className="btn-primary"
                                icon="plus" label={t('Insert Record')}/>
                </Toolbar>
                }
                <Table ref={node => this.table = node} withHeader dataUrl={`rest/signal-set-records-table/${sigSetId}`}
                       columns={columns}/>
            </>
        }

        return (
            <Panel title={t('Records')}>
                {content}
            </Panel>
        );
    }
}