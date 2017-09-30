'use strict';

import React, { Component } from 'react';
import PropTypes from "prop-types";
import {Menu, MenuLink} from '../lib/secondary-menu';

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
                <MenuLink
                    key={panel.id}
                    linkTo={`/workspaces/${this.props.resolved.workspace.id}/${panel.id}`}
                    label={panel.name}
                />
            );
        }

        return (
            <Menu>
                {panels}
            </Menu>
        );
    }
}
