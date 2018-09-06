'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {translate} from "react-i18next";
import {NavButton, requiresAuthenticatedUser, withPageHelpers} from "../../lib/page";
import {Button, ButtonRow, Form, FormSendMethod, InputField, TextArea, TreeTableSelect, withForm} from "../../lib/form";
import axios from "../../lib/axios";
import {withAsyncErrorHandler, withErrorHandling} from "../../lib/error-handling";
import interoperableErrors from "../../../../shared/interoperable-errors";
import {DeleteModalDialog} from "../../lib/modals";
import {Panel} from "../../lib/panel";
import ivisConfig from "ivisConfig";
import {getUrl} from "../../lib/urls";
import {getGlobalNamespaceId} from "../../../../shared/namespaces";

@translate()
@withForm
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class CUD extends Component {
    constructor(props) {
        super(props);

        this.state = {};

        this.initForm();
        this.hasChildren = false;
    }

    static propTypes = {
        action: PropTypes.string.isRequired,
        entity: PropTypes.object
    }

    isEditGlobal() {
        return this.props.entity && this.props.entity.id === getGlobalNamespaceId();
    }

    isDelete() {
        return this.props.match.params.action === 'delete';
    }

    removeNsIdSubtree(data) {
        for (let idx = 0; idx < data.length; idx++) {
            const entry = data[idx];

            if (entry.key === this.props.entity.id) {
                if (entry.children.length > 0) {
                    this.hasChildren = true;
                }

                data.splice(idx, 1);
                return true;
            }

            if (this.removeNsIdSubtree(entry.children)) {
                return true;
            }
        }
    }

    @withAsyncErrorHandler
    async loadTreeData() {
        axios.get(getUrl('rest/namespaces-tree'))
            .then(response => {

                const data = response.data;
                for (const root of data) {
                    root.expanded = true;
                }

                if (this.props.entity && !this.isEditGlobal()) {
                    this.removeNsIdSubtree(data);
                }

                this.setState({
                    treeData: data
                });
            });
    }

    componentDidMount() {
        if (this.props.entity) {
            this.getFormValuesFromEntity(this.props.entity);
        } else {
            this.populateFormValues({
                name: '',
                description: '',
                namespace: ivisConfig.user.namespace
            });
        }

        if (!this.isEditGlobal()) {
            this.loadTreeData();
        }
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        if (!state.getIn(['name', 'value']).trim()) {
            state.setIn(['name', 'error'], t('Name must not be empty'));
        } else {
            state.setIn(['name', 'error'], null);
        }

        if (!this.isEditGlobal()) {
            if (!state.getIn(['namespace', 'value'])) {
                state.setIn(['namespace', 'error'], t('Parent Namespace must be selected'));
            } else {
                state.setIn(['namespace', 'error'], null);
            }
        }
    }

    async submitHandler() {
        const t = this.props.t;

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/namespaces/${this.props.entity.id}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = 'rest/namespaces'
        }

        try {
            this.disableForm();
            this.setFormStatusMessage('info', t('Saving ...'));

            const submitSuccessful = await this.validateAndSendFormValuesToURL(sendMethod, url);

            if (submitSuccessful) {
                this.navigateToWithFlashMessage('/settings/namespaces', 'success', t('Namespace saved'));
            } else {
                this.enableForm();
                this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
            }

        } catch (error) {
            if (error instanceof interoperableErrors.LoopDetectedError) {
                this.setFormStatusMessage('danger',
                    <span>
                        <strong>{t('Your updates cannot be saved.')}</strong>{' '}
                        {t('There has been a loop detected in the assignment of the parent namespace. This is most likely because someone else has changed the parent of some namespace in the meantime. Refresh your page to start anew. Please note that your changes will be lost.')}
                    </span>
                );
                return;
            }

            if (error instanceof interoperableErrors.DependencyNotFoundError) {
                this.setFormStatusMessage('danger',
                    <span>
                        <strong>{t('Your updates cannot be saved.')}</strong>{' '}
                        {t('It seems that the parent namespace has been deleted in the meantime. Refresh your page to start anew. Please note that your changes will be lost.')}
                    </span>
                );
                return;
            }

            throw error;
        }
    }

    async onDeleteError(error) {
        if (error instanceof interoperableErrors.ChildDetectedError) {
            this.disableForm();
            this.setFormStatusMessage('danger',
                <span>
                    <strong>{t('The namespace cannot be deleted.')}</strong>{' '}
                    {t('There has been a child namespace found. This is most likely because someone else has changed the parent of some namespace in the meantime. Refresh your page to start anew with fresh data.')}
                </span>
            );
            return;
        }

        throw error;
    }

    render() {
        const t = this.props.t;
        const isEdit = !!this.props.entity;
        const canDelete =  isEdit && !this.isEditGlobal() && !this.hasChildren && this.props.entity.permissions.includes('delete');

        return (
            <Panel title={isEdit ? t('Edit Namespace') : t('Create Namespace')}>
                {canDelete &&
                    <DeleteModalDialog
                        stateOwner={this}
                        visible={this.props.action === 'delete'}
                        deleteUrl={`rest/namespaces/${this.props.entity.id}`}
                        cudUrl={`/settings/namespaces/${this.props.entity.id}/edit`}
                        listUrl="/settings/namespaces"
                        deletingMsg={t('Deleting namespace ...')}
                        deletedMsg={t('Namespace deleted')}
                        onErrorAsync={::this.onDeleteError}/>
                }

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="name" label={t('Name')}/>
                    <TextArea id="description" label={t('Description')}/>

                    {!this.isEditGlobal() &&
                    <TreeTableSelect id="namespace" label={t('Parent Namespace')} data={this.state.treeData}/>}

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="ok" label={t('Save')}/>
                        {canDelete && <NavButton className="btn-danger" icon="remove" label={t('Delete')} linkTo={`/settings/namespaces/${this.props.entity.id}/delete`}/>}
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}
