'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {translate} from "react-i18next";
import {requiresAuthenticatedUser, withPageHelpers} from "../../lib/page";
import {ACEEditor, Button, Form, FormSendMethod, withForm} from "../../lib/form";
import "brace/mode/json";
import "brace/mode/jsx";
import "brace/mode/scss";
import {withAsyncErrorHandler, withErrorHandling} from "../../lib/error-handling";
import {Panel} from "../../lib/panel";
import developStyles from "./Develop.scss";
import {ActionLink} from "../../lib/bootstrap-components";
import Preview from "./Preview";

const SaveState = {
    SAVED: 0,
    SAVING: 1,
    CHANGED: 2
};

const defaultEditorHeight = 600;

@translate()
@withForm
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class Develop extends Component {
    constructor(props) {
        super(props);

        this.templateTypes = this.getTemplateTypes();

        this.state = {
            activeTab: null,
            saveState: SaveState.SAVED,
            isMaximized: false,
            editorHeight: defaultEditorHeight,
            templateVersionId: 0
        };

        const t = props.t;

        this.saveLabels = {
            [SaveState.CHANGED]: t('Save'),
            [SaveState.SAVED]: t('Saved'),
            [SaveState.SAVING]: t('Saving...')
        };

        this.initForm({
            onChange: (newState, key) => {
                const templateType = newState.formState.getIn(['data', 'type', 'value']);
                if (this.templateTypes[templateType].changedKeys.has(key)) {
                    newState.saveState = SaveState.CHANGED;
                }
            }
        });
    }

    static propTypes = {
        entity: PropTypes.object.isRequired
    }

    getTemplateTypes() {
        const t = this.props.t;
        const templateTypes = {};

        templateTypes.jsx = {
            changedKeys: new Set(['jsx', 'scss', 'params']),
            tabs: [
                {
                    id: 'jsx',
                    default: true,
                    label: t('JSX'),
                    getContent: () => <ACEEditor height={this.state.editorHeight + 'px'} id="jsx" mode="jsx" format="wide"/>
                },
                {
                    id: 'scss',
                    label: t('SCSS'),
                    getContent: () => <ACEEditor height={this.state.editorHeight + 'px'} id="scss" mode="scss" format="wide"/>
                },
                {
                    id: 'params',
                    label: t('Parameters'),
                    getContent: () => <ACEEditor height={this.state.editorHeight + 'px'} id="params" mode="json" format="wide"/>
                }
            ],
            dataIn: data => {
                data.jsx = data.settings.jsx;
                data.scss = data.settings.scss;
                data.params = JSON.stringify(data.settings.params, null, '  ');
            },
            dataOut: data => {
                data.settings.jsx = data.jsx;
                data.settings.scss = data.scss;
                data.settings.params = JSON.parse(data.params);
                delete data.jsx;
                delete data.scss;
                delete data.params;
            },
            validate: state => {
                const paramsStr = state.getIn(['params', 'value']);
                try {
                    const params = JSON.parse(paramsStr);

                    if (!Array.isArray(params)) {
                        state.setIn(['params', 'error'], t('Parameters specification has to be a valid JSON array.'));
                    } else {
                        state.setIn(['params', 'error'], null);
                    }
                } catch (err) {
                    state.setIn(['params', 'error'], t('Parameters specification is not a valid JSON array. ') + err.message);
                }
            }
        }

        return templateTypes;
    }

    inputMutator(data) {
        const settings = data.settings || {};
        this.templateTypes[data.type].dataIn(data);
    }

    @withAsyncErrorHandler
    async loadFormValues() {
        await this.getFormValuesFromURL(`/rest/templates/${this.props.entity.id}`, ::this.inputMutator);
    }

    resizeTabPaneContent() {
        if (this.tabPaneContentNode) {
            let desiredHeight;
            const tabPaneContentNodeRect = this.tabPaneContentNode.getBoundingClientRect();

            if (this.state.isMaximized) {
                desiredHeight = window.innerHeight - tabPaneContentNodeRect.top;
            } else {
                desiredHeight = defaultEditorHeight;
            }

            if (this.state.editorHeight != desiredHeight) {
                this.setState({
                    editorHeight: desiredHeight
                });
            }
        }
    }

    componentDidMount() {
        this.getFormValuesFromEntity(this.props.entity, ::this.inputMutator);
        this.resizeTabPaneContent();
    }

    componentDidUpdate() {
        this.resizeTabPaneContent();
    }

    localValidateFormValues(state) {
        const templateType = state.getIn(['type', 'value']);
        this.templateTypes[templateType].validate(state);
    }

    async save() {
        const t = this.props.t;

        const prevState = this.state.saveState;

        this.setState({
            saveState: SaveState.SAVING
        });

        this.disableForm();

        const submitSuccessful = await this.validateAndSendFormValuesToURL(FormSendMethod.PUT, `/rest/templates/${this.props.entity.id}`, data => {
            this.templateTypes[data.type].dataOut(data);
        });

        if (submitSuccessful) {
            await this.loadFormValues();
            this.enableForm();
            this.setState({
                saveState: SaveState.SAVED,
                templateVersionId: this.state.templateVersionId + 1
            });
            this.clearFormStatusMessage();
            this.hideFormValidation();
        } else {
            this.enableForm();
            this.setState({
                saveState: prevState
            });

            this.setFormStatusMessage('warning', t('There are errors in the input. Please fix them and submit again.'));
        }
    }

    selectTab(tab) {
        this.setState({
            activeTab: tab
        });
    }

    render() {
        const t = this.props.t;

        const statusMessageText = this.getFormStatusMessageText();
        const statusMessageSeverity = this.getFormStatusMessageSeverity();

        let activeTabContent;
        const tabs = [];

        const templateType = this.getFormValue('type');
        if (templateType) {
            for (const tabSpec of this.templateTypes[templateType].tabs) {
                const isActive = (!this.state.activeTab && tabSpec.default) || this.state.activeTab === tabSpec.id;

                tabs.push(
                    <li key={tabSpec.id} className={ isActive ? 'active' : ''}>
                        <ActionLink onClickAsync={() => this.selectTab(tabSpec.id)}>{tabSpec.label}</ActionLink>
                    </li>
                );

                if (isActive) {
                    activeTabContent = tabSpec.getContent();
                }
            }
        }

        const errors = [];
        for (const [key, entry] of this.state.formState.get('data').entries()) {
            const err = entry.get('error');
            if (err) {
                errors.push(<div key={key}>{err}</div>);
            }
        }

        return (
            <Panel title={t('Edit Template Code')}>
                <div className={this.state.isMaximized ? developStyles.fullscreenOverlay : ''}>
                    <div className={developStyles.codePane}>
                        <Form stateOwner={this} onSubmitAsync={::this.save} format="wide" noStatus>
                            <div className={developStyles.tabPane}>
                                <div className={developStyles.tabPaneHeader}>
                                    <div className={developStyles.buttons}>
                                        <Button type="submit" className="" label={this.saveLabels[this.state.saveState]}/>
                                        <Button className="" icon="fullscreen" onClickAsync={() => this.setState({isMaximized: !this.state.isMaximized })}/>
                                    </div>
                                    <ul className="nav nav-pills">
                                        {tabs}
                                    </ul>
                                </div>

                                <div className={developStyles.formStatus}>
                                    {statusMessageText &&
                                    <div id="form-status-message"
                                         className={`alert alert-${statusMessageSeverity}`}
                                         role="alert">{statusMessageText}</div>
                                    }
                                    {errors.length > 0 && this.isFormValidationShown() &&
                                    <div id="form-status-message"
                                         className={`alert alert-danger`}
                                         role="alert">
                                        {errors}
                                    </div>
                                    }
                                </div>

                                <div ref={node => this.tabPaneContentNode = node} className={developStyles.tabPaneContent}>
                                    {activeTabContent}
                                </div>
                            </div>
                        </Form>
                    </div>
                    <div className={developStyles.previewPane}>
                        <Preview templateId={this.props.entity.id} templateHash={this.state.templateVersionId}/>
                    </div>
                </div>
            </Panel>
        );
    }
}
