'use strict';

import React, { Component } from "react";
import PropTypes from "prop-types";
import { translate } from "react-i18next";
import { NavButton, requiresAuthenticatedUser, withPageHelpers } from "../../lib/page";
import {
    Button,
    ButtonRow,
    CheckBox,
    Dropdown,
    Form,
    FormSendMethod,
    InputField,
    TextArea,
    withForm,
    DatePicker,
    TableSelect
} from "../../lib/form";
import { withAsyncErrorHandler, withErrorHandling } from "../../lib/error-handling";
import { NamespaceSelect, validateNamespace } from "../../lib/namespace";
import { DeleteModalDialog } from "../../lib/modals";
import { Panel } from "../../lib/panel";
import ivisConfig from "ivisConfig";
import * as dateMath from "../../lib/datemath";
import moment from "moment";
import styles from "../../ivis-ws/TimeRangeSelector.scss";

@translate()
@withForm
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class CUD extends Component {
    constructor(props) {
        super(props);

        this.state = {};

        this.initForm();
    }

    static propTypes = {
        action: PropTypes.string.isRequired,
        entity: PropTypes.object
    }

    componentDidMount() {
        if (this.props.entity) {
            this.getFormValuesFromEntity(this.props.entity);

        } else {
            this.populateFormValues({
                farmer: ivisConfig.user.id,
                farm: '',
                type: '',
                description: 'Default description',
                happened: '',
                cost: 0,
                quantity: 0,
                namespace: ivisConfig.user.namespace
            });
        }
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        if (!state.getIn(['farmer', 'value'])) {
            state.setIn(['farmer', 'error'], t('Farmer must not be empty'));
        } else {
            state.setIn(['farmer', 'error'], null);
        }

        if (!state.getIn(['farm', 'value'])) {
            state.setIn(['farm', 'error'], t('Farm must not be empty'));
        } else {
            state.setIn(['farm', 'error'], null);
        }

        if (!state.getIn(['type', 'value'])) {
            state.setIn(['type', 'error'], t('Type must not be empty'));
        } else {
            state.setIn(['type', 'error'], null);
        }

        if (!state.getIn(['happened', 'value'])) {
            state.setIn(['happened', 'error'], t('Happened must not be empty'));
        } else {
            state.setIn(['happened', 'error'], null);
        }
        
        //FIXME validateNamespace(t, state);

        //['events.id', 'users.name', 'farms.name', 'event_types.name', 'events.description', 
        //'events.happened', 'events.quantity', 'events.cost']

        /*const cidServerValidation = state.getIn(['cid', 'serverValidation']);
        if (!state.getIn(['cid', 'value'])) {
            state.setIn(['cid', 'error'], t('crop id must not be empty.'));
        } else if (!cidServerValidation) {
            state.setIn(['cid', 'error'], t('Validation is in progress...'));
        } else if (cidServerValidation.exists) {
            state.setIn(['cid', 'error'], t('Another crop with the same id exists. Please choose another crop id.'));
        } else {
            state.setIn(['cid', 'error'], null);
        }*/

    }

    async submitHandler() {
        const t = this.props.t;

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `/rest/events/${this.props.entity.id}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = '/rest/events'
        }

        this.disableForm();
        this.setFormStatusMessage('info', t('Saving ...'));

        const submitSuccessful = await this.validateAndSendFormValuesToURL(sendMethod, url);
        if (submitSuccessful) {
            this.navigateToWithFlashMessage('/settings/events', 'success', t('event saved'));
        } else {
            this.enableForm();
            this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
        }
    }

    render() {
        const t = this.props.t;
        const isEdit = !!this.props.entity;
        const canDelete = isEdit //&& this.props.entity.permissions.includes('manageFarms');

        const farmsColumns = [
            { data: 0, title: t('#') },
            { data: 1, title: t('Name') },
            { data: 2, title: t('Description') },
            { data: 3, title: t('Address') },
            { data: 4, title: t('Created'), render: data => moment(data).fromNow() },
            { data: 5, title: t('Namespace') }

        ];
        let farmsLabelIndex = 1;

        const eventTypesColumns = [
            { data: 0, title: t('#') },
            { data: 1, title: t('Name') },
            { data: 2, title: t('Description') },
            { data: 3, title: t('Unit') },
            { data: 4, title: t('Namespace') }
        ];
        let eventTypesLabelIndex = 1;

        const parseDate = (str, end) => {
            const date = dateMath.parse(str, end);
            if (date && date.isValid()) {
                return date.toDate();
            } else {
                return null;
            }
        };

        return (
            <Panel title={isEdit ? t('Edit Event') : t('Create Event')}>
                {canDelete &&
                    <DeleteModalDialog
                        stateOwner={this}
                        visible={this.props.action === 'delete'}
                        deleteUrl={`/rest/events/${this.props.entity.id}`}
                        cudUrl={`/settings/events/${this.props.entity.id}/edit`}
                        listUrl="/settings/events"
                        deletingMsg={t('Deleting Event ...')}
                        deletedMsg={t('Event deleted')} />
                }
                    <Form stateOwner={this} onSubmitAsync={::this.submitHandler} >
                        <TableSelect ref={node => this.farmsTableSelect = node} id="farm" label={t('Farm')} withHeader dropdown dataUrl={`/rest/farms-table/`} columns={farmsColumns} selectionLabelIndex={farmsLabelIndex} />
                        <TableSelect ref={node => this.eventTypesTableSelect = node} id="type" label={t('Event Type')} withHeader dropdown dataUrl={`/rest/event-types-table/`} columns={eventTypesColumns} selectionLabelIndex={eventTypesLabelIndex} />
                        <TextArea id="description" label={t('Description')} help={t('HTML is allowed')} />
                        <DatePicker
                            id="happened"
                            label={t('Happened:')}
                            formatDate={date => moment.utc(date).format('YYYY-MM-DD') + ' 00:00:00'}
                            parseDate={str => parseDate(str, false)}
                        />
                        <InputField id="quantity" label={t('Quantity')} />
                        <InputField id="cost" label={t('Cost')} />
                        <ButtonRow>
                            <Button type="submit" className="btn-primary" icon="ok" label={t('Save')} />
                            {canDelete && <NavButton className="btn-danger" icon="remove" label={t('Delete')} linkTo={`/settings/events/${this.props.entity.id}/delete`} />}
                        </ButtonRow>
                    </Form>
            </Panel >
        );
    }
}
