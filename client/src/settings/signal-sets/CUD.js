'use strict';

import React, {Component} from "react";
import PropTypes
    from "prop-types";
import {
    LinkButton,
    requiresAuthenticatedUser,
    withPageHelpers
} from "../../lib/page";
import {
    Button,
    ButtonRow,
    Form,
    FormSendMethod,
    InputField,
    TextArea,
    withForm
} from "../../lib/form";
import {withErrorHandling} from "../../lib/error-handling";
import {
    NamespaceSelect,
    validateNamespace
} from "../../lib/namespace";
import {DeleteModalDialog} from "../../lib/modals";
import {Panel} from "../../lib/panel";
import ivisConfig
    from "ivisConfig";
import em
    from "../../lib/extension-manager";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";

@withComponentMixins([
    withTranslation,
    withForm,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class CUD extends Component {
    constructor(props) {
        super(props);
        const t = props.t;

        this.state = {};

        this.initForm({
            serverValidation: {
                url: 'rest/signal-sets-validate',
                changed: ['cid'],
                extra: ['id']
            }
        });

        if (!em.get('settings.signalSetsAsSensors', false)) {
            this.labels = {
                'Edit Signal Set': t('Edit Signal Set'),
                'Create Signal Set': t('Create Signal Set'),
                'Deleting signal set ...': t('Deleting signal set ...'),
                'Signal set deleted': t('Signal set deleted'),
                'Another signal set with the same id exists. Please choose another id.': t('Another signal set with the same id exists. Please choose another id.'),
                'Signal set saved': t('Signal set saved')
            };
        } else {
            this.labels = {
                'Edit Signal Set': t('Edit Sensor Node'),
                'Create Signal Set': t('Create Sensor Node'),
                'Deleting signal set ...': t('Deleting sensor node ...'),
                'Signal set deleted': t('Sensor node deleted'),
                'Another signal set with the same id exists. Please choose another id.': t('Another sensor node with the same id exists. Please choose another id.'),
                'Signal set saved': t('Sensor node saved')
            };
        }
    }

    static propTypes = {
        action: PropTypes.string.isRequired,
        entity: PropTypes.object
    }

    componentDidMount() {
        if (this.props.entity) {
            this.getFormValuesFromEntity(this.props.entity);

        } else {
            this.populateFormValues({
                cid: '',
                name: '',
                description: '',
                record_id_template: '',
                namespace: ivisConfig.user.namespace
            });
        }
    }

    localValidateFormValues(state) {
        const t = this.props.t;
        const labels = this.labels;

        if (!state.getIn(['name', 'value'])) {
            state.setIn(['name', 'error'], t('Name must not be empty'));
        } else {
            state.setIn(['name', 'error'], null);
        }

        const cidServerValidation = state.getIn(['cid', 'serverValidation']);
        if (!state.getIn(['cid', 'value'])) {
            state.setIn(['cid', 'error'], t('The id must not be empty.'));
        } else if (!cidServerValidation) {
            state.setIn(['cid', 'error'], t('Validation is in progress...'));
        } else if (cidServerValidation.exists) {
            state.setIn(['cid', 'error'], labels['Another signal set with the same id exists. Please choose another id.']);
        } else {
            state.setIn(['cid', 'error'], null);
        }

        validateNamespace(t, state);
    }

    async submitHandler() {
        const t = this.props.t;
        const labels = this.labels;

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/signal-sets/${this.props.entity.id}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = 'rest/signal-sets'
        }

        this.disableForm();
        this.setFormStatusMessage('info', t('Saving ...'));

        const submitSuccessful = await this.validateAndSendFormValuesToURL(sendMethod, url);

        if (submitSuccessful) {
            this.navigateToWithFlashMessage('/settings/signal-sets', 'success', t('Signal set saved'));
        } else {
            this.enableForm();
            this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
        }
    }

    render() {
        const t = this.props.t;
        const labels = this.labels;
        const isEdit = !!this.props.entity;
        const canDelete =  isEdit && this.props.entity.permissions.includes('delete');

        return (
            <Panel title={isEdit ? labels['Edit Signal Set'] : labels['Create Signal Set']}>
                {canDelete &&
                <DeleteModalDialog
                    stateOwner={this}
                    visible={this.props.action === 'delete'}
                    deleteUrl={`rest/signal-sets/${this.props.entity.id}`}
                    backUrl={`/settings/signal-sets/${this.props.entity.id}/edit`}
                    successUrl="/settings/signal-sets"
                    deletingMsg={labels['Deleting signal set ...']}
                    deletedMsg={labels['Signal set deleted']}/>
                }

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="cid" label={t('Id')}/>
                    <InputField id="name" label={t('Name')}/>
                    <TextArea id="description" label={t('Description')} help={t('HTML is allowed')}/>

                    <InputField id="record_id_template" label={t('Record ID template')} help={t('useHandlebars', {interpolation: {prefix: '[[', suffix: ']]'}})}/>

                    <NamespaceSelect/>

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="check" label={t('Save')}/>
                        { canDelete && <LinkButton className="btn-danger" icon="remove" label={t('Delete')} to={`/settings/signal-sets/${this.props.entity.id}/delete`}/>}
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}
