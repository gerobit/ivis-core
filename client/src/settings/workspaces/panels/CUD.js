'use strict';

import React, {Component} from "react";
import PropTypes
    from "prop-types";
import {
    LinkButton,
    requiresAuthenticatedUser, Toolbar,
    withPageHelpers
} from "../../../lib/page";
import {
    ACEEditor,
    Button,
    ButtonRow,
    Dropdown,
    Fieldset,
    Form,
    FormSendMethod,
    InputField,
    TableSelect,
    TextArea,
    withForm
} from "../../../lib/form";
import "brace/mode/html";
import "brace/mode/json";
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
import axios
    from "../../../lib/axios";
import moment
    from "moment";
import ivisConfig
    from "ivisConfig";
import {getUrl} from "../../../lib/urls";
import ParamTypes
    from "./ParamTypes"
import {withComponentMixins} from "../../../lib/decorator-helpers";
import {withTranslation} from "../../../lib/i18n";
import {ModalDialog} from "../../../lib/bootstrap-components";
import styles from "../../../lib/styles.scss";
import {
    getBuiltinTemplates,
    getBuiltinTemplateName,
    anyBuiltinTemplate,
    getBuiltinTemplate
} from "../../../lib/builtin-templates";


@withComponentMixins([
    withTranslation,
    withForm
])
export class ImportExportModalDialog extends Component {
    constructor(props) {
        super(props);

        this.state = {};

        this.initForm();
    }

    static propTypes = {
        visible: PropTypes.bool.isRequired,
        onClose: PropTypes.func.isRequired,
        onImport: PropTypes.func.isRequired,
        onExport: PropTypes.func.isRequired
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        state.setIn(['code', 'error'], null);

        const codeStr = state.getIn(['code', 'value']);

        if (!codeStr) {
            state.setIn(['code', 'error'], t('JSON code must not be empty'));
        } else {
            try {
                const code = JSON.parse(codeStr);
            } catch (err) {
                state.setIn(['code', 'error'], t('Syntax error in the JSON code'));
            }
        }
    }

    doClose() {
        this.props.onClose();
    }

    componentDidMount() {
        this.populateFormValues({
            code: this.props.visible ? this.props.onExport() : ''
        });
    }

    componentDidUpdate(prevProps, prevState) {
        if (!prevProps.visible && this.props.visible) {
            const code = this.props.onExport();
            this.updateFormValue('code', code);
        }
    }

    doImport() {
        if (this.isFormWithoutErrors()) {
            const code = JSON.parse(this.getFormValue('code'));

            this.props.onImport(code);

        } else {
            this.showFormValidation();
        }
    }

    render() {
        const t = this.props.t;

        return (
            <ModalDialog hidden={!this.props.visible} title={t('Import panel settings')} onCloseAsync={async () => this.doClose()} buttons={[
                { label: t('Close'), className: 'btn-primary', onClickAsync: async () => this.doClose() },
                { label: t('Import'), className: 'btn-danger', onClickAsync: async () => this.doImport() }
            ]}>
                <Form stateOwner={this}>
                    <ACEEditor id="code" mode="json" format="wide"/>
                </Form>
            </ModalDialog>
        );
    }
}

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

        this.state = {
            importExportModalShown: false
        };

        this.initForm({
            onChangeBeforeValidation: ::this.onChangeBeforeValidation,
            onChange: {
                template: ::this.onTemplateChange,
                builtin_template: ::this.onTemplateChange,
                templateType: ::this.onTemplateChange
            }
        });

        this.paramTypes = new ParamTypes(props.t);
    }

    static propTypes = {
        action: PropTypes.string.isRequired,
        panelsVisible: PropTypes.array,
        workspace: PropTypes.object,
        entity: PropTypes.object
    }

    @withAsyncErrorHandler
    async fetchUserTemplateParams(templateId) {
        const result = await axios.get(getUrl(`rest/template-params/${templateId}`));

        this.updateFormValue('templateParams', result.data);
    }

    onTemplateChange(state, key, oldVal, newVal) {
        if (oldVal !== newVal) {
            const templateType = state.formState.getIn(['data', 'templateType', 'value']);

            console.log(templateType);
            if (templateType === 'user') {
                const template = state.formState.getIn(['data', 'template', 'value']);

                state.formState = state.formState.setIn(['data', 'templateParams', 'value'], '');

                console.log(template);
                if (template) {
                    this.fetchUserTemplateParams(template);
                }

            } else {
                const builtinTemplateKey = state.formState.getIn(['data', 'builtin_template', 'value']);
                const builtinTemplate = getBuiltinTemplate(builtinTemplateKey);

                if (builtinTemplate) {
                    state.formState = state.formState.setIn(['data', 'templateParams', 'value'], builtinTemplate.params);
                } else {
                    state.formState = state.formState.setIn(['data', 'templateParams', 'value'], '');
                }
            }
        }
    }

    onChangeBeforeValidation(mutStateData, key, oldVal, newVal) {
        if (key === 'templateParams') {
            if (oldVal !== newVal && newVal) {
                this.paramTypes.adopt(newVal, mutStateData);
            }
        } else {
            const configSpec = mutStateData.getIn(['templateParams', 'value']);
            if (configSpec) {
                this.paramTypes.onChange(configSpec, mutStateData, key, oldVal, newVal)
            }
        }
    }

    componentDidMount() {
        const getDefaultBuiltinTemplate = () => anyBuiltinTemplate() ? Object.keys(getBuiltinTemplates())[0] : null;

        if (this.props.entity) {
            this.getFormValuesFromEntity(this.props.entity, data => {
                this.paramTypes.setFields(data.templateParams, data.params, data);
                data.orderBefore = data.orderBefore.toString();
                data.templateType = data.template ? 'user' : 'builtin';
                if (!data.builtin_template) {
                    data.builtin_template = getDefaultBuiltinTemplate();
                }
            });

        } else {
            this.populateFormValues({
                name: '',
                description: '',
                template: null,
                builtin_template: getDefaultBuiltinTemplate(),
                workspace: this.props.workspace.id,
                namespace: ivisConfig.user.namespace,
                orderBefore: 'end',
                templateType: 'user'
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

        if (state.getIn(['templateType', 'value']) === 'user' && !state.getIn(['template', 'value'])) {
            state.setIn(['template', 'error'], t('Template must be selected'));
        } else {
            state.setIn(['template', 'error'], null);
        }

        if (this.props.entity) {
            if (!state.getIn(['workspace', 'value'])) {
                state.setIn(['workspace', 'error'], t('Workspace must be selected'));
            } else {
                state.setIn(['workspace', 'error'], null);
            }
        }

        const paramPrefix = this.paramTypes.getParamPrefix();
        for (const paramId of state.keys()) {
            if (paramId.startsWith(paramPrefix)) {
                state.deleteIn([paramId, 'error']);
            }
        }

        const configSpec = state.getIn(['templateParams', 'value']);
        if (configSpec) {
            this.paramTypes.localValidate(configSpec, state);
        }

        validateNamespace(t, state);
    }

    async submitHandler() {
        const t = this.props.t;

        if (this.getFormValue('template') && !this.getFormValue('templateParams')) {
            this.setFormStatusMessage('warning', t('Panel parameters are not selected. Wait for them to get displayed and then fill them in.'));
            return;
        }

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/panels/${this.props.entity.id}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = `rest/panels/${this.props.workspace.id}`
        }

        try {
            this.disableForm();
            this.setFormStatusMessage('info', t('Saving ...'));

            const submitSuccessful = await this.validateAndSendFormValuesToURL(sendMethod, url, data => {
                const params = this.paramTypes.getParams(data.templateParams, data);

                const paramPrefix = this.paramTypes.getParamPrefix();
                for (const paramId in data) {
                    if (paramId.startsWith(paramPrefix)) {
                        delete data[paramId];
                    }
                }

                delete data.templateParams;
                data.params = params;

                if (data.templateType === 'user') {
                    data.builtin_template = null;
                } else {
                    data.template = null;
                }
                delete data.templateType;

                data.orderBefore = Number.parseInt(data.orderBefore) || data.orderBefore;
            });

            if (submitSuccessful) {
                this.navigateToWithFlashMessage(`/settings/workspaces/${this.props.workspace.id}/panels`, 'success', t('Panel saved'));
            } else {
                this.enableForm();
                this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
            }
        } catch (error) {
            throw error;
        }
    }

    render() {
        const t = this.props.t;
        const isEdit = !!this.props.entity;
        const canDelete =  isEdit && this.props.entity.permissions.includes('delete');

        const templateColumns = [
            { data: 1, title: t('Name') },
            { data: 2, title: t('Description') },
            { data: 5, title: t('Created'), render: data => moment(data).fromNow() }
        ];

        const workspaceColumns = [
            { data: 1, title: t('#') },
            { data: 2, title: t('Name') },
            { data: 3, title: t('Description') },
            { data: 4, title: t('Created'), render: data => moment(data).fromNow() }
        ];

        const templateTypeOptions =[
            {key: 'user', label: t('User-defined template')},
            {key: 'builtin', label: t('Built-in template')},
        ];

        const builtinTemplateOptions = [];
        for (const key in getBuiltinTemplates()) {
            builtinTemplateOptions.push({key, label: getBuiltinTemplateName(key, t)});
        }

        // FIXME - panelsVisible should be fetched dynamically based on the selected workspace
        const orderOptions =[
            {key: 'none', label: t('Not visible')},
            ...this.props.panelsVisible.filter(x => !this.props.entity || x.id !== this.props.entity.id).map(x => ({ key: x.id.toString(), label: x.name})),
            {key: 'end', label: t('End of list')}
        ];

        const configSpec = this.getFormValue('templateParams');
        const params = configSpec ? this.paramTypes.render(configSpec, this) : null;

        return (
            <Panel title={isEdit ? t('Edit Panel') : t('Create Panel')}>
                <ImportExportModalDialog
                    visible={this.state.importExportModalShown}
                    onClose={() => {
                        this.setState({importExportModalShown: false});
                    }}
                    onExport={() => {
                        const data = this.getFormValues();
                        const params = this.paramTypes.getParams(configSpec, data);
                        return JSON.stringify(params, null, 2);
                    }}
                    onImport={code => {
                        const data = {};
                        this.paramTypes.setFields(configSpec, code, data);
                        this.populateFormValues(data);
                        this.setState({importExportModalShown: false});
                    }}
                />
                {canDelete &&
                <DeleteModalDialog
                    stateOwner={this}
                    visible={this.props.action === 'delete'}
                    deleteUrl={`rest/panels/${this.props.entity.id}`}
                    backUrl={`/settings/workspaces/${this.props.workspace.id}/panels/${this.props.entity.id}/edit`}
                    successUrl={`/settings/workspaces/${this.props.workspace.id}/panels`}
                    deletingMsg={t('Deleting panel ...')}
                    deletedMsg={t('Panel deleted')}/>
                }

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="name" label={t('Name')}/>
                    <TextArea id="description" label={t('Description')} help={t('HTML is allowed')}/>

                    {anyBuiltinTemplate() &&
                        <Dropdown id="templateType" label={t('Template type')} options={templateTypeOptions}/>
                    }

                    {this.getFormValue('templateType') === 'user' ?
                        <TableSelect id="template" label={t('Template')} withHeader dropdown dataUrl="rest/templates-table" columns={templateColumns} selectionLabelIndex={1}/>
                        :
                        <Dropdown id="builtin_template" label={t('Template')} options={builtinTemplateOptions}/>
                    }

                    {isEdit &&
                        <TableSelect id="workspace" label={t('Workspace')} withHeader dropdown dataUrl="rest/workspaces-table" columns={workspaceColumns} selectionLabelIndex={2}/>
                    }
                    <NamespaceSelect/>
                    <Dropdown id="orderBefore" label={t('Order (before)')} options={orderOptions} help={t('Select the panel before which this panel should appear in the menu. To exclude the panel from listings, select "Not visible".')}/>

                    {configSpec ?
                        params &&
                        <>
                            <Fieldset
                                label={
                                    <div>
                                        <Toolbar className={styles.fieldsetToolbar}>
                                            <Button className="btn-primary" label={t('Import / Export')} onClickAsync={ async () => this.setState({importExportModalShown: true}) }/>
                                        </Toolbar>
                                        <span>{t('Panel parameters')}</span>
                                    </div>
                                }
                            >
                                {params}
                            </Fieldset>
                        </>
                        :
                        this.getFormValue('template') &&
                        <div className="alert alert-info" role="alert">{t('Loading template...')}</div>
                    }

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="check" label={t('Save')}/>
                        {isEdit && <LinkButton className="btn-danger" icon="remove" label={t('Delete')} to={`/settings/workspaces/${this.props.workspace.id}/panels/${this.props.entity.id}/delete`}/>}
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}
