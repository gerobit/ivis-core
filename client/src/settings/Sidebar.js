'use strict';

import React, {Component} from 'react';
import ivisConfig
    from "ivisConfig";
import em
    from '../lib/extension-manager';
import {NavLink} from "../lib/page";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";


@withComponentMixins([
    withTranslation
])
export default class Sidebar extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const settings = [];
        const t = this.props.t;
        
        em.invoke('client.settings.installSettings', settings, t);

        if (ivisConfig.globalPermissions.showGlobalSettings)
            settings.push(<NavLink key='global' to="/settings/global" icon="cog">{t('Global settings')}</NavLink>);

        if (ivisConfig.globalPermissions.showAdminUsers)
            settings.push(<NavLink key='users' to="/settings/users" icon="user">{t('Users')}</NavLink>);

        if (ivisConfig.globalPermissions.showAdminNamespaces)
            settings.push(<NavLink key='namespaces' to="/settings/namespaces" icon="sitemap">{t('Namespaces')}</NavLink>);

        if (ivisConfig.globalPermissions.showAdminWorkspaces)
            settings.push(<NavLink key='workspaces' to="/settings/workspaces" icon="layer-group">{t('Workspaces')}</NavLink>);
        
        if (ivisConfig.globalPermissions.showAdminTemplates)
            settings.push(<NavLink key='templates' to="/settings/templates" icon="file-invoice">{t('Templates')}</NavLink>);

        if (ivisConfig.globalPermissions.showAdminSignalSets)
            settings.push(<NavLink key='signalSets' to="/settings/signal-sets" icon="chart-line">{!em.get('settings.signalSetsAsSensors', false) ? t('Signal Sets') : t('Sensors')}</NavLink>);
        
        return (
            <>
                <div className="sidebar-header">
                    {t('Settings')}
                </div>
                <nav className="sidebar-nav">
                    <ul className="nav">
                        {settings}
                    </ul>
                </nav>
            </>
        );
    }
}
