'use strict';

import React, {Component} from "react";
import PropTypes
    from "prop-types";
import {
    DatePicker,
    Dropdown,
    Form,
    withForm
} from "../lib/form";
import styles
    from "./TimeRangeSelector.scss";
import moment
    from "moment";
import {
    ActionLink,
    Button,
    Icon
} from "../lib/bootstrap-components";
import * as dateMath
    from "../lib/datemath";
import {intervalAccessMixin} from "./TimeContext";
import _
    from "lodash";
import {IntervalSpec} from "./TimeInterval";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";

@withComponentMixins([
    withTranslation,
    withForm,
    intervalAccessMixin()
])
export class TimeRangeSelector extends Component {
    constructor(props, context) {
        super(props, context);

        const t = props.t;

        this.state = {
            opened: false
        };

        this.refreshIntervalTypes = {
            off: { label: t('off'), duration: null },
            '5s': { label: t('5 seconds'), duration: moment.duration(5, 's') },
            '10s': { label: t('10 seconds'), duration: moment.duration(10, 's') },
            '30s': { label: t('30 seconds'), duration: moment.duration(30, 's') },
            '1m': { label: t('1 minute'), duration: moment.duration(1, 'm') },
            '5m': { label: t('5 minute'), duration: moment.duration(5, 'm') },
            '15m': { label: t('15 minutes'), duration: moment.duration(15, 'm') },
            '30m': { label: t('30 minutes'), duration: moment.duration(30, 'm') },
            '1h': { label: t('1 hour'), duration: moment.duration(1, 'h') },
            '2h': { label: t('2 hours'), duration: moment.duration(2, 'h') },
            '1d': { label: t('1 day'), duration: moment.duration(1, 'd') }
        };

        this.aggregationIntervalTypes = {
            auto: { label: t('auto'), duration: null },
            off: { label: t('off'), duration: moment.duration(0, 's') },
            '1ms': { label: t('1 millisecond'), duration: moment.duration(1, 'ms') },
            '5ms': { label: t('5 milliseconds'), duration: moment.duration(5, 'ms') },
            '10ms': { label: t('10 milliseconds'), duration: moment.duration(10, 'ms') },
            '50ms': { label: t('50 milliseconds'), duration: moment.duration(50, 'ms') },
            '100ms': { label: t('100 milliseconds'), duration: moment.duration(100, 'ms') },
            '200ms': { label: t('200 milliseconds'), duration: moment.duration(200, 'ms') },
            '500ms': { label: t('500 milliseconds'), duration: moment.duration(500, 'ms') },
            '1s': { label: t('1 second'), duration: moment.duration(1, 's') },
            '2s': { label: t('2 seconds'), duration: moment.duration(2, 's') },
            '5s': { label: t('5 seconds'), duration: moment.duration(5, 's') },
            '10s': { label: t('10 seconds'), duration: moment.duration(10, 's') },
            '15s': { label: t('15 seconds'), duration: moment.duration(15, 's') },
            '30s': { label: t('30 seconds'), duration: moment.duration(30, 's') },
            '1m': { label: t('1 minute'), duration: moment.duration(1, 'm') },
            '2m': { label: t('2 minutes'), duration: moment.duration(2, 'm') },
            '5m': { label: t('5 minutes'), duration: moment.duration(5, 'm') },
            '10m': { label: t('10 minutes'), duration: moment.duration(10, 'm') },
            '15m': { label: t('15 minutes'), duration: moment.duration(15, 'm') },
            '30m': { label: t('30 minutes'), duration: moment.duration(30, 'm') },
            '1h': { label: t('1 hour'), duration: moment.duration(1, 'h') },
            '2h': { label: t('2 hours'), duration: moment.duration(2, 'h') },
            '4h': { label: t('4 hours'), duration: moment.duration(4, 'h') },
            '6h': { label: t('6 hours'), duration: moment.duration(6, 'h') },
            '12h': { label: t('12 hours'), duration: moment.duration(12, 'h') },
            '1d': { label: t('1 day'), duration: moment.duration(1, 'd') },
            '2d': { label: t('2 days'), duration: moment.duration(2, 'd') },
            '5d': { label: t('5 days'), duration: moment.duration(5, 'd') },
            '1w': { label: t('1 week'), duration: moment.duration(1, 'w') },
            '2w': { label: t('2 weeks'), duration: moment.duration(2, 'w') },
            '1M': { label: t('1 month'), duration: moment.duration(1, 'M') }
        };

        this.fixedRangeTypes = [
            [
                { from: 'now-2d', to: 'now', label: t('Last 2 days') },
                { from: 'now-7d', to: 'now', label: t('Last 7 days') },
                { from: 'now-30d', to: 'now', label: t('Last 30 days') },
                { from: 'now-90d', to: 'now', label: t('Last 90 days') },
                { from: 'now-6M', to: 'now', label: t('Last 6 months') },
                { from: 'now-1y', to: 'now', label: t('Last 1 year') },
                { from: 'now-2y', to: 'now', label: t('Last 2 years') },
                { from: 'now-5y', to: 'now', label: t('Last 5 years') }
            ],
            [
                { from: 'now-1d/d', to: 'now-1d/d', label: t('Yesterday') },
                { from: 'now-2d/d', to: 'now-2d/d', label: t('Day before yesterday') },
                { from: 'now-7d/d', to: 'now-7d/d', label: t('This day last week') },
                { from: 'now-1w/w', to: 'now-1w/w', label: t('Previous week') },
                { from: 'now-1M/M', to: 'now-1M/M', label: t('Previous month') },
                { from: 'now-1y/y', to: 'now-1y/y', label: t('Previous year') }
            ],
            [
                { from: 'now/d', to: 'now/d', label: t('Today') },
                { from: 'now/d', to: 'now', label: t('Today so far') },
                { from: 'now/w', to: 'now/w', label: t('This week') },
                { from: 'now/w', to: 'now', label: t('This week so far') },
                { from: 'now/M', to: 'now/M', label: t('This month') },
                { from: 'now/M', to: 'now', label: t('This month so far') },
                { from: 'now/y', to: 'now/y', label: t('This year') },
                { from: 'now/y', to: 'now', label: t('This year so far') }
            ],
            [
                { from: 'now-5m', to: 'now', label: t('Last 5 minutes') },
                { from: 'now-15m', to: 'now', label: t('Last 15 minutes') },
                { from: 'now-30m', to: 'now', label: t('Last 30 minutes') },
                { from: 'now-1h', to: 'now', label: t('Last 1 hour') },
                { from: 'now-3h', to: 'now', label: t('Last 3 hours') },
                { from: 'now-6h', to: 'now', label: t('Last 6 hours') },
                { from: 'now-12h', to: 'now', label: t('Last 12 hours') },
                { from: 'now-24h', to: 'now', label: t('Last 24 hours') }
            ]
        ];

        this.initForm({
            onChangeBeforeValidation: (mutStateData, key, oldValue, newValue) => {
                if (key === 'to' || key === 'from') {
                    const fromStr = mutStateData.getIn(['from', 'value']);
                    const toStr = mutStateData.getIn(['to', 'value']);
                    const aggregationIntervalStr = mutStateData.getIn(['aggregationInterval', 'value']);

                    const aggregationOptions = this.getAggregationOptions(fromStr, toStr);
                    if (!aggregationOptions.find(x => x.key === aggregationIntervalStr)) {
                        mutStateData.setIn(['aggregationInterval', 'value'], 'auto');
                    }
                }
            }
        });
    }

    static propTypes = {

    }

    refreshValuesFromIntervalSpec() {
        const intervalSpec = this.getIntervalSpec();

        this.populateFormValues({
            from: dateMath.format(intervalSpec.from),
            to: dateMath.format(intervalSpec.to),
            aggregationInterval: _.findKey(this.aggregationIntervalTypes,
                    x => x.duration === intervalSpec.aggregationInterval ||
                        (x.duration && intervalSpec.aggregationInterval && x.duration.toISOString() === intervalSpec.aggregationInterval.toISOString())
                ) || 'off',
            refreshInterval: _.findKey(this.refreshIntervalTypes,
                    x => x.duration === intervalSpec.refreshInterval ||
                        (x.duration && intervalSpec.refreshInterval && x.duration.toISOString() === intervalSpec.refreshInterval.toISOString())
                ) || 'off'
        });
    }

    componentDidMount() {
        this.refreshValuesFromIntervalSpec();
    }

    componentDidUpdate(prevProps) {
        const prevIntervalSpec = this.getIntervalSpec(prevProps);

        if (prevIntervalSpec !== this.getIntervalSpec()) {
            this.refreshValuesFromIntervalSpec();
        }
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        const fromStr = state.getIn(['from', 'value']);
        const from = dateMath.parse(fromStr, false);
        if (fromStr === '') {
            state.setIn(['from', 'error'], t('Date must be set'));
        } else if (!from || !from.isValid()) {
            state.setIn(['from', 'error'], t('Date is invalid'));
        } else {
            state.setIn(['from', 'error'], null);
        }

        const toStr = state.getIn(['to', 'value']);
        const to = dateMath.parse(toStr, true);
        if (toStr === '') {
            state.setIn(['to', 'error'], t('Date must be set'));
        } else if (!to || !to.isValid()) {
            state.setIn(['to', 'error'], t('Date is invalid'));
        } else {
            state.setIn(['to', 'error'], null);
        }
    }

    async submitForm() {
        if (this.isFormWithoutErrors()) {
            const from = this.getFormValue('from');
            const to = this.getFormValue('to');

            const refreshIntervalKey = this.getFormValue('refreshInterval');
            const aggregationIntervalKey = this.getFormValue('aggregationInterval');

            const spec = new IntervalSpec(
                from,
                to,
                this.aggregationIntervalTypes[aggregationIntervalKey].duration,
                this.refreshIntervalTypes[refreshIntervalKey].duration
            );

            this.getInterval().setSpec(spec);

            this.setState({
                opened: false
            });

        } else {
            this.showFormValidation();
        }
    }

    submitRange(entry) {
        const spec = new IntervalSpec(
            entry.from,
            entry.to,
            null
        );

        this.getInterval().setSpec(spec);

        this.setState({
            opened: false
        });
    }

    alignAndSetInterval(from, to) {
    }

    async zoom(factor) {
        const intv = this.getInterval();

        const abs = this.getIntervalAbsolute();

        const middle = (abs.to + abs.from) / 2;
        const halfLength = (abs.to - abs.from) * factor / 2;

        const rounded = intv.roundToMinAggregationInterval(middle - halfLength, middle + halfLength);

        const spec = new IntervalSpec(
            rounded.from,
            rounded.to,
            null
        );

        intv.setSpec(spec);
    }

    async move(factor) {
        const intv = this.getInterval();

        const abs = this.getIntervalAbsolute();

        const offset = (abs.to - abs.from) * factor;

        const rounded = intv.roundToMinAggregationInterval(abs.from + offset, abs.to + offset);

        const spec = new IntervalSpec(
            rounded.from,
            moment(rounded.from + abs.to - abs.from) // We preserve the original interval size
        );

        intv.setSpec(spec);
    }

    getDescription() {
        const intervalSpec = this.getIntervalSpec();
        const selectedKey = intervalSpec.from + ' to ' + intervalSpec.to;

        let selectedRange;
        for (const rangeColumn of this.fixedRangeTypes) {
            for (const entry of rangeColumn) {
                const key = entry.from + ' to ' + entry.to;
                if (key === selectedKey) {
                    selectedRange = entry;
                    break;
                }
            }
        }

        let description;
        if (selectedRange) {
            description = selectedRange.label;
        } else {
            const intervalAbsolute = this.getIntervalAbsolute();
            description = dateMath.format(intervalAbsolute.from) + ' to ' + dateMath.format(intervalAbsolute.to);
        }

        return description;
    }

    getAggregationOptions(fromStr, toStr) {
        let aggregationOptions;
        const absFrom = dateMath.parse(fromStr, false);
        const absTo = dateMath.parse(toStr, true);

        if (absFrom && absTo && absFrom.isValid() && absTo.isValid()) {
            const intv = this.getInterval();

            const minAggregationInterval = intv.getMinAggregationInterval(absFrom, absTo);
            const maxAggregationInterval = absTo - absFrom;
            aggregationOptions = Object.entries(this.aggregationIntervalTypes)
                .filter(([key, entry]) => !entry.duration || (entry.duration >= minAggregationInterval && entry.duration <= maxAggregationInterval))
                .map(([key, entry]) => ({key, label: entry.label}));
        } else {
            aggregationOptions = Object.entries(this.aggregationIntervalTypes).map(([key, entry]) => ({key, label: entry.label}));
        }

        return aggregationOptions;
    }

    renderRangePicker() {
        const t = this.props.t;

        const refreshOptions = Object.entries(this.refreshIntervalTypes).map(([key, entry]) => ({key, label: entry.label}));

        const selectedKey = this.getFormValue('from') + ' to ' + this.getFormValue('to');
        const getQuickRanges = column => {
            return this.fixedRangeTypes[column].map(entry => {
                const key = entry.from + ' to ' + entry.to;
                return (
                    <div key={key} className={styles.quickRange + (key === selectedKey ? ' ' + styles.quickRangeActive : '')}>
                        <ActionLink onClickAsync={async () => this.submitRange(entry)}>{entry.label}</ActionLink>
                    </div>
                );
            });
        };

        const parseDate = (str, end) => {
            const date = dateMath.parse(str, end);
            if (date && date.isValid()) {
                return date.toDate();
            } else {
                return null;
            }
        };


        return (
            <div className={styles.widget}>
                <div className={styles.timeRange}>
                    <h3>{t('Time Range')}</h3>
                    <Form stateOwner={this} onSubmitAsync={::this.submitForm} format="wide">
                        <DatePicker
                            id="from"
                            label={t('From:')}
                            formatDate={date => moment.utc(date).format('YYYY-MM-DD') + ' 00:00:00'}
                            parseDate={str => parseDate(str, false)} format="wide"
                        />
                        <DatePicker
                            id="to"
                            label={t('To:')}
                            formatDate={date => moment.utc(date).format('YYYY-MM-DD') + ' 23:59:59'}
                            parseDate={str => parseDate(str, true)} format="wide"
                        />
                        <Dropdown id="aggregationInterval" label="Aggregation by:" format="wide" options={this.getAggregationOptions(this.getFormValue('from'), this.getFormValue('to'))} />
                        <div className={styles.refreshApplyRow}>
                            <div className={styles.refreshField}>
                                <Dropdown id="refreshInterval" label="Refreshing every:" format="wide" options={refreshOptions} />
                            </div>
                            <div className={styles.applyButton}>
                                <Button type="submit" className="btn-primary" label={t('Apply')}/>
                            </div>
                        </div>
                    </Form>
                </div>

                <div className={styles.separator}/>

                <div className={styles.quickRanges}>
                    <h3>{t('Quick Ranges')}</h3>
                    <div className={styles.quickRangesColumns}>
                        <div className={styles.quickRangesColumns}>
                            <div className={styles.quickRangesColumn}>
                                {getQuickRanges(0)}
                            </div>
                            <div className={styles.quickRangesColumn}>
                                {getQuickRanges(1)}
                            </div>
                        </div>
                        <div className={styles.quickRangesColumns}>
                            <div className={styles.quickRangesColumn}>
                                {getQuickRanges(2)}
                            </div>
                            <div className={styles.quickRangesColumn}>
                                {getQuickRanges(3)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    render() {
        const t = this.props.t;

        // FIXME:
        // - add timezone selection
        return (
            <div className="card">
                <div className="card-header" onClick={() => this.setState({ opened: !this.state.opened })}>
                    <div className={styles.headingDescription}>{this.getDescription()}</div>
                    <div className={styles.headingButtons}>
                        <ActionLink onClickAsync={async () => this.getInterval().goBack()}><Icon icon="chevron-left" title={t('Go back')}/></ActionLink>
                        <ActionLink onClickAsync={async () => this.getInterval().goForward()}><Icon icon="chevron-right" title={t('Go forward')}/></ActionLink>
                        <ActionLink onClickAsync={async () => this.getInterval().refresh()}><Icon icon="redo" title={t('Refresh')}/></ActionLink>
                        <ActionLink onClickAsync={async () => this.zoom(0.5)}><Icon icon="search-plus" title={t('Zoom in')}/></ActionLink>
                        <ActionLink onClickAsync={async () => this.zoom(2)}><Icon icon="search-minus" title={t('Zoom out')}/></ActionLink>
                        <ActionLink onClickAsync={async () => this.move(-0.8)}><Icon icon="arrow-left" title={t('Move left')}/></ActionLink>
                        <ActionLink onClickAsync={async () => this.move(0.8)}><Icon icon="arrow-right" title={t('Move right')}/></ActionLink>
                    </div>
                </div>
                { this.state.opened &&
                    <div className="card-body">
                        {this.renderRangePicker()}
                    </div>
                }
            </div>
        )
    }
}

@withComponentMixins([
    intervalAccessMixin()
])
export class PredefTimeRangeSelector extends Component {
    constructor(props, context) {
        super(props, context);
    }

    static propTypes = {
        ranges: PropTypes.array.isRequired
    }

    submitRange(entry) {
        const spec = new IntervalSpec(
            entry.from,
            entry.to,
            entry.aggregationInterval,
            entry.refreshInterval
        );

        this.getInterval().setSpec(spec);
    }

    render() {
        const intervalSpec = this.getIntervalSpec();
        const selectedKey = intervalSpec.from + ' to ' + intervalSpec.to;

        const fixedRanges = this.props.ranges.map(entry => {
            const key = entry.from + ' to ' + entry.to;
            return (
                <li key={key} className={(key === selectedKey ? 'active' : '')}>
                    <ActionLink onClickAsync={async () => this.submitRange(entry)}>{entry.label}</ActionLink>
                </li>
            );
        });

        return (
            <ul className="nav nav-pills">
                {fixedRanges}
            </ul>
        )
    }
}
