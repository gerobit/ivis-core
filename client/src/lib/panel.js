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
                        <DropdownActionLink key={itemIdx} onClickAsync={() => this.props.onPanelMenuAction(item.action)}>{item.label}</DropdownActionLink>
                    );
                }
                itemIdx += 1;
            }

            menu = (
                <ButtonDropdown label={<Icon icon="cog"/>}>
                    {menuItems}
                </ButtonDropdown>
            );
        }

        return (
            <div className="card">
                {props.title &&
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
