'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {translate} from "react-i18next";
import {requiresAuthenticatedUser} from "../../lib/page";
import {Panel} from "../../lib/panel";
import {getBuildStates} from "./states";
import Ansi from 'ansi-to-react';
import outputStyles from './Output.scss';
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";

@withComponentMixins([
    withTranslation,
    requiresAuthenticatedUser
])
export default class CUD extends Component {
    constructor(props) {
        super(props);

        this.state = {};
        this.buildStates = getBuildStates(props.t);
    }

    static propTypes = {
        entity: PropTypes.object
    };

    render() {
        const t = this.props.t;
        const entity = this.props.entity;

        const errors = [];
        const warnings = [];

        if (entity.build_output) {
            let idx = 0;
            if (entity.build_output.errors) {
                for (const error of entity.build_output.errors) {
                    errors.push(<div key={idx}><pre><code>{error}</code></pre></div>);
                    idx++;
                }
            }

            if (entity.build_output.warnings) {
                for (const warning of entity.build_output.warnings) {
                    warnings.push(<div key={idx}><pre><code>{warning}</code></pre></div>);
                    idx++;
                }
            }
        }

        return (
            <Panel title={t('Build Output')}>
                <div className={outputStyles.label}>Status: {this.buildStates[entity.build_state]}</div>
                <div className={outputStyles.label}>Errors:</div>
                {errors}

                <div className={outputStyles.label}>Warnings:</div>
                {warnings}
            </Panel>
        );
    }
}
