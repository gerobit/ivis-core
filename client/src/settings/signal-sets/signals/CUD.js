'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {translate} from "react-i18next";
import {NavButton, requiresAuthenticatedUser, withPageHelpers} from "../../../lib/page";
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
} from "../../../lib/form";
import {withAsyncErrorHandler, withErrorHandling} from "../../../lib/error-handling";
import {NamespaceSelect, validateNamespace} from "../../../lib/namespace";
import {DeleteModalDialog} from "../../../lib/modals";
import {Panel} from "../../../lib/panel";
import ivisConfig from "ivisConfig";
import {getSignalTypes} from "./signal-types";
import {SignalType, DerivedSignalTypes} from "../../../../../shared/signals"

@translate()
@withForm
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class CUD extends Component {
    constructor(props) {
        super(props);

        this.state = {};

        this.initForm({
            serverValidation: {
                url: `rest/signals-validate/${props.signalSet.id}`,
                changed: ['cid'],
                extra: ['id']
            }
        });

        this.signalTypes = getSignalTypes(props.t)

        this.typeOptions = [];
        for (const type in this.signalTypes) {
            if(!props.entity || DerivedSignalTypes.has(props.entity.type) == DerivedSignalTypes.has(type)){
                this.typeOptions.push({key: type, label: this.signalTypes[type]});
            }
        }
    }

    static propTypes = {
        action: PropTypes.string.isRequired,
        signalSet: PropTypes.object,
        entity: PropTypes.object
    }

    @withAsyncErrorHandler
    async loadFormValues() {
        await this.getFormValuesFromURL(`rest/signals/${this.props.entity.id}`);
    }

    componentDidMount() {
        if (this.props.entity) {
            this.getFormValuesFromEntity(this.props.entity, data => {
                data.painlessScript = data.settings.painlessScript
            });

        } else {
            this.populateFormValues({
                cid: '',
                name: '',
                description: '',
                type: SignalType.DOUBLE,
                indexed: false,
                settings: {},
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

        const cidServerValidation = state.getIn(['cid', 'serverValidation']);
        if (!state.getIn(['cid', 'value'])) {
            state.setIn(['cid', 'error'], t('Signal id must not be empty.'));
        } else if (!cidServerValidation) {
            state.setIn(['cid', 'error'], t('Validation is in progress...'));
        } else if (cidServerValidation.exists) {
            state.setIn(['cid', 'error'], t('Another signal with the same id exists. Please choose another signal id.'));
        } else {
            state.setIn(['cid', 'error'], null);
        }

        validateNamespace(t, state);
    }

    async submitHandler() {
        const t = this.props.t;

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/signals/${this.props.entity.id}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = `rest/signals/${this.props.signalSet.id}`
        }

        this.disableForm();
        this.setFormStatusMessage('info', t('Saving ...'));

        const submitSuccessful = await this.validateAndSendFormValuesToURL(sendMethod, url, data => {
            data.settings = {painlessScript: data.painlessScript};
        });

        if (submitSuccessful) {
            this.navigateToWithFlashMessage(`/settings/signal-sets/${this.props.signalSet.id}/signals`, 'success', t('Signal saved'));
        } else {
            this.enableForm();
            this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
        }
    }

    render() {
        const t = this.props.t;
        const isEdit = !!this.props.entity;
        const canDelete =  isEdit && this.props.entity.permissions.includes('delete');

        return (
            <Panel title={isEdit ? t('Edit Signal') : t('Create Signal')}>
                {canDelete &&
                <DeleteModalDialog
                    stateOwner={this}
                    visible={this.props.action === 'delete'}
                    deleteUrl={`rest/signals/${this.props.entity.id}`}
                    backUrl={`/settings/signal-sets/${this.props.signalSet.id}/signals/${this.props.entity.id}/edit`}
                    successUrl={`/settings/signal-sets/${this.props.signalSet.id}/signals`}
                    deletingMsg={t('Deleting signal ...')}
                    deletedMsg={t('Signal deleted')}/>
                }

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="cid" label={t('Id')}/>
                    <InputField id="name" label={t('Name')}/>
                    <TextArea id="description" label={t('Description')} help={t('HTML is allowed')}/>
                    <Dropdown id="type" label={t('Type')} options={this.typeOptions}/>


                    {this.getFormValue('type') == SignalType.PAINLESS &&
                        <TextArea id="painlessScript" label={t('Painless script')}/>
                    }

                    <CheckBox id="indexed" text={t('Indexed')}/>

                    <NamespaceSelect/>

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="ok" label={t('Save')}/>
                        { canDelete && <NavButton className="btn-danger" icon="remove" label={t('Delete')} linkTo={`/settings/signal-sets/${this.props.signalSet.id}/signals/${this.props.entity.id}/delete`}/>}
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}
