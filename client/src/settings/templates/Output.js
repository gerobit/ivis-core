'use strict';

import React, {Component} from "react";
import PropTypes
    from "prop-types";
import {requiresAuthenticatedUser} from "../../lib/page";
import {Panel} from "../../lib/panel";
import {getBuildStates} from "./build-states";
import Ansi
    from 'ansi-to-react';
import outputStyles
    from './Output.scss';
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
    }

    render() {
        const t = this.props.t;
        const entity = this.props.entity;

        const errors = [];
        const warnings = [];

        if (entity.output) {
            let idx = 0;
            for (const error of entity.output.errors) {
                errors.push(<div key={idx}><Ansi>{error}</Ansi></div>)
                idx++;
            }

            for (const warning of entity.output.warnings) {
                warnings.push(<div key={idx}><Ansi>{warning}</Ansi></div>)
                idx++;
            }
        }

        return (
            <Panel title={t('Build Output')}>
                <div className={outputStyles.label}>Status: {this.buildStates[entity.state]}</div>
                <div className={outputStyles.label}>Errors:</div>
                {errors}

                <div className={outputStyles.label}>Warnings:</div>
                {warnings}
            </Panel>
        );
    }
}
