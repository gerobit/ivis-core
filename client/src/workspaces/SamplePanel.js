'use strict';

import React, {Component} from "react";
import {Panel} from "../lib/panel";
import {rgb} from "d3-color";
import {
    LegendPosition,
    StaticPieChart
} from "../ivis/ivis";
import TestWorkspacePanel
    from "./panels/TestWorkspacePanel";

class TestPieChart extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const t = this.props.t;

        const cnf = {
            arcs: [
                {
                    label: 'A',
                    color: rgb(70, 130, 180),
                    value: 45
                },
                {
                    label: 'B',
                    color: rgb(230, 60, 60),
                    value: 28
                },
                {
                    label: 'C',
                    color: rgb(30, 70, 120),
                    value: 31
                }
            ]
        };

        return (
            <Panel>
                <StaticPieChart config={cnf} height={400} legendPosition={LegendPosition.BOTTOM} legendRowClass="col-xs-12 col-sm-6 col-md-4 col-lg-2"/>
            </Panel>
        );
    }
}


export default class SamplePanel extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const panelParams = {};

        return (
            <TestWorkspacePanel
                title="Sample Panel"
                panel={{
                    id: 1,
                    template: 1
                }}
                params={panelParams}
                content={TestPieChart}
            />
        );
    }
}