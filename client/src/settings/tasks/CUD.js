'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {translate} from "react-i18next";
import {LinkButton, requiresAuthenticatedUser, withPageHelpers} from "../../lib/page";
import {
    Button,
    ButtonRow,
    Dropdown,
    Form,
    FormSendMethod,
    InputField,
    TextArea,
    withForm
} from "../../lib/form";
import "brace/mode/json";
import "brace/mode/jsx";
import "brace/mode/scss";
import {withAsyncErrorHandler, withErrorHandling} from "../../lib/error-handling";
import {NamespaceSelect, validateNamespace} from "../../lib/namespace";
import {DeleteModalDialog} from "../../lib/modals";
import {Panel} from "../../lib/panel";
import ivisConfig from "ivisConfig";
import {WizardType, wizards} from "./wizards";
import {TaskType} from "../../../../shared/tasks";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    withForm,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class CUD extends Component {
    constructor(props) {
        super(props);

        this.state = {};

        this.initForm();
    }

    static propTypes = {
        action: PropTypes.string.isRequired,
        entity: PropTypes.object
    };

    componentDidMount() {
        if (this.props.entity) {
            this.getFormValuesFromEntity(this.props.entity, null);
        } else {
            this.populateFormValues({
                name: '',
                description: '',
                namespace: ivisConfig.user.namespace,
                type: TaskType.PYTHON,
                wizard: WizardType.BLANK
            });
        }
    }

    @withAsyncErrorHandler
    async loadFormValues() {
        await this.getFormValuesFromURL(`rest/tasks/${this.props.entity.id}`);
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        if (!state.getIn(['name', 'value'])) {
            state.setIn(['name', 'error'], t('Name must not be empty'));
        } else {
            state.setIn(['name', 'error'], null);
        }

        if (!state.getIn(['type', 'value'])) {
            state.setIn(['type', 'error'], t('Type must be selected'));
        } else {
            state.setIn(['type', 'error'], null);
        }


        validateNamespace(t, state);
    }

    static getWizard(wizardType) {
        return wizards.get(wizardType);
    }

    async submitHandler() {
        const t = this.props.t;

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/tasks/${this.props.entity.id}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = 'rest/tasks'
        }

        this.disableForm();
        this.setFormStatusMessage('info', t('Saving ...'));

        const submitSuccessful = await this.validateAndSendFormValuesToURL(sendMethod, url, data => {
            if (!this.props.entity) {
                const wizard = CUD.getWizard(data.wizard);
                if (wizard) {
                    wizard(data);
                } else {
                    data.settings = {
                        params: [],
                        code: ''
                    };
                }

                delete data.wizard;
            } else {
                data.settings = this.props.entity.settings;
            }
        });


        if (submitSuccessful) {
            if (this.props.entity) {
                await this.loadFormValues();
                this.enableForm();
                this.clearFormStatusMessage();
                this.hideFormValidation();
                this.setFlashMessage('success', t('Task saved'));
            } else {
                this.navigateToWithFlashMessage('/settings/tasks', 'success', t('Task saved'));
            }
        } else {
            this.enableForm();
            this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
        }
    }

    render() {
        const t = this.props.t;
        const isEdit = !!this.props.entity;
        const canDelete = isEdit && this.props.entity.permissions.includes('delete');

        const typeOptions = [
            {key: TaskType.NUMPY, label: t('Numpy task')},
            {key: TaskType.PYTHON, label: t('Python task')}
        ];

        const wizardOptions = [
            {key: WizardType.BLANK, label: t('Blank')},
            {key: WizardType.BASIC, label: t('Basic functionality')}
        ];

        return (
            <Panel title={isEdit ? t('Task Settings') : t('Create Task')}>
                {canDelete &&
                <DeleteModalDialog
                    stateOwner={this}
                    visible={this.props.action === 'delete'}
                    deleteUrl={`rest/tasks/${this.props.entity.id}`}
                    backUrl={`/settings/tasks/${this.props.entity.id}/edit`}
                    successUrl="/settings/tasks"
                    deletingMsg={t('Deleting task ...')}
                    deletedMsg={t('Task deleted')}/>
                }

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="name" label={t('Name')}/>
                    <TextArea id="description" label={t('Description')} help={t('HTML is allowed')}/>
                    <Dropdown id="type" label={t('Type')} options={typeOptions} disabled={isEdit}/>

                    {!isEdit && <Dropdown id="wizard" label={t('Wizard')} options={wizardOptions}/>}
                    <NamespaceSelect/>

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="ok" label={t('Save')}/>
                        {canDelete && <LinkButton className="btn-danger" icon="remove" label={t('Delete')}
                                                  to={`/settings/tasks/${this.props.entity.id}/delete`}/>}
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}
