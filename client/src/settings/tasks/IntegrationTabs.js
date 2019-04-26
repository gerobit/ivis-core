'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {Form, TableSelect, withForm} from "../../lib/form";
import {requiresAuthenticatedUser, withPageHelpers} from "../../lib/page";
import {withAsyncErrorHandler, withErrorHandling} from "../../lib/error-handling";
import outputStyles from "./Output.scss";
import developStyles from "./Develop.scss";
import axios from "../../lib/axios";
import {BuildState} from "../../../../shared/tasks"
import {getUrl} from "../../lib/urls";
import {RunStatus} from "../../../../shared/jobs";
import {ActionLink} from "../../lib/bootstrap-components";
import moment from "moment";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";

@withComponentMixins([
    withTranslation,
    withForm,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class IntegrationTabs extends Component {
    static propTypes = {
        taskId: PropTypes.number,
        taskHash: PropTypes.number,
        withBuild: PropTypes.bool,
        onJobChange: PropTypes.func,
        run: PropTypes.object
    };

    constructor(props) {
        super(props);

        this.state = {
            activeTab: null,
            task: null,
            prevPropsTaskHash: this.props.taskHash
        };
        this.refreshTimeout = null;

        this.initForm({
            onChange: (newState, key) => {
                this.props.onJobChange(newState.formState.getIn(['data', 'developJob', 'value']));
            }
        });
    }

    @withAsyncErrorHandler
    async fetchTask() {
        const result = await axios.get(getUrl(`rest/tasks/${this.props.taskId}`));

        const task = result.data;

        this.setState({
            task: task
        });

        if (task.build_state == null
            || task.build_state === BuildState.SCHEDULED
            || task.build_state === BuildState.PROCESSING) {
            this.refreshTimeout = setTimeout(() => {
                this.fetchTask();
            }, 1000);
        }
    }

    componentDidMount() {
        this.populateFormValues({
            developJob: null
        });

        if (!this.state.task) {
            this.fetchTask();
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        return nextProps.taskHash !== this.props.taskHash ||
            this.state.task !== nextState.task ||
            this.state.jobId !== nextState.jobId ||
            this.state.runId !== nextState.runId ||
            this.props.run !== nextProps.run ||
            this.state.activeTab !== nextState.activeTab
    }


    componentWillUnmount() {
        clearTimeout(this.refreshTimeout);
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        if (nextProps.taskHash !== prevState.prevPropsTaskHash) {
            return {
                prevPropsTaskHash: nextProps.taskHash,
                task: null
            };
        }
    }

    componentDidUpdate() {
        if (!this.state.task) {
            this.fetchTask();
        }
    }

    selectTab(tab) {
        this.setState({
            activeTab: tab
        });
    }

    getBuildContent(t) {
        const task = this.state.task;
        let buildContent = null;
        if (!task) {
            buildContent = (
                <div>{t('Loading...')}</div>
            );

        } else {
            switch (task.build_state) {
                case (BuildState.SCHEDULED):
                case (BuildState.PROCESSING):
                    buildContent = (
                        <div>{t('Building task...')}</div>
                    );
                    break;
                case (BuildState.FAILED): {
                    if (task.build_output) {
                        const
                            errors = [];
                        const
                            warnings = [];

                        let
                            idx = 0;
                        if (task.build_output.errors) {
                            for (const error of task.build_output.errors
                                ) {
                                errors.push(<div key={idx}>{error}</div>);
                                idx++;
                            }
                        }

                        if (task.build_output.warnings) {
                            for (const warning of task.build_output.warnings) {
                                warnings.push(<div key={idx}>{warning}</div>);
                                idx++;
                            }
                        }

                        buildContent = (
                            <>
                                {errors.length > 0 &&
                                <div>
                                    <div className={outputStyles.label}>{t('Errors:')}</div>
                                    {errors}
                                </div>
                                }

                                {warnings.length > 0 &&
                                <div>
                                    <div className={outputStyles.label}>{t('Warnings:')}</div>
                                    {warnings}
                                </div>
                                }
                            </>
                        );

                    } else {
                        buildContent = (
                            <div className={outputStyles.label}>{t('Build failed')}</div>
                        );

                    }

                    break;
                }
                case (BuildState.FINISHED): {
                    const
                        warnings = [];
                    let
                        idx = 0;
                    if (task.build_output && task.build_output.warnings && task.build_output.warnings.length > 0) {
                        for (const
                            warning
                            of
                            task.build_output.warnings
                            ) {
                            warnings.push(<div key={idx}>{warning}</div>);
                            idx++;
                        }

                        buildContent = (
                            <div>
                                <div className={outputStyles.label}>{t('Warnings:')}</div>
                                {warnings}
                            </div>
                        )
                    } else {
                        buildContent = (
                            <div className={outputStyles.label}>{t('Build successful')}</div>
                        )
                    }
                    break;
                }
                default:
                    buildContent = (
                        <div className={outputStyles.label}>{t('Task is not build.')}</div>
                    );
                    break;
            }
        }

        return (
            <div className={developStyles.integrationTab}>
                <div className={developStyles.integrationTabContent}>
                    {buildContent}
                </div>
            </div>
        );
    }

    getRunContent(t) {
        let runContent = null;
        const run = this.props.run;
        const jobColumns = [
            {data: 0, title: t('#')},
            {data: 1, title: t('Name')},
            {data: 2, title: t('Description')},
            {data: 4, title: t('Created'), render: data => moment(data).fromNow()},
            {data: 5, title: t('Namespace')}
        ];

        const jobTable =
            <Form stateOwner={this} format="wide" noStatus>
                <TableSelect id="developJob" label={t('Job for testing')} format="wide" withHeader dropdown
                             dataUrl={`rest/jobs-by-task-table/${this.props.taskId}`} columns={jobColumns}
                             selectionLabelIndex={1}/>
            </Form>;

        if (!run) {
            runContent = (
                <div>{t('Not run in this panel yet.')}</div>
            );
        } else {
            switch (run.status) {
                case (RunStatus.INITIALIZATION):
                case (RunStatus.SCHEDULED):
                    runContent = (
                        <div>{t('Loading...')}</div>
                    );
                    break;
                case (RunStatus.RUNNING):
                    runContent = (
                        <div>{t('Running...')}</div>
                    );
                    break;
                case (RunStatus.FAILED):
                case (RunStatus.SUCCESS):
                    if (run.output) {
                        runContent = (
                            <pre><code>{run.output}</code></pre>
                        );
                    }
                    break;
            }

        }

        return (
            <div className={developStyles.integrationTab}>
                <div className={developStyles.integrationTabHeader}>
                    {jobTable}
                </div>
                <div className={developStyles.integrationTabContent}>
                    {runContent}
                </div>
            </div>
        );
    }

    render() {
        const t = this.props.t;
        let buildContent = null;
        let runContent = null;

        buildContent = this.getBuildContent(t);

        runContent = this.getRunContent(t);

        const tabs = [
            {
                id: 'run',
                default: true,
                label: t('Run'),
                getContent: () => runContent
            },
            {
                id: 'build',
                label: t('Build'),
                getContent: () => buildContent
            }
        ];

        let activeTabContent;
        const developTabs = [];
        for (const tabSpec of tabs) {
            const isActive = (!this.state.activeTab && tabSpec.default) || this.state.activeTab === tabSpec.id;

            developTabs.push(
                <li key={tabSpec.id} className={isActive ? 'active' : ''}>
                    <ActionLink className={'nav-link' + (isActive ? ' active' : '')}
                                onClickAsync={() => this.selectTab(tabSpec.id)}>{tabSpec.label}</ActionLink>
                </li>
            );

            if (isActive) {
                activeTabContent = tabSpec.getContent();
            }
        }


        return (
            <>
                <div id="headerPreviewPane" className={developStyles.integrationPaneHeader}>
                    <ul className="nav nav-pills">
                        {developTabs}
                    </ul>
                </div>
                {activeTabContent}
            </>
        );
    }
}
