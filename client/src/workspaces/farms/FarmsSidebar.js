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
                <MenuLink linkTo="/workspaces/farms" icon="leaf" label="Farms" />
                <MenuLink linkTo="/workspaces/farms/events" icon="flash" label="Events" />
                <MenuLink linkTo="/workspaces/farms/recommendations" icon="comment" label="Recommendations" />
                <MenuLink linkTo="/workspaces/farms/cropseasons" icon="tree-deciduous" label="Crop Seasons" />
                <MenuLink linkTo="/workspaces/farms/notifications" icon="info-sign" label="Notifications" />
            </Menu>
        );
    }
}
