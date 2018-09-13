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

        if (ivisConfig.globalPermissions['showAdminSignalSets'])
            settings.push(<MenuLink key='signalSets' linkTo="/settings/signal-sets" icon="line-chart" iconFamily="fa" label="Sensors" />);

        if (ivisConfig.globalPermissions['showAdminUsers'])
            settings.push(<MenuLink key='users' linkTo="/settings/users" icon="user" label="Users" />);

        if (ivisConfig.globalPermissions['showAdminNamespaces'])
            settings.push(<MenuLink key='namespaces' linkTo="/settings/namespaces" icon="inbox" label="Namespaces" />);

        if (ivisConfig.globalPermissions['showAdminWorkspaces'])
            settings.push(<MenuLink key='workspaces' linkTo="/settings/workspaces" icon="th" label="Workspaces" />);
        
        if (ivisConfig.globalPermissions['showAdminTemplates'])
            settings.push(<MenuLink key='templates' linkTo="/settings/templates" icon="list-alt" label="Templates" />);

        return (
            <Menu>
                {settings}
            </Menu>
        );
    }
}
