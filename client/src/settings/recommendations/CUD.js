'use strict';

import React, { Component } from "react";
import PropTypes from "prop-types";
import { translate } from "react-i18next";
import { NavButton, requiresAuthenticatedUser, withPageHelpers } from "../../lib/page";
import {
    Button,
    ButtonRow,
    CheckBox,
    Dropdown,
    Form,
    FormSendMethod,
    InputField,
    TextArea,
    withForm,
    DatePicker,
    TableSelect
} from "../../lib/form";
import { withAsyncErrorHandler, withErrorHandling } from "../../lib/error-handling";
import { NamespaceSelect, validateNamespace } from "../../lib/namespace";
import { DeleteModalDialog } from "../../lib/modals";
import { Panel } from "../../lib/panel";
import ivisConfig from "ivisConfig";
import * as dateMath from "../../lib/datemath";
import moment from "moment";
import styles from "../../ivis-ws/TimeRangeSelector.scss";

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
    }

    static propTypes = {
        action: PropTypes.string.isRequired,
        entity: PropTypes.object
    }
       /*
      ['advisor.name', 'farmer.name', 'farms.name', 'recommendation_types.name', 'recommendations.description', 'recommendations.to_be_happened', 
      'recommendations.quantity', 'recommendations.cost']     
        */
 
    componentDidMount() {
        if (this.props.entity) {
            this.getFormValuesFromEntity(this.props.entity);
        } else {
            this.populateFormValues({
                advisor: ivisConfig.user.id,
                farmer: '',
                farm: '',
                type: '',
                description: 'This recommendation is related to ...',
                to_be_happened: '',
                quantity: 0,
                cost: 0,
                namespace: ivisConfig.user.namespace
            });
        }
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        if (!state.getIn(['farmer', 'value'])) {
            state.setIn(['farmer', 'error'], t('Farmer must not be empty'));
        } else {
            state.setIn(['farmer', 'error'], null);
        }

        if (!state.getIn(['farm', 'value'])) {
            state.setIn(['farm', 'error'], t('Farm must not be empty'));
        } else {
            state.setIn(['farm', 'error'], null);
        }

        if (!state.getIn(['type', 'value'])) {
            state.setIn(['type', 'error'], t('Type must not be empty'));
        } else {
            state.setIn(['type', 'error'], null);
        }

        if (!state.getIn(['to_be_happened', 'value'])) {
            state.setIn(['to_be_happened', 'error'], t('Scheduled for must not be empty'));
        } else {
            state.setIn(['to_be_happened', 'error'], null);
        }
    }

    async submitHandler() {
        const t = this.props.t;

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `/rest/recommendations/${this.props.entity.id}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = '/rest/recommendations'
        }

        this.disableForm();
        this.setFormStatusMessage('info', t('Saving ...'));

        const submitSuccessful = await this.validateAndSendFormValuesToURL(sendMethod, url);
        if (submitSuccessful) {
            this.navigateToWithFlashMessage('/settings/recommendations', 'success', t('recommendation saved'));
        } else {
            this.enableForm();
            this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
        }
    }

    render() {
        const t = this.props.t;
        const isEdit = !!this.props.entity;
        const canDelete = isEdit //&& this.props.entity.permissions.includes('manageFarms');

        /*console.log('farmsTableSelect', this.farmsTableSelect);
        console.log('props', this.props);
        console.log('getFormValue', this.getFormValue);
        console.log('this.getFormValue.farm', this.getFormValue('farm'));*/

        
        //['farms.id', 'farms.name', 'users.name', 'farms.description', 'farms.address', 'farms.created', 'namespaces.name']
        const farmsColumns = [
            { data: 0, title: t('Id') },
            { data: 1, title: t('Farm') },
            { data: 2, title: t('Farmer') },
            { data: 3, title: t('Description') },
            { data: 4, title: t('Address') },
            { data: 5, title: t('Created'), render: data => moment(data).fromNow() },
            { data: 6, title: t('Namespace') }
        ];

        let farmsLabelIndex = 1;
        
        //['users.id', 'users.name', 'users.email',  'farms.name', 'farms.description', 'farms.address', 'farms.created', 'namespaces.name']
        const farmersColumns = [
            { data: 0, title: t('#') },
            { data: 1, title: t('Farmer') },
            { data: 2, title: t('Farmer\'s email') },
            { data: 7, title: t('Farmer\'s Namespace') },
            { data: 3, title: t('Farm') },
            { data: 4, title: t('Description') },
            { data: 5, title: t('Address') },
            { data: 6, title: t('Created'), render: data => moment(data).fromNow() }
        ];

        let farmersLabelIndex = 1;

        const recommendationTypesColumns = [
            { data: 0, title: t('#') },
            { data: 1, title: t('Name') },
            { data: 2, title: t('Description') },
            { data: 3, title: t('Unit') },
            { data: 4, title: t('Namespace') }
        ];
        let recommendationTypesLabelIndex = 1;

        const parseDate = (str, end) => {
            const date = dateMath.parse(str, end);
            if (date && date.isValid()) {
                return date.toDate();
            } else {
                return null;
            }
        };

        return (
            <Panel title={isEdit ? t('Edit Recommendation') : t('Create Recommendation')}>
                {canDelete &&
                    <DeleteModalDialog
                        stateOwner={this}
                        visible={this.props.action === 'delete'}
                        deleteUrl={`/rest/recommendations/${this.props.entity.id}`}
                        cudUrl={`/settings/recommendations/${this.props.entity.id}/edit`}
                        listUrl="/settings/recommendations"
                        deletingMsg={t('Deleting recommendation ...')}
                        deletedMsg={t('recommendation deleted')} />
                }
                    <Form stateOwner={this} onSubmitAsync={::this.submitHandler} >
                        <TableSelect ref={node => this.farmsTableSelect = node} id="farm" label={t('Farm & Farmer')} withHeader dropdown 
                        dataUrl={`/rest/farms-farmers-table/`}
                         columns={farmsColumns} selectionLabelIndex={farmsLabelIndex} />
                        <TableSelect ref={node => this.farmersTableSelect = node} id="farmer" label={t('Farmer & Farm')} withHeader dropdown dataUrl={`/rest/farmers-farms-table/?farm=${this.getFormValue('farm')}`} 
                        columns={farmersColumns} selectionLabelIndex={farmersLabelIndex} />
                        <TableSelect ref={node => this.recommendationTypesTableSelect = node} id="type" label={t('Recommendation Type')} withHeader dropdown dataUrl={`/rest/event-types-table/`} columns={recommendationTypesColumns} selectionLabelIndex={recommendationTypesLabelIndex} />
                        <TextArea id="description" label={t('Description')} help={t('HTML is allowed')} />
                        <DatePicker
                            id="to_be_happened"
                            label={t('Scheduled for:')}
                            formatDate={date => moment.utc(date).format('YYYY-MM-DD') + ' 00:00:00'}
                            parseDate={str => parseDate(str, false)}
                        />
                        <InputField id="quantity" label={t('Quantity')} />
                        <InputField id="cost" label={t('Cost')} />
                        <ButtonRow>
                            <Button type="submit" className="btn-primary" icon="ok" label={t('Save')} />
                            {canDelete && <NavButton className="btn-danger" icon="remove" label={t('Delete')} linkTo={`/settings/recommendations/${this.props.entity.id}/delete`} />}
                        </ButtonRow>
                    </Form>
            </Panel>
        );
    }
}
