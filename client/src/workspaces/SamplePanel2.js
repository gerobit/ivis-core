'use strict';

import React, {Component} from "react";
import styles from './sample-styles.scss';
import {LineChart} from "../ivis/LineChart";
import {TimeRangeSelector} from "../ivis/TimeRangeSelector";
import {TimeContext} from "../ivis/TimeContext";
import {rgb} from "d3-color";

import {withPanelConfig} from "../ivis/PanelConfig"
import {
    Legend,
    setSelectionDefault
} from "../ivis/Legend"

const graphSpecs = [
    {
        label: "Temperature",
        signalCid: "temperature",
        yScaleMin: 20,
        yScaleMax: 40
    },
    {
        label: "CO2",
        signalCid: "co2"
    },
    {
        label: "Humidity",
        signalCid: "humidity"
    },
    {
        label: "Battery Level",
        signalCid: "batteryLevel"
    },
    {
        label: "SNR",
        signalCid: "snr"
    },
    {
        label: "RSSI",
        signalCid: "rssi"
    }
];

const sensorsStructure = [
    {
        cidAttr: 'sigSet',
        labelAttr: 'label',
        colorAttr: 'color',
        selectionAttr: 'enabled'
    }
];

const sensorsConfigSpec = {
    "id": "sensors",
    "type": "fieldset",
    "cardinality": "1..n",
    "children": [
        {
            "id": "label",
            "label": "Label",
            "type": "string"
        },
        {
            "id": "color",
            "label": "Color",
            "type": "color"
        },
        {
            "id": "sigSet",
            "label": "Signal Set",
            "type": "signalSet"
        },
        {
            "id": "enabled",
            "label": "Enabled",
            "type": "boolean",
            "default": true
        }
    ]
};


@withPanelConfig
class PanelContent extends Component {
    constructor(props) {
        super(props);
    }

    onConfigChanged(config) {
        console.log(config);
        this.updatePanelConfig(['sensors'], config);
    }

    render() {
        const config = this.getPanelConfig();

        const graphs = [];
        let graphIdx = 0;

        for (const graphSpec of graphSpecs) {
            const yScaleMin = graphSpec.yScaleMin;
            const yScaleMax = graphSpec.yScaleMax;

            const yScale = {};
            if (!Number.isNaN(yScaleMin)) {
                yScale.includedMin = yScaleMin;
                yScale.limitMin = yScaleMin;
            }

            if (!Number.isNaN(yScaleMax)) {
                yScale.includedMax = yScaleMax;
                yScale.limitMax = yScaleMax;
            }

            const signalSets = [];
            for (const sensor of config.sensors) {
                signalSets.push({
                        cid: sensor.sigSet,
                        signals: [
                            {
                                label: sensor.label,
                                color: sensor.color,
                                cid: graphSpec.signalCid,
                                enabled: sensor.enabled
                            }
                        ]
                    }
                );
            }

            const chartConfig = {
                yScale: yScale,
                signalSets
            };

            graphs.push(
                <div key={graphIdx} className="col-xs-12">
                    <div className={styles.info}>
                        <h4>{graphSpec.label}</h4>
                        <LineChart
                            config={chartConfig}
                            height={500}
                            margin={{ left: 40, right: 5, top: 5, bottom: 20 }}
                            withTooltip
                            tooltipExtraProps={{ width: 450 }}
                        />
                    </div>
                </div>
            );

            graphIdx += 1;
        }

        return (
            <TimeContext>
                <div className="row">
                    <div className="col-xs-12">
                        <TimeRangeSelector/>
                    </div>
                    <div className="col-xs-12">
                        <h4>Sensors</h4>
                        <Legend owner={this} path={['sensors']} withSelector structure={sensorsStructure} withConfigurator configSpec={sensorsConfigSpec}/>
                    </div>
                    {graphs}
                </div>
            </TimeContext>
        );
    }
}


export default class Panel extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const panelParams = {
            "sensors":[
                {
                    "label": "ASC-B6",
                    "color": rgb(219, 0, 0),
                    "sigSet": "0E7E3464333100B6",
                    "enabled": true
                },
                {
                    "label": "RHF231",
                    "color": rgb(144, 19, 254),
                    "sigSet": "9CF9574000000231",
                    "enabled": true
                },
                {
                    "label": "RHF2E2",
                    "color": rgb(139, 87, 42),
                    "sigSet": "8CF95740000002E2",
                    "enabled": false
                }
            ]
        };

        return (
            <PanelContent params={panelParams}/>
        );
    }
}