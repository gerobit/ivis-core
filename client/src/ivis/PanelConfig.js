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
import {ParamTypes} from "../settings/workspaces/panels/param-types"
import axios from "../lib/axios";
import {checkPermissions} from "../lib/permissions";

export const ShowOptions = {
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
            onChangeBeforeValidation: ::this.onChangeBeforeValidation
        });

        this.paramTypes = new ParamTypes(props.t);
    }

    static propTypes = {
        spec: PropTypes.object,
        config: PropTypes.object, // May be updated during lifetime of the component
        show: PropTypes.number.isRequired,
        panelId: PropTypes.number,
        path: PropTypes.array
    }

    static defaultProps = {
        path: []
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

    onChangeBeforeValidation(mutStateData, key, oldVal, newVal) {
        this.paramTypes.onChange(this.props.spec, mutStateData, key, oldVal, newVal)
    }

    reloadConfig(config) {
        for (const pathElem of this.props.path) {
            config = config[pathElem];
        }

        const data = {};
        this.paramTypes.setFields(this.props.spec, config, data);
        this.populateFormValues(data);
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.config !== nextProps.config) {
            this.reloadConfig(nextProps.config);
        }
    }

    componentDidMount() {
        this.reloadConfig(this.props.config);
        this.fetchPermissions();
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        const paramPrefix = this.paramTypes.getParamPrefix();
        for (const paramId of state.keys()) {
            if (paramId.startsWith(paramPrefix)) {
                state.deleteIn([paramId, 'error']);
            }
        }

        this.paramTypes.localValidate(this.props.spec, state);
    }

    async submitHandler() {
        const t = this.props.t;

        try {
            this.disableForm();
            this.setFormStatusMessage('info', t('Saving ...'));

            await this.waitForFormServerValidated();

            if (this.isFormWithoutErrors()) {
                const data = this.getFormValues();

                let config;
                if (this.props.path.length > 0) {
                    config = this.props.config;
                    let parent = config;
                    for (let idx = 0; idx < this.props.path.length - 1; idx++) {
                        parent = parent[this.props.path[idx]];
                    }
                    parent[this.props.path[this.props.path.length - 1]] = this.paramTypes.getParams(this.props.spec, data);
                } else {
                    config = this.paramTypes.getParams(this.props.spec, data);
                }

                const response = await axios.put(getUrl(`rest/panels/${this.props.panelId}`), config);

                this.enableForm();
                this.setFormStatusMessage('info', t('Settings saved.'));

            } else {
                this.showFormValidation();
                this.enableForm();
                this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
            }
        } catch (error) {
            throw error;
        }
    }

    async cancel() {
        this.reloadConfig(this.props.config);
        this.setState({
            opened: false
        });
    }

    async open() {
        this.setState({
            opened: true
        });
    }

    render() {
        const t = this.props.t;
        const show = this.props.show;

        if (show === ShowOptions.WITHOUT_SAVE || show === ShowOptions.WITH_SAVE_IF_PERMITTED || (show === ShowOptions.ONLY_IF_SAVE_PERMITTED && this.state.savePermittd)) {
            if (this.state.opened) {
                const params = this.paramTypes.render(this.props.spec, this);

                return (
                    <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                        <Fieldset label={t('Panel parameters')}>
                            <div className={styles.params}>
                                {params}
                            </div>
                        </Fieldset>

                        <ButtonRow>
                            <Button
                                type="submit"
                                className="btn-primary"
                                icon="ok"
                                label={(show === ShowOptions.WITH_SAVE_IF_PERMITTED || show === ShowOptions.ONLY_IF_SAVE_PERMITTED) ? t('Apply and save') : t('Apply')}
                            />
                            <Button
                                className="btn-danger"
                                icon="ban"
                                label={t('Cancel')}
                                onClickAsync={::this.cancel}
                            />
                        </ButtonRow>
                    </Form>
                );
            } else {
                <Button className="btn-default" icon="cog" onClickAsync={::this.open} />
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

        const config = Immutable.fromJS(props.params).toJS(); // This is just a convenient deep clone

        if (comp1.prototype.preparePanelConfig) {
            this.preparePanelConfig(config);
        }

        this.state._panelConfig = Immutable.Map({
            params: config
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
    }

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
