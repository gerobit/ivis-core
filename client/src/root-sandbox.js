'use strict';

import './lib/public-path';

import React from 'react';
import ReactDOM from 'react-dom';
import {I18nextProvider} from 'react-i18next';
import i18n from './lib/i18n';

import {Section} from './lib/page-sandbox';
import WorkspacePanelSandbox from './workspaces/panels/WorkspacePanelSandbox';
import {parentRPC, UntrustedContentRoot} from "./lib/untrusted";
import {setRestrictedAccessTokenFromPath} from "./lib/urls";
import {extractPermanentLinkConfig} from "./lib/permanent-link";

setRestrictedAccessTokenFromPath(window.location.pathname);

parentRPC.init();

const getStructure = t => {

    return {
        children: {
            panel: {
                panelRender: props =>
                    <UntrustedContentRoot render={props => <WorkspacePanelSandbox {...props} />} />,
                insideIframe: true,

                children: {
                    ':panelId([0-9]+)': {
                        resolve: {
                            panel: params => `rest/panels/${params.panelId}`
                        },

                        panelRender: props => {
                            const permanentLinkConfig = extractPermanentLinkConfig(props.location);

                            const params = {
                                ...props.resolved.panel.params,
                                ...permanentLinkConfig
                            };

                            const panel = {
                                ...props.resolved.panel,
                                params
                            };

                            return <WorkspacePanelSandbox panel={panel} />;
                        }
                    }
                }
            }
        }
    };
};

ReactDOM.render(
    <I18nextProvider i18n={ i18n }>
        <Section root='/' structure={getStructure}/>
    </I18nextProvider>,
    document.getElementById('root')
);


