'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {translate} from "react-i18next";
import {NavButton, requiresAuthenticatedUser, withPageHelpers} from "../../lib/page";
import {
    Button,
    ButtonRow,
    CheckBox,
    Dropdown,
    Form,
    FormSendMethod,
    InputField,
    TextArea,
    withForm
} from "../../lib/form";
import {withAsyncErrorHandler, withErrorHandling} from "../../lib/error-handling";
import {NamespaceSelect, validateNamespace} from "../../lib/namespace";
import {DeleteModalDialog} from "../../lib/modals";
import {Panel} from "../../lib/panel";
import ivisConfig from "ivisConfig";

@translate()
@withForm
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class CUD extends Component {
    constructor(props) {
        super(props);

        this.state = {};

        this.initForm({
            serverValidation: {
                url: '/rest/signal-sets-validate',
                changed: ['cid'],
                extra: ['id']
            }
        });
    }

    static propTypes = {
        action: PropTypes.string.isRequired,
        entity: PropTypes.object
    }

    componentDidMount() {
        if (this.props.entity) {
            this.getFormValuesFromEntity(this.props.entity, data => {
                data.aggs = data.aggs ? '1' : '0'
            });

        } else {
            this.populateFormValues({
                cid: '',
                name: '',
                update_period: '',
                description: '',
                aggs: '0',
                lat: '',
                lng: '',
                namespace: ivisConfig.user.namespace
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

        const cidServerValidation = state.getIn(['cid', 'serverValidation']);
        if (!state.getIn(['cid', 'value'])) {
            state.setIn(['cid', 'error'], t('Signal set id must not be empty.'));
        } else if (!cidServerValidation) {
            state.setIn(['cid', 'error'], t('Validation is in progress...'));
        } else if (cidServerValidation.exists) {
            state.setIn(['cid', 'error'], t('Another signal set with the same id exists. Please choose another signal set id.'));
        } else {
            state.setIn(['cid', 'error'], null);
        }

        validateNamespace(t, state);
    }

    async submitHandler() {
        const t = this.props.t;

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `/rest/signal-sets/${this.props.entity.id}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = '/rest/signal-sets'
        }

        this.disableForm();
        this.setFormStatusMessage('info', t('Saving ...'));

        const submitSuccessful = await this.validateAndSendFormValuesToURL(sendMethod, url, data => {
            data.aggs = data.aggs == '1'
        });

        if (submitSuccessful) {
            this.navigateToWithFlashMessage('/settings/signal-sets', 'success', t('Signal set saved'));
        } else {
            this.enableForm();
            this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
        }
    }

    render() {
        const t = this.props.t;
        const isEdit = !!this.props.entity;
        const canDelete =  isEdit && this.props.entity.permissions.includes('delete');

        const typeOptions = [
            { key: '0', label: t('Values') },
            { key: '1', label: t('Aggregations') }
        ];

        return (
            <Panel title={isEdit ? t('Edit Signal Set') : t('Create Signal Set')}>
                {canDelete &&
                <DeleteModalDialog
                    stateOwner={this}
                    visible={this.props.action === 'delete'}
                    deleteUrl={`/rest/signal-sets/${this.props.entity.id}`}
                    cudUrl={`/settings/signal-sets/${this.props.entity.id}/edit`}
                    listUrl="/settings/signal-sets"
                    deletingMsg={t('Deleting signal set ...')}
                    deletedMsg={t('Signal set deleted')}/>
                }

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="cid" label={t('Id')}/>
                    <InputField id="name" label={t('Name')}/>
                    <InputField id="update_period" label={t('Update Period (minute)')}/>
                    <InputField id="lat" label={t('Latitude')}/>
                    <InputField id="lng" label={t('Longitude')}/>
                    <TextArea id="description" label={t('Description')} help={t('HTML is allowed')}/>
                    <Dropdown id="aggs" label={t('Type')} options={typeOptions}/>

                    <NamespaceSelect/>

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="ok" label={t('Save')}/>
                        { canDelete && <NavButton className="btn-danger" icon="remove" label={t('Delete')} linkTo={`/settings/signal-sets/${this.props.entity.id}/delete`}/>}
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}
