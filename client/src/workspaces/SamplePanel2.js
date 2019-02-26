'use strict';

import React, {Component} from "react";
import styles
    from './sample-styles.scss';
import {LineChart} from "../ivis/LineChart";
import {TimeRangeSelector} from "../ivis/TimeRangeSelector";
import {TimeContext} from "../ivis/TimeContext";
import {rgb} from "d3-color";
import {withPanelConfig} from "../ivis/PanelConfig"
import {Legend} from "../ivis/Legend"
import TestWorkspacePanel
    from "./panels/TestWorkspacePanel";

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
    }
];

const sensorsStructure = [
    {
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
                <div key={graphIdx} className="my-3" className={styles.titleAndGraph}>
                    <h4>{graphSpec.label}</h4>
                    <LineChart
                        config={chartConfig}
                        height={500}
                        margin={{ left: 40, right: 5, top: 5, bottom: 20 }}
                        withTooltip
                        tooltipExtraProps={{ width: 450 }}
                    />
                </div>
            );

            graphIdx += 1;
        }

        return (
            <TimeContext>
                <TimeRangeSelector/>
                <Legend label="Sensors" configPath={['sensors']} withSelector structure={sensorsStructure} withConfigurator configSpec={sensorsConfigSpec}/>
                {graphs}
            </TimeContext>
        );
    }
}


export default class SamplePanel extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const panelParams = {
            "sensors":[
                {
                    "label": "Teplotní senzor v altanu\n",
                    "color": rgb(219, 0, 0),
                    "sigSet": "4776e6ed003f003e",
                    "enabled": true
                },
                {
                    "label": "Teplota, Vlhkost",
                    "color": rgb(144, 19, 254),
                    "sigSet": "a81758fffe0301b4",
                    "enabled": true
                },
                {
                    "label": "Teplota, Vlhkost, Síla signálu",
                    "color": rgb(139, 87, 42),
                    "sigSet": "a81758fffe0301be",
                    "enabled": false
                }
            ]
        };

        return (
            <TestWorkspacePanel
                title="Sample Panel"
                panel={{
                    id: 1,
                    template: 1
                }}
                params={panelParams}
                content={PanelContent}
            />
        );
    }
}