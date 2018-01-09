'use strict';

import React, { Component } from 'react';
import { Menu, MenuLink } from '../../lib/secondary-menu';
import ivisConfig from "ivisConfig";

export default class FarmsSidebar extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <Menu>
                <MenuLink linkTo="/workspaces/farms" icon="th" label="Farms" />
                <MenuLink linkTo="/workspaces/farms/events" icon="th" label="Events" />
                <MenuLink linkTo="/workspaces/farms/recommendations" icon="list-alt" label="Recommendations" />
                <MenuLink linkTo="/workspaces/farms/notifications" icon="user" iconFamily="fa" label="Notifications" />
                <MenuLink linkTo="/workspaces/farms/crops" icon="th" iconFamily="fa" label="Crops" />
            </Menu>
        );
    }
}
