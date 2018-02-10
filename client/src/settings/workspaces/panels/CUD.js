'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {translate} from "react-i18next";
import {NavButton, requiresAuthenticatedUser, withPageHelpers} from "../../../lib/page";
import {
    ACEEditor,
    AlignedRow,
    Button,
    ButtonRow,
    ColorPicker,
    Dropdown,
    Fieldset,
    Form,
    FormSendMethod,
    InputField,
    TableSelect,
    TextArea,
    withForm
} from "../../../lib/form";
import "brace/mode/html";
import "brace/mode/json";
import {withAsyncErrorHandler, withErrorHandling} from "../../../lib/error-handling";
import {NamespaceSelect, validateNamespace} from "../../../lib/namespace";
import {DeleteModalDialog} from "../../../lib/modals";
import {Panel} from "../../../lib/panel";
import axios from "../../../lib/axios";
import moment from "moment";
import ivisConfig from "ivisConfig";
import {TableSelectMode} from "../../../lib/table";
import styles from "./CUD.scss";
import {parseCardinality} from "../../../../../shared/templates";
import {getSignalTypes} from "../../signal-sets/signals/signal-types";

let paramId = 0;
function nextParamId() {
    paramId++;
    return paramId;
}

function getParamFormId(prefix, paramId) {
    return 'param_' + prefix + (paramId || '');
}

const getFieldsetPrefix = (prefix, spec, idx) => {
    return prefix + '.' + spec.id + (idx !== undefined ? `.[${idx}]` : '');
};


const ensureString = value => {
    if (typeof value !== 'string') {
        return ''
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

const setStringFieldFromParam = (prefix, spec, param, data) => data[getParamFormId(prefix, spec.id)] = ensureString(param);

const setNumberFieldFromParam = (prefix, spec, param, data) => data[getParamFormId(prefix, spec.id)] = Number.parseFloat(ensureString(param));

const adoptString = (prefix, spec, state) => {
    const formId = getParamFormId(prefix, spec.id);
    state.setIn([formId, 'value'], ensureString(state.getIn([formId, 'value'])));
};

const getParamsFromField = (prefix, spec, data) => data[getParamFormId(prefix, spec.id)];

const getACEEditor = mode => ({
    adopt: adoptString,
    setFields: setStringFieldFromParam,
    getParams: getParamsFromField,
    validate: (prefix, spec, state) => {},
    render: (self, prefix, spec) => <ACEEditor key={spec.id} id={getParamFormId(prefix, spec.id)} label={spec.label} help={spec.help} mode={mode} height={spec.height}/>
});


function getParamTypes(t) {
    const signalTypes = getSignalTypes(t);

    let paramTypes = {};

    paramTypes.string = {
        adopt: adoptString,
        setFields: setStringFieldFromParam,
        getParams: getParamsFromField,
        validate: (prefix, spec, state) => {},
        render: (self, prefix, spec) => <InputField key={spec.id} id={getParamFormId(prefix, spec.id)} label={spec.label} help={spec.help}/>
    };


    paramTypes.number = {
        adopt: adoptString,
        setFields: setStringFieldFromParam,
        getParams: getParamsFromField,
        validate: (prefix, spec, state) => {
            const formId = getParamFormId(prefix, spec.id);
            const val = state.getIn([formId, 'value']);

            if (isNaN(val)) {
                state.setIn([formId, 'error'], t('Please enter a number'));
            }
        },
        render: (self, prefix, spec) => <InputField key={spec.id} id={getParamFormId(prefix, spec.id)} label={spec.label} help={spec.help}/>
    };


    paramTypes.text = {
        adopt: adoptString,
        setFields: setStringFieldFromParam,
        getParams: getParamsFromField,
        validate: (prefix, spec, state) => {},
        render: (self, prefix, spec) => <TextArea key={spec.id} id={getParamFormId(prefix, spec.id)} label={spec.label} help={spec.help}/>
    };


    paramTypes.html = getACEEditor('html');


    paramTypes.json = getACEEditor('json');


    paramTypes.color = {
        adopt: (prefix, spec, state) => {
            const formId = getParamFormId(prefix, spec.id);
            state.setIn([formId, 'value'], ensureColor(state.getIn([formId, 'value'])));
        },
        setFields: (prefix, spec, param, data) => data[getParamFormId(prefix, spec.id)] = ensureColor(param),
        getParams: getParamsFromField,
        validate: (prefix, spec, state) => {},
        render: (self, prefix, spec) => <ColorPicker key={spec.id} id={getParamFormId(prefix, spec.id)} label={spec.label} help={spec.help}/>
    };


    paramTypes.signalSet = {
        adopt: (prefix, spec, state) => {
            const formId = getParamFormId(prefix, spec.id);
            state.setIn([formId, 'value'], null);
        },
        setFields: (prefix, spec, param, data) => {
            data[getParamFormId(prefix, spec.id)] = ensureSelection({min: 1, max: 1}, param);
        },
        getParams: getParamsFromField,
        validate: (prefix, spec, state) => {
            const formId = getParamFormId(prefix, spec.id);
            const sel = state.getIn([formId, 'value']);

            if (sel === undefined || sel === null) {
                state.setIn([formId, 'error'], t('Exactly one item has to be selected'));
            }
        },
        render: (self, prefix, spec) => {
            const signalColumns = [
                { data: 1, title: t('Id') },
                { data: 2, title: t('Name') },
                { data: 3, title: t('Description') },
                { data: 4, title: t('Type'), render: data => data ? t('Aggs'): t('Vals') },
                { data: 6, title: t('Created'), render: data => moment(data).fromNow() },
                { data: 7, title: t('Namespace') }
            ];

            return <TableSelect
                key={spec.id}
                id={getParamFormId(prefix, spec.id)}
                label={spec.label}
                help={spec.help}
                columns={signalColumns}
                withHeader
                dropdown
                selectMode={TableSelectMode.SINGLE}
                selectionLabelIndex={1}
                selectionKeyIndex={1}
                dataUrl="/rest/signal-sets-table"
            />;
        }
    };


    paramTypes.signal = {
        adopt: (prefix, spec, state) => {
            const card = parseCardinality(spec.cardinality);
            const formId = getParamFormId(prefix, spec.id);
            state.setIn([formId, 'value'], card.max === 1 ? null : []);
        },
        setFields: (prefix, spec, param, data) => {
            const card = parseCardinality(spec.cardinality);
            data[getParamFormId(prefix, spec.id)] = ensureSelection(card, param);
        },
        getParams: getParamsFromField,
        validate: (prefix, spec, state) => {
            const card = parseCardinality(spec.cardinality);
            const formId = getParamFormId(prefix, spec.id);
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
            const signalSetFormId = getParamFormId('', spec.signalSet);
            if (key === signalSetFormId && oldVal !== newVal) {
                const formId = getParamFormId(prefix, spec.id);
                const card = parseCardinality(spec.cardinality);
                state.setIn([formId, 'value'], card.max === 1 ? null : []);
            }

        },
        render: (self, prefix, spec) => {
            const signalSetFormId = getParamFormId('', spec.signalSet);
            const signalSetCid = self.getFormValue(signalSetFormId);

            const card = parseCardinality(spec.cardinality);
            const signalColumns = [
                { data: 1, title: t('Id') },
                { data: 2, title: t('Name') },
                { data: 3, title: t('Description') },
                { data: 4, title: t('Type'), render: data => signalTypes[data] },
                { data: 5, title: t('Created'), render: data => moment(data).fromNow() },
                { data: 6, title: t('Namespace') }
            ];

            let dataUrl, data;
            if (signalSetCid) {
                return <TableSelect
                    key={spec.id}
                    id={getParamFormId(prefix, spec.id)}
                    label={spec.label}
                    help={spec.help}
                    columns={signalColumns}
                    withHeader
                    dropdown
                    selectMode={card.max === 1 ? TableSelectMode.SINGLE : TableSelectMode.MULTI}
                    selectionLabelIndex={1}
                    selectionKeyIndex={1}
                    data={data}
                    dataUrl={`/rest/signals-table-by-cid/${signalSetCid}`}
                />;
            } else {
                return <AlignedRow key={spec.id}><div>{t('Select signal set to see the list of signals.')}</div></AlignedRow>
            }


        }
    };


    paramTypes.fieldset = {
        adopt: (prefix, spec, state) => {
            const card = parseCardinality(spec.cardinality);
            const childrenPrefix = getFieldsetPrefix(prefix, spec, 'singleton');
            const formId = getParamFormId(prefix, spec.id);

            const childParamPrefix = getParamFormId(childrenPrefix);
            for (const childFormId of state.keys()) {
                if (childFormId.startsWith(childParamPrefix)) {
                    state.deleteIn([childFormId, 'error']);
                }
            }

            if (spec.children) {
                if (card.max === 1 && card.min === 1) {
                    const childPrefix = getFieldsetPrefix(prefix, spec, 'singleton');
                    for (const childSpec of spec.children) {
                        paramTypes[childSpec.type].adopt(childPrefix, childSpec, state);
                    }

                    state.setIn([formId, 'value'], ['singleton'])
                } else {
                    state.setIn([formId, 'value'], []);
                }
            }
        },
        setFields: (prefix, spec, param, data) => {
            const card = parseCardinality(spec.cardinality);
            const formId = getParamFormId(prefix, spec.id);

            if (card.max === 1) {
                if (typeof param !== 'object') {
                    param = card.min === 1 ? {} : null;
                }
            } else {
                if (!Array.isArray(param)) {
                    param = [];
                }
            }

            const setChildFields = (entryId, params) => {
                const childPrefix = getFieldsetPrefix(prefix, spec, entryId);
                for (const childSpec of spec.children) {
                    paramTypes[childSpec.type].setFields(childPrefix, childSpec, params[childSpec.id], data);
                }
            };

            if (spec.children) {
                if (card.max === 1) {
                    if (card.min === 1 || param !== null) {
                        setChildFields('singleton', param);
                        data[formId] = ['singleton'];
                    } else {
                        data[formId] = [];
                    }
                } else {
                    data[formId] = [];
                    for (const entryParams of param) {
                        const entryId = nextParamId();
                        data[formId].push(entryId);
                        setChildFields(entryId, entryParams);
                    }
                }
            }
        },
        getParams: (prefix, spec, data) => {
            const card = parseCardinality(spec.cardinality);
            const formId = getParamFormId(prefix, spec.id);
            let params;

            const getChildParams = (entryId) => {
                const childParams = {};
                for (const childSpec of spec.children) {
                    childParams[childSpec.id] = paramTypes[childSpec.type].getParams(getFieldsetPrefix(prefix, spec, entryId), childSpec, data);
                }
                return childParams;
            };

            if (spec.children) {
                const childEntries = data[formId];
                if (card.max === 1) {
                    if (card.min === 1 || childEntries.length > 0) {
                        params = getChildParams('singleton');
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
            const formId = getParamFormId(prefix, spec.id);

            if (spec.children) {
                const childEntries = state.getIn([formId, 'value']);
                for (const entryId of childEntries) {
                    for (const childSpec of spec.children) {
                        paramTypes[childSpec.type].validate(getFieldsetPrefix(prefix, spec, entryId), childSpec, state);
                    }
                }

                if (childEntries.length < card.min) {
                    state.setIn([formId, 'error'], t('There have to be at least {{ count }} entries', {count: card.min}));
                } else if (childEntries.length > card.max) {
                    state.setIn([formId, 'error'], t('There can be at most {{ count }} entries', {count: card.max}));
                }
            }
        },
        onChange: (prefix, spec, state, key, oldVal, newVal) => {
            const formId = getParamFormId(prefix, spec.id);

            if (spec.children) {
                const childEntries = state.getIn([formId, 'value']);
                for (const entryId of childEntries) {
                    for (const childSpec of spec.children) {
                        const onChange = paramTypes[childSpec.type].onChange;
                        if (onChange) {
                            onChange(getFieldsetPrefix(prefix, spec, entryId), childSpec, state, key, oldVal, newVal);

                        }
                    }
                }
            }
        },
        render: (self, prefix, spec) => {
            const card = parseCardinality(spec.cardinality);
            const formId = getParamFormId(prefix, spec.id);

            const fields = [];
            if (spec.children) {
                const childEntries = self.getFormValue(formId);

                const onAddEntry = beforeIdx => (() =>
                    self.setState(previousState => ({
                        formState: previousState.formState.update('data', data => data.withMutations(mutState => {
                            const order = mutState.getIn([formId, 'value']);

                            const entryId = card.max === 1 ? 'singleton' : nextParamId();
                            const newOrder = [...order.slice(0, beforeIdx), entryId, ...order.slice(beforeIdx)];

                            const childPrefix = getFieldsetPrefix(prefix, spec, entryId);
                            for (const childSpec of spec.children) {
                                paramTypes[childSpec.type].adopt(childPrefix, childSpec, mutState);
                            }

                            mutState.setIn([formId, 'value'], newOrder);
                        }))
                    }))
                );

                for (let entryIdx = 0; entryIdx < childEntries.length; entryIdx++) {
                    const entryId = childEntries[entryIdx];
                    const childPrefix = getFieldsetPrefix(prefix, spec, entryId);

                    const childFields = [];
                    for (const childSpec of spec.children) {
                        childFields.push(paramTypes[childSpec.type].render(self, childPrefix, childSpec));
                    }

                    const anyButtons = !(card.max === 1 && card.min === 1) || entryIdx > 0 || entryIdx < childEntries.length - 1;
                    fields.push(
                        <div key={entryId} className={styles.entry + (anyButtons ? ' ' + styles.entryWithButtons : '')}>
                            {anyButtons &&
                            <div className={styles.entryButtons}>
                                {!(card.max === 1 && card.min === 1) &&
                                <Button
                                    icon="remove"
                                    title={t('Remove')}
                                    onClickAsync={() =>
                                        self.setState(previousState => ({
                                            formState: previousState.formState.update('data', data => data.withMutations(mutState => {
                                                const childParamPrefix = getParamFormId(childPrefix);
                                                for (const childFormId of mutState.keys()) {
                                                    if (childFormId.startsWith(childParamPrefix)) {
                                                        mutState.delete(childFormId);
                                                    }
                                                }

                                                const order = mutState.getIn([formId, 'value']).filter((val, idx) => idx !== entryIdx);
                                                mutState.setIn([formId, 'value'], order);
                                            }))
                                        }))
                                    }
                                />
                                }
                                {card.max > 1 &&
                                <Button
                                    icon="plus"
                                    title={t('Insert new entry before this one')}
                                    onClickAsync={onAddEntry(entryIdx)}
                                />
                                }
                                {entryIdx > 0 &&
                                <Button
                                    icon="chevron-up"
                                    title={t('Move up')}
                                    onClickAsync={() =>
                                        self.setState(previousState => ({
                                            formState: previousState.formState.updateIn(['data', formId, 'value'],
                                                order => [...order.slice(0, entryIdx - 1), order[entryIdx], order[entryIdx - 1], ...order.slice(entryIdx + 1)])
                                        }))
                                    }
                                />
                                }
                                {entryIdx < childEntries.length - 1 &&
                                <Button
                                    icon="chevron-down"
                                    title={t('Move down')}
                                    onClickAsync={() =>
                                        self.setState(previousState => ({
                                            formState: previousState.formState.updateIn(['data', formId, 'value'],
                                                order => [...order.slice(0, entryIdx), order[entryIdx + 1], order[entryIdx], ...order.slice(entryIdx + 2)])
                                        }))
                                    }
                                />
                                }
                            </div>
                            }
                            <div className={styles.entryContent}>
                                {childFields}
                            </div>
                        </div>
                    );
                }

                if (!(card.max === 1 && (card.min === 1 || childEntries.length === 1))) {
                    fields.push(
                        <div key="newEntry" className={styles.newEntry}>
                            <Button
                                icon="plus"
                                label={t('Add entry')}
                                onClickAsync={onAddEntry(childEntries.length)}
                            />
                        </div>
                    );
                }
            }

            return <Fieldset key={spec.id} id={formId} label={spec.label}>{fields}</Fieldset>;
        }
    };

    return paramTypes;
}

@translate()
@withForm
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class CUD extends Component {
    constructor(props) {
        super(props);

        this.state = {};

        this.initForm({
            onChangeBeforeValidation: ::this.onChangeBeforeValidation,
            onChange: {
                template: ::this.onTemplateChange
            }
        });

        this.paramTypes = getParamTypes(props.t);
    }

    static propTypes = {
        action: PropTypes.string.isRequired,
        panelsVisible: PropTypes.array,
        workspace: PropTypes.object,
        entity: PropTypes.object
    }

    @withAsyncErrorHandler
    async fetchTemplateParams(templateId) {
        const result = await axios.get(`/rest/template-params/${templateId}`);

        this.updateFormValue('templateParams', result.data);
    }

    onTemplateChange(state, key, oldVal, newVal) {
        if (oldVal !== newVal) {
            state.formState = state.formState.setIn(['data', 'templateParams', 'value'], '');

            if (newVal) {
                this.fetchTemplateParams(newVal);
            }
        }
    }

    onChangeBeforeValidation(mutStateData, key, oldVal, newVal) {
        if (key === 'templateParams') {
            if (oldVal !== newVal && newVal) {
                for (const spec of newVal) {
                    this.paramTypes[spec.type].adopt('', spec, mutStateData);
                }
            }
        } else {
            const paramsSpec = mutStateData.getIn(['templateParams', 'value']);
            if (paramsSpec) {
                for (const spec of paramsSpec) {
                    const onChange = this.paramTypes[spec.type].onChange;
                    if (onChange) {
                        onChange('', spec, mutStateData, key, oldVal, newVal);
                    }
                }
            }
        }
    }

    componentDidMount() {
        if (this.props.entity) {
            this.getFormValuesFromEntity(this.props.entity, data => {
                for (const spec of data.templateParams) {
                    this.paramTypes[spec.type].setFields('', spec, data.params[spec.id], data);
                }

                data.orderBefore = data.orderBefore.toString();
            });

        } else {
            this.populateFormValues({
                name: '',
                description: '',
                template: null,
                workspace: this.props.workspace.id,
                namespace: ivisConfig.user.namespace,
                orderBefore: 'end'
            });
        }
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        if (!state.getIn(['name', 'value'])) {
            state.setIn(['name', 'error'], t('Name must not be empty'));
        } else {
            state.setIn(['name', 'error'], null);
        }

        if (!state.getIn(['template', 'value'])) {
            state.setIn(['template', 'error'], t('Template must be selected'));
        } else {
            state.setIn(['template', 'error'], null);
        }

        if (this.props.entity) {
            if (!state.getIn(['workspace', 'value'])) {
                state.setIn(['workspace', 'error'], t('Workspace must be selected'));
            } else {
                state.setIn(['workspace', 'error'], null);
            }
        }

        const paramPrefix = getParamFormId('');
        for (const paramId of state.keys()) {
            if (paramId.startsWith(paramPrefix)) {
                state.deleteIn([paramId, 'error']);
            }
        }

        const paramsSpec = state.getIn(['templateParams', 'value']);
        if (paramsSpec) {
            for (const spec of paramsSpec) {
                this.paramTypes[spec.type].validate('', spec, state);
            }
        }

        validateNamespace(t, state);
    }

    async submitHandler() {
        const t = this.props.t;

        if (this.getFormValue('template') && !this.getFormValue('templateParams')) {
            this.setFormStatusMessage('warning', t('Panel parameters are not selected. Wait for them to get displayed and then fill them in.'));
            return;
        }

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `/rest/panels/${this.props.entity.id}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = `/rest/panels/${this.props.workspace.id}`
        }

        try {
            this.disableForm();
            this.setFormStatusMessage('info', t('Saving ...'));

            const submitSuccessful = await this.validateAndSendFormValuesToURL(sendMethod, url, data => {
                const params = {};

                for (const spec of data.templateParams) {
                    params[spec.id] = this.paramTypes[spec.type].getParams('', spec, data);
                }

                const paramPrefix = getParamFormId('');
                for (const paramId in data) {
                    if (paramId.startsWith(paramPrefix)) {
                        delete data[paramId];
                    }
                }

                delete data.templateParams;
                data.params = params;

                data.orderBefore = Number.parseInt(data.orderBefore) || data.orderBefore;
            });

            if (submitSuccessful) {
                this.navigateToWithFlashMessage(`/settings/workspaces/${this.props.workspace.id}/panels`, 'success', t('Panel saved'));
            } else {
                this.enableForm();
                this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
            }
        } catch (error) {
            throw error;
        }
    }

    render() {
        const t = this.props.t;
        const isEdit = !!this.props.entity;
        const canDelete =  isEdit && this.props.entity.permissions.includes('delete');

        const templateColumns = [
            { data: 1, title: t('Name') },
            { data: 2, title: t('Description') },
            { data: 4, title: t('Created'), render: data => moment(data).fromNow() }
        ];

        const workspaceColumns = [
            { data: 1, title: t('#') },
            { data: 2, title: t('Name') },
            { data: 3, title: t('Description') },
            { data: 4, title: t('Created'), render: data => moment(data).fromNow() }
        ];

        const orderOptions =[
            {key: 'none', label: t('Not visible')},
            ...this.props.panelsVisible.filter(x => !this.props.entity || x.id !== this.props.entity.id).map(x => ({ key: x.id.toString(), label: x.name})),
            {key: 'end', label: t('End of list')}
        ];

        const paramsSpec = this.getFormValue('templateParams');
        const params = [];

        if (paramsSpec) {
            for (const spec of paramsSpec) {
                params.push(this.paramTypes[spec.type].render(this, '', spec));
            }
        }

        return (
            <Panel title={isEdit ? t('Edit Panel') : t('Create Panel')}>
                {canDelete &&
                <DeleteModalDialog
                    stateOwner={this}
                    visible={this.props.action === 'delete'}
                    deleteUrl={`/rest/panels/${this.props.entity.id}`}
                    cudUrl={`/settings/workspaces/${this.props.workspace.id}/panels/${this.props.entity.id}/edit`}
                    listUrl={`/settings/workspaces/${this.props.workspace.id}/panels`}
                    deletingMsg={t('Deleting panel ...')}
                    deletedMsg={t('Panel deleted')}/>
                }

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="name" label={t('Name')}/>
                    <TextArea id="description" label={t('Description')} help={t('HTML is allowed')}/>
                    <TableSelect id="template" label={t('Template')} withHeader dropdown dataUrl="/rest/templates-table" columns={templateColumns} selectionLabelIndex={1}/>
                    {isEdit &&
                        <TableSelect id="workspace" label={t('Workspace')} withHeader dropdown dataUrl="/rest/workspaces-table" columns={workspaceColumns} selectionLabelIndex={2}/>
                    }
                    <NamespaceSelect/>
                    <Dropdown id="orderBefore" label={t('Order (before)')} options={orderOptions} help={t('Select the panel before which this panel should appear in the menu. To exclude the panel from listings, select "Not visible".')}/>

                    {paramsSpec ?
                        params.length > 0 &&
                        <Fieldset label={t('Panel parameters')}>
                            <div className={styles.params}>
                                {params}
                            </div>
                        </Fieldset>
                        :
                        this.getFormValue('template') &&
                        <div className="alert alert-info" role="alert">{t('Loading template...')}</div>
                    }

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="ok" label={t('Save')}/>
                        {isEdit && <NavButton className="btn-danger" icon="remove" label={t('Delete')} linkTo={`/settings/workspaces/${this.props.workspace.id}/panels/${this.props.entity.id}/delete`}/>}
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}
