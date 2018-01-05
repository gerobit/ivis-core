'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {translate} from "react-i18next";
import {NavButton, requiresAuthenticatedUser, withPageHelpers} from "../../lib/page";
import {
    Button,
    ButtonRow,
    CheckBox,
    Dropdown,
    Form,
    FormSendMethod,
    InputField,
    TextArea,
    withForm
} from "../../lib/form";
import {withAsyncErrorHandler, withErrorHandling} from "../../lib/error-handling";
import {NamespaceSelect, validateNamespace} from "../../lib/namespace";
import {DeleteModalDialog} from "../../lib/modals";
import {Panel} from "../../lib/panel";
import ivisConfig from "ivisConfig";

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
                address: '',
                description: '',
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

        /*const cidServerValidation = state.getIn(['cid', 'serverValidation']);
        if (!state.getIn(['cid', 'value'])) {
            state.setIn(['cid', 'error'], t('Farm id must not be empty.'));
        } else if (!cidServerValidation) {
            state.setIn(['cid', 'error'], t('Validation is in progress...'));
        } else if (cidServerValidation.exists) {
            state.setIn(['cid', 'error'], t('Another Farm with the same id exists. Please choose another Farm id.'));
        } else {
            state.setIn(['cid', 'error'], null);
        }*/

        validateNamespace(t, state);
    }

    async submitHandler() {
        const t = this.props.t;

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `/rest/farms/${this.props.entity.id}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = '/rest/farms'
        }

        this.disableForm();
        this.setFormStatusMessage('info', t('Saving ...'));

        const submitSuccessful = await this.validateAndSendFormValuesToURL(sendMethod, url);

        if (submitSuccessful) {
            this.navigateToWithFlashMessage('/settings/farms', 'success', t('Farm saved'));
        } else {
            this.enableForm();
            this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
        }
    }

    render() { //                    <UserSelect/>
        
        const t = this.props.t;
        const isEdit = !!this.props.entity;
        const canDelete =  isEdit && this.props.entity.permissions.includes('delete');

        return (
            <Panel title={isEdit ? t('Edit Farm') : t('Create Farm')}>
                {canDelete &&
                <DeleteModalDialog
                    stateOwner={this}
                    visible={this.props.action === 'delete'}
                    deleteUrl={`/rest/farms/${this.props.entity.id}`}
                    cudUrl={`/settings/farms/${this.props.entity.id}/edit`}
                    listUrl="/settings/farms"
                    deletingMsg={t('Deleting Farm ...')}
                    deletedMsg={t('Farm deleted')}/>
                }

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="name" label={t('Name')}/>
                    <TextArea id="description" label={t('Description')} help={t('HTML is allowed')}/>
                    <TextArea id="address" label={t('Address')} help={t('HTML is allowed')}/>
                    <NamespaceSelect/>
                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="ok" label={t('Save')}/>
                        { canDelete && <NavButton className="btn-danger" icon="remove" label={t('Delete')} linkTo={`/settings/farms/${this.props.entity.id}/delete`}/>}
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}
