'use strict';

import React from 'react';
import ReactDOM from 'react-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from './lib/i18n';

import 'bootstrap/dist/js/bootstrap.min';
import '../public/bootflat-admin/css/site.min.css';

import { Section } from './lib/page-sandbox';
import WorkspacePanelSandbox from './workspaces/panels/WorkspacePanelSandbox';
import {UntrustedContentRoot} from "./lib/untrusted";

const getStructure = t => {

    return {
        '': {
            children: {
                panel: {
                    panelRender: props =>
                        <UntrustedContentRoot render={props => <WorkspacePanelSandbox {...props} />} />
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


