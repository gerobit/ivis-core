'use strict';

import React, {Component} from 'react';
import {translate} from 'react-i18next';
import {
    requiresAuthenticatedUser,
    withPageHelpers
} from '../lib/page'
import {
    withAsyncErrorHandler,
    withErrorHandling
} from '../lib/error-handling';
import axios
    from '../lib/axios';
import {Button} from '../lib/bootstrap-components';
import {getUrl} from "../lib/urls";
import {Panel} from "../lib/panel";

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class API extends Component {
    constructor(props) {
        super(props);

        this.state = {
            accessToken: null
        };
    }

    @withAsyncErrorHandler
    async loadAccessToken() {
        const response = await axios.get(getUrl('rest/access-token'));
        this.setState({
            accessToken: response.data
        });
    }

    componentDidMount() {
        // noinspection JSIgnoredPromiseFromCall
        this.loadAccessToken();
    }

    async resetAccessToken() {
        const response = await axios.post(getUrl('rest/access-token-reset'));
        this.setState({
            accessToken: response.data
        });
    }

    render() {
        const t = this.props.t;

        const accessToken = this.state.accessToken || 'ACCESS_TOKEN';

        let accessTokenMsg;
        if (this.state.accessToken) {
            accessTokenMsg = <div>{t('Personal access token') + ': '}<code>{accessToken}</code></div>;
        } else {
            accessTokenMsg = <div>{t('Access token not yet generated')}</div>;
        }

        return (
            <Panel title={t('API')}>
                <div className="pull-right">
                    <Button label={this.state.accessToken ? t('Reset Access Token') : t('Generate Access Token')} icon="retweet" className="btn-info" onClickAsync={::this.resetAccessToken} />
                </div>
                {accessTokenMsg}

            </Panel>
        );
    }
}
