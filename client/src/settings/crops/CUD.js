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
                description: '',
                root: '',
                max_height: '',
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

        if (!state.getIn(['root', 'value'])) {
            state.setIn(['root', 'error'], t('Root must not be empty'));
        } else {
            state.setIn(['root', 'error'], null);
        }

        if (!state.getIn(['max_height', 'value'])) {
            state.setIn(['max_height', 'error'], t('Max height must not be empty'));
        } else {
            state.setIn(['max_height', 'error'], null);
        }

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

        validateNamespace(t, state);
    }

    async submitHandler() {
        const t = this.props.t;

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `/rest/crops/${this.props.entity.id}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = '/rest/crops'
        }

        this.disableForm();
        this.setFormStatusMessage('info', t('Saving ...'));

        const submitSuccessful = await this.validateAndSendFormValuesToURL(sendMethod, url);

        if (submitSuccessful) {
            this.navigateToWithFlashMessage('/settings/crops', 'success', t('crop saved'));
        } else {
            this.enableForm();
            this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
        }
    }

    render() {
        const t = this.props.t;
        const isEdit = !!this.props.entity;
        const canDelete =  isEdit //&& this.props.entity.permissions.includes('manageFarms');

        return (
            <Panel title={isEdit ? t('Edit Crop') : t('Create Crop')}>
                {canDelete &&
                <DeleteModalDialog
                    stateOwner={this}
                    visible={this.props.action === 'delete'}
                    deleteUrl={`/rest/crops/${this.props.entity.id}`}
                    cudUrl={`/settings/crops/${this.props.entity.id}/edit`}
                    listUrl="/settings/crops"
                    deletingMsg={t('Deleting Crop ...')}
                    deletedMsg={t('Crop deleted')}/>
                }

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="name" label={t('Name')}/>
                    <TextArea id="description" label={t('Description')} help={t('HTML is allowed')}/>
                    <InputField id="root" label={t('Root')}/>
                    <InputField id="max_height" label={t('Max Height')}/>
                    <NamespaceSelect/>
                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="ok" label={t('Save')}/>
                        { canDelete && <NavButton className="btn-danger" icon="remove" label={t('Delete')} linkTo={`/settings/crops/${this.props.entity.id}/delete`}/>}
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}
