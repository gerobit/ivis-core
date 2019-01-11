'use strict';

import React, {Component} from 'react';
import {withPageHelpers} from '../lib/page';
import {Link} from 'react-router-dom';
import {Panel} from '../lib/panel';
import {
    Button,
    ButtonRow,
    CheckBox,
    Form,
    FormSendMethod,
    InputField,
    withForm
} from '../lib/form';
import {withErrorHandling} from '../lib/error-handling';
import URL
    from 'url-parse';
import interoperableErrors
    from '../../../shared/interoperable-errors';
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";

@withComponentMixins([
    withTranslation,
    withForm,
    withErrorHandling,
    withPageHelpers
])
export default class Login extends Component {
    constructor(props) {
        super(props);

        this.state = {};

        this.initForm();
    }

    componentDidMount() {
        this.populateFormValues({
            username: '',
            password: '',
            remember: false
        });
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        const username = state.getIn(['username', 'value']);
        if (!username) {
            state.setIn(['username', 'error'], t('User name must not be empty'));
        } else {
            state.setIn(['username', 'error'], null);
        }

        const password = state.getIn(['password', 'value']);
        if (!password) {
            state.setIn(['password', 'error'], t('Password must not be empty'));
        } else {
            state.setIn(['password', 'error'], null);
        }
    }

    async submitHandler() {
        const t = this.props.t;

        try {
            this.disableForm();
            this.setFormStatusMessage('info', t('Verifying credentials ...'));

            const submitSuccessful = await this.validateAndSendFormValuesToURL(FormSendMethod.POST, 'rest/login');

            if (submitSuccessful) {
                const query = new URL(this.props.location.search, true).query;
                const nextUrl = query.next || '/';

                /* FIXME, once we manage loading of authenticated config this should become navigateTo */
                window.location = nextUrl;
            } else {
                this.enableForm();

                this.setFormStatusMessage('warning', t('Please enter your credentials and try again.'));
            }
        } catch (error) {
            if (error instanceof interoperableErrors.IncorrectPasswordError || error instanceof interoperableErrors.PermissionDeniedError) {
                this.enableForm();

                this.setFormStatusMessage('danger',
                    <span>
                        <strong>{t('Invalid username or password.')}</strong>
                    </span>
                );

                return;
            }

            throw error;
        }
    }

    render() {
        const t = this.props.t;

        return (
            <Panel title={t('Sign in')}>
                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="username" label={t('Username')}/>
                    <InputField id="password" label={t('Password')} type="password" />
                    <CheckBox id="remember" text={t('Remember me')}/>

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="check" label={t('Sign in')}/>
                        { /* Password reset does not work at the moment. <Link to={`/login/forgot/${this.getFormValue('username')}`}>{t('Forgot your password?')}</Link> */ }
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}