'use strict';

import React, {Component} from "react";
import PropTypes
    from "prop-types";
import {
    LinkButton,
    requiresAuthenticatedUser,
    withPageHelpers
} from "../../../lib/page";
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
import {
    withAsyncErrorHandler,
    withErrorHandling
} from "../../../lib/error-handling";
import {
    NamespaceSelect,
    validateNamespace
} from "../../../lib/namespace";
import {DeleteModalDialog} from "../../../lib/modals";
import {Panel} from "../../../lib/panel";
import ivisConfig
    from "ivisConfig";
import {getSignalTypes} from "./signal-types";
import {
    DerivedSignalTypes,
    SignalType
} from "../../../../../shared/signals"
import {withComponentMixins} from "../../../lib/decorator-helpers";
import {withTranslation} from "../../../lib/i18n";

@withComponentMixins([
    withTranslation,
    withForm,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
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

        this.signalTypes = getSignalTypes(props.t);

        this.typeOptions = [];
        for (const type in this.signalTypes) {
            if (!DerivedSignalTypes.has(type) || props.signalSet.permissions.includes('manageScripts')) {
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
                data.painlessScript = data.settings && data.settings.painlessScript;
                
                if (data.weight_list === null) {
                    data.shownInList = false;
                    data.weight_list = '0';
                } else {
                    data.shownInList = true;
                    data.weight_list = data.weight_list.toString();
                }
                
                if (data.weight_edit === null) {
                    data.shownInEdit = false;
                    data.weight_edit = '0';
                } else {
                    data.shownInEdit = true;
                    data.weight_edit = data.weight_edit.toString();
                }
            });

        } else {
            this.populateFormValues({
                cid: '',
                name: '',
                description: '',
                type: SignalType.DOUBLE,
                indexed: false,
                settings: {},
                shownInList: false,
                weight_list: '0',
                shownInEdit: false,
                weight_edit: '0',
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

        state.setIn(['weight_list', 'error'], null);
        if (state.getIn(['shownInList', 'value'])) {
            const listWeight = state.getIn(['weight_list', 'value']);
            if (isNaN(listWeight)) {
                state.setIn(['weight_list', 'error'], t('List weight must be empty or a number'));
            }
        }

        state.setIn(['weight_edit', 'error'], null);
        if (state.getIn(['shownInEdit', 'value'])) {
            const editWeight = state.getIn(['weight_edit', 'value']);
            if (isNaN(editWeight)) {
                state.setIn(['weight_edit', 'error'], t('Edit weight must be empty or a number'));
            }
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
            if (data.type === SignalType.PAINLESS) {
                data.settings = {painlessScript: data.painlessScript};
                data.weight_list = null;
                data.weight_edit = null;
                data.indexed = false;
            } else {
                data.settings = {};
                data.weight_list = data.shownInList ? Number.parseInt(data.weight_list || '0') : null;
                data.weight_edit = data.shownInEdit ? Number.parseInt(data.weight_edit || '0') : null;
            }
            delete data.shownInList;
            delete data.shownInEdit;
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


                    {this.getFormValue('type') === SignalType.PAINLESS &&
                        <TextArea id="painlessScript" label={t('Painless script')}/>
                    }

                    {this.getFormValue('type') !== SignalType.PAINLESS &&
                    <>
                        <CheckBox id="indexed" text={t('Indexed')}/>

                        <CheckBox id="shownInList" label={t('Records list')} text={t('Visible in record list')}/>
                        {this.getFormValue('shownInList') &&
                            <InputField id="weight_list" label={t('List weight')} help={t('This number determines if in which order the signal is listed when viewing records in the data set. Signals are ordered by weight in ascending order.')}/>
                        }

                        <CheckBox id="shownInEdit" label={t('Record edit')} text={t('Visible in record edit form')}/>
                        {this.getFormValue('shownInEdit') &&
                            <InputField id="weight_edit" label={t('Edit weight')} help={t('This number determines if in which order the signal is listed when editing records in the data set. Signals are ordered by weight in ascending order.')}/>
                        }
                    </>
                    }

                    <NamespaceSelect/>

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="check" label={t('Save')}/>
                        { canDelete && <LinkButton className="btn-danger" icon="remove" label={t('Delete')} to={`/settings/signal-sets/${this.props.signalSet.id}/signals/${this.props.entity.id}/delete`}/>}
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}
