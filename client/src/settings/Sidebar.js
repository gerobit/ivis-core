'use strict';

import React, { Component } from 'react';
import {Menu, MenuLink} from '../lib/secondary-menu';
import ivisConfig from "ivisConfig";

export default class Sidebar extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <Menu>
                {ivisConfig.globalPermissions.includes('manageWorkspaces')  && <MenuLink linkTo="/settings/workspaces" icon="th" label="Workspaces" />}
                {ivisConfig.globalPermissions.includes('manageTemplates')  && <MenuLink linkTo="/settings/templates" icon="list-alt" label="Templates" />}
                {ivisConfig.globalPermissions.includes('manageSignalSets')  && <MenuLink linkTo="/settings/signal-sets" icon="line-chart" iconFamily="fa" label="Signal Sets" />}
                {ivisConfig.globalPermissions.includes('manageFarms')  && <MenuLink linkTo="/settings/farms" icon="th" iconFamily="fa" label="Farms" />}
                {ivisConfig.globalPermissions.includes('manageUsers')  && <MenuLink linkTo="/settings/users" icon="user" label="Users" />}
                {ivisConfig.globalPermissions.includes('manageNamespaces')  && <MenuLink linkTo="/settings/namespaces" icon="inbox" label="Namespaces" />}
            </Menu>
        );
    }
}
