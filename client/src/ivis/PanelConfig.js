import React, {Component} from "react";
import Immutable from 'immutable';
import PropTypes from "prop-types";
import {translate} from "react-i18next";
import {requiresAuthenticatedUser} from "../lib/page";
import {
    AlignedRow,
    Button,
    ButtonRow,
    Fieldset,
    Form,
    InputField,
    withForm
} from "../lib/form";
import "brace/mode/html";
import "brace/mode/json";
import {
    withErrorHandling,
    wrapWithAsyncErrorHandler
} from "../lib/error-handling";
import ParamTypes from "../settings/workspaces/panels/ParamTypes"
import {checkPermissions} from "../lib/permissions";
import styles from "./PanelConfig.scss";

@translate()
@withForm
@requiresAuthenticatedUser
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
        panelId: PropTypes.number,
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
                        <Button className="btn-primary" icon="ok" label={t('Close')} onClickAsync={::this.close} />
                    </ButtonRow>
                );
            } else {
                buttons = (
                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="ok" label={t('Apply')}/>
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


@translate()
@withForm
@requiresAuthenticatedUser
export class SaveDialog extends Component {
    constructor(props) {
        super(props);

        this.initForm();
    }

    static propTypes = {
        owner: PropTypes.object.isRequired
    }

    componentDidMount() {
        this.populateFormValues({});
    }

    async submitHandler() {
        const t = this.props.t;

        try {
            // FIXME
        } catch (error) {
            throw error;
        }
    }

    async close() {
        this.props.owner.updatePanelState(['save', 'opened'], false);
    }

    render() {
        const t = this.props.t;

        const opened = this.props.owner.getPanelState(['save', 'opened']);

        if (opened) {
            return (
                <div className={styles.saveWidget}>
                    <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                        <legend>{t('Save panel settings')}</legend>
                        <AlignedRow>{t('Do you want to overwrite the existing panel settings?')}</AlignedRow>
                        <ButtonRow>
                            <Button type="submit" className="btn-primary" icon="ok" label={t('Save')}/>
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

@translate()
@withForm
@requiresAuthenticatedUser
export class SaveCopyAsDialog extends Component {
    constructor(props) {
        super(props);

        this.initForm();
    }

    static propTypes = {
        owner: PropTypes.object.isRequired
    }

    componentDidMount() {
        this.populateFormValues({
            panelName: ''
        });
    }

    localValidateFormValues(state) {
        const t = this.props.t;
    }

    async submitHandler() {
        const t = this.props.t;

        try {
            this.disableForm();

            if (this.isFormWithoutErrors()) {

                // FIXME

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
        this.props.owner.updatePanelState(['saveCopyAs', 'opened'], false);
    }

    render() {
        const t = this.props.t;

        const opened = this.props.owner.getPanelState(['saveCopyAs', 'opened']);

        if (opened) {
            return (
                <div className={styles.saveWidget}>
                    <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                        <legend>{t('Save panel settings')}</legend>

                        <InputField id="panelName" label={t('Panel Name')}/>
                        <ButtonRow>
                            <Button type="submit" className="btn-primary" icon="ok" label={t('Save')}/>
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



export function withPanelConfig(target) {
    const comp1 = withErrorHandling(target);

    function comp2(props, context) {
        comp1.apply(this, [props, context]);

        if (!this.state) {
            this.state = {};
        }

        let config = props.params;

        this.state._panelConfig = Immutable.Map({
            params: Immutable.fromJS(config),
            savePermitted: false
        });
    }

    const inst = comp2.prototype = comp1.prototype;

    for (const attr in comp1) {
        comp2[attr] = comp1[attr];
    }

    const previousComponentDidMount = inst.componentDidMount;
    inst.componentDidMount = function() {
        const fetchPermissions = wrapWithAsyncErrorHandler(this, async () => {
            const result = await checkPermissions({
                editPanel: {
                    entityTypeId: 'panel',
                    entityId: this.props.panelId,
                    requiredOperations: ['edit']
                }
            });

            const savePermitted = result.data.editPanel;
            this.setState(state => ({
                _panelConfig: state._panelConfig.set('savePermitted', savePermitted)
            }));
        });

        fetchPermissions();

        if (previousComponentDidMount) {
            previousComponentDidMount.apply(this);
        }
    };

    inst.isPanelConfigSavePermitted = function() {
        return this.state._panelConfig.get('savePermitted');
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

    return comp2;
}

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
