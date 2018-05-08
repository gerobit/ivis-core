'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {TimeInterval} from "./TimeInterval";

const defaultIntervalName = 'default';

export class TimeContext extends Component {

    constructor(props) {
        super(props);

        this.intervals = {};
        for (const ctxName of props.intervalNames) {
            this.intervals[ctxName] = new TimeInterval(
                (type, newInterval) => {
                    this.intervals[ctxName] = newInterval;
                    const intervals = Object.assign({}, this.intervals);

                    this.setState({
                        intervals
                    });
                },
                {spec: props.initialIntervalSpec}
            );
        }

        this.state = {
            intervals: Object.assign({}, this.intervals)
        }
    }

    static propTypes = {
        intervalNames: PropTypes.array,
        initialIntervalSpec: PropTypes.object
    }

    static defaultProps = {
        intervalNames: [defaultIntervalName]
    }

    static childContextTypes = {
        timeIntervals: PropTypes.object
    }

    getChildContext() {
        return {
            timeIntervals: this.state.intervals
        };
    }

    componentDidMount() {
        for (const interval of Object.values(this.intervals)) {
            interval.start();
        }
    }

    componentWillUnmount() {
        for (const interval of Object.values(this.intervals)) {
            interval.stop();
        }
    }

    render() {
        return this.props.children;
    }
}

TimeContext.defaultIntervalName = defaultIntervalName;


const defaultMappings = {
    [TimeContext.defaultIntervalName]: {
        intervalNameProp: 'intervalName',
        intervalAbsoluteProp: 'intervalAbsolute',
        intervalSpecProp: 'intervalSpec',
        intervalHistoryProp: 'intervalHistory',
        intervalProp: 'interval'
    }
};

export function withIntervalAccess(mappings = defaultMappings) {
    return target => {
        const inst = target.prototype;

        const contextTypes = target.contextTypes || {};
        contextTypes.timeIntervals = PropTypes.object.isRequired;
        target.contextTypes = contextTypes;


        const defaultProps = target.defaultProps || {};
        const propTypes = target.propTypes || {};

        for (const [intervalName, mapping] of Object.entries(mappings)) {
            defaultProps[mapping.intervalNameProp] = intervalName;
            propTypes[mapping.intervalNameProp] = PropTypes.string;
            propTypes[mapping.intervalAbsoluteProp] = PropTypes.object;
            propTypes[mapping.intervalSpecProp] = PropTypes.object;
            propTypes[mapping.intervalHistoryProp] = PropTypes.object;
            propTypes[mapping.intervalProp] = PropTypes.object;
        }

        target.defaultProps = defaultProps;
        target.propTypes = propTypes;


        const getProp = (self, propName, attrName, intervalName, props, context) => {
            const mapping = mappings[intervalName || defaultIntervalName];

            props = props || self.props;
            context = context || self.context;

            const propValue = props[mapping[propName]];
            if (propValue) {
                return propValue;
            } else {
                const interval = context.timeIntervals[intervalName];
                return attrName ? interval[attrName] : interval;
            }
        };


        const mappingsKeys = Object.keys(mappings);
        if (mappingsKeys.length === 1) {
            const intervalName = mappingsKeys[0];

            inst.getInterval = function(props, context) {
                return getProp(this, 'intervalProp', null, intervalName, props, context);
            };

            inst.getIntervalAbsolute = function(props, context) {
                return getProp(this, 'intervalAbsoluteProp', 'absolute', intervalName, props, context);
            };

            inst.getIntervalSpec = function(props, context) {
                return getProp(this, 'intervalSpecProp', 'spec', intervalName, props, context);
            };

            inst.getIntervalHistory = function(props, context) {
                return getProp(this, 'intervalHistoryProp', 'history', intervalName, props, context);
            };

        } else if (mappingsKeys.length > 1) {
            inst.getInterval = function(intervalName, props, context) {
                return getProp(this, 'intervalProp', null, intervalName, props, context);
            };

            inst.getIntervalAbsolute = function(intervalName, props, context) {
                return getProp(this, 'intervalAbsoluteProp', 'absolute', intervalName, props, context);
            };

            inst.getIntervalSpec = function(intervalName, props, context) {
                return getProp(this, 'intervalSpecProp', 'spec', intervalName, props, context);
            };

            inst.getIntervalHistory = function(intervalName, props, context) {
                return getProp(this, 'intervalHistoryProp', 'history', intervalName, props, context);
            };

        } else {
            throw new Error('Invalid mappings');
        }
    };
}
