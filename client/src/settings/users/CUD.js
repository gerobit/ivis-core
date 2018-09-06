'use strict';

import React, {Component} from "react";
import PropTypes from 'prop-types';
import {translate} from "react-i18next";
import {NavButton, withPageHelpers} from "../../lib/page";
import {Panel} from "../../lib/panel";
import {
    Button,
    ButtonRow,
    Form,
    FormSendMethod,
    InputField,
    TableSelect,
    TextArea,
    withForm
} from "../../lib/form";
import {withErrorHandling} from "../../lib/error-handling";
import interoperableErrors from "../../../../shared/interoperable-errors";
import passwordValidator from "../../../../shared/password-validator";
import validators from "../../../../shared/validators";
import {NamespaceSelect} from "../../lib/namespace";
import {DeleteModalDialog} from "../../lib/modals";

@translate()
@withForm
@withPageHelpers
@withErrorHandling
export default class CUD extends Component {
    constructor(props) {
        super(props);

        this.passwordValidator = passwordValidator(props.t);

        this.state = {};

        this.initForm({
            serverValidation: {
                url: 'rest/users-validate',
                changed: ['username', 'email'],
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
                data.password = '';
                data.password2 = '';
            });
        } else {
            this.populateFormValues({
                username: '',
                name: '',
                email: '',
                phone_cell: '',
                address: '',
                password: '',
                password2: '',
                namespace: ivisConfig.user.namespace
            });
        }
    }

    localValidateFormValues(state) {
        const t = this.props.t;
        const isEdit = !!this.props.entity;

        const username = state.getIn(['username', 'value']);
        const usernameServerValidation = state.getIn(['username', 'serverValidation']);

        if (!username) {
            state.setIn(['username', 'error'], t('User name must not be empty'));
        } else if (!validators.usernameValid(username)) {
            state.setIn(['username', 'error'], t('User name may contain only the following characters: A-Z, a-z, 0-9, "_", "-", "." and may start only with A-Z, a-z, 0-9.'));
        } else if (usernameServerValidation && usernameServerValidation.exists) {
            state.setIn(['username', 'error'], t('The user name already exists in the system.'));
        } else if (!usernameServerValidation) {
            state.setIn(['email', 'error'], t('Validation is in progress...'));
        } else {
            state.setIn(['username', 'error'], null);
        }


        const email = state.getIn(['email', 'value']);
        const emailServerValidation = state.getIn(['email', 'serverValidation']);

        if (!email) {
            state.setIn(['email', 'error'], t('Email must not be empty'));
        } else if (emailServerValidation && emailServerValidation.invalid) {
            state.setIn(['email', 'error'], t('Invalid email address.'));
        } else if (!emailServerValidation) {
            state.setIn(['email', 'error'], t('Validation is in progress...'));
        } else {
            state.setIn(['email', 'error'], null);
        }


        const name = state.getIn(['name', 'value']);

        if (!name) {
            state.setIn(['name', 'error'], t('Full name must not be empty'));
        } else {
            state.setIn(['name', 'error'], null);
        }


        const password = state.getIn(['password', 'value']) || '';
        const password2 = state.getIn(['password2', 'value']) || '';

        const passwordResults = this.passwordValidator.test(password);

        let passwordMsgs = [];

        if (!isEdit && !password) {
            passwordMsgs.push(t('Password must not be empty'));
        }

        if (password) {
            passwordMsgs.push(...passwordResults.errors);
        }

        if (passwordMsgs.length > 1) {
           passwordMsgs = passwordMsgs.map((msg, idx) => <div key={idx}>{msg}</div>)
        }

        state.setIn(['password', 'error'], passwordMsgs.length > 0 ? passwordMsgs : null);
        state.setIn(['password2', 'error'], password !== password2 ? t('Passwords must match') : null);
    }

    async submitHandler() {
        const t = this.props.t;

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/users/${this.props.entity.id}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = 'rest/users'
        }

        try {
            this.disableForm();
            this.setFormStatusMessage('info', t('Saving user ...'));

            const submitSuccessful = await this.validateAndSendFormValuesToURL(sendMethod, url, data => {
                delete data.password2;
            });

            if (submitSuccessful) {
                this.navigateToWithFlashMessage('/settings/users', 'success', t('User saved'));
            } else {
                this.enableForm();
                this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
            }
        } catch (error) {
            this.enableForm();

            if (error instanceof interoperableErrors.DuplicitNameError) {
                this.setFormStatusMessage('danger',
                    <span>
                        <strong>{t('Your updates cannot be saved.')}</strong>{' '}
                        {t('The username is already assigned to another user.')}
                    </span>
                );
                return;
            }

            if (error instanceof interoperableErrors.DuplicitEmailError) {
                this.setFormStatusMessage('danger',
                    <span>
                        <strong>{t('Your updates cannot be saved.')}</strong>{' '}
                        {t('The email is already assigned to another user.')}
                    </span>
                );
                return;
            }

            throw error;
        }
    }

    render() {
        const t = this.props.t;
        const isEdit = !!this.props.entity;
        const userId = this.getFormValue('id');
        const canDelete = userId !== 1 && ivisConfig.user.id !== userId;

        const rolesColumns = [
            { data: 1, title: t('Name') },
            { data: 2, title: t('Description') },
        ];

        return (
            <Panel title={isEdit ? t('Edit User') : t('Create User')}>
                {isEdit && canDelete &&
                    <DeleteModalDialog
                        stateOwner={this}
                        visible={this.props.action === 'delete'}
                        deleteUrl={`rest/users/${this.props.entity.id}`}
                        cudUrl={`/settings/users/${this.props.entity.id}/edit`}
                        listUrl="/settings/users"
                        deletingMsg={t('Deleting user ...')}
                        deletedMsg={t('User deleted')}/>
                }

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="username" label={t('User Name')}/>
                    <InputField id="name" label={t('Full Name')}/>
                    <InputField id="email" label={t('Email')}/>
                    <InputField id="phone_cell" label={t('Cell')}/>
                    <TextArea id="address" label={t('Address')}/>

                    <InputField id="password" label={t('Password')} type="password" />
                    <InputField id="password2" label={t('Repeat Password')} type="password" />

                    <TableSelect id="role" label={t('Role')} withHeader dropdown dataUrl={'rest/shares-roles-table/global'} columns={rolesColumns} selectionLabelIndex={1}/>
                    <NamespaceSelect/>

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="ok" label={t('Save')}/>
                        {isEdit && canDelete && <NavButton className="btn-danger" icon="remove" label={t('Delete User')} linkTo={`/settings/users/${this.props.entity.id}/delete`}/>}
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}
