'use strict';

import React, { Component } from 'react';
import { Menu, MenuLink } from '../lib/secondary-menu';
import ivisConfig from "ivisConfig";
import em from '../lib/extension-manager';
import {translate} from "react-i18next";


@translate()
export default class Sidebar extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const settings = [];
        const t = this.props.t;
        
        em.invoke('client.settings.installSettings', settings);

        if (ivisConfig.globalPermissions.showAdminUsers)
            settings.push(<MenuLink key='users' linkTo="/settings/users" icon="user" label={t('Users')} />);

        if (ivisConfig.globalPermissions.showAdminNamespaces)
            settings.push(<MenuLink key='namespaces' linkTo="/settings/namespaces" icon="inbox" label={t('Namespaces')} />);

        if (ivisConfig.globalPermissions.showAdminWorkspaces)
            settings.push(<MenuLink key='workspaces' linkTo="/settings/workspaces" icon="th" label={t('Workspaces')} />);
        
        if (ivisConfig.globalPermissions.showAdminTemplates)
            settings.push(<MenuLink key='templates' linkTo="/settings/templates" icon="list-alt" label={t('Templates')} />);

        if (ivisConfig.globalPermissions.showAdminSignalSets)
            settings.push(<MenuLink key='signalSets' linkTo="/settings/signal-sets" icon="line-chart" iconFamily="fa" label={!em.get('settings.signalSetsAsSensors', false) ? t('Signal Sets') : t('Sensors')} />);
        
        return (
            <Menu>
                {settings}
            </Menu>
        );
    }
}
