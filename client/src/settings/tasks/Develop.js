'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {requiresAuthenticatedUser, withPageHelpers} from "../../lib/page";
import {ACEEditor, Button, Form, FormSendMethod, withForm} from "../../lib/form";
import "brace/mode/json";
import "brace/mode/python";
import "brace/mode/text";
import {withAsyncErrorHandler, withErrorHandling} from "../../lib/error-handling";
import {Panel} from "../../lib/panel";
import developStyles from "./Develop.scss";
import {ActionLink} from "../../lib/bootstrap-components";
import IntegrationTabs from "./IntegrationTabs";
import Files from "../../lib/files";
import {TaskType} from "../../../../shared/tasks";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";
import axios from "../../lib/axios";
import {getUrl} from "../../lib/urls";
import {RunStatus} from "../../../../shared/jobs";

const SaveState = {
    SAVED: 0,
    SAVING: 1,
    CHANGED: 2
};

const defaultEditorHeight = 600;

const typeToEditor = new Map();
typeToEditor.set(TaskType.PYTHON, 'python');
typeToEditor.set(TaskType.NUMPY, 'python');

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    withForm,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class Develop extends Component {
    constructor(props) {
        super(props);

        this.taskTypes = {};

        this.state = {
            activeTab: null,
            saveState: SaveState.SAVED,
            isMaximized: false,
            withIntegration: false,
            editorHeight: defaultEditorHeight,
            taskVersionId: 0,
            fileToDeleteName: null,
            fileToDeleteId: null
        };

        const t = props.t;

        this.saveLabels = {
            [SaveState.CHANGED]: t('Save'),
            [SaveState.SAVED]: t('Saved'),
            [SaveState.SAVING]: t('Saving...')
        };

        this.saveRunLabels = {
            [SaveState.CHANGED]: t('Save and Run'),
            [SaveState.SAVED]: t('Saved'),
            [SaveState.SAVING]: t('Saving...')
        };

        this.initForm({
            onChange: (newState, key) => {
                const taskType = newState.formState.getIn(['data', 'type', 'value']);
                if (this.getTypeSpec(taskType).changedKeys.has(key)) {
                    newState.saveState = SaveState.CHANGED;
                }
            }
        });
    }

    static propTypes = {
        entity: PropTypes.object.isRequired
    };

    changeJob(id) {
        if (this.state.jobId !== id) {
            this.setState({jobId: id});
            if (this.runRefreshTimeout) {
                clearTimeout(this.runRefreshTimeout);
            }
            this.setState({
                run: null,
                runId: null
            });
        }
    }

    @withAsyncErrorHandler
    async fetchRun() {
        const result = await axios.get(getUrl(`rest/jobs/${this.state.jobId}/run/${this.state.runId}`));

        const run = result.data;

        this.setState({
            run: run
        });

        if (run.status == null
            || run.status === RunStatus.INITIALIZATION
            || run.status === RunStatus.SCHEDULED
            || run.status === RunStatus.RUNNING) {
            this.runRefreshTimeout = setTimeout(() => {
                this.fetchRun();
            }, 1000);
        } else {

        }
    }

    async run() {
        if (this.state.jobId != null) {
            const runId = await axios.post(getUrl(`rest/job-run/${this.state.jobId}`));

            if (this.runRefreshTimeout) {
                clearTimeout(this.runRefreshTimeout);
            }
            this.setState({
                run: null,
                runId: runId.data
            });

            this.fetchRun();
        } else {
            // TODO fix, doesn't show anything
            this.setFormStatusMessage('warning', this.props.t('Job is not selected. Nothing to run.'));
        }
    }

    getTypeSpec(type) {
        const t = this.props.t;
        let spec = this.taskTypes[type];
        if (spec !== undefined) {
            return spec;
        }

        let editorMode = typeToEditor.get(type);
        if (editorMode === undefined) {
            editorMode = 'text';
        }

        spec = {
            changedKeys: new Set(['code', 'files', 'params']),
            tabs: [
                {
                    id: 'code',
                    default: true,
                    label: t('Code'),
                    getContent: () => <ACEEditor height={this.state.editorHeight + 'px'} id="code" mode={editorMode}
                                                 format="wide"/>
                },
                {
                    id: 'files',
                    label: t('Files'),
                    getContent: () => <Files entity={this.props.entity} entityTypeId="task" entitySubTypeId="file"
                                             managePermission="manageFiles"/>
                },
                {
                    id: 'params',
                    label: t('Parameters'),
                    getContent: () => <ACEEditor height={this.state.editorHeight + 'px'} id="params" mode="json"
                                                 format="wide"/>
                }
            ],
            dataIn: data => {
                data.code = data.settings.code;
                data.params = JSON.stringify(data.settings.params, null, '  ');
            },
            dataOut: data => {
                data.settings.code = data.code;
                data.settings.params = JSON.parse(data.params);
                delete data.code;
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
        };
        this.taskTypes[type] = spec;
        return spec;
    }

    inputMutator(data) {
        this.getTypeSpec(data.type).dataIn(data);
    }

    @withAsyncErrorHandler
    async loadFormValues() {
        await this.getFormValuesFromURL(`rest/tasks/${this.props.entity.id}`, ::this.inputMutator);
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

            if (this.state.editorHeight !== desiredHeight) {
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

    componentWillUnmount() {
        clearTimeout(this.runRefreshTimeout);
    }

    localValidateFormValues(state) {
        const taskType = state.getIn(['type', 'value']);
        this.getTypeSpec(taskType).validate(state);
    }

    async saveAndRun() {
        await this.save();
        await this.run();
    }

    async save() {
        const t = this.props.t;

        const prevState = this.state.saveState;

        this.setState({
            saveState: SaveState.SAVING
        });

        this.disableForm();

        const submitSuccessful = await this.validateAndSendFormValuesToURL(FormSendMethod.PUT, `rest/tasks/${this.props.entity.id}`, data => {
            this.getTypeSpec(data.type).dataOut(data);
        });

        if (submitSuccessful) {
            await this.loadFormValues();
            this.enableForm();
            this.setState({
                saveState: SaveState.SAVED,
                taskVersionId: this.state.taskVersionId + 1
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

    @withAsyncErrorHandler
    async stop() {
        if (this.state.runId) {
            await axios.post(getUrl(`rest/job-stop/${this.state.runId}`));
            if (this.runRefreshTimeout) {
                clearTimeout(this.runRefreshTimeout);
            }

            this.setState({
                run: null,
                runId: null
            });
        }
    }

    render() {
        const t = this.props.t;

        const statusMessageText = this.getFormStatusMessageText();
        const statusMessageSeverity = this.getFormStatusMessageSeverity();

        let activeTabContent;
        const tabs = [];

        const taskType = this.getFormValue('type');
        if (taskType) {
            for (const tabSpec of this.getTypeSpec(taskType).tabs) {
                const isActive = (!this.state.activeTab && tabSpec.default) || this.state.activeTab === tabSpec.id;

                tabs.push(
                    <li key={tabSpec.id} className={isActive ? 'active' : ''}>
                        <ActionLink className={'nav-link' + (isActive ? ' active' : '')}
                                    onClickAsync={() => this.selectTab(tabSpec.id)}>{tabSpec.label}</ActionLink>
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

        const showStopBtn = this.state.run && (this.state.run.status === RunStatus.INITIALIZATION ||
            this.state.run.status === RunStatus.RUNNING ||
            this.state.run.status === RunStatus.SCHEDULED);

        let saveAndRunBtn = null;
        if (this.state.saveState === SaveState.SAVED) {
            saveAndRunBtn =
                <Button className="btn-primary"
                        label={t('Run')}
                        onClickAsync={() => this.run()}/>
        } else if (this.state.saveState === SaveState.CHANGED) {
            saveAndRunBtn = <Button className="btn-primary"
                    label={this.saveRunLabels[this.state.saveState]}
                    onClickAsync={() => this.saveAndRun()}/>
        }

        return (
            <Panel title={t('Edit Task Code')}>
                <div
                    className={developStyles.develop + ' ' + (this.state.isMaximized ? developStyles.fullscreenOverlay : '') + ' ' + (this.state.withIntegration ? developStyles.withIntegration : '')}>
                    <div className={developStyles.codePane}>
                        <Form stateOwner={this} onSubmitAsync={::this.save} format="wide" noStatus>
                            <div className={developStyles.tabPane}>
                                <div id="headerPane" className={developStyles.tabPaneHeader}>
                                    <div className={developStyles.buttons}>

                                        <Button type="submit" className="btn-primary"
                                                label={this.saveLabels[this.state.saveState]}/>
                                        {!showStopBtn && saveAndRunBtn}
                                        {showStopBtn &&
                                        <Button className="btn-primary"
                                                label={t('Stop')}
                                                onClickAsync={() => this.stop()}/>
                                        }
                                        <Button className="btn-primary"
                                                icon={this.state.isMaximized ? "compress-arrows-alt" : "expand-arrows-alt"}
                                                onClickAsync={() => this.setState({isMaximized: !this.state.isMaximized})}/>
                                        <Button className="btn-primary"
                                                icon={this.state.withIntegration ? 'arrow-right' : 'arrow-left'}
                                                onClickAsync={() => this.setState({withIntegration: !this.state.withIntegration})}/>
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

                                <div ref={node => this.tabPaneContentNode = node}
                                     className={developStyles.tabPaneContent}>
                                    {activeTabContent}
                                </div>
                            </div>
                        </Form>
                    </div>
                    <div className={developStyles.integrationPane}>
                        <React.StrictMode>
                            <IntegrationTabs onJobChange={this.changeJob.bind(this)} taskId={this.props.entity.id}
                                             taskHash={this.state.taskVersionId} run={this.state.run}/>

                        </React.StrictMode>
                    </div>
                </div>
            </Panel>
        );
    }
}
