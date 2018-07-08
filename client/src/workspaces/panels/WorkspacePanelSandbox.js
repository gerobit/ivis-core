'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {translate} from "react-i18next";
import {rgb} from "d3-color";
import {parseCardinality} from "../../../../shared/templates";
import "../../../generated/ivis-exports";
import {getSandboxUrl} from "../../lib/urls";
import ParamTypes from "../../settings/workspaces/panels/ParamTypes";

@translate()
export default class WorkspacePanelSandbox extends Component {
    constructor(props) {
        super(props);

        this.paramTypes = new ParamTypes(props.t);

        this.state = {
            moduleLoaded: false,
            panelParams: this.paramTypes.upcast(props.panel.templateParams, props.panel.params)
        };
    }

    static propTypes = {
        panel: PropTypes.object
    }

    componentDidMount() {
        global.ivisPanelTemplateId = this.props.panel.template; // This is to support "fileUrl" method in ivis/template-file.js

        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = getSandboxUrl(`rest/template-module/${this.props.panel.template}`);
        script.onload = () => {
            this.setState({ moduleLoaded: true });
        };

        document.head.appendChild(script);
    }

    render() {
        const t = this.props.t;

        if (this.state.moduleLoaded) {
            const PanelModule = global['template_' + this.props.panel.template].default;
            return (
                <div className="panel-body">
                    <PanelModule params={this.state.panelParams}/>
                </div>
            )

        } else {
            return (
                <div>
                    {t('Loading...')}
                </div>
            );
        }
    }
}