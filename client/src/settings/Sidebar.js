'use strict';

import React, { Component } from 'react';
import { Menu, MenuLink } from '../lib/secondary-menu';
import ivisConfig from "ivisConfig";

export default class Sidebar extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <Menu>
                {ivisConfig.globalPermissions.includes('manageFarms') && <MenuLink linkTo="/settings/farms" icon="th" iconFamily="fa" label="Farms" />}
                {ivisConfig.globalPermissions.includes('manageFarms') && <MenuLink linkTo="/settings/crops" icon="th" iconFamily="fa" label="Crops" />}
                {ivisConfig.globalPermissions.includes('manageEventTypes') && <MenuLink linkTo="/settings/event-types" icon="th" iconFamily="fa" label="Event Types" />}
                {ivisConfig.globalPermissions.includes('manageEvents') && <MenuLink linkTo="/settings/events" icon="th" iconFamily="fa" label="Events" />}
                {ivisConfig.globalPermissions.includes('manageRecommendations') && <MenuLink linkTo="/settings/recommendations" icon="th" iconFamily="fa" label="Recommendations" />}
                {ivisConfig.globalPermissions.includes('manageWorkspaces') && <MenuLink linkTo="/settings/workspaces" icon="th" label="Workspaces" />}
                {ivisConfig.globalPermissions.includes('manageTemplates') && <MenuLink linkTo="/settings/templates" icon="list-alt" label="Templates" />}
                {ivisConfig.globalPermissions.includes('manageSignalSets') && <MenuLink linkTo="/settings/signal-sets" icon="line-chart" iconFamily="fa" label="Signal Sets" />}
                {ivisConfig.globalPermissions.includes('manageUsers') && <MenuLink linkTo="/settings/users" icon="user" label="Users" />}
                {ivisConfig.globalPermissions.includes('manageNamespaces') && <MenuLink linkTo="/settings/namespaces" icon="inbox" label="Namespaces" />}
            </Menu>
        );
    }
}
