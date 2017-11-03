'use strict';

import React, { Component } from 'react';
import {Menu, MenuLink} from '../lib/secondary-menu';

export default class Sidebar extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <Menu>
                <MenuLink linkTo="/settings/workspaces" icon="th" label="Workspaces" />
                <MenuLink linkTo="/settings/templates" icon="list-alt" label="Templates" />
                <MenuLink linkTo="/settings/signals" icon="line-chart" iconFamily="fa" label="Signal Sets" />
                <MenuLink linkTo="/settings/users" icon="user" label="Users" />
                <MenuLink linkTo="/settings/namespaces" icon="inbox" label="Namespaces" />
            </Menu>
        );
    }
}
