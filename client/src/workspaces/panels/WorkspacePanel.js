'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {translate} from "react-i18next";
import {Panel} from "../../lib/panel";
import {requiresAuthenticatedUser} from "../../lib/page";
import WorkspacePanelUntrustedHost from "./WorkspacePanelUntrustedHost";

@translate()
@requiresAuthenticatedUser
export default class WorkspacePanel extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        panel: PropTypes.object,
        initialAccessToken: PropTypes.string
    }

    render() {
        const t = this.props.t;
        const panel = this.props.panel;

        return (
            <Panel title={this.props.panel.name}>
                <WorkspacePanelUntrustedHost panel={this.props.panel} initialAccessToken={this.props.initialAccessToken}/>
            </Panel>
        );
    }
}