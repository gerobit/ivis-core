'use strict';

import React, { Component } from "react";
import { translate } from "react-i18next";
import { Table } from "../../lib/table";
import { Panel } from "../../lib/panel";
import { Map } from "../../lib/map";
import { NavButton, requiresAuthenticatedUser, Toolbar, withPageHelpers } from "../../lib/page";
import { Icon } from "../../lib/bootstrap-components";
import axios from "../../lib/axios";
import { withAsyncErrorHandler, withErrorHandling } from "../../lib/error-handling";
import moment from "moment";
import config from "../../ivis-ws/event-drops/src/config";
import ivisConfig from "ivisConfig";

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class FarmsMapPanel extends Component {
    constructor(props) {
        super(props);

        this.state = {};
        this.sensorMarkers = {};
        const t = props.t;
    }

    @withAsyncErrorHandler
    async fetchPermissions() {
    }

    async componentDidMount() {
        //this.fetchPermissions();
        const result = await axios.get('/rest/farms-sensors');
        const sensors = result.data;
        for(const sensor of sensors) {
            if(sensor.lat !== null && sensor.lng !== null)
                this.sensorMarkers[sensor.farm + ':' + sensor.sensor] = 
                [parseFloat(sensor.lat), parseFloat(sensor.lng)];
        }

        console.log(this.sensorMarkers);
    }

    render() {
        const t = this.props.t;
        // location, label
        const markers = {
            'Farm1: Sensor1': [51.5, -0.09],
            'Farm1: Sensor2': [51.05, -0.10],
            'Farm1: Sensor3': [50.5, -0.11]
        };

        return (
            <Panel title={t('Your Farms Map')}>
                <Map center={[51.505, -0.09]} markers={this.sensorMarkers} />
            </Panel>
        );
    }
}