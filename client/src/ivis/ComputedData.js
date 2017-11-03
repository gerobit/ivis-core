'use strict';

import React, {Component} from "react";

import {translate} from "react-i18next";
import {withIntervalAccess} from "./TimeContext";
import {dataAccess, TimeseriesSource} from "./DataAccess";
import {withAsyncErrorHandler, withErrorHandling} from "../lib/error-handling";
import interoperableErrors from "../../../shared/interoperable-errors";
import {IntervalSpec} from "./TimeInterval";
import {DataPathApproximator} from "./DataPathApproximator";

//@experimentalDecorators
@translate()
@withErrorHandling
@withIntervalAccess()
export class ComputedData extends Component {
    constructor(props){
        super(props);

        const t = props.t;

        this.fetchDataCounter = 0;

        this.state = {
            signalsData: null,
            statusMsg: t('Loading...'),
        };
    }

    componentWillReceiveProps(nextProps, nextContext) {
        const t = this.props.t;

        const nextAbs = this.getIntervalAbsolute(nextProps, nextContext);
        if (nextProps.config !== this.props.config || nextAbs !== this.getIntervalAbsolute()) {
            console.log('props changed');
            this.setState({
                signalsData: null,
                statusMsg: t('Loading...')
            });

            this.fetchData(nextAbs, nextProps.config);
        }
    }

    componentDidMount() {
        // console.log('mount');
        this.fetchData(this.getIntervalAbsolute(), this.props.config);

        // this.computeData() is not needed here because at this point, we are missing too many things to actually execute it
    }

    componentDidUpdate(prevProps, prevState, prevContext) {
        console.log('update');
        const forceRefresh = this.prevContainerNode !== this.containerNode
            || prevState.signalsData !== this.state.signalsData
            || prevProps.config !== this.props.config
            || this.getIntervalAbsolute(prevProps, prevContext) !== this.getIntervalAbsolute();

        this.computeData(forceRefresh);
        this.prevContainerNode = this.containerNode;
    }

    componentWillUnmount() {
        // console.log('unmount');
    }

    @withAsyncErrorHandler
    async fetchData(abs, config) {
        console.log('fetch');
        console.log(JSON.stringify(config));
        
        const t = this.props.t;

        try {
            const tsSources = config.signals.map(signalSpec => new TimeseriesSource(signalSpec.cid));

            this.fetchDataCounter += 1;
            const fetchDataCounter = this.fetchDataCounter;

            const signalsData = await dataAccess.getSignals(tsSources, abs);

            if (this.fetchDataCounter === fetchDataCounter) {
                this.setState({
                    signalsData
                });
            }
        } catch (err) {
            if (err instanceof interoperableErrors.TooManyPointsError) {
                this.setState({
                    statusMsg: t('Too many data points.')
                });
                return;
            }

            throw err;
        }
    }

    computeData(forceRefresh) {
        const t = this.props.t;
        const self = this;

        if (!this.state.signalsData) {
            return;
        }

        console.log('computeData');

        const abs = this.getIntervalAbsolute();
        let noData = true;
        console.log('signalsData', this.state.signalsData);
       
        if (noData) {
            //this.statusMsgSelection.text(t('No data.'));
            return;
        }
    }

    render() {
        /*if (!this.state.signalsData) {
            return (
                <svg ref={node => this.containerNode = node} height={this.props.height} width="100%">
                    <text textAnchor="middle" x="50%" y="50%" fontFamily="'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif" fontSize="14px">
                        {this.state.statusMsg}
                    </text>
                </svg>
            );

        }*/
        return <div/>;
    }
}