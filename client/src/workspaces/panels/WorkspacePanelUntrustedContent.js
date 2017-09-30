'use strict';

import React, {Component} from "react";
import {translate} from "react-i18next";
import { getRestUrl } from "../../lib/access";
import {rgb} from "d3-color";
import {parseCardinality} from "../../../../shared/templates";

import "../../../generated/ivis-exports";

@translate()
export default class WorkspacePanelUntrustedContent extends Component {
    constructor(props) {
        super(props);

        this.state = {
            initialized: false,
            moduleLoaded: false
        };

        this.receiveMessageHandler = ::this.receiveMessage;
    }

    receiveMessage(evt) {
        const msg = evt.data;
        console.log(msg);

        if (msg.type === 'initAvailable' && !this.panel) {
            this.sendMessage('initNeeded');

        } else if (msg.type === 'init' && !this.panel) {
            this.panel = msg.data.panel;
            this.panelParams = this.upcastParams(this.panel.templateParams, this.panel.params);

            global.ivisPanelAccessToken = msg.data.accessToken;
            this.setState({ initialized: true });

            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = getRestUrl(`/template-module/${this.panel.template}`);
            script.onload = () => {
                this.setState({ moduleLoaded: true });
            };

            document.head.appendChild(script);

        } else if (msg.type === 'accessToken') {
            global.ivisPanelAccessToken = msg.data;
        }
    }

    sendMessage(type, data) {
        window.parent.postMessage({type, data}, ivisConfig.serverUrl);
    }

    componentDidMount() {
        window.addEventListener('message', this.receiveMessageHandler, false);
        this.sendMessage('initNeeded');
    }

    componentWillUnmount() {
        window.removeEventListener('message', this.receiveMessageHandler, false);
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

        if (this.state.initialized && this.state.moduleLoaded) {
            const PanelModule = global['template_' + this.panel.template].default;
            return <PanelModule params={this.panelParams}/>;

        } else {
            return (
                <div>
                    {t('Loading...')}
                </div>
            );
        }
    }
}