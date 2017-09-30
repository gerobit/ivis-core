'use strict';

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { Link } from 'react-router-dom'
import {Icon} from "./bootstrap-components";

class MenuLink extends Component {
    static propTypes = {
        label: PropTypes.string,
        className: PropTypes.string,
        linkTo: PropTypes.string,
        icon: PropTypes.string,
        iconFamily: PropTypes.string
    };

    render() {
        const props = this.props;

        let className = 'list-group-item';
        if (props.className) {
            className = className + ' ' + props.className;
        }

        let icon;
        if (props.icon) {
            icon = <Icon icon={props.icon} family={props.iconFamily}/>;
        }

        return (
            <li className={className}>{icon}<Link to={props.linkTo}>{props.label}</Link></li>
        );
    }
}

class Menu extends Component {
    render() {
        const props = this.props;

        return (
            <ul className="list-group panel">
                {props.children}
            </ul>
        );
    }
}
export {
    MenuLink,
    Menu
};