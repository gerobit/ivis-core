'use strict';

import React, { Component } from "react";
import { translate } from "react-i18next";
import { Panel } from "../../lib/panel";
import { requiresAuthenticatedUser, withPageHelpers } from "../../lib/page";
import axios from "../../lib/axios";
import { withAsyncErrorHandler, withErrorHandling } from "../../lib/error-handling";
import { PieChart } from "../../ivis-ws/PieChart";

@translate()
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class FarmsCropSeasonsAnalysis extends Component {
    constructor(props) {
        super(props);
        this.state = { dataCost: null, dataQuantity: null, totalCost: 0 };
    }

    @withAsyncErrorHandler
    async componentDidMount() {
        const response = await axios.get(`/rest/crop-seasons-analysis?farm=${this.props.cropSeason.farm}&start=${this.props.cropSeason.start}&end=${this.props.cropSeason.end}`);

        const data = response.data;
        const dataCost = [];
        const dataQuantity = [];
        let costs = 0;
        let quantities = 0;

        for (const event of data) {
            dataCost.push({ key: event.event, value: parseFloat(event.costs) });
            dataQuantity.push({ key: event.event, value: parseInt(event.quantities) });
            costs += parseFloat(event.costs);
            quantities += parseFloat(event.quantities);
        }

        this.setState({
            dataCost, dataQuantity, titleCost: 'Event Costs (' + costs + ')',
            titleQuantity: 'Event Quantities (' + quantities + ')', totalCost: costs, totalQuantities: quantities
        });

    }

    render() {
        const t = this.props.t;
        let costElement, quantityElement;

        if (this.state.dataCost &&
            (this.state.dataCost.length === 0 || this.state.totalCost === 0))
            costElement = <div className="col-xs-6 content"> <b>There are no costs.</b> </div>
        else
            costElement = <div className="col-xs-6 content"> <PieChart title={this.state.titleCost} total={this.state.totalCost} data={this.state.dataCost} width={500} height={500} margin={{top: 20, right: 10, bottom: 20, left: 10}}/> </div>

        if (this.state.dataQuantity &&
            (this.state.dataQuantity.length === 0 || this.state.totalQuantity === 0))
            quantityElement = <div className="col-xs-6 content"> <b>There are no quantity.</b> </div>
        else
            quantityElement = <div className="col-xs-6 content"><PieChart title={this.state.titleQuantity} total={this.state.totalQuantities} data={this.state.dataQuantity} width={500} height={500} margin={{top: 20, right: 10, bottom: 20, left: 10}}/> </div>

        return (
            <Panel title={t(`Farm Crop Season Analysis: ${this.props.cropSeason.name}`)} >
                {costElement}
                {quantityElement}
            </Panel>
        );
    }
}

/*
        console.log(this.state.dataCost);
        console.log(this.state.dataQuantity);

                <div className="col-xs-12 content">
                    <div className="col-xs-6 content">
                        <b> Event Costs </b>
                    </div>
                    <div className="col-xs-6 content">
                        <b> Event Quantities</b>
                    </div>
                </div>
<div class="col-xs-12 content"><!-- react-empty: 486 --><div class="panel panel-default"><div class="panel-heading"><h3 class="panel-title">Farm Crop Season Analysis Winter Season</h3></div><div class="panel-body"><svg width="300" height="500"><g transform="translate(150,250)"><g class="arc"><path d="M8.572527594031473e-15,-140A140,140,0,0,1,113.18077109522456,82.40214229187481L0,0Z" fill="#98abc5"></path><text transform="translate(98.03545134526746,-49.89038263563125)" dy="0.35em">Irrigation</text></g><g class="arc"><path d="M113.18077109522456,82.40214229187481A140,140,0,1,1,-39.01878221547427,-134.45272267388782L0,0Z" fill="#8a89a6"></path><text transform="translate(-90.03719469177499,63.192591116644415)" dy="0.35em">Phosphorous input</text></g><g class="arc"><path d="M-39.01878221547427,-134.45272267388782A140,140,0,0,1,-1.5006256154011194e-13,-140L0,0Z" fill="#7b6888"></path><text transform="translate(-15.482946338051867,-108.904905181966)" dy="0.35em">Rail fall</text></g></g><g transform="translate(150,250)"><g class="arc"><path d="M8.572527594031473e-15,-140A140,140,0,1,1,-133.7193084522964,-41.46259214086369L0,0Z" fill="#98abc5"></path><text transform="translate(65.25506644521802,88.55380456665982)" dy="0.35em">Irrigation</text></g><g class="arc"><path d="M-133.7193084522964,-41.46259214086369A140,140,0,0,1,-69.20354425588572,-121.69991562208935L0,0Z" fill="#8a89a6"></path><text transform="translate(-85.72545448000258,-68.92856051156882)" dy="0.35em">Phosphorous input</text></g><g class="arc"><path d="M-69.20354425588572,-121.69991562208935A140,140,0,0,1,9.862739597592311e-14,-140L0,0Z" fill="#7b6888"></path><text transform="translate(-28.12161223867807,-106.34460458856121)" dy="0.35em">Rail fall</text></g></g></svg><svg width="300" height="500"></svg></div></div></div>

        {!!this.state.data && <Table withHeader data={this.state.data} columns={columns} />}

        , searchable: false 

        const columns = [
            { data: 1, title: t('Event') },
            { data: 2, title: t('Cost') },
            { data: 3, title: t('Quantity') },
        ];
                <Table withHeader dataUrl={`/rest/crop-seasons-analysis/${this.props.cropSeason.farm}/${this.props.cropSeason.start}/${this.props.cropSeason.end}`} columns={columns} />

*/