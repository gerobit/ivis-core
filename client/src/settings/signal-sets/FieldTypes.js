'use strict';

import React from "react";
import {CheckBox, DatePicker, InputField} from "../../lib/form";
import moment from "moment";

const { SignalType } = require('../../../../shared/signals');

export default class FieldTypes {
    constructor(t, signalsVisibleForEdit) {
        this.signalsVisibleForEdit = signalsVisibleForEdit;

        this.fieldTypes = {};

        this.fieldTypes[SignalType.INTEGER] = this.fieldTypes[SignalType.LONG] = {
            localValidate: (sigSpec, state, formId) => {
                const val = state.getIn([formId, 'value']);

                if (val !== '' && !Number.isInteger(val)) {
                    state.setIn([formId, 'error'], t('Please enter a valid integer number'));
                }
            },
            render: (sigSpec, self, formId) => <InputField key={sigSpec.cid} id={formId} label={sigSpec.name}/>,
            getSignal: (sigSpec, data, formId) => data[formId] === '' ? null : Number.parseInt(data[formId]),
            populateFields: (sigSpec, data, value, formId) => data[formId] = value === null ? '' : value.toString()
        };

        this.fieldTypes[SignalType.FLOAT] = this.fieldTypes[SignalType.DOUBLE] = {
            localValidate: (sigSpec, state, formId) => {
                const val = state.getIn([formId, 'value']);

                if (val !== '' && Number.isNaN(val)) {
                    state.setIn([formId, 'error'], t('Please enter a valid floating point number'));
                }
            },
            render: (sigSpec, self, formId) => <InputField key={sigSpec.cid} id={formId} label={sigSpec.name}/>,
            getSignal: (sigSpec, data, formId) => data[formId] === '' ? null : Number.parseFloat(data[formId]),
            populateFields: (sigSpec, data, value, formId) => data[formId] = value === null ? '' : value.toString()
        };

        this.fieldTypes[SignalType.BOOLEAN] = {
            localValidate: (sigSpec, state, formId) => { },
            render: (sigSpec, self, formId) => <CheckBox key={sigSpec.cid} id={formId} label={sigSpec.name}/>,
            getSignal: (sigSpec, data, formId) => data[formId],
            populateFields: (sigSpec, data, value, formId) => data[formId] = value
        };

        this.fieldTypes[SignalType.KEYWORD] = this.fieldTypes[SignalType.TEXT] = {
            localValidate: (sigSpec, state, formId) => { },
            render: (sigSpec, self, formId) => <InputField key={sigSpec.cid} id={formId} label={sigSpec.name}/>,
            getSignal: (sigSpec, data, formId) => data[formId] === '' ? null : data[formId],
            populateFields: (sigSpec, data, value, formId) => data[formId] = value === null ? '' : value
        };


        const parseDate = str => {
            const date = moment(str, 'YYYY-MM-DD HH:mm:ss');
            if (date && date.isValid()) {
                return date.toDate();
            } else {
                return null;
            }
        };

        this.fieldTypes[SignalType.DATE_TIME] = {
            localValidate: (sigSpec, state, formId) => { },
            render: (sigSpec, self, formId) =>
                <DatePicker
                    key={sigSpec.cid}
                    id={formId}
                    label={sigSpec.name}
                    formatDate={date => moment(date).format('YYYY-MM-DD') + ' 00:00:00'}
                    parseDate={str => parseDate(str)}
                />
            ,
            getSignal: (sigSpec, data, formId) => data[formId] === '' ? null : parseDate(data[formId]),
            populateFields: (sigSpec, data, value, formId) => data[formId] = value === null ? moment().format('YYYY-MM-DD HH:mm:ss') : moment(value).format('YYYY-MM-DD HH:mm:ss')
        };
    }


    localValidate(state) {
        for (const sigSpec of this.signalsVisibleForEdit) {
            this.fieldTypes[sigSpec.type].localValidate(sigSpec, state, this.getFormId(sigSpec.cid));
        }
    }

    render(self) {
        const rows = [];

        for (const sigSpec of this.signalsVisibleForEdit) {
            rows.push(this.fieldTypes[sigSpec.type].render(sigSpec, self, this.getFormId(sigSpec.cid)));
        }

        return rows;
    }

    getSignals(data) {
        const signals = {};

        for (const sigSpec of this.signalsVisibleForEdit) {
            signals[sigSpec.cid] = this.fieldTypes[sigSpec.type].getSignal(sigSpec, data, this.getFormId(sigSpec.cid));
        }

        return signals;
    }

    populateFields(data, signals) {
        for (const sigSpec of this.signalsVisibleForEdit) {
            this.fieldTypes[sigSpec.type].populateFields(sigSpec, data, signals && sigSpec.cid in signals ? signals[sigSpec.cid] : null, this.getFormId(sigSpec.cid));
        }
    }


    getPrefix() {
        return this.getFormId('');
    }


    // ------------------------------------------------------------------
    // Private methods

    getFormId(fieldId) {
        return 'field_' + fieldId;
    }
}
