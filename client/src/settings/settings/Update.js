'use strict';

import React, {Component} from "react";
import PropTypes from 'prop-types';
import {
    translate
} from 'react-i18next';
import {
    requiresAuthenticatedUser,
    withPageHelpers
} from '../../lib/page';
import {
    Button,
    ButtonRow,
    Form,
    FormSendMethod,
    withForm
} from '../../lib/form';
import {withErrorHandling} from '../../lib/error-handling';
import {Panel} from "../../lib/panel";
import em from '../../lib/extension-manager';

@translate()
@withForm
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class Update extends Component {
    constructor(props) {
        super(props);

        this.state = {};

        this.initForm();
    }

    static propTypes = {
        entity: PropTypes.object
    }

    componentDidMount() {
        this.getFormValuesFromEntity(this.props.entity);
    }

    localValidateFormValues(state) {
        const t = this.props.t;
    }

    async submitHandler() {
        const t = this.props.t;

        this.disableForm();
        this.setFormStatusMessage('info', t('Saving ...'));

        const submitSuccessful = await this.validateAndSendFormValuesToURL(FormSendMethod.PUT, 'rest/settings');

        if (submitSuccessful) {
            await this.getFormValuesFromURL('rest/settings');
            this.enableForm();
            this.setFormStatusMessage('success', t('Global settings saved'));
        } else {
            this.enableForm();
            this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
        }
    }

    render() {
        const t = this.props.t;

        const configSettings = [];
        em.invoke('configSettings.add', configSettings, t);

        return (
            <Panel title={t('Global Settings')}>
                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    {configSettings}
                    <hr/>
                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="ok" label={t('Save')}/>
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}