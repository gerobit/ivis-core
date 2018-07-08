import React, {Component} from "react";
import Immutable from 'immutable';
import PropTypes from "prop-types";
import {translate} from "react-i18next";
import {requiresAuthenticatedUser} from "../lib/page";
import {
    Button,
    ButtonRow,
    Fieldset,
    Form,
    withForm
} from "../lib/form";
import "brace/mode/html";
import "brace/mode/json";
import {
    withAsyncErrorHandler,
    withErrorHandling
} from "../lib/error-handling";
import styles from "./PanelConfig.scss";
import {getUrl} from "../lib/urls";
import ParamTypes from "../settings/workspaces/panels/ParamTypes"
import axios from "../lib/axios";
import {checkPermissions} from "../lib/permissions";

export const DisplayOptions = {
    WITHOUT_SAVE: 0,
    WITH_SAVE_IF_PERMITTED: 1,
    ONLY_IF_SAVE_PERMITTED: 2
};

@translate()
@withForm
@withErrorHandling
@requiresAuthenticatedUser
export class Configurator extends Component {
    constructor(props) {
        super(props);

        this.state = {
            opened: false
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
        display: PropTypes.number,
        dropdown: PropTypes.bool,
        autoApply: PropTypes.bool,
        panelId: PropTypes.number,
        onChange: PropTypes.func.isRequired,
        onOpenAsync: PropTypes.func,
        onCloseAsync: PropTypes.func
    }

    static defaultProps = {
        display: DisplayOptions.WITHOUT_SAVE
    }

    @withAsyncErrorHandler
    async fetchPermissions() {
        const result = await checkPermissions({
            editPanel: {
                entityTypeId: 'panel',
                requiredOperations: ['edit']
            }
        });

        this.setState({
            savePermitted: result.data.editPanel
        });
    }

    componentDidMount() {
        this.fetchPermissions();

        if (!this.props.dropdown) {
            this.open();
        }
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

    reloadConfig(config) {
        const data = {};
        this.paramTypes.setFields(this.props.configSpec, config, data);
        this.populateFormValues(data);
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
            this.setFormStatusMessage('info', t('Saving ...'));

            // await this.waitForFormServerValidated(); - This is not needed at the moment, but we keep it here as a reminder to wait for server validation here if we start using server validation for panel config

            if (this.isFormWithoutErrors()) {
                const config = this.paramTypes.getParams(this.props.configSpec, this.getFormValues());
                this.props.onChange(this.paramTypes.upcast(this.props.configSpec, config));

                const display = this.props.display;
                if (display === DisplayOptions.WITH_SAVE_IF_PERMITTED || display === DisplayOptions.ONLY_IF_SAVE_PERMITTED) {
                    const response = await axios.put(getUrl(`rest/panels/${this.props.panelId}?path=FIXME`), config);
                }

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

        if (this.props.dropdown) {
            this.setState({
                opened: false
            });
        }
    }

    async open() {
        if (this.props.onOpenAsync) {
            await this.props.onOpenAsync();
        }

        this.reloadConfig(this.props.config);
        this.setState({
            opened: true
        });
    }

    render() {
        const t = this.props.t;
        const display = this.props.display;

        if (display === DisplayOptions.WITHOUT_SAVE || display === DisplayOptions.WITH_SAVE_IF_PERMITTED || (display === DisplayOptions.ONLY_IF_SAVE_PERMITTED && this.state.savePermittd)) {
            if (this.state.opened) {
                const params = this.paramTypes.render(this.props.configSpec, this);

                const isSave = display === DisplayOptions.WITH_SAVE_IF_PERMITTED || display === DisplayOptions.ONLY_IF_SAVE_PERMITTED;
                let buttons;

                if (this.props.autoApply) {
                    if (isSave) {
                        buttons = (
                            <ButtonRow>
                                <Button type="submit" className="btn-primary" icon="ok" label={t('Save')}/>
                                <Button className="btn-danger" icon="ban" label={t('Close')} onClickAsync={::this.close} />
                            </ButtonRow>
                        );
                    } else {
                        buttons = (
                            <ButtonRow>
                                <Button className="btn-primary" icon="ok" label={t('Close')} onClickAsync={::this.close} />
                            </ButtonRow>
                        );
                    }
                } else {
                    if (isSave) {
                        buttons = (
                            <ButtonRow>
                                <Button type="submit" className="btn-primary" icon="ok" label={t('Save')}/>
                                <Button className="btn-danger" icon="ban" label={t('Close')} onClickAsync={::this.close} />
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
                }

                return (
                    <div className={styles.opened}>
                        <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                            {params}
                            {buttons}
                        </Form>
                    </div>
                );
            } else {
                if (this.props.dropdown) {
                    return (
                        <div className={styles.closed}>
                            <Button className="btn-default" icon="cog" onClickAsync={::this.open} />
                        </div>
                    );
                } else {
                    return null;
                }
            }
        }
    }
}


export function withPanelConfig(comp1) {
    function comp2(props, context) {
        comp1.apply(this, props, context);

        if (!this.state) {
            this.state = {};
        }

        let config = props.params;

        this.state._panelConfig = Immutable.Map({
            params: Immutable.fromJS(config)
        });
    }

    comp2.prototype = comp1.prototype;

    for (const attr in comp1) {
        comp2[attr] = comp1[attr];
    }

    comp2.prototype.getPanelConfig = function(path = []) {
        const value = this.state._panelConfig.getIn(['params', ...path]);
        if (Immutable.isImmutable(value)) {
            return value.toJS();
        } else {
            return value;
        }
    };

    comp2.prototype.updatePanelConfig = function(path, newValue) {
        this.setState({
            _panelConfig: this.state._panelConfig.setIn(['params', ...path], Immutable.fromJS(newValue))
        });
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
            (path, newValue) => {
                owner.updatePanelConfig([...this.props.path, ...path], newValue);
            }
        );
    }
}
