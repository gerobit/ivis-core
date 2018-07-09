'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {Panel} from "../../lib/panel";
import {requiresAuthenticatedUser} from "../../lib/page";

@requiresAuthenticatedUser
export default class TestWorkspacePanel extends Component {
    constructor(props) {
        super(props);

        this.state = {
            panelMenu: []
        };
    }

    static propTypes = {
        title: PropTypes.string,
        panelId: PropTypes.number,
        params: PropTypes.object,
        content: PropTypes.func
    }

    async setPanelMenu(menu) {
        this.setState({
            panelMenu: menu
        });
    }

    render() {
        const PanelModule = this.props.content;
        return (
            <Panel title={this.props.title} panelMenu={this.state.panelMenu} onPanelMenuAction={(action, params) => this.contentNode.onPanelMenuAction(action, params)}>
                <PanelModule ref={node => this.contentNode = node} panelId={1} params={this.props.params} setPanelMenu={::this.setPanelMenu}/>
            </Panel>
        );
    }
}