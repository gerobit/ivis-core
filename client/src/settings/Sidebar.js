'use strict';

import React, { Component } from 'react';
import { Menu, MenuLink } from '../lib/secondary-menu';
import ivisConfig from "ivisConfig";
import em from '../lib/extension-manager';

export default class Sidebar extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const settings = [];
        
        em.invoke('client.settings.installSettings', settings);
    
        
        if (ivisConfig.globalPermissions.includes('manageSignalSets'))
            settings.push(<MenuLink key='signalsets' linkTo="/settings/signal-sets" icon="line-chart" iconFamily="fa" label="Sensors" />);

        if (ivisConfig.globalPermissions.includes('manageUsers'))
            settings.push(<MenuLink key='users' linkTo="/settings/users" icon="user" label="Users" />);

        if (ivisConfig.globalPermissions.includes('manageNamespaces'))
            settings.push(<MenuLink key='namespaces' linkTo="/settings/namespaces" icon="inbox" label="Namespaces" />);

        if (ivisConfig.globalPermissions.includes('manageWorkspaces'))
            settings.push(<MenuLink key='workspaces' linkTo="/settings/workspaces" icon="th" label="Workspaces" />);
        
        if (ivisConfig.globalPermissions.includes('manageTemplates'))
            settings.push(<MenuLink key='templates' linkTo="/settings/templates" icon="list-alt" label="Templates" />);

        return (
            <Menu>
                {settings}
            </Menu>
        );
    }
}
    /*
                    {ivisConfig.globalPermissions.includes('manageWorkspaces') && <MenuLink linkTo="/settings/workspaces" icon="th" label="Workspaces" />}
                    {ivisConfig.globalPermissions.includes('manageTemplates') && <MenuLink linkTo="/settings/templates" icon="list-alt" label="Templates" />}
    
    */