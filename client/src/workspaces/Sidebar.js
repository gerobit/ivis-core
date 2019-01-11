'use strict';

import React, { Component } from 'react';
import PropTypes from "prop-types";
import {NavLink} from "../lib/page";

export default class Sidebar extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        resolved: PropTypes.object
    }

    render() {
        const panels = [];
        for (const panel of this.props.resolved.panelsVisible) {
            panels.push(
                <NavLink key={panel.id} to={`/workspaces/${this.props.resolved.workspace.id}/${panel.id}`}>{panel.name}</NavLink>

            );
        }

        return (
            <nav className="sidebar-nav">
                <ul className="nav">
                    {panels}
                </ul>
            </nav>
        );
    }
}
