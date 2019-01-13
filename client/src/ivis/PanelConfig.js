import React, {Component} from "react";
import Immutable
    from 'immutable';
import PropTypes
    from "prop-types";
import {Trans} from "react-i18next";
import {
    AlignedRow,
    Button,
    ButtonRow,
    Dropdown,
    Form,
    FormSendMethod,
    InputField,
    TableSelect,
    TextArea,
    withForm
} from "../lib/form";
import "brace/mode/html";
import "brace/mode/json";
import {
    withAsyncErrorHandler,
    withErrorHandling,
    wrapWithAsyncErrorHandler
} from "../lib/error-handling";
import ParamTypes
    from "../settings/workspaces/panels/ParamTypes"
import {checkPermissions} from "../lib/permissions";
import styles
    from "./PanelConfig.scss";
import {
    panelMenuMixin,
    withPanelMenu
} from "./PanelMenu";
import {
    getTrustedUrl,
    getUrl
} from "../lib/urls";
import axios
    from "../lib/axios";
import moment
    from "moment/moment";
import {
    NamespaceSelect,
    validateNamespace
} from "../lib/namespace";
import {ActionLink} from "../lib/bootstrap-components";
import {withPageHelpers} from "../lib/page-common";
import {
    createComponentMixin,
    withComponentMixins
} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";

@withComponentMixins([
    withTranslation,
    withForm
])
export class Configurator extends Component {
    constructor(props) {
        super(props);

        this.state = {
            initialized: false
        };

        this.initForm({
            onChangeBeforeValidation: ::this.onChangeBeforeValidation,
            onChange: ::this.onChangeCallback
        });

        this.paramTypes = new ParamTypes(props.t);
    }

    static propTypes = {
        configSpec: PropTypes.oneOfType([PropTypes.array, PropTypes.object]).isRequired,
        config: PropTypes.oneOfType([PropTypes.array, PropTypes.object]).isRequired,
        autoApply: PropTypes.bool,
        onChange: PropTypes.func.isRequired,
        onCloseAsync: PropTypes.func
    }

    componentDidMount() {
        const data = {};
        this.paramTypes.setFields(this.props.configSpec, this.props.config, data);
        this.populateFormValues(data);
        this.setState({
            initialized: true
        });
    }

    onChangeBeforeValidation(mutStateData, key, oldVal, newVal) {
        this.paramTypes.onChange(this.props.configSpec, mutStateData, key, oldVal, newVal)
    }

    onChangeCallback(state, key, oldValue, value) {
        if (this.props.autoApply && !state.formState.get('data').find(attr => attr.get('error'))) { // If form is without errors
            const config = this.paramTypes.getParams(this.props.configSpec, state.formState.get('data').map(attr => attr.get('value')).toJS()); // Get form values
            this.props.onChange(this.paramTypes.upcast(this.props.configSpec, config));
        }
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        const paramPrefix = this.paramTypes.getParamPrefix();
        for (const paramId of state.keys()) {
            if (paramId.startsWith(paramPrefix)) {
                state.deleteIn([paramId, 'error']);
            }
        }

        this.paramTypes.localValidate(this.props.configSpec, state);
    }

    async submitHandler() {
        const t = this.props.t;

        try {
            this.disableForm();

            // await this.waitForFormServerValidated(); - This is not needed at the moment, but we keep it here as a reminder to wait for server validation here if we start using server validation for panel config

            if (this.isFormWithoutErrors()) {
                const config = this.paramTypes.getParams(this.props.configSpec, this.getFormValues());
                this.props.onChange(this.paramTypes.upcast(this.props.configSpec, config));

                this.enableForm();
                this.clearFormStatusMessage();
                this.hideFormValidation();

                this.close();
            } else {
                this.showFormValidation();
                this.enableForm();
                this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and try again.'));
            }
        } catch (error) {
            throw error;
        }
    }

    async close() {
        if (this.props.onCloseAsync) {
            await this.props.onCloseAsync();
        }
    }

    render() {
        const t = this.props.t;

        if (this.state.initialized) {
            const params = this.paramTypes.render(this.props.configSpec, this);

            let buttons;

            if (this.props.autoApply) {
                buttons = (
                    <ButtonRow>
                        <Button className="btn-primary" icon="check" label={t('Close')} onClickAsync={::this.close} />
                    </ButtonRow>
                );
            } else {
                buttons = (
                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="check" label={t('Apply')}/>
                        <Button className="btn-danger" icon="ban" label={t('Cancel')} onClickAsync={::this.close} />
                    </ButtonRow>
                );
            }

            return (
                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    {params}
                    {buttons}
                </Form>
            );
        } else {
            return null;
        }
    }
}


const SaveDialogType = {
    NONE: 0,
    SAVE: 1,
    SAVE_COPY: 2
};

function openSaveDialog(owner, dialog) {
    owner.updatePanelState(['saveDialog'], dialog);

    if (dialog === SaveDialogType.NONE) {
        owner.updatePanelMenuEnabled({
            save: true,
            saveAs: true,
            saveCopy: true
        });
    } else {
        owner.updatePanelMenuEnabled({
            save: false,
            saveAs: false,
            saveCopy: false
        });
    }
}

@withComponentMixins([
    withTranslation,
    withPageHelpers,
    withForm
])
export class SaveDialog extends Component {
    constructor(props) {
        super(props);

        this.state = {
            message: null
        };

        this.initForm({
            onChange: {
                workspace: (newState, key, oldValue, newValue) => ::this.fetchPanelsVisible(newValue)
            }
        });
    }

    static propTypes = {
        owner: PropTypes.object.isRequired
    }

    @withAsyncErrorHandler
    async fetchPanelsVisible(workspaceId) {
        const owner = this.props.owner;

        this.setState({
            panelsVisible: []
        });

        if (workspaceId) {
            const result = await axios.get(getUrl(`rest/panels-visible/${workspaceId}`));

            this.setState({
                panelsVisible: result.data
            });
        }
    }

    componentDidMount() {
        const owner = this.props.owner;

        this.fetchPanelsVisible(owner.props.panel.workspace);

        this.populateFormValues({
            name: '',
            description: '',
            workspace: owner.props.panel.workspace,
            namespace: owner.props.panel.namespace,
            orderBefore: 'end'
        });
    }

    localValidateFormValues(state) {
        const t = this.props.t;
        const owner = this.props.owner;
        const dialog = owner.getPanelState(['saveDialog']);

        if (dialog === SaveDialogType.SAVE_COPY) {
            if (!state.getIn(['name', 'value'])) {
                state.setIn(['name', 'error'], t('Name must not be empty'));
            } else {
                state.setIn(['name', 'error'], null);
            }

            if (this.props.entity) {
                if (!state.getIn(['workspace', 'value'])) {
                    state.setIn(['workspace', 'error'], t('Workspace must be selected'));
                } else {
                    state.setIn(['workspace', 'error'], null);
                }
            }

            validateNamespace(t, state);
        }
    }

    async submitHandler() {
        const t = this.props.t;
        const owner = this.props.owner;
        const dialog = owner.getPanelState(['saveDialog']);

        try {
            if (dialog === SaveDialogType.SAVE) {
                this.disableForm();
                this.setFormStatusMessage('info', t('Saving ...'));

                await axios.put(getUrl(`rest/panels-config/${owner.props.panel.id}`), owner.getPanelConfig());

                this.enableForm();
                this.clearFormStatusMessage();

                this.close();

            } else if (dialog === SaveDialogType.SAVE_COPY) {
                this.disableForm();
                this.setFormStatusMessage('info', t('Saving ...'));

                const workspaceId = this.getFormValue('workspace');

                const newPanelId = await this.validateAndSendFormValuesToURL(FormSendMethod.POST, `rest/panels/${workspaceId}`, data => {
                    data.template = owner.props.panel.template;
                    data.params = owner.getPanelConfig();
                    data.orderBefore = Number.parseInt(data.orderBefore) || data.orderBefore;
                });

                if (newPanelId) {
                    this.setState({
                        message: <Trans>Panel saved. Click <ActionLink href={getTrustedUrl(`workspaces/${workspaceId}/${newPanelId}`)} onClickAsync={() => this.navigateTo(`/workspaces/${workspaceId}/${newPanelId}`)}>here</ActionLink> to open it.</Trans> // FIXME - make the action link tell parent to navigate to the url
                    });

                    this.enableForm();
                    this.clearFormStatusMessage();

                } else {
                    this.enableForm();
                    this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
                }
            }
        } catch (error) {
            throw error;
        }
    }

    async close() {
        const owner = this.props.owner;
        this.populateFormValues({
            name: '',
            description: '',
            workspace: owner.props.panel.workspace,
            namespace: owner.props.panel.namespace,
            orderBefore: 'end'
        });

        this.setState({
            message: null
        });

        openSaveDialog(owner, SaveDialogType.NONE);
    }

    render() {
        const t = this.props.t;

        const dialog = this.props.owner.getPanelState(['saveDialog']);

        if (this.state.message) {
            return (
                <div className={styles.saveWidget}>
                    <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                        <legend>{t('Save panel settings')}</legend>

                        <AlignedRow>{this.state.message}</AlignedRow>

                        <ButtonRow>
                            <Button className="btn-primary" icon="check" label={t('OK')} onClickAsync={::this.close} />
                        </ButtonRow>
                    </Form>
                </div>
            );

        } else if (dialog === SaveDialogType.SAVE) {
            return (
                <div className={styles.saveWidget}>
                    <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                        <legend>{t('Save panel settings')}</legend>

                        <AlignedRow>{t('Do you want to overwrite the existing panel settings?')}</AlignedRow>

                        <ButtonRow>
                            <Button type="submit" className="btn-primary" icon="check" label={t('Save')}/>
                            <Button className="btn-danger" icon="ban" label={t('Cancel')} onClickAsync={::this.close} />
                        </ButtonRow>
                    </Form>
                </div>
            );

        } else if (dialog === SaveDialogType.SAVE_COPY) {
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

            const panel = this.props.owner.props.panel;

            const orderOptions =[
                {key: 'none', label: t('Not visible')},
                ...this.state.panelsVisible.map(x => ({ key: x.id.toString(), label: x.name})),
                {key: 'end', label: t('End of list')}
            ];

            return (
                <div className={styles.saveWidget}>
                    <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                        <legend>{t('Save panel settings')}</legend>

                        <InputField id="name" label={t('Name')}/>
                        <TextArea id="description" label={t('Description')} help={t('HTML is allowed')}/>
                        <TableSelect id="workspace" label={t('Workspace')} withHeader dropdown dataUrl="rest/workspaces-table" columns={workspaceColumns} selectionLabelIndex={2}/>
                        <NamespaceSelect/>
                        <Dropdown id="orderBefore" label={t('Order (before)')} options={orderOptions} help={t('Select the panel before which this panel should appear in the menu. To exclude the panel from listings, select "Not visible".')}/>

                        <ButtonRow>
                            <Button type="submit" className="btn-primary" icon="check" label={t('Save')}/>
                            <Button className="btn-danger" icon="ban" label={t('Cancel')} onClickAsync={::this.close} />
                        </ButtonRow>
                    </Form>
                </div>
            );
        } else {
            return null;
        }
    }
}

export const panelConfigMixin = createComponentMixin([], [withErrorHandling, panelMenuMixin], (TargetClass, InnerClass) => {
    const inst = InnerClass.prototype;

    function ctor(self, props) {
        if (!self.state) {
            self.state = {};
        }

        self.state._panelConfig = Immutable.Map({
            params: Immutable.fromJS(props.params),
            savePermitted: false
        });
    }

    const previousComponentDidUpdate = inst.componentDidUpdate;
    inst.componentDidUpdate = function(prevProps, prevState, snapshot) {
        if (this.props.params !== prevProps.params) {
            this.setState(state => ({
                _panelConfig: state._panelConfig
                    .set('params', Immutable.fromJS(this.props.params))
            }));
        }

        if (previousComponentDidUpdate) {
            previousComponentDidUpdate.apply(this, prevProps, prevState, snapshot);
        }
    };

    const previousComponentDidMount = inst.componentDidMount;
    inst.componentDidMount = function() {
        const fetchPermissions = wrapWithAsyncErrorHandler(this, async () => {
            const result = await checkPermissions({
                editPanel: {
                    entityTypeId: 'panel',
                    entityId: this.props.panel.id,
                    requiredOperations: ['edit']
                },
                createPanel: {
                    entityTypeId: 'namespace',
                    requiredOperations: ['createPanel']
                }
            });

            const savePermitted = result.data.editPanel;
            const saveAsPermitted = result.data.createPanel;
            this.setState(state => ({
                _panelConfig: state._panelConfig
                    .set('savePermitted', savePermitted)
                    .set('saveAsPermitted', saveAsPermitted)
            }));

            const menuUpdates = {};
            if (savePermitted) {
                menuUpdates['save'] = {
                    label: 'Save',
                    action: () => openSaveDialog(this, SaveDialogType.SAVE),
                    weight: 10
                };
            }

            if (saveAsPermitted) {
                menuUpdates['saveCopy'] = {
                    label: 'Save Copy',
                    action: () => openSaveDialog(this, SaveDialogType.SAVE_COPY),
                    weight: 11
                };
            }

            this.updatePanelMenu(menuUpdates);
        });

        fetchPermissions();

        if (previousComponentDidMount) {
            previousComponentDidMount.apply(this);
        }
    };

    const previousRender = inst.render;
    inst.render = function() {
        return (
            <div>
                {(this.isPanelConfigSavePermitted() || this.isPanelConfigSaveAsPermitted()) && <SaveDialog owner={this}/>}
                { previousRender.apply(this) }
            </div>
        );
    };

    inst.isPanelConfigSavePermitted = function() {
        return this.state._panelConfig.get('savePermitted');
    };

    inst.isPanelConfigSaveAsPermitted = function() {
        return this.state._panelConfig.get('saveAsPermitted');
    };

    inst.getPanelConfig = function(path = []) {
        const value = this.state._panelConfig.getIn(['params', ...path]);
        if (Immutable.isImmutable(value)) {
            return value.toJS();
        } else {
            return value;
        }
    };

    inst.updatePanelConfig = function(path, newValue) {
        this.setState(state => ({
            _panelConfig: state._panelConfig.setIn(['params', ...path], Immutable.fromJS(newValue))
        }));
    };

    inst.getPanelState = function(path = []) {
        const value = this.state._panelConfig.getIn(['state', ...path]);
        if (Immutable.isImmutable(value)) {
            return value.toJS();
        } else {
            return value;
        }
    };

    inst.updatePanelState = function(path, newValue) {
        this.setState(state => ({
            _panelConfig: state._panelConfig.setIn(['state', ...path], Immutable.fromJS(newValue))
        }));
    };

    return {
        ctor
    };
});


export const withPanelConfig = withComponentMixins([
   panelConfigMixin
]);


export class PanelConfigAccess extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        owner: PropTypes.object.isRequired,
        path: PropTypes.array.isRequired,
        render: PropTypes.func.isRequired
    }

    render() {
        const owner = this.props.owner;

        return this.props.render(
            owner.getPanelConfig(this.props.path),
            owner.isPanelConfigSavePermitted(),
            (path, newValue) => {
                owner.updatePanelConfig([...this.props.path, ...path], newValue);
            }
        );
    }
}
