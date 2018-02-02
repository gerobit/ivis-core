'use strict';

import React, { Component } from 'react';
import { Menu, MenuLink } from '../lib/secondary-menu';
import ivisConfig from "ivisConfig";

export default class Sidebar extends Component {
    constructor(props) {
        super(props);
    }
    /*
                    {ivisConfig.globalPermissions.includes('manageFarms') && <MenuLink linkTo="/settings/cattles" icon="th" iconFamily="fa" label="Cattles" />}
                    {ivisConfig.globalPermissions.includes('manageWorkspaces') && <MenuLink linkTo="/settings/workspaces" icon="th" label="Workspaces" />}
                    {ivisConfig.globalPermissions.includes('manageTemplates') && <MenuLink linkTo="/settings/templates" icon="list-alt" label="Templates" />}
    
    */
    render() {
        return (
            <Menu>
                {ivisConfig.globalPermissions.includes('manageFarms') && <MenuLink linkTo="/settings/farms" icon="th" iconFamily="fa" label="Farms" />}
                {ivisConfig.globalPermissions.includes('manageFarms') && <MenuLink linkTo="/settings/crop-seasons" icon="glyphicon-leaf" iconFamily="fa" label="Crop Seasons" />}
                {ivisConfig.globalPermissions.includes('manageEvents') && <MenuLink linkTo="/settings/events" icon="bolt" iconFamily="fa" label="Events" />}
                {ivisConfig.globalPermissions.includes('manageRecommendations') && <MenuLink linkTo="/settings/recommendations" icon="comment-o" iconFamily="fa" label="Recommendations" />}
                {ivisConfig.globalPermissions.includes('manageFarms') && <MenuLink linkTo="/settings/crops" icon="th" iconFamily="fa" label="Crops" />}
                {ivisConfig.globalPermissions.includes('manageEventTypes') && <MenuLink linkTo="/settings/event-types" icon="th" iconFamily="fa" label="Event Types" />}
                {ivisConfig.globalPermissions.includes('manageSignalSets') && <MenuLink linkTo="/settings/signal-sets" icon="line-chart" iconFamily="fa" label="Sensors" />}
                {ivisConfig.globalPermissions.includes('manageUsers') && <MenuLink linkTo="/settings/users" icon="user" label="Users" />}
                {ivisConfig.globalPermissions.includes('manageNamespaces') && <MenuLink linkTo="/settings/namespaces" icon="inbox" label="Namespaces" />}
            </Menu>
        );
    }
}