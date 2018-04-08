'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {translate} from "react-i18next";
import {rgb} from "d3-color";
import {parseCardinality} from "../../../../shared/templates";
import "../../../generated/ivis-exports";
import {getSandboxUrl} from "../../lib/urls";

@translate()
export default class WorkspacePanelSandbox extends Component {
    constructor(props) {
        super(props);

        this.state = {
            moduleLoaded: false,
            panelParams: this.upcastParams(props.panel.templateParams, props.panel.params)
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

    upcastParams(templateParams, params) {
        const np = {};
        for (const spec of templateParams) {
            let value;

            if (spec.type === 'color') {
                const col = params[spec.id];
                value = rgb(col.r, col.g, col.b, col.a);

            } else if (spec.type === 'fieldset') {
                const card = parseCardinality(spec.cardinality);
                if (spec.children) {
                    if (card.max === 1) {
                        value = this.upcastParams(spec.children, params[spec.id]);
                    } else {
                        value = [];

                        if (params[spec.id]) {
                            for (const childParams of params[spec.id]) {
                                value.push(this.upcastParams(spec.children, childParams));
                            }
                        }
                    }
                }

            } else {
                value = params[spec.id];
            }

            np[spec.id] = value;
        }

        return np;
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