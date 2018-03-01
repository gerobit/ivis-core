import React, { Component } from "react";
import moment from "moment";
import { translate } from "react-i18next";
import PropTypes from "prop-types";

import { InputField, Form, withForm, TableSelect } from "../lib/form";
import { TableSelectMode } from "../lib/table";
import { LineChart } from "./LineChart";
import styles from "./TimeRangeSelector.scss";
import stylesP from "../workspaces/Sample.scss";

import { Button } from "../lib/bootstrap-components";
import randomColor from '../lib/random-color.js';
import prepareDataFun from "..//lib/data/farm/prepareData";

import axios from "../lib/axios";

@translate()
@withForm
export class GraphOptions extends Component {
    constructor(props) {
        super(props);
        this.state = {
            config: {
                yScale: {
                    includedMin: 0,
                    includedMax: 100
                }
            },
            opened: false,
            areaZones:  {overIrrigationZone: 80, overDryZone: 20}
        };

        this.initForm();
    }

    getDescription() {
        return 'Zones (over irrigation: ' + this.state.areaZones.overIrrigationZone +
        ', over dry:' + this.state.areaZones.overDryZone + ')';
    }


    localValidateFormValues(state) {
        const t = this.props.t;

        if (!state.getIn(['overIrrigationZone', 'value'])) {
            state.setIn(['overIrrigationZone', 'error'], t('overIrrigationZone must not be empty'));
        } else {
            state.setIn(['overIrrigationZone', 'error'], null);
        }

        if (!state.getIn(['overDryZone', 'value'])) {
            state.setIn(['overDryZone', 'error'], t('overDryZone must not be empty'));
        } else {
            state.setIn(['overDryZone', 'error'], null);
        }

        if (!state.getIn(['sensorIds', 'value'])) {
            state.setIn(['sensorIds', 'error'], t('You need to select at least one sensor of this farm.'));
        } else {
            state.setIn(['sensorIds', 'error'], null);
        }
    }

    async submitForm() {
        if (this.isFormWithoutErrors()) {
            const t = this.props.t;

            const overIrrigationZone = this.getFormValue('overIrrigationZone');
            const overDryZone = this.getFormValue('overDryZone');
            const selectedSensorIds = new Set(this.getFormValue('sensorIds'));
            //selectedSensorIds.set();
            console.log(selectedSensorIds);

            let signalSetsArray = [];
            //get all farm sensors, and filter them out
            const result = await axios.get(`/rest/farmsensors/${this.props.farmId}`);
            const data = result.data
            const sensors = data.filter(sensor => selectedSensorIds.has(sensor.id));
            console.log(sensors);

            for (const sensor of sensors) {
                let signalSetDic = null;
    
                for (const ssd of signalSetsArray)
                    if (ssd.cid === sensor.ssCid)
                        signalSetDic = ssd;
    
                if (signalSetDic === null) {
                    signalSetDic = {};
                    signalSetDic.cid = sensor.ssCid;
                    signalSetDic.signals = [];
                    signalSetsArray.push(signalSetDic);
                }
    
                signalSetDic.signals.push({
                    cid: sensor.sCid,
                    label: t(signalSetDic.cid + ':' + sensor.sCid),
                    color: randomColor()
                });
            }
    
            const sigSets = {
                signalSets: signalSetsArray
            };

            let state = Object.assign(this.state.config, sigSets);
            const prepareData = {
                prepareData: prepareDataFun
            };
    
            state = Object.assign(this.state.config, prepareData);
            //this.setState({ state });
            this.setState({
                config: state,
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
            overDryZone: '20',
        });
    }

    renderGraphicOptions() {
        const t = this.props.t;
        let sigSetLabelIndex = 1;
        const sigSetColumns = [
            { data: 1, title: t('Name') },
            { data: 2, title: t('Description') },
            { data: 3, title: t('Created'), render: data => moment(data).fromNow() },
            { data: 4, title: t('Namespace') },
            { data: 5, title: t('Cid') }
        ]

        return (
            <div className={styles.widget}>
                <div className={styles.quickRanges}>
                    <h3>{t('Graph Options')}</h3>
                    <Form stateOwner={this} onSubmitAsync={::this.submitForm}>
                        <TableSelect selectMode={TableSelectMode.MULTI} ref={node => this.sigSetTableSelect = node} id="sensorIds" label={t('Sensors')} 
                        withHeader dropdown dataUrl={`/rest/farmsensor-table/${this.props.farmId}`}
                        help={t('Select all farm sensors for graphs.')} 
                        columns={sigSetColumns} selectionLabelIndex={sigSetLabelIndex} />

                        <InputField id="overIrrigationZone" label={t('Over irrigation zone')} help={t('This specifies over-irrigation zone area and line.')} />
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
        const t = this.props.t;

        const legendRows = [];

        if (this.state.config.signalSets) {
            for (const sigSetConf of this.state.config.signalSets) {
                for (const sigConf of sigSetConf.signals) {
                    legendRows.push(
                        <div>
                            <span className={stylesP.signalColor} style={{ backgroundColor: sigConf.color }}></span>
                            <span className={stylesP.signalLabel}>{sigConf.label}</span>
                        </div>
                    );
                }
            }
        }

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
                {(!!this.state.config.signalSets &&
                    this.state.config.signalSets.length > 0) &&
                    <div>
                    <LineChart {...this.props} config={this.state.config}
                        graphOptions={{ areaZones: this.state.areaZones }} />
                        <div className={stylesP.legend}>
                            <div className="row">
                            {legendRows}
                            </div>
                        </div>
                    </div>
                }
            </div>
        )
    }
}

/*
sometimes when adding second sensor
index.js:10342 TypeError: Cannot read property 'prev' of undefined
    at LineChartBase.createChart (index.js:232852)
    at TimeBasedChartBase.createChart (index.js:194873)
    at TimeBasedChartBase.componentDidUpdate (index.js:194644)
    at measureLifeCyclePerf (index.js:150027)
    at index.js:150680
        //const t = this.props.t;


        if (!state.getIn(['optimalIrrigationZone', 'value'])) {
            state.setIn(['optimalIrrigationZone', 'error'], t('optimalIrrigationZone must not be empty'));
        } else {
            state.setIn(['optimalIrrigationZone', 'error'], null);
        }                        <InputField id="optimalIrrigationZone" label={t('Optimal irrigation zone')} help={t('This specifies over-irrigation zone area and line.')} />

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