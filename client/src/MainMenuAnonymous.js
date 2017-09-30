'use strict';

import React, {Component} from "react";
import {Menu} from "./lib/primary-menu";
import {translate} from "react-i18next";

@translate()
export default class MainMenu extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const t = this.props.t;

        return (
            <Menu>
            </Menu>
        );
    }
}
