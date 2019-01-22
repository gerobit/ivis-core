'use strict';

import React, {Component} from "react";
import PropTypes
    from "prop-types";
import {
    IntervalSpec,
    TimeInterval
} from "./TimeInterval";
import moment
    from "moment";
import {createComponentMixin, withComponentMixins} from "../lib/decorator-helpers";
import {panelConfigAccessMixin} from "./PanelConfig";


const defaultIntervalName = 'default';

export const TimeIntervalsContext = React.createContext(null);

@withComponentMixins([
    panelConfigAccessMixin
])
export class TimeContext extends Component {
    constructor(props) {
        super(props);

        const owner = props.panelConfigOwner;

        const config = owner ? owner.getPanelConfig(props.configPath) || {} : {};

        const exportData = intervals => {
            const owner = props.panelConfigOwner;

            if (owner) {
                const exportedData = {};
                for (const ctxName of props.intervalNames) {
                    exportedData[ctxName] = intervals[ctxName].exportData();
                }

                owner.updatePanelConfig(props.configPath, exportedData);
            }
        };

        const intervals = {};
        for (const ctxName of props.intervalNames) {

            const onChange = (type, newInterval) => {
                const newIntervals = Object.assign({}, this.state.intervals);
                newIntervals[ctxName] = newInterval;

                this.setState({
                    intervals: newIntervals
                });

                exportData(newIntervals);
            };

            if (config[ctxName]) {
                intervals[ctxName] = TimeInterval.fromExportedData(onChange, config[ctxName]);

            } else {
                intervals[ctxName] = new TimeInterval(onChange,
                    {
                        spec: props.initialIntervalSpec,
                        conf: {
                            getMinAggregationInterval: props.getMinAggregationInterval
                        }
                    }
                );
            }
        }

        exportData(intervals);

        this.state = {
            intervals
        };
    }

    static propTypes = {
        intervalNames: PropTypes.array,
        initialIntervalSpec: PropTypes.object,
        getMinAggregationInterval: PropTypes.func,
        configPath: PropTypes.array
    }

    static defaultProps = {
        intervalNames: [defaultIntervalName],
        initialIntervalSpec: new IntervalSpec('now-7d', 'now', null, moment.duration(1, 'm')),
        configPath: ['timeContext']
    }

    componentDidMount() {
        for (const interval of Object.values(this.state.intervals)) {
            interval.start();
        }
    }

    componentWillUnmount() {
        for (const interval of Object.values(this.state.intervals)) {
            interval.stop();
        }
    }

    render() {
        return (
            <TimeIntervalsContext.Provider value={{
                timeIntervals: this.state.intervals
            }}>
                {this.props.children}
            </TimeIntervalsContext.Provider>
        );
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


export function intervalAccessMixin(mappings = defaultMappings) {
    return createComponentMixin([{context: TimeIntervalsContext, propName: 'timeContext'}], [], (TargetClass, InnerClass) => {
        const inst = InnerClass.prototype;

        const defaultProps = InnerClass.defaultProps || {};
        const propTypes = InnerClass.propTypes || {};

        for (const [intervalName, mapping] of Object.entries(mappings)) {
            defaultProps[mapping.intervalNameProp] = intervalName;
            propTypes[mapping.intervalNameProp] = PropTypes.string;
            propTypes[mapping.intervalAbsoluteProp] = PropTypes.object;
            propTypes[mapping.intervalSpecProp] = PropTypes.object;
            propTypes[mapping.intervalHistoryProp] = PropTypes.object;
            propTypes[mapping.intervalProp] = PropTypes.object;
        }

        InnerClass.defaultProps = defaultProps;
        InnerClass.propTypes = propTypes;


        const getProp = (self, propName, attrName, intervalName, props) => {
            const mapping = mappings[intervalName || defaultIntervalName];

            props = props || self.props;
            const context = props.timeContext;

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

            inst.getInterval = function(props) {
                return getProp(this, 'intervalProp', null, intervalName, props);
            };

            inst.getIntervalAbsolute = function(props) {
                return getProp(this, 'intervalAbsoluteProp', 'absolute', intervalName, props);
            };

            inst.getIntervalSpec = function(props) {
                return getProp(this, 'intervalSpecProp', 'spec', intervalName, props);
            };

            inst.getIntervalHistory = function(props) {
                return getProp(this, 'intervalHistoryProp', 'history', intervalName, props);
            };

        } else if (mappingsKeys.length > 1) {
            inst.getInterval = function(intervalName, props) {
                return getProp(this, 'intervalProp', null, intervalName, props);
            };

            inst.getIntervalAbsolute = function(intervalName, props) {
                return getProp(this, 'intervalAbsoluteProp', 'absolute', intervalName, props);
            };

            inst.getIntervalSpec = function(intervalName, props) {
                return getProp(this, 'intervalSpecProp', 'spec', intervalName, props);
            };

            inst.getIntervalHistory = function(intervalName, props) {
                return getProp(this, 'intervalHistoryProp', 'history', intervalName, props);
            };

        } else {
            throw new Error('Invalid mappings');
        }

        return {};
    });
}
