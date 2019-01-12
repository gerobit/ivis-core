'use strict';

import em
    from './lib/extension-manager';

import React, {Component} from "react";
import PropTypes
    from "prop-types";
import axios
    from "./lib/axios";
import {
    withAsyncErrorHandler,
    withErrorHandling
} from "./lib/error-handling";
import {
    DropdownLink,
    getLanguageChooser,
    NavDropdown,
    NavLink,
    requiresAuthenticatedUser
} from "./lib/page";
import {
    DropdownActionLink,
    DropdownDivider
} from "./lib/bootstrap-components";
import {getUrl} from "./lib/urls";
import {withComponentMixins} from "./lib/decorator-helpers";
import {withTranslation} from "./lib/i18n";

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    requiresAuthenticatedUser
])
export default class MainMenu extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        resolved: PropTypes.object
    }

    @withAsyncErrorHandler
    async logout() {
        await axios.post(getUrl('rest/logout'));

        /* FIXME, once we manage loading of authenticated config this should become navigateTo */
        window.location = '/login';
    }

    render() {
        const t = this.props.t;

        const workspaces = [];
        for (const ws of this.props.resolved.workspacesVisible) {
            workspaces.push(
                <NavLink key={ws.id} to={'/workspaces/' + ws.id + (ws.default_panel ? '/' + ws.default_panel : '')}>{ws.name}</NavLink>
            );
        }

        em.invoke('client.mainMenuAuthenticated.installWorkspaces', workspaces, t);

        return (
            <>
                {workspaces.length > 0 &&
                <ul className="navbar-nav ivis-navbar-nav-left">
                    {workspaces}
                </ul>
                }
                <ul className="navbar-nav ivis-navbar-nav-right">
                    <NavLink to="/settings">{t('Settings')}</NavLink>
                    {getLanguageChooser(t)}
                    <NavDropdown menuClassName="dropdown-menu-right" label="Account" icon="user">
                        <DropdownLink to="/account/edit">{t('Profile')}</DropdownLink>
                        <DropdownLink to="/account/api">{t('API')}</DropdownLink>
                        <DropdownDivider/>
                        <DropdownActionLink onClickAsync={::this.logout}>{t('Logout')}</DropdownActionLink>
                    </NavDropdown>

                </ul>
            </>
        );
    }
}
