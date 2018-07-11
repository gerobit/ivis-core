'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {translate} from "react-i18next";
import {requiresAuthenticatedUser, withPageHelpers} from "../../lib/page";
import {withAsyncErrorHandler, withErrorHandling} from "../../lib/error-handling";
import axios from "../../lib/axios";
import styles from "../../lib/styles.scss";
import {UntrustedContentHost} from "../../lib/untrusted";
import {getUrl} from "../../lib/urls";

@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class WorkspacePanelContent extends Component {
    constructor(props) {
        super(props);

        this.state = {
            panel: props.panel
        };
    }

    static propTypes = {
        panel: PropTypes.object,
        setPanelMenu: PropTypes.func,
        panelId: PropTypes.number // panelId is used from Preview.js
    }

    getPanelId() {
        return this.props.panelId || this.props.panel.id;
    }

    @withAsyncErrorHandler
    async fetchPanel() {
        const panelId = this.getPanelId();
        const result = await axios.get(getUrl(`rest/panels/${panelId}`));

        if (panelId === this.getPanelId()) {
            this.setState({
                panel: result.data
            });
        }
    }

    handleUpdate() {
        if (!this.state.panel) {
            this.fetchPanel();
        }
    }

    componentDidMount() {
        this.handleUpdate();
    }

    componentDidUpdate() {
        this.handleUpdate();
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.panelId && this.props.panelId !== nextProps.panelId) {
            this.setState({
                panel: null
            });

        } else if (nextProps.panel && this.props.panel !== nextProps.panel) {
            this.setState({
                panel: nextProps.panel
            });
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        return nextProps.panelId !== this.props.panelId || nextProps.panel !== this.props.panel ||
            nextState.panel !== this.state.panel
    }

    async onMethodAsync(method, params) {
        if (method === 'setPanelMenu') {
            await this.props.setPanelMenu(params);
        }
    }

    onPanelMenuAction(action) {
        this.contentNode.ask('panelMenuAction', {
            action
        });
    }

    render() {
        const panelMethodData = {
            panelId: this.getPanelId()
        };

        let panelProps = null;

        if (this.state.panel) {
            panelProps = {
                panel: this.state.panel
            };
        }

        return (
            <UntrustedContentHost
                ref={node => this.contentNode = node}
                className={styles.panelUntrustedContent}
                contentProps={panelProps}
                contentSrc="panel"
                tokenMethod="panel"
                tokenParams={panelMethodData}
                onMethodAsync={::this.onMethodAsync}
            />
        );
    }
}