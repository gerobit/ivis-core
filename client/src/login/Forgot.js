'use strict';

import React, {Component} from 'react';
import {withPageHelpers} from '../lib/page';
import {
    Button,
    ButtonRow,
    Form,
    FormSendMethod,
    InputField,
    withForm
} from '../lib/form';
import {Panel} from '../lib/panel';
import {withErrorHandling} from '../lib/error-handling';
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";

@withComponentMixins([
    withTranslation,
    withForm,
    withErrorHandling,
    withPageHelpers
])
export default class Forget extends Component {
    constructor(props) {
        super(props);

        this.state = {};

        this.initForm();
    }

    componentDidMount() {
        this.populateFormValues({
            usernameOrEmail: this.props.match.params.username || ''
        });
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        const username = state.getIn(['usernameOrEmail', 'value']);
        if (!username) {
            state.setIn(['usernameOrEmail', 'error'], t('Username or email must not be empty'));
        } else {
            state.setIn(['usernameOrEmail', 'error'], null);
        }
    }

    async submitHandler() {
        const t = this.props.t;

        this.disableForm();
        this.setFormStatusMessage('info', t('Processing ...'));

        const submitSuccessful = await this.validateAndSendFormValuesToURL(FormSendMethod.POST, 'rest/password-reset-send');

        if (submitSuccessful) {
            this.navigateToWithFlashMessage('/login', 'success', t('If the username / email exists in the system, password reset link will be sent to the registered email.'));
        } else {
            this.enableForm();
            this.setFormStatusMessage('warning', t('Please enter your username / email and try again.'));
        }
    }

    render() {
        const t = this.props.t;

        return (
            <Panel title={t('Password Reset')}>
                <p>{t('Please provide the username or email address that is registered with your account.')}</p>

                <p>{t('We will send you an email that will allow you to reset your password.')}</p>

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="usernameOrEmail" label={t('Username or email')}/>

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="check" label={t('Send email')}/>
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}
