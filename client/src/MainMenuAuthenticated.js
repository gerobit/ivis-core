'use strict';

import em from './lib/extension-manager';

import React, {Component} from "react";
import PropTypes from "prop-types";
import { Menu, MenuDivider, MenuDropdown, MenuLink } from "./lib/primary-menu";
import { translate } from "react-i18next";
import axios from "./lib/axios";
import { withAsyncErrorHandler, withErrorHandling } from "./lib/error-handling";
import { requiresAuthenticatedUser } from "./lib/page";

@translate()
@withErrorHandling
@requiresAuthenticatedUser
export default class MainMenu extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        resolved: PropTypes.object
    }

    @withAsyncErrorHandler
    async logout() {
        await axios.post('/rest/logout');

        /* FIXME, once we manage loading of authenticated config this should become navigateTo */
        window.location = '/login';
    }

    render() {
        const t = this.props.t;

        const workspaces = [];
        /*for (const ws of this.props.resolved.workspacesVisible) {
            workspaces.push(
                <MenuLink
                    key={ws.id}
                    linkTo={'/workspaces/' + ws.id + (ws.default_panel ? '/' + ws.default_panel : '')}
                    label={ws.name}
                />
            );
        }*/

        em.invoke('client.mainMenuAuthenticated.installWorkspaces', workspaces, t);

        return (
            <Menu>
                {workspaces}
                <MenuLink linkTo="/settings" label={t('Administration')} />
                <MenuDropdown label="Account">
                    <MenuLink linkTo="/account" label={t('Profile')} />
                    <MenuDivider />
                    <MenuLink onClickAsync={::this.logout} label={t('Logout')} />
                </MenuDropdown>
            </Menu>
        );
    }
}
