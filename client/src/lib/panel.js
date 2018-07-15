'use strict';

import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {withRouter} from 'react-router';
import {
    ActionLink,
    DropdownMenu,
    Icon
} from "./bootstrap-components";
import styles from './styles.scss';

class Panel extends Component {
    static propTypes = {
        title: PropTypes.string,
        className: PropTypes.string,
        panelMenu: PropTypes.array,
        onPanelMenuAction: PropTypes.func
    }

    render() {
        const props = this.props;

        let menu = null;

        if (this.props.panelMenu && this.props.panelMenu.length > 0) {
            const menuItems = [];
            let itemIdx = 0;
            for (const item of this.props.panelMenu) {
                if (item.disabled) {
                    menuItems.push(
                        <li key={itemIdx}><span className={styles.disabled}>{item.label}</span></li>
                    );
                } else {
                    menuItems.push(
                        <li key={itemIdx}><ActionLink onClickAsync={() => this.props.onPanelMenuAction(item.action)}>{item.label}</ActionLink></li>
                    );
                }
                itemIdx += 1;
            }

            menu = (
                <div className={styles.panelMenuIcon}>
                    <DropdownMenu noCaret label={<Icon icon="cog"/>}>
                        {menuItems}
                    </DropdownMenu>
                </div>
            );
        }

        return (
            <div className="panel panel-default">
                {props.title &&
                    <div className="panel-heading">
                        {menu}
                        <h3 className="panel-title">{props.title}</h3>
                    </div>
                }
                <div className="panel-body">
                    {props.children}
                </div>
            </div>
        );
    }
}


export {
    Panel
};