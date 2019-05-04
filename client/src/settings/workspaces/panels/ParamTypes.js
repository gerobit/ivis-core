'use strict';

import React from "react";
import {
    ACEEditor,
    AlignedRow,
    Button,
    CheckBox,
    ColorPicker,
    Fieldset,
    InputField,
    TableSelect,
    TextArea
} from "../../../lib/form";
import "brace/mode/html";
import "brace/mode/json";
import moment from "moment";
import {TableSelectMode} from "../../../lib/table";
import styles from "./ParamTypes.scss";
import {getFieldsetPrefix, parseCardinality, resolveAbs} from "../../../../../shared/templates";
import {getSignalTypes} from "../../signal-sets/signals/signal-types";
import {rgb} from "d3-color";

export default class ParamTypes {
    constructor(t) {
        this.paramTypes = {};

        // ---------------------------------------------------------------------
        // Helpers

        let paramId = 0;
        const nextParamId = () => {
            paramId++;
            return paramId;
        };

        const ensureString = value => {
            if (typeof value !== 'string') {
                return ''
            } else {
                return value;
            }
        };

        const ensureBoolean = (spec, value) => {
            if (typeof value !== 'boolean') {
                return spec['default'];
            } else {
                return value;
            }
        };

        const ensureColor = value => {
            if (typeof value !== 'object') {
                return {r: 0, g: 0, b: 0, a: 1};
            } else {
                return {r: value.r || 0, g: value.g || 0, b: value.b || 0, a: value.a || 1};
            }
        };

        const ensureSelection = (card, value) => {
            if (card.max === 1) {
                if (Array.isArray(value)) {
                    return null;
                } else {
                    return value;
                }
            } else {
                if (Array.isArray(value)) {
                    return value;
                } else {
                    return [];
                }
            }
        };

        const setStringFieldFromParam = (prefix, spec, param, data) => data[this.getParamFormId(prefix, spec.id)] = ensureString(param);

        const adoptString = (prefix, spec, state) => {
            const formId = this.getParamFormId(prefix, spec.id);
            state.setIn([formId, 'value'], ensureString(state.getIn([formId, 'value'])));
        };

        const upcastString = (spec, value) => ensureString(value);

        const getParamsFromField = (prefix, spec, data) => data[this.getParamFormId(prefix, spec.id)];

        const getACEEditor = mode => ({
            adopt: adoptString,
            setFields: setStringFieldFromParam,
            getParams: getParamsFromField,
            validate: (prefix, spec, state) => {
            },
            render: (self, prefix, spec) => <ACEEditor key={spec.id} id={this.getParamFormId(prefix, spec.id)}
                                                       label={spec.label} help={spec.help} mode={mode}
                                                       height={spec.height}/>,
            upcast: upcastString
        });


        // ---------------------------------------------------------------------
        // Parameter Type Handlers

        const signalTypes = getSignalTypes(t);

        this.paramTypes.boolean = {
            adopt: (prefix, spec, state) => {
                const formId = this.getParamFormId(prefix, spec.id);
                state.setIn([formId, 'value'], ensureBoolean(spec, state.getIn([formId, 'value'])));
            },
            setFields: (prefix, spec, param, data) => data[this.getParamFormId(prefix, spec.id)] = ensureBoolean(spec, param),
            getParams: getParamsFromField,
            validate: (prefix, spec, state) => {
            },
            render: (self, prefix, spec) => <CheckBox key={spec.id} id={this.getParamFormId(prefix, spec.id)}
                                                      label={spec.label} text="" help={spec.help}/>,
            upcast: (spec, value) => ensureBoolean(spec, value)
        };

        this.paramTypes.string = {
            adopt: adoptString,
            setFields: setStringFieldFromParam,
            getParams: getParamsFromField,
            validate: (prefix, spec, state) => {
            },
            render: (self, prefix, spec) => <InputField key={spec.id} id={this.getParamFormId(prefix, spec.id)}
                                                        label={spec.label} help={spec.help}/>,
            upcast: upcastString
        };


        this.paramTypes.number = {
            adopt: adoptString,
            setFields: setStringFieldFromParam,
            getParams: getParamsFromField,
            validate: (prefix, spec, state) => {
                const formId = this.getParamFormId(prefix, spec.id);
                const val = state.getIn([formId, 'value']);

                if ((spec.isRequired && val.trim() === '') || isNaN(val)) {
                    state.setIn([formId, 'error'], t('Please enter a number'));
                }
            },
            render: (self, prefix, spec) => <InputField key={spec.id} id={this.getParamFormId(prefix, spec.id)}
                                                        label={spec.label} help={spec.help}/>,
            upcast: (spec, value) => Number.parseInt(value)
        };


        this.paramTypes.text = {
            adopt: adoptString,
            setFields: setStringFieldFromParam,
            getParams: getParamsFromField,
            validate: (prefix, spec, state) => {
            },
            render: (self, prefix, spec) => <TextArea key={spec.id} id={this.getParamFormId(prefix, spec.id)}
                                                      label={spec.label} help={spec.help}/>,
            upcast: upcastString
        };


        this.paramTypes.html = getACEEditor('html');


        this.paramTypes.json = getACEEditor('json');


        this.paramTypes.color = {
            adopt: (prefix, spec, state) => {
                const formId = this.getParamFormId(prefix, spec.id);
                state.setIn([formId, 'value'], ensureColor(state.getIn([formId, 'value'])));
            },
            setFields: (prefix, spec, param, data) => data[this.getParamFormId(prefix, spec.id)] = ensureColor(param),
            getParams: getParamsFromField,
            validate: (prefix, spec, state) => {
            },
            render: (self, prefix, spec) => <ColorPicker key={spec.id} id={this.getParamFormId(prefix, spec.id)}
                                                         label={spec.label} help={spec.help}/>,
            upcast: (spec, value) => {
                const col = ensureColor(value);
                return rgb(col.r, col.g, col.b, col.a);
            }
        };


        this.paramTypes.signalSet = {
            adopt: (prefix, spec, state) => {
                const formId = this.getParamFormId(prefix, spec.id);
                state.setIn([formId, 'value'], null);
            },
            setFields: (prefix, spec, param, data) => {
                data[this.getParamFormId(prefix, spec.id)] = ensureSelection({min: 1, max: 1}, param);
            },
            getParams: getParamsFromField,
            validate: (prefix, spec, state) => {
                const formId = this.getParamFormId(prefix, spec.id);
                const sel = state.getIn([formId, 'value']);

                if (sel === undefined || sel === null) {
                    state.setIn([formId, 'error'], t('Exactly one item has to be selected'));
                }
            },
            render: (self, prefix, spec) => {
                const signalColumns = [
                    {data: 1, title: t('Id')},
                    {data: 2, title: t('Name')},
                    {data: 3, title: t('Description')},
                    {data: 5, title: t('Created'), render: data => moment(data).fromNow()},
                    {data: 7, title: t('Namespace')}
                ];

                return <TableSelect
                    key={spec.id}
                    id={this.getParamFormId(prefix, spec.id)}
                    label={spec.label}
                    help={spec.help}
                    columns={signalColumns}
                    withHeader
                    dropdown
                    selectMode={TableSelectMode.SINGLE}
                    selectionLabelIndex={2}
                    selectionKeyIndex={1}
                    dataUrl="rest/signal-sets-table"
                />;
            },
            upcast: (spec, value) => ensureSelection({min: 1, max: 1}, value)
        };


        this.paramTypes.signal = {
            adopt: (prefix, spec, state) => {
                const card = parseCardinality(spec.cardinality);
                const formId = this.getParamFormId(prefix, spec.id);
                state.setIn([formId, 'value'], card.max === 1 ? null : []);
            },
            setFields: (prefix, spec, param, data) => {
                const card = parseCardinality(spec.cardinality);
                data[this.getParamFormId(prefix, spec.id)] = ensureSelection(card, param);
            },
            getParams: getParamsFromField,
            validate: (prefix, spec, state) => {
                const card = parseCardinality(spec.cardinality);
                const formId = this.getParamFormId(prefix, spec.id);
                const sel = state.getIn([formId, 'value']);

                if (card.max === 1) {
                    if ((sel === undefined || sel === null) && card.min === 1) {
                        state.setIn([formId, 'error'], t('Exactly one item has to be selected'));
                    }
                } else if (sel.length < card.min) {
                    state.setIn([formId, 'error'], t('At least {{ count }} item(s) have to be selected', {count: spec.min}));
                } else if (sel.length > card.max) {
                    state.setIn([formId, 'error'], t('At most {{ count }} item(s) can be selected', {count: spec.max}));
                }
            },
            onChange: (prefix, spec, state, key, oldVal, newVal) => {
                if (spec.signalSetRef) {
                    const signalSetFormId = this.getParamFormId(prefix, spec.signalSetRef);

                    // Checks for changes in root and on the same param tree level
                    const signalSetRootFormId = this.getParamFormId('/', spec.signalSetRef);
                    if ((key === signalSetFormId || key === signalSetRootFormId)
                        && oldVal !== newVal) {
                        const formId = this.getParamFormId(prefix, spec.id);
                        const card = parseCardinality(spec.cardinality);
                        state.setIn([formId, 'value'], card.max === 1 ? null : []);
                    }
                }

            },
            render: (self, prefix, spec) => {
                let signalSetCid = spec.signalSet;
                if (spec.signalSetRef) {
                    let signalSetFormId = this.getParamFormId(prefix, spec.signalSetRef);
                    signalSetCid = self.getFormValue(signalSetFormId);

                    // Fallback when the reference is not found on the current level
                    // look for it in the root of the params
                    if (!signalSetCid) {
                        signalSetFormId = this.getParamFormId('/', spec.signalSetRef);
                        signalSetCid = self.getFormValue(signalSetFormId);
                    }
                }

                const card = parseCardinality(spec.cardinality);
                const signalColumns = [
                    {data: 1, title: t('Id')},
                    {data: 2, title: t('Name')},
                    {data: 3, title: t('Description')},
                    {data: 4, title: t('Type'), render: data => signalTypes[data]},
                    {data: 5, title: t('Created'), render: data => moment(data).fromNow()},
                    {data: 6, title: t('Namespace')}
                ];

                let dataUrl, data;
                if (signalSetCid) {
                    return <TableSelect
                        key={spec.id}
                        id={this.getParamFormId(prefix, spec.id)}
                        label={spec.label}
                        help={spec.help}
                        columns={signalColumns}
                        withHeader
                        dropdown
                        selectMode={card.max === 1 ? TableSelectMode.SINGLE : TableSelectMode.MULTI}
                        selectionLabelIndex={2}
                        selectionKeyIndex={1}
                        data={data}
                        dataUrl={`rest/signals-table-by-cid/${signalSetCid}`}
                    />;
                } else {
                    return <AlignedRow key={spec.id}>
                        <div>{t('Select signal set to see the list of signals.')}</div>
                    </AlignedRow>
                }


            },
            upcast: (spec, value) => {
                const card = parseCardinality(spec.cardinality);
                return ensureSelection(card, value);
            }
        };


        /*
          The form data has the following structure depending on cardinality:
          0..1:
          - field param_/XXX = true -> param_/XXX/childN contains childN data

          1..1:
          - field param_/XXX is true, param_/XXX/childN contains childN data

          *..n:
          - field param_/XXX = [id1], param_/XXX/[id1]/childN contains childN data

          If spec.flat is true, it is rendered without label and without the encapsulating fieldset
         */
        this.paramTypes.fieldset = {
            adopt: (prefix, spec, state) => {
                const card = parseCardinality(spec.cardinality);
                const childrenPrefix = getFieldsetPrefix(prefix, spec);
                const formId = this.getParamFormId(prefix, spec.id);

                const childParamPrefix = this.getParamFormId(childrenPrefix);
                for (const childFormId of state.keys()) {
                    if (childFormId.startsWith(childParamPrefix)) {
                        state.deleteIn([childFormId, 'error']);
                    }
                }

                if (spec.children) {
                    if (card.max === 1) {
                        if (card.min === 1) {
                            // If cardinality is 1, initilize the children
                            const childPrefix = getFieldsetPrefix(prefix, spec);
                            for (const childSpec of spec.children) {
                                this.getSanitizedParamType(childSpec.type).adopt(childPrefix, childSpec, state);
                            }

                            state.setIn([formId, 'value'], true);
                        } else {
                            state.setIn([formId, 'value'], false);
                        }
                    } else {
                        state.setIn([formId, 'value'], []);
                    }
                }
            },
            setFields: (prefix, spec, param, data) => {
                const card = parseCardinality(spec.cardinality);
                const formId = this.getParamFormId(prefix, spec.id);

                if (card.max === 1) {
                    if (typeof param !== 'object') {
                        param = card.min === 1 ? {} : null;
                    }
                } else {
                    if (!Array.isArray(param)) {
                        param = [];
                    }
                }

                const setChildFields = (params, entryId) => {
                    const childPrefix = getFieldsetPrefix(prefix, spec, entryId);
                    for (const childSpec of spec.children) {
                        this.getSanitizedParamType(childSpec.type).setFields(childPrefix, childSpec, params[childSpec.id], data);
                    }
                };

                if (spec.children) {
                    if (card.max === 1) {
                        if (param !== null) {
                            setChildFields(param);
                            data[formId] = true;
                        } else {
                            data[formId] = false;
                        }
                    } else {
                        data[formId] = [];
                        for (const entryParams of param) {
                            const entryId = nextParamId();
                            data[formId].push(entryId);
                            setChildFields(entryParams, entryId);
                        }
                    }
                }
            },
            getParams: (prefix, spec, data) => {
                const card = parseCardinality(spec.cardinality);
                const formId = this.getParamFormId(prefix, spec.id);
                let params;

                const getChildParams = (entryId) => {
                    const childParams = {};
                    for (const childSpec of spec.children) {
                        childParams[childSpec.id] = this.getSanitizedParamType(childSpec.type).getParams(getFieldsetPrefix(prefix, spec, entryId), childSpec, data);
                    }
                    return childParams;
                };

                const childEntries = data[formId];
                if (spec.children) {
                    if (card.max === 1) {
                        if (childEntries) {
                            params = getChildParams();
                        } else {
                            params = null;
                        }
                    } else {
                        params = [];
                        for (const entryId of childEntries) {
                            params.push(getChildParams(entryId));
                        }
                    }
                }

                return params;
            },
            validate: (prefix, spec, state) => {
                const card = parseCardinality(spec.cardinality);
                const formId = this.getParamFormId(prefix, spec.id);

                if (spec.children) {
                    const childEntries = state.getIn([formId, 'value']);

                    const processChild = (entryId) => {
                        for (const childSpec of spec.children) {
                            this.getSanitizedParamType(childSpec.type).validate(getFieldsetPrefix(prefix, spec, entryId), childSpec, state);
                        }
                    };

                    if (card.max === 1) {
                        if (childEntries) {
                            processChild();
                        }
                    } else {
                        for (const entryId of childEntries) {
                            processChild(entryId);
                        }

                        if (childEntries.length < card.min) {
                            state.setIn([formId, 'error'], t('There have to be at least {{ count }} entries', {count: card.min}));
                        } else if (childEntries.length > card.max) {
                            state.setIn([formId, 'error'], t('There can be at most {{ count }} entries', {count: card.max}));
                        }
                    }
                }
            },
            onChange: (prefix, spec, state, key, oldVal, newVal) => {
                const card = parseCardinality(spec.cardinality);
                const formId = this.getParamFormId(prefix, spec.id);

                const processChild = entryId => {
                    for (const childSpec of spec.children) {
                        const onChange = this.getSanitizedParamType(childSpec.type).onChange;
                        if (onChange) {
                            onChange(getFieldsetPrefix(prefix, spec, entryId), childSpec, state, key, oldVal, newVal);
                        }
                    }
                };

                if (spec.children) {
                    const childEntries = state.getIn([formId, 'value']);
                    if (card.max === 1) {
                        if (childEntries) {
                            processChild();
                        }
                    } else {
                        for (const entryId of childEntries) {
                            processChild(entryId);
                        }
                    }
                }
            },
            render: (self, prefix, spec) => {
                const card = parseCardinality(spec.cardinality);
                const formId = this.getParamFormId(prefix, spec.id);

                const fields = [];
                if (spec.children) {
                    const childEntries = self.getFormValue(formId);

                    // This method is used only for non-singletons (i.e. cardinality other than 1)
                    const onAddEntry = beforeIdx => (async () =>
                            self.updateForm(mutState => {
                                if (card.max === 1) {
                                    const childPrefix = getFieldsetPrefix(prefix, spec);
                                    for (const childSpec of spec.children) {
                                        this.getSanitizedParamType(childSpec.type).adopt(childPrefix, childSpec, mutState);
                                    }

                                    mutState.setIn([formId, 'value'], true);

                                } else {
                                    const order = mutState.getIn([formId, 'value']);

                                    const entryId = nextParamId();
                                    const newOrder = [...order.slice(0, beforeIdx), entryId, ...order.slice(beforeIdx)];

                                    const childPrefix = getFieldsetPrefix(prefix, spec, entryId);
                                    for (const childSpec of spec.children) {
                                        this.getSanitizedParamType(childSpec.type).adopt(childPrefix, childSpec, mutState);
                                    }

                                    mutState.setIn([formId, 'value'], newOrder);
                                }
                            })
                    );

                    const processChild = (entryIdx, entryId) => {
                        const childPrefix = getFieldsetPrefix(prefix, spec, entryId);

                        const childFields = [];
                        for (const childSpec of spec.children) {
                            childFields.push(this.getSanitizedParamType(childSpec.type).render(self, childPrefix, childSpec));
                        }

                        fields.push(
                            <div key={card.max === 1 ? 'singleton' : entryId}
                                 className={styles.entry + (card.max === 1 && card.min === 1 ? '' : ' ' + styles.entryWithButtons)}>
                                {!(card.min === 1 && card.max === 1) &&
                                <div className={styles.entryButtons}>
                                    {((card.max === 1 && childEntries) || childEntries.length > card.min) &&
                                    <Button
                                        className="btn-secondary"
                                        icon="trash"
                                        title={t('Remove')}
                                        onClickAsync={async () =>
                                            self.updateForm(mutState => {
                                                const childParamPrefix = this.getParamFormId(childPrefix);
                                                for (const childFormId of mutState.keys()) {
                                                    if (childFormId.startsWith(childParamPrefix)) {
                                                        mutState.delete(childFormId);
                                                    }
                                                }

                                                if (card.max === 1) {
                                                    mutState.setIn([formId, 'value'], false);
                                                } else {
                                                    const order = mutState.getIn([formId, 'value']).filter((val, idx) => idx !== entryIdx);
                                                    mutState.setIn([formId, 'value'], order);
                                                }
                                            })
                                        }
                                    />
                                    }
                                    {((card.max === 1 && !childEntries) || childEntries.length < card.max) &&
                                    <Button
                                        className="btn-secondary"
                                        icon="plus"
                                        title={t('Insert new entry before this one')}
                                        onClickAsync={onAddEntry(entryIdx)}
                                    />
                                    }
                                    {card.max !== 1 && entryIdx > 0 &&
                                    <Button
                                        className="btn-secondary"
                                        icon="chevron-up"
                                        title={t('Move up')}
                                        onClickAsync={async () => {
                                            const order = self.getFormValue(formId);
                                            self.updateFormValue(formId, [...order.slice(0, entryIdx - 1), order[entryIdx], order[entryIdx - 1], ...order.slice(entryIdx + 1)]);
                                        }}
                                    />
                                    }
                                    {card.max !== 1 && entryIdx < childEntries.length - 1 &&
                                    <Button
                                        className="btn-secondary"
                                        icon="chevron-down"
                                        title={t('Move down')}
                                        onClickAsync={async () => {
                                            const order = self.getFormValue(formId);
                                            self.updateFormValue(formId, [...order.slice(0, entryIdx), order[entryIdx + 1], order[entryIdx], ...order.slice(entryIdx + 2)]);
                                        }}
                                    />
                                    }
                                </div>
                                }
                                <div className={styles.entryContent}>
                                    {childFields}
                                </div>
                            </div>
                        );
                    };


                    if (card.max === 1) {
                        if (childEntries) {
                            processChild();
                        }
                    } else {
                        for (let entryIdx = 0; entryIdx < childEntries.length; entryIdx++) {
                            processChild(entryIdx, childEntries[entryIdx]);
                        }
                    }

                    if ((card.max === 1 && !childEntries) || childEntries.length < card.max) {
                        fields.push(
                            <div key="newEntry" className={styles.newEntry}>
                                <Button
                                    className="btn-secondary"
                                    icon="plus"
                                    label={t('Add entry')}
                                    onClickAsync={onAddEntry(childEntries.length)}
                                />
                            </div>
                        );
                    }
                }

                return <Fieldset key={spec.id} id={formId} label={spec.label} flat={spec.flat}>{fields}</Fieldset>;
            },
            upcast: (spec, value) => {
                const upcastChild = (childConfig) => {
                    const upcastedConfig = {};
                    for (const childSpec of spec.children) {
                        upcastedConfig[childSpec.id] = this.getSanitizedParamType(childSpec.type).upcast(childSpec, childConfig[childSpec.id]);
                    }

                    return upcastedConfig;
                };


                const card = parseCardinality(spec.cardinality);
                if (card.max === 1) {
                    if (spec.children) {
                        if (value) {
                            return upcastChild(value);
                        }
                    } else {
                        return null;
                    }
                } else {
                    if (spec.children) {
                        const result = [];

                        for (const childConfig of value) {
                            result.push(upcastChild(childConfig));
                        }

                        return result;
                    } else {
                        return [];
                    }
                }
            }
        };
    }

    adopt(configSpec, mutStateData) {
        if (Array.isArray(configSpec)) {
            for (const spec of configSpec) {
                this.getSanitizedParamType(spec.type).adopt('/', spec, mutStateData);
            }
        } else {
            this.getSanitizedParamType(configSpec.type).adopt(null, configSpec, mutStateData);
        }
    }

    onChange(configSpec, mutStateData, key, oldVal, newVal) {
        if (Array.isArray(configSpec)) {
            for (const spec of configSpec) {
                const onChange = this.getSanitizedParamType(spec.type).onChange;
                if (onChange) {
                    onChange('/', spec, mutStateData, key, oldVal, newVal);
                }
            }
        } else {
            const onChange = this.getSanitizedParamType(configSpec.type).onChange;
            if (onChange) {
                onChange(null, configSpec, mutStateData, key, oldVal, newVal);
            }
        }
    }

    setFields(configSpec, config, data) {
        if (Array.isArray(configSpec)) {
            for (const spec of configSpec) {
                this.getSanitizedParamType(spec.type).setFields('/', spec, config[spec.id], data);
            }
        } else {
            this.getSanitizedParamType(configSpec.type).setFields(null, configSpec, config, data);
        }
    }

    getParams(configSpec, data) {
        if (Array.isArray(configSpec)) {
            const config = {};
            for (const spec of configSpec) {
                config[spec.id] = this.getSanitizedParamType(spec.type).getParams('/', spec, data);
            }
            return config;
        } else {
            return this.getSanitizedParamType(configSpec.type).getParams(null, configSpec, data);
        }
    }

    localValidate(configSpec, state) {
        if (Array.isArray(configSpec)) {
            for (const spec of configSpec) {
                this.getSanitizedParamType(spec.type).validate('/', spec, state);
            }
        } else {
            this.getSanitizedParamType(configSpec.type).validate(null, configSpec, state);
        }
    }

    render(configSpec, self) {
        const params = [];

        if (Array.isArray(configSpec)) {
            for (const spec of configSpec) {
                const field = this.getSanitizedParamType(spec.type).render(self, '/', spec);
                if (field) {
                    params.push(field);
                }
            }
        } else {
            const field = this.getSanitizedParamType(configSpec.type).render(self, null, configSpec);
            if (field) {
                params.push(field);
            }
        }

        if (params.length > 0) {
            return (
                <div className={styles.params}>
                    {params}
                </div>
            );
        } else {
            return null;
        }
    }

    upcast(configSpec, config) {
        if (Array.isArray(configSpec)) {
            const upcastedConfig = {};

            // These are entries for which we have type specification (from template params)
            for (const spec of configSpec) {
                upcastedConfig[spec.id] = this.getSanitizedParamType(spec.type).upcast(spec, config[spec.id]);
            }

            // These are ad-hoc configuration entries that are potentially added by ivis components (Legend, TimeContext, etc.)
            // We don't have type spec for them, so we only copy them. The respective components are responsible for correctly
            // importing and upcasting the config
            for (const configKey in config) {
                if (!(configKey in upcastedConfig)) {
                    upcastedConfig[configKey] = config[configKey];
                }
            }

            return upcastedConfig;
        } else {
            return this.getSanitizedParamType(configSpec.type).upcast(configSpec, config);
        }
    }

    getParamPrefix() {
        return this.getParamFormId('/');
    }


    // ------------------------------------------------------------------
    // Private methods

    getSanitizedParamType(type) {
        let paramType;
        if (type in this.paramTypes) {
            paramType = this.paramTypes[type];
        } else {
            paramType = {
                adopt: (prefix, spec, state) => {
                },
                setFields: (prefix, spec, param, data) => {
                },
                getParams: (prefix, spec, data) => {
                },
                validate: (prefix, spec, state) => {
                },
                onChange: (prefix, spec, state, key, oldVal, newVal) => {
                },
                render: (self, prefix, spec) => {
                },
                upcast: value => null
            };
        }

        return paramType;
    }

    getParamFormId(prefix, paramId) {
        const abs = paramId ? resolveAbs(prefix, paramId) : prefix;
        const formId = 'param_' + abs;
        return formId;
    }
}
