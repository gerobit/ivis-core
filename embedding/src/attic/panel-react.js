'use strict';

import './lib/public-path';

import React, {Component} from "react";
import ReactDOM from 'react-dom';
import PropTypes from "prop-types";

import axios from "./lib/axios";
import {getSandboxUrl} from "./lib/urls";


export class Panel extends Component {
    constructor(props) {
        super(props);

        this.refreshAccessTokenTimeout = null;
        this.contentNodeIsLoaded = false;

        this.state = {
            panel: props.panel
        };

        this.receiveMessageHandler = ::this.receiveMessage;
    }

    static propTypes = {
        panelId: PropTypes.number,
        accessToken: PropTypes.string
    }

    async receiveMessage(evt) {
        const msg = evt.data;

        if (msg.type === 'initNeeded') {
            if (this.state.panel) {
                const contentProps = {
                    panel: this.state.panel
                };

                this.sendMessage('init', {
                    accessToken: this.props.accessToken,
                    contentProps
                });
            }

        } else if (msg.type === 'clientHeight') {
            this.contentNode.height = msg.data;
        }
    }

    sendMessage(type, data) {
        if (this.contentNodeIsLoaded) { // This is to avoid errors "common.js:45744 Failed to execute 'postMessage' on 'DOMWindow': The target origin provided ('http://localhost:8081') does not match the recipient window's origin ('http://localhost:3000')"
            this.contentNode.contentWindow.postMessage({type, data}, getSandboxUrl());
        }
    }

    @withAsyncErrorHandler
    async refreshAccessToken() {
        await axios.put(getSandboxUrl('rest/embedded-panel-renew-restricted-access-token', this.props.accessToken), {
            token: this.props.accessToken
        });
    }

    scheduleRefreshAccessToken() {
        this.refreshAccessTokenTimeout = setTimeout(() => {
            // noinspection JSIgnoredPromiseFromCall
            this.refreshAccessToken();
            this.scheduleRefreshAccessToken();
        }, 60 * 1000);
    }

    async fetchPanel() {
        const panelId = this.getPanelId();
        const result = await axios.get(getSandboxUrl(`rest/panels/${panelId}`, this.props.accessToken));

        if (panelId === this.getPanelId()) {
            this.setState({
                panel: result.data
            });
        }
    }

    handleUpdate() {
        if (!this.state.panel) {
            // noinspection JSIgnoredPromiseFromCall
            this.fetchPanel();
        } else {
            this.sendMessage('initAvailable');
        }

        // noinspection JSIgnoredPromiseFromCall
        this.refreshAccessToken();
    }

    componentDidMount() {
        this.scheduleRefreshAccessToken();
        window.addEventListener('message', this.receiveMessageHandler, false);

        this.handleUpdate();
    }

    componentDidUpdate() {
        this.handleUpdate();
    }

    componentWillUnmount() {
        clearTimeout(this.refreshAccessTokenTimeout);
        window.removeEventListener('message', this.receiveMessageHandler, false);
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.panelId && this.props.panelId !== nextProps.panelId) {
            this.setState({
                panel: null
            });
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        return nextProps.panelId !== this.props.panelId || nextState.panel !== this.state.panel;
    }

    contentNodeLoaded() {
        this.contentNodeIsLoaded = true;
    }

    render() {
        const style = {
            border: "0px none",
            width: "100%",
            overflow: "hidden"
        };

        return (
            <iframe style={style} ref={node => this.contentNode = node} src={getSandboxUrl('panel')} onLoad={::this.contentNodeLoaded}> </iframe>
        );
    }
}


export async function renderPanel(domElementId, panelId, accessToken) {
    return ReactDOM.render(
        <div>
            <Content panelId={panelId} accessToken={accessToken}/>
        </div>,
        document.getElementById(domElementId)
    );
}
