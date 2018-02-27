import React, { Component } from "react";

import { InputField, Form, withForm } from "../lib/form";
import { translate } from "react-i18next";
import styles from "./TimeRangeSelector.scss";
import { LineChart } from "./LineChart";

import { Button } from "../lib/bootstrap-components";
import PropTypes from "prop-types";

@translate()
@withForm
export class GraphOptions extends Component {
    constructor(props) {
        super(props);
        this.state = {
            opened: false,
            areaZones: null
        };

        this.initForm();
    }

    getDescription() {
        return 'Graph Options'
    }


    localValidateFormValues(state) {
        const t = this.props.t;

        if (!state.getIn(['overIrrigationZone', 'value'])) {
            state.setIn(['overIrrigationZone', 'error'], t('overIrrigationZone must not be empty'));
        } else {
            state.setIn(['overIrrigationZone', 'error'], null);
        }
        if (!state.getIn(['optimalIrrigationZone', 'value'])) {
            state.setIn(['optimalIrrigationZone', 'error'], t('optimalIrrigationZone must not be empty'));
        } else {
            state.setIn(['optimalIrrigationZone', 'error'], null);
        }

        if (!state.getIn(['overDryZone', 'value'])) {
            state.setIn(['overDryZone', 'error'], t('overDryZone must not be empty'));
        } else {
            state.setIn(['overDryZone', 'error'], null);
        }

    }

    async submitForm() {
        if (this.isFormWithoutErrors()) {
            const overIrrigationZone = this.getFormValue('overIrrigationZone');
            const overDryZone = this.getFormValue('overDryZone');

            this.setState({
                opened: false,
                areaZones: { overIrrigationZone: overIrrigationZone, overDryZone: overDryZone }
            });
        } else {
            this.showFormValidation();
        }
    }

    componentDidMount() {
        this.populateFormValues({
            overIrrigationZone: '80',
            optimalIrrigationZone: '60',
            overDryZone: '30',
        });

        const overIrrigationZone = this.getFormValue('overIrrigationZone');
        const overDryZone = this.getFormValue('overDryZone');
        this.setState({
            areaZones: { overIrrigationZone: overIrrigationZone, overDryZone: overDryZone }
        });
    }

    renderGraphicOptions() {
        const t = this.props.t;

        return (
            <div className={styles.widget}>
                <div className={styles.quickRanges}>
                    <h3>{t('Graph Options')}</h3>
                    <Form stateOwner={this} onSubmitAsync={::this.submitForm}>
                        <InputField id="overIrrigationZone" label={t('Over irrigation zone')} help={t('This specifies over-irrigation zone area and line.')} />
                        <InputField id="optimalIrrigationZone" label={t('Optimal irrigation zone')} help={t('This specifies over-irrigation zone area and line.')} />
                        <InputField id="overDryZone" label={t('Over dry zone')} help={t('This specifies over-dry zone area and line.')} />
                        <div className={styles.applyButton}>
                            <Button type="submit" className="btn-primary" label={t('Apply')} />
                        </div>
                    </Form>
                </div>
            </div>
        );
    }

    render() {
        return (
            <div>
                <div className="panel panel-default">
                    <div className="panel-heading" onClick={() => this.setState({ opened: !this.state.opened })}>
                        <div className={styles.headingDescription}>{this.getDescription()}</div>
                        <div className="clearfix" />
                    </div>
                    {this.state.opened &&
                        <div className="panel-body">
                            {this.renderGraphicOptions()}
                        </div>
                    }
                </div>
                <LineChart {...this.props} graphOptions={{areaZones: this.state.areaZones}} />            
            </div>
        )
    }
}

/*
        //const t = this.props.t;

format="wide"
                <div className={styles.timeRange}>
                </div>
                <div className={styles.intervalChooser}>
                </div>

    static childContextTypes = {
        areaZones: PropTypes.object
    };

    getChildContext() {
        return { areaZones: this.state.areaZones };
    }
*/