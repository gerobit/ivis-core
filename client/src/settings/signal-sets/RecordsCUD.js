'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {LinkButton, requiresAuthenticatedUser, withPageHelpers} from "../../lib/page";
import {AlignedRow, Button, ButtonRow, Form, FormSendMethod, InputField, StaticField, withForm} from "../../lib/form";
import {withErrorHandling} from "../../lib/error-handling";
import {DeleteModalDialog} from "../../lib/modals";
import {Panel} from "../../lib/panel";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";
import base64url from 'base64-url';
import FieldTypes from "./FieldTypes";
import styles from "../../lib/styles.scss";

@withComponentMixins([
    withTranslation,
    withForm,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class RecordsCUD extends Component {
    constructor(props) {
        super(props);
        const t = props.t;

        this.state = {
            autoId: !!props.signalSet.record_id_template
        };

        if (this.state.autoId) {
            this.initForm();
        } else {
            this.initForm({
                serverValidation: {
                    url: `rest/signal-set-records-validate/${encodeURIComponent(props.signalSet.id)}`,
                    changed: ['id']
                }
            });
        }

        this.fieldTypes = new FieldTypes(props.t, props.signalsVisibleForEdit);
    }

    static propTypes = {
        action: PropTypes.string.isRequired,
        signalSet: PropTypes.object,
        signalsVisibleForEdit: PropTypes.array,
        record: PropTypes.object
    }

    componentDidMount() {
        if (this.props.record) {
            this.getFormValuesFromEntity(this.props.record, data => {
                this.fieldTypes.populateFields(data, data.signals);
            });

        } else {
            const data = {
                id: ''
            };

            this.fieldTypes.populateFields(data);

            this.populateFormValues(data);
        }
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        if (!this.state.autoId) {
            const existingId = this.props.record && this.props.record.id;
            const idValue = state.getIn(['id', 'value']);

            const idServerValidation = state.getIn(['id', 'serverValidation']);
            if (!idValue) {
                state.setIn(['id', 'error'], t('The ID must not be empty.'));
            } else if (!idServerValidation) {
                state.setIn(['id', 'error'], t('Validation is in progress...'));
            } else if (idServerValidation.exists && idValue !== existingId) {
                state.setIn(['id', 'error'], t('Another record with the same ID exists. Please choose another ID.'));
            } else {
                state.setIn(['id', 'error'], null);
            }
        }

        const fieldPrefix = this.fieldTypes.getPrefix();
        for (const fieldId of state.keys()) {
            if (fieldId.startsWith(fieldPrefix)) {
                state.deleteIn([fieldId, 'error']);
            }
        }

        this.fieldTypes.localValidate(state);
    }

    async submitHandler() {
        const t = this.props.t;
        const sigSetId = this.props.signalSet.id;

        let sendMethod, url;
        if (this.props.record) {
            const recordIdBase64 = base64url.encode(this.props.record.id);

            sendMethod = FormSendMethod.PUT;
            url = `rest/signal-set-records/${sigSetId}/${recordIdBase64}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = `rest/signal-set-records/${sigSetId}`
        }

        this.disableForm();
        this.setFormStatusMessage('info', t('Saving ...'));

        const submitSuccessful = await this.validateAndSendFormValuesToURL(sendMethod, url, data => {
            if (this.state.autoId) {
                delete data.id;
            }

            const signals = this.fieldTypes.getSignals(data);

            const fieldPrefix = this.fieldTypes.getPrefix();
            for (const fieldId in data) {
                if (fieldId.startsWith(fieldPrefix)) {
                    delete data[fieldId];
                }
            }

            data.signals = signals;
        });

        if (submitSuccessful) {
            this.navigateToWithFlashMessage(`/settings/signal-sets/${sigSetId}/records`, 'success', t('Record saved'));
        } else {
            this.enableForm();
            this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
        }
    }

    render() {
        const t = this.props.t;
        const signalSet = this.props.signalSet;
        const isEdit = !!this.props.record;
        const canDelete =  isEdit && signalSet.permissions.includes('deleteRecord');
        const sigSetId = signalSet.id;
        const recordIdBase64 = this.props.record && base64url.encode(this.props.record.id);

        let idField;
        if (isEdit) {
            if (this.state.autoId) {
                idField =
                    <StaticField id="id" className={styles.formDisabled} label={t('ID')} help={t('The ID will be automatically updated on save.')}>
                        {this.getFormValue('id')}
                    </StaticField>;
            } else {
                idField = <InputField id="id" label={t('ID')}/>;
            }
        } else {
            if (this.state.autoId) {
                idField =
                    <StaticField id="id" className={styles.formDisabled} label={t('ID')}>
                        {t('The ID will be automatically updated on save.')}
                    </StaticField>;
            } else {
                idField = <InputField id="id" label={t('ID')}/>;
            }
        }


        return (
            <Panel title={isEdit ? t('Edit Record') : t('Create Record')}>
                {canDelete &&
                <DeleteModalDialog
                    stateOwner={this}
                    visible={this.props.action === 'delete'}
                    deleteUrl={`rest/signal-set-records/${sigSetId}/${recordIdBase64}`}
                    backUrl={`/settings/signal-sets/${sigSetId}/records/${recordIdBase64}/edit`}
                    successUrl={`/settings/signal-sets/${sigSetId}/records`}
                    deletingMsg={t('Deleting record ...')}
                    deletedMsg={t('Record deleted')}
                    name={isEdit && this.props.record.id} />
                }

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    {idField}

                    {this.fieldTypes.render(this)}

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="check" label={t('Save')}/>
                        { canDelete && <LinkButton className="btn-danger" icon="remove" label={t('Delete')} to={`/settings/signal-sets/${sigSetId}/records/${recordIdBase64}/delete`}/>}
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}
