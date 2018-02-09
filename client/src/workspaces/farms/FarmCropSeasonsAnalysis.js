'use strict';

import React, { Component } from "react";
import { translate } from "react-i18next";
import { Panel } from "../../lib/panel";
import { requiresAuthenticatedUser, withPageHelpers } from "../../lib/page";
import axios from "../../lib/axios";
import { withAsyncErrorHandler, withErrorHandling } from "../../lib/error-handling";
import { Table } from "../../lib/table";
import moment from "moment";
import { Icon } from "../../lib/bootstrap-components";

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class FarmsCropSeasonsAnalysis extends Component {
    constructor(props) {
        super(props);
        this.state = { data: null };
    }

    /*async componentDidMount() {
        const response = await axios.get(`/rest/crop-seasons-analysis?farm=${this.props.cropSeason.farm}&start=${this.props.cropSeason.start}&end=${this.props.cropSeason.end}`);
        const data = response.data;
        this.setState({ data });
        , searchable: false 
    }*/

    render() {
        const t = this.props.t;
        const columns = [
            { data: 1, title: t('Event')},
            { data: 2, title: t('Cost')},
            { data: 3, title: t('Quantity')},
        ];

        //console.log(this.state.data);
        //{!!this.state.data && <Table withHeader data={this.state.data} columns={columns} />}


        return (
            <Panel title={t(`Farm Crop Season Analysis ${this.props.cropSeason.name}`)} >
                <Table withHeader dataUrl={`/rest/crop-seasons-analysis/${this.props.cropSeason.farm}/${this.props.cropSeason.start}/${this.props.cropSeason.end}`} columns={columns} />
            </Panel>
        );
    }
}