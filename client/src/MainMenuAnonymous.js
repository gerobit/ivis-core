'use strict';

import React, {Component} from "react";
import {getLanguageChooser} from "./lib/page";
import {withComponentMixins} from "./lib/decorator-helpers";
import {withTranslation} from "./lib/i18n";

@withComponentMixins([
    withTranslation
])
export default class MainMenu extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const t = this.props.t;

        return (
            <ul className="navbar-nav ivis-navbar-nav-right">
                {getLanguageChooser(t)}
            </ul>
        );
    }
}
