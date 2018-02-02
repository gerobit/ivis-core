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
                name: '',
                description: '',
                farm: '',
                crop: '',
                start: '',
                end: '',
                namespace: ivisConfig.user.namespace
            });
        }
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        if (!state.getIn(['name', 'value'])) {
            state.setIn(['name', 'error'], t('Name must not be empty'));
        } else {
            state.setIn(['name', 'error'], null);
        }

        if (!state.getIn(['farm', 'value'])) {
            state.setIn(['farm', 'error'], t('Farm must not be empty'));
        } else {
            state.setIn(['farm', 'error'], null);
        }

        if (!state.getIn(['crop', 'value'])) {
            state.setIn(['crop', 'error'], t('Crop must not be empty'));
        } else {
            state.setIn(['crop', 'error'], null);
        }

        if (!state.getIn(['start', 'value'])) {
            state.setIn(['start', 'error'], t('Start must not be empty'));
        } else {
            state.setIn(['start', 'error'], null);
        }

        //validateNamespace(t, state);
    }

    async submitHandler() {
        const t = this.props.t;

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `/rest/crop-seasons/${this.props.entity.id}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = '/rest/crop-seasons'
        }

        this.disableForm();
        this.setFormStatusMessage('info', t('Saving ...'));

        const submitSuccessful = await this.validateAndSendFormValuesToURL(sendMethod, url);

        if (submitSuccessful) {
            this.navigateToWithFlashMessage('/settings/crop-seasons', 'success', t('crop season saved'));
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

        const cropsColumns = [
            { data: 0, title: t('#') },
            { data: 1, title: t('Name') },
            { data: 2, title: t('Description') },
            { data: 3, title: t('Root') },
            { data: 4, title: t('Max Height') },
            { data: 5, title: t('Namespace') },
        ];
        let cropsLabelIndex = 1;

        const parseDate = (str, end) => {
            const date = dateMath.parse(str, end);
            if (date && date.isValid()) {
                return date.toDate();
            } else {
                return null;
            }
        };
        return (
            <Panel title={isEdit ? t('Edit Crop Season') : t('Create Crop Season')}>
                {canDelete &&
                    <DeleteModalDialog
                        stateOwner={this}
                        visible={this.props.action === 'delete'}
                        deleteUrl={`/rest/crop-seasons/${this.props.entity.id}`}
                        cudUrl={`/settings/crop-seasons/${this.props.entity.id}/edit`}
                        listUrl="/settings/crop-seasons"
                        deletingMsg={t('Deleting Crop Season ...')}
                        deletedMsg={t('Crop Season deleted')} />
                }

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="name" label={t('Name')} />
                    <TextArea id="description" label={t('Description')} help={t('HTML is allowed')} />
                    <TableSelect ref={node => this.farmsTableSelect = node} id="farm" label={t('Farm')} withHeader dropdown dataUrl={`/rest/farms-table/`} columns={farmsColumns} selectionLabelIndex={farmsLabelIndex} />
                    <TableSelect ref={node => this.cropsTableSelect = node} id="crop" label={t('Crop')} withHeader dropdown dataUrl={`/rest/crops-table/`} columns={cropsColumns} selectionLabelIndex={cropsLabelIndex} />
                    <DatePicker
                        id="start"
                        label={t('Start:')}
                        formatDate={date => moment.utc(date).format('YYYY-MM-DD') + ' 00:00:00'}
                        parseDate={str => parseDate(str, false)}
                    />
                    <DatePicker
                        id="end"
                        label={t('End:')}
                        formatDate={date => moment.utc(date).format('YYYY-MM-DD') + ' 00:00:00'}
                        parseDate={str => parseDate(str, false)}
                    />
                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="ok" label={t('Save')} />
                        {canDelete && <NavButton className="btn-danger" icon="remove" label={t('Delete')} linkTo={`/settings/crop-seasons/${this.props.entity.id}/delete`} />}
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}
