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
import ivisConfig from "ivisConfig";

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class FarmsMapPanel extends Component {
    constructor(props) {
        super(props);

        this.state = { sensorMarkers: {} };
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
        for (const sensor of sensors) {
            if (sensor.lat !== null && sensor.lng !== null)
                this.sensorMarkers[sensor.farm + ':' + sensor.sensor] =
                    {
                        group: sensor.farm,
                        label: sensor.farm + ':' + sensor.sensor,
                        location: [parseFloat(sensor.lat), parseFloat(sensor.lng)]
                    }
        }

        this.setState({ sensorMarkers: this.sensorMarkers });
    }

    render() {
        const t = this.props.t;

        return (
            <Panel title={t('Your Farms Map')}>
                <Map center={[51.505, -0.09]} markers={this.state.sensorMarkers} />
            </Panel>
        );
    }
}