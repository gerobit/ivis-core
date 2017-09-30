'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {translate} from "react-i18next";
import {requiresAuthenticatedUser, withPageHelpers} from "../../lib/page";
import {withAsyncErrorHandler, withErrorHandling} from "../../lib/error-handling";
import axios from "../../lib/axios";
import ivisConfig from "ivisConfig";
import styles from "../../lib/styles.scss";

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class WorkspacePanel extends Component {
    constructor(props) {
        super(props);

        this.accessToken = props.initialAccessToken;
        this.refreshAccessTokenTimeout = null;

        this.state = {
            hasAccessToken: !!this.accessToken,
            panel: props.panel
        };

        this.receiveMessageHandler = ::this.receiveMessage;
    }

    static propTypes = {
        panel: PropTypes.object,
        panelId: PropTypes.number,
        initialAccessToken: PropTypes.string
    }

    isInitialized() {
        return this.state.hasAccessToken && this.state.panel;
    }

    getPanelId() {
        return this.props.panelId || this.props.panel.id;
    }

    receiveMessage(evt) {
        const msg = evt.data;
        console.log(msg);

        if (msg.type === 'initNeeded') {
            if (this.isInitialized()) {
                this.sendMessage('init', {
                    accessToken: this.accessToken,
                    panel: this.state.panel
                });
            }
        }
    }

    sendMessage(type, data) {
        this.contentNode.contentWindow.postMessage({type, data}, ivisConfig.serverUrlUntrusted);
    }

    @withAsyncErrorHandler
    async refreshAccessToken() {
        const panelId = this.getPanelId();
        const result = await axios.get(`/rest/panel-token/${panelId}`);

        if (panelId === this.getPanelId()) {
            this.accessToken = result.data;

            if (!this.state.hasAccessToken) {
                this.setState({
                    hasAccessToken: true
                })
            }

            this.sendMessage('accessToken', this.accessToken);
        }
    }

    @withAsyncErrorHandler
    async fetchPanel() {
        const panelId = this.getPanelId();
        const result = await axios.get(`/rest/panels/${panelId}`);

        if (panelId === this.getPanelId()) {
            this.setState({
                panel: result.data
            });
        }
    }

    scheduleRefreshAccessToken() {
        this.refreshAccessTokenTimeout = setTimeout(() => {
            this.refreshAccessToken();
            this.scheduleRefreshAccessToken();
        }, 60 * 1000);
    }

    handleUpdate() {
        if (this.isInitialized()) {
            this.sendMessage('initAvailable');
        }

        if (!this.state.panel) {
            this.fetchPanel();
        }

        if (!this.state.hasAccessToken) {
            this.refreshAccessToken();
        }
    }

    componentDidMount() {
        this.scheduleRefreshAccessToken();
        window.addEventListener('message', this.receiveMessageHandler, false);

        this.handleUpdate();
    }

    componentDidUpdate() {
        this.handleUpdate();
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.panelId && this.props.panelId !== nextProps.panelId) {
            this.setState({
                panel: null,
                hasAccessToken: false
            });

        } else if (nextProps.panel && this.props.panel !== nextProps.panel) {
            this.setState({
                panel: nextProps.panel,
                hasAccessToken: false
            });
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        return nextProps.panelId !== this.props.panelId || nextProps.panel !== this.props.panel ||
            nextState.panel !== this.state.panel || nextState.hasAccessToken !== this.state.hasAccessToken
    }

    componentWillUnmount() {
        clearTimeout(this.refreshAccessTokenTimeout);
        window.removeEventListener('message', this.receiveMessageHandler, false);
    }

    render() {
        const t = this.props.t;
        const panel = this.props.panel;

        return (
            <iframe key={this.getPanelId()} className={styles.panelUntrustedContent} ref={node => this.contentNode = node} src={`${ivisConfig.serverUrlUntrusted}/panel`}></iframe>
        );
    }
}