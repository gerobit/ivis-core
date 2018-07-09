'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {Panel} from "../../lib/panel";
import {requiresAuthenticatedUser} from "../../lib/page";
import WorkspacePanelContent from "./WorkspacePanelContent";
import styles from "../../lib/styles.scss";

@requiresAuthenticatedUser
export default class WorkspacePanel extends Component {
    constructor(props) {
        super(props);

        this.state = {
            panelMenu: []
        };
    }

    static propTypes = {
        panel: PropTypes.object
    }

    async setPanelMenu(menu) {
        this.setState({
            panelMenu: menu
        });
    }

    render() {
        const panel = this.props.panel;

        return (
            <Panel title={this.props.panel.name} panelMenu={this.state.panelMenu} onPanelMenuAction={(action, params) => this.contentNode.onPanelMenuAction(action, params)}>
                <div className={styles.panelUntrustedContentWrapper}>
                    <WorkspacePanelContent ref={node => this.contentNode = node} panel={this.props.panel} setPanelMenu={::this.setPanelMenu}/>
                </div>
            </Panel>
        );
    }
}