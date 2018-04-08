'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {translate} from "react-i18next";
import {Panel} from "../../lib/panel";
import {requiresAuthenticatedUser} from "../../lib/page";
import WorkspacePanelContent from "./WorkspacePanelContent";

@translate()
@requiresAuthenticatedUser
export default class WorkspacePanel extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        panel: PropTypes.object
    }

    render() {
        const t = this.props.t;
        const panel = this.props.panel;

        return (
            <Panel title={this.props.panel.name}>
                <WorkspacePanelContent panel={this.props.panel}/>
            </Panel>
        );
    }
}