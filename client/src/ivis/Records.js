'use strict';

import React, {Component} from "react";
import {Table} from "../lib/table";
import {Toolbar} from "../lib/page";
import {Button, Icon} from "../lib/bootstrap-components";
import {withAsyncErrorHandler, withErrorHandling} from "../lib/error-handling";
import moment from "moment";
import {SignalType} from "../../../shared/signals";
import {tableAddDeleteButton, tableRestActionDialogInit, tableRestActionDialogRender,} from "../lib/modals";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";
import PropTypes from "prop-types";
import base64url from 'base64-url';
import axios from "../lib/axios";
import {getUrl} from "../lib/urls";


@withComponentMixins([
    withTranslation,
    withErrorHandling
])
class RecordsList extends Component {
    constructor(props) {
        super(props);

        this.state = {};
    }

    static propTypes = {
        signalSet: PropTypes.object,
        signalsVisibleForList: PropTypes.array
    }

    render() {
        const t = this.props.t;
        const signalSet = this.props.signalSet;
        const sigSetId = signalSet.id;

        const columns = [
            {
                data: 0,
                title: t('ID'),
                render: data => <code>{data}</code>
            }
        ];

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

        return (
            <div>
                <Table ref={node => this.table = node} withHeader dataUrl={`rest/signal-set-records-table/${sigSetId}`} columns={columns} />
            </div>
        );
    }
}


@withComponentMixins([
    withTranslation,
    withErrorHandling,
])
export class Records extends Component {
    constructor(props) {
        super(props);

        this.state = {
            signalSet: null,
            signalsVisibleForList: null
        };
    }

    static propTypes = {
        signalSetCid: PropTypes.string,
        signalsVisibleForList: PropTypes.array
    }

    @withAsyncErrorHandler
    async fetchSignalSet() {
        const signalSetResult = await axios.get(getUrl(`rest/signal-sets-by-cid/${this.props.signalSetCid}`));

        const signalSet = signalSetResult.data;

        let signalsVisibleForList;
        if (!this.props.signalsVisibleForList) {
            const signalsVisibleForListResult = await axios.get(getUrl(`rest/signals-visible-list/${signalSet.id}`));
            signalsVisibleForList = signalsVisibleForListResult.data;
        } else {
            signalsVisibleForList = this.props.signalsVisibleForList;
        }

        this.setState({
            signalSet,
            signalsVisibleForList
        });
    }

    componentDidMount() {
        // noinspection JSIgnoredPromiseFromCall
        this.fetchSignalSet();
    }

    render() {
        const t = this.props.t;

        if (this.state.signalSet) {
            return (
                <div>
                    <RecordsList signalSet={this.state.signalSet} signalsVisibleForList={this.state.signalsVisibleForList}/>
                </div>
            );
        } else {
            return (
                <div>
                    {t('Loading ...')}
                </div>
            )
        }
    }
}