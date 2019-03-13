'use strict';

import React, { Component } from 'react';
import PropTypes from "prop-types";
import {NavLink} from "../lib/page";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";

@withComponentMixins([
    withTranslation
])
export default class Sidebar extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        resolved: PropTypes.object
    }

    render() {
        const props = this.props;
        const t = this.props.t;

        const sidebarEntries = [];
        let sidebarTitle;

        if (props.resolved.workspace) {
            sidebarTitle = props.resolved.workspace.name;

            for (const panel of props.resolved.panelsVisible) {
                sidebarEntries.push(
                    <NavLink key={panel.id} to={`/workspaces/${props.resolved.workspace.id}/${panel.id}`}>{panel.name}</NavLink>
                );
            }
        } else {
            sidebarTitle = t('Workspaces');
        }

        return (
            <>
                <div className="sidebar-header">
                    {sidebarTitle}
                </div>
                <nav className="sidebar-nav">
                    <ul className="nav">
                        {sidebarEntries}
                    </ul>
                </nav>
            </>
        );
    }
}
