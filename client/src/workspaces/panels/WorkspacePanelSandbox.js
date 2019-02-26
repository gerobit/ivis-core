'use strict';

import React, {PureComponent}
    from "react";
import PropTypes
    from "prop-types";
import "../../../generated/ivis-exports";
import {getSandboxUrl} from "../../lib/urls";
import ParamTypes
    from "../../settings/workspaces/panels/ParamTypes";
import {parentRPC} from "../../lib/untrusted";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";
import memoize
    from "memoize-one";

@withComponentMixins([
    withTranslation
])
export default class WorkspacePanelSandbox extends PureComponent {
    constructor(props) {
        super(props);

        this.paramTypes = new ParamTypes(props.t);

        this.state = {
            moduleLoaded: false
        };
    }

    static propTypes = {
        panel: PropTypes.object
    }

    componentDidMount() {
        parentRPC.setMethodHandler('panelMenuAction', ::this.onPanelMenuAction);

        global.ivisPanelTemplateId = this.props.panel.template; // This is to support "fileUrl" method in ivis/template-file.js

        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = getSandboxUrl(`rest/template-module/${this.props.panel.template}`);
        script.onload = () => {
            this.setState({ moduleLoaded: true });
        };

        document.head.appendChild(script);
    }

    panelParams = memoize(
        (templateParams, params) => this.paramTypes.upcast(templateParams, params)
    );

    async setPanelMenu(menu) {
        await parentRPC.ask('setPanelMenu', menu);
    }

    async onPanelMenuAction(method, params) {
        this.contentNode.onPanelMenuAction(params.action);
    }

    render() {
        const t = this.props.t;

        if (this.state.moduleLoaded) {
            const PanelModule = global['template_' + this.props.panel.template].default;
            const panel = this.props.panel;

            return (
                <PanelModule ref={node => this.contentNode = node} setPanelMenu={::this.setPanelMenu} panel={panel} params={this.panelParams(panel.templateParams, panel.params)} />
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
