'use strict';

import React, {Component} from "react";
import PropTypes
    from "prop-types";
import {
    requiresAuthenticatedUser,
    withPageHelpers
} from "../../lib/page";
import {
    withAsyncErrorHandler,
    withErrorHandling
} from "../../lib/error-handling";
import axios
    from "../../lib/axios";
import styles
    from "../../lib/styles.scss";
import {UntrustedContentHost} from "../../lib/untrusted";
import {getUrl} from "../../lib/urls";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
], ['onPanelMenuAction'])
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
        disablePageActions: PropTypes.bool,
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

    componentDidMount() {
        if (!this.state.panel) {
            this.fetchPanel();
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.panelId && this.props.panelId !== prevProps.panelId) {
            this.setState({
                panel: null
            });

            this.fetchPanel();

        } else if (this.props.panel && this.props.panel !== prevProps.panel) {
            this.setState({
                panel: this.props.panel
            });
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        return nextProps.panelId !== this.props.panelId || nextProps.panel !== this.props.panel ||
            nextState.panel !== this.state.panel
    }

    async onMethodAsync(method, params) {
        if (!this.props.disablePageActions) {
            if (method === 'setPanelMenu') {
                await this.props.setPanelMenu(params);
            } else if (method === 'setFlashMessage') {
                this.setFlashMessage(params.severity, params.text);
            } else if (method === 'navigateTo') {
                this.navigateTo(params.path);
            } else if (method === 'navigateBack') {
                this.navigateBack();
            } else if (method === 'navigateToWithFlashMessage') {
                this.navigateToWithFlashMessage(params.path, params.severity, params.text);
            }
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