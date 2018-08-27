'use strict';

import em from './extension-manager';

import React, { Component } from 'react';
import { translate } from 'react-i18next';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { Link } from 'react-router-dom'
import {ActionLink, Icon} from "./bootstrap-components";
import em from './extension-manager.js';

class MenuLink extends Component {
    static propTypes = {
        label: PropTypes.string,
        className: PropTypes.string,
        linkTo: PropTypes.string,
        onClickAsync: PropTypes.func,
        icon: PropTypes.string,
        iconFamily: PropTypes.string
    };

    render() {
        const props = this.props;

        let className = '';
        if (props.className) {
            className = className + ' ' + props.className;
        }

        let icon;
        if (props.icon) {
            icon = <Icon icon={props.icon} family={props.iconFamily}/>;
        }

        if (this.props.onClickAsync) {
            return (
                <li className={props.className}><ActionLink onClickAsync={this.props.onClickAsync}>{icon}{' '}{props.label}</ActionLink></li>
            );
        } else {
            return (
                <li className={props.className}><Link to={props.linkTo}>{icon}{' '}{props.label}</Link></li>
            );
        }
    }
}

class MenuDropdown extends Component {
    static propTypes = {
        label: PropTypes.string,
        className: PropTypes.string,
        icon: PropTypes.string,
        iconFamily: PropTypes.string
    }

    render() {
        const props = this.props;

        let className = 'dropdown';
        if (props.className) {
            className = className + ' ' + props.className;
        }

        let icon;
        if (props.icon) {
            icon = <Icon icon={props.icon} family={props.iconFamily}/>;
        }

        return (
            <li className={className}>
                <a data-toggle="dropdown" className="dropdown-toggle" href="#">{icon}{' '}{props.label}{' '}<b className="caret"></b></a>
                <ul role="menu" className="dropdown-menu">
                    {props.children}
                </ul>
            </li>
        );
    }
}

class MenuDivider extends Component {
    static propTypes = {
        className: PropTypes.string,
    };

    render() {
        const props = this.props;

        let className = 'divider';
        if (props.className) {
            className = className + ' ' + props.className;
        }

        return (
            <li className={className}></li>
        );
    }
}

@translate()
class Menu extends Component {
    render() {
        const props = this.props;
        const t = props.t;

        return (
            <nav role="navigation" className="navbar navbar-custom">
                <div className="container-fluid">
                    <div className="navbar-header">
                        <button data-target="#ivis-primary-menu-collapse" data-toggle="collapse" className="navbar-toggle" type="button">
                            <span className="sr-only">{t('Toggle navigation')}</span>
                            <span className="icon-bar"></span>
                            <span className="icon-bar"></span>
                            <span className="icon-bar"></span>
                        </button>
                        <span className="navbar-brand"><Link to="/">{em.get('app.title', 'IVIS')}</Link></span>
                    </div>

                    <div id="#ivis-primary-menu-collapse" className="collapse navbar-collapse">
                        <ul className="nav navbar-nav navbar-right">
                            {props.children}
                        </ul>
                    </div>
                </div>
            </nav>
        );
    }
}

export {
    MenuDropdown,
    MenuLink,
    MenuDivider,
    Menu
};