'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {translate} from "react-i18next";
import {Form, TableSelect, withForm} from "../../lib/form";
import {requiresAuthenticatedUser, withPageHelpers} from "../../lib/page";
import {withAsyncErrorHandler, withErrorHandling} from "../../lib/error-handling";
import Ansi from "ansi-to-react";
import outputStyles from "./Output.scss";
import developStyles from "./Develop.scss";
import axios from "../../lib/axios";
import {BuildState} from "../../../../shared/build";
import moment from "moment";
import WorkspacePanelContent from "../../workspaces/panels/WorkspacePanelContent";
import {getUrl} from "../../lib/urls";

@translate()
@withForm
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class Preview extends Component {
    constructor(props) {
        super(props);

        this.state = {};
        this.refreshTimeout = null;

        this.initForm();
    }

    static propTypes = {
        templateId: PropTypes.number,
        templateHash: PropTypes.number
    }

    @withAsyncErrorHandler
    async fetchTemplate() {
        const result = await axios.get(getUrl(`rest/templates/${this.props.templateId}`));

        const template = result.data;

        this.setState({
            template
        });

        if (template.state === BuildState.SCHEDULED || template.state === BuildState.PROCESSING) {
            this.refreshTimeout = setTimeout(() => {
                this.fetchTemplate();
            }, 1 * 1000);
        }
    }

    componentDidMount() {
        this.populateFormValues({
            previewPanel: null
        });
    }

    shouldComponentUpdate(nextProps, nextState) {
        return nextProps.templateHash !== this.props.templateHash ||
            this.state.template !== nextState.template ||
            this.state.formState !== nextState.formState
    }

    componentWillUnmount() {
        clearTimeout(this.refreshTimeout);
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.templateHash !== nextProps.templateHash) {
            this.setState({
                template: null
            });
        }
    }

    componentDidUpdate() {
        if (!this.state.template) {
            this.fetchTemplate();
        }
    }

    render() {
        const t = this.props.t;
        const template = this.state.template;
        let result = null;

        if (!template) {
            result = (
              <div>{t('Loading...')}</div>
            );

        } else if (template.state === BuildState.SCHEDULED || template.state === BuildState.PROCESSING) {
            result = (
                <div>{t('Building template...')}</div>
            );

        } else if (template.state === BuildState.FAILED && template.output) {
            const errors = [];
            const warnings = [];

            let idx = 0;
            for (const error of template.output.errors) {
                errors.push(<div key={idx}><Ansi>{error}</Ansi></div>)
                idx++;
            }

            for (const warning of template.output.warnings) {
                warnings.push(<div key={idx}><Ansi>{warning}</Ansi></div>)
                idx++;
            }

            result = (
                <div>
                    {errors.length > 0 &&
                    <div>
                        <div
                            className={outputStyles.label}>{t('Errors:')}</div>
                        {errors}
                    </div>
                    }

                    {warnings.length > 0 &&
                        <div>
                            <div className={outputStyles.label}>{t('Warnings:')}</div>
                            {warnings}
                        </div>
                    }
                </div>
            );

        } else if (template.state === BuildState.FAILED && !template.output) {
            result = (
                <div className={outputStyles.label}>{t('Build failed')}</div>
            );

        } else if (template.state === BuildState.FINISHED) {
            const previewPanel = this.getFormValue('previewPanel');

            if (previewPanel) {
                result = (
                    <div className={developStyles.previewPaneContent}>
                        <WorkspacePanelContent key={this.props.templateHash} panelId={previewPanel}/>
                    </div>
                )
            } else {
                result = (
                    <div className={outputStyles.label}>{t('Build successful')}</div>
                )
            }
        }

        const panelColumns = [
            {data: 1, title: t('#')},
            {data: 2, title: t('Name')},
            {data: 3, title: t('Description')},
            {data: 5, title: t('Created'), render: data => moment(data).fromNow()},
            {data: 6, title: t('Namespace')}
        ];

        return (
            <div>
                <Form stateOwner={this} format="wide" noStatus>
                    <div className={developStyles.previewPaneHeader}>
                        <TableSelect id="previewPanel" label={t('Panel for Preview')} format="wide" withHeader dropdown dataUrl={`rest/panels-by-template-table/${this.props.templateId}`} columns={panelColumns} selectionLabelIndex={2}/>
                    </div>
                </Form>
                {result}
            </div>
        );
    }
}
