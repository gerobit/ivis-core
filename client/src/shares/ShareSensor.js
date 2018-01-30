'use strict';

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { translate } from 'react-i18next';
import { requiresAuthenticatedUser, withPageHelpers } from '../lib/page';
import { withErrorHandling, withAsyncErrorHandler } from '../lib/error-handling';
import {
    withForm, Form, FormSendMethod, TableSelect, ButtonRow, Button
} from '../lib/form';
import { Table } from '../lib/table';
import axios from '../lib/axios';
import { Panel } from "../lib/panel";
import moment from "moment";
import {Icon} from "../lib/bootstrap-components";

@translate()
@withForm
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class ShareSensor extends Component {
    constructor(props) {
        super(props);

        this.initForm();
    }

    static propTypes = {
        title: PropTypes.string,
        entity: PropTypes.object,
    }

    @withAsyncErrorHandler
    async deleteShare(sensorId) {
        await axios.delete('/rest/farmsensor/' + this.props.entity.id + '/' + sensorId);
        this.sensorsTable.refresh();
        this.sigSetTableSelect.refresh();
    }

    clearShareFields() {
        this.populateFormValues({
            entityId: this.props.entity.id,
            sensorId: null,
        });
    }

    componentDidMount() {
        this.clearShareFields();
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        if (!state.getIn(['sensorId', 'value'])) {
            state.setIn(['sensorId', 'error'], t('Sensor must not be empty'));
        } else {
            state.setIn(['sensorId', 'error'], null);
        }
    }

    async submitHandler() {
        const t = this.props.t;

        this.disableForm();
        this.setFormStatusMessage('info', t('Saving ...'));

        const submitSuccessful = await this.validateAndSendFormValuesToURL(FormSendMethod.PUT, '/rest/farmsensor');

        if (submitSuccessful) {
            this.hideFormValidation();
            this.clearShareFields();
            this.enableForm();

            this.clearFormStatusMessage();
            this.sensorsTable.refresh();
            this.sigSetTableSelect.refresh();

        } else {
            this.enableForm();
            this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and try again.'));
        }
    }

    render() {
        const t = this.props.t;

        const sharesColumns = [
            { data: 0, title: t('Id') },
            { data: 1, title: t('Name') },
            { data: 2, title: t('Description') },
            { data: 3, title: t('Created'), render: data => moment(data).fromNow()},
            { data: 4, title: t('Namespace') },
            { data: 5, title: t('Cid') }
        ]

        sharesColumns.push({
            actions: data => {
                const actions = [];

                actions.push({
                    label: <Icon icon="remove" title={t('Remove')}/>,
                    action: () => this.deleteShare(data[0])
                });

                return actions;
            }
            ,
            title: t('Action')
        })

        let sigSetLabelIndex = 1;
        const sigSetColumns = [
            { data: 0, title: t('Id') },
            { data: 1, title: t('Name') },
            { data: 2, title: t('Description') },
            { data: 3, title: t('Created'), render: data => moment(data).fromNow() },
            { data: 4, title: t('Namespace') },
            { data: 5, title: t('Cid') }
        ]

        return (
            <Panel title={this.props.title}>
                <h3 className="legend">{t('Add Sensor')}</h3>
                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <TableSelect ref={node => this.sigSetTableSelect = node} id="sensorId" label={t('Sensors')} withHeader dropdown dataUrl={`/rest/farm-sensor-shares-unassigned-table/${this.props.entity.id}`} columns={sigSetColumns} selectionLabelIndex={sigSetLabelIndex} />

                <ButtonRow>
                    <Button type="submit" className="btn-primary" icon="ok" label={t('Add')} />
                </ButtonRow>
                </Form>

            <hr />
            <h3 className="legend">{t('Existing Sensors')}</h3>
            <Table ref={node => this.sensorsTable = node} withHeader dataUrl={`/rest/farmsensor-table/${this.props.entity.id}`} columns={sharesColumns} />
            </Panel >
        );
    }
}
