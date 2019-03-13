'use strict';

import React, {Component} from 'react';
import PropTypes
    from 'prop-types';
import {
    ButtonDropdown,
    DropdownActionLink,
    Icon
} from "./bootstrap-components";
import styles
    from './styles.scss';
import {Toolbar} from "./page";

export class Panel extends Component {
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
                        <DropdownActionLink key={itemIdx} disabled>{item.label}</DropdownActionLink>
                    );
                } else {
                    menuItems.push(
                        <DropdownActionLink key={itemIdx} onClickAsync={async () => this.props.onPanelMenuAction(item.action)}>{item.label}</DropdownActionLink>
                    );
                }
                itemIdx += 1;
            }

            menu = (
                <div className={styles.panelMenu}>
                    <ButtonDropdown menuClassName="dropdown-menu-right" label={<Icon icon="cog"/>}>
                        {menuItems}
                    </ButtonDropdown>
                </div>
            );
        }

        return (
            <div className="card ivis-panel">
                {(props.title || menu) &&
                    <div className="card-header">
                        {menu}
                        <h3 className={`${styles.panelTitle}`}>{props.title}</h3>
                    </div>
                }
                <div className="card-body">
                    {props.children}
                </div>
            </div>
        );
    }
}
