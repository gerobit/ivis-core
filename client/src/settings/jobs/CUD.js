'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {translate} from "react-i18next";
import {LinkButton, requiresAuthenticatedUser, withPageHelpers} from "../../lib/page";
import {
    Button,
    ButtonRow,
    Dropdown,
    Fieldset,
    Form,
    FormSendMethod,
    InputField,
    TableSelect,
    TextArea,
    withForm
} from "../../lib/form";
import "brace/mode/json";
import "brace/mode/jsx";
import "brace/mode/scss";
import {withAsyncErrorHandler, withErrorHandling} from "../../lib/error-handling";
import {NamespaceSelect, validateNamespace} from "../../lib/namespace";
import {DeleteModalDialog} from "../../lib/modals";
import {Panel} from "../../lib/panel";
import ivisConfig from "ivisConfig";
import {getJobStates} from './states';
import {JobState} from "../../../../shared/jobs";
import cudStyles from "./CUD.scss";
import moment from "moment";
import ParamTypes from "../workspaces/panels/ParamTypes"
import axios from "axios";
import {getUrl} from "../../lib/urls";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";

const SETS_PREFIX = 'sets_';

@withComponentMixins([
    withTranslation,
    withForm,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class CUD extends Component {
    constructor(props) {
        super(props);

        this.state = {};
        this.nextListEntryId = 0;

        this.initForm({
            onChangeBeforeValidation: ::this.onChangeBeforeValidation,
            onChange: {
                task: ::this.onTaskChange
            }
        });

        this.paramTypes = new ParamTypes(props.t);
    }

    static propTypes = {
        action: PropTypes.string.isRequired,
        entity: PropTypes.object
    };

    @withAsyncErrorHandler
    async fetchTaskParams(taskId) {
        const result = await axios.get(getUrl(`rest/task-params/${taskId}`));

        this.updateFormValue('taskParams', result.data);
    }

    componentDidMount() {
        if (this.props.entity) {
            this.getFormValuesFromEntity(this.props.entity, data => {
                this.paramTypes.setFields(data.taskParams, data.params, data);

                if (data['state'] === JobState.INVALID_PARAMS) {
                    data['state'] = JobState.DISABLED;
                }

                const sets = [];
                for (const trigger of data.signal_sets_triggers) {
                    const setUid = this.getNextSetEntryId();

                    const prefix = SETS_PREFIX + setUid + '_';

                    data[prefix + 'trigger'] = trigger;

                    sets.push(setUid);
                }
                data["sets"] = sets;
            });
        } else {
            this.populateFormValues({
                name: '',
                description: '',
                namespace: ivisConfig.user.namespace,
                task: null,
                state: JobState.ENABLED,
                signal_sets_triggers: [],
                sets: [],
                trigger: '',
                min_gap: '',
                delay: ''
            });
        }
    }

    onTaskChange(state, key, oldVal, newVal) {
        if (oldVal !== newVal) {
            state.formState = state.formState.setIn(['data', 'taskParams', 'value'], '');

            if (newVal) {
               this.fetchTaskParams(newVal);
            }
        }
    }

    onChangeBeforeValidation(mutStateData, key, oldVal, newVal) {
        if (key === 'taskParams') {
            if (oldVal !== newVal && newVal) {
                this.paramTypes.adopt(newVal, mutStateData);
            }
        } else {
            const configSpec = mutStateData.getIn(['taskParams', 'value']);
            if (configSpec) {
                this.paramTypes.onChange(configSpec, mutStateData, key, oldVal, newVal)
            }
        }
    }

    @withAsyncErrorHandler
    async loadFormValues() {
        await this.getFormValuesFromURL(`rest/jobs/${this.props.entity.id}`);
    }

    static isPositiveInteger(s) {
        return /^[1-9][\d]*$/.test(s);
    }


    localValidateFormValues(state) {
        const t = this.props.t;

        if (!state.getIn(['name', 'value'])) {
            state.setIn(['name', 'error'], t('Name must not be empty'));
        } else {
            state.setIn(['name', 'error'], null);
        }

        if (!state.getIn(['task', 'value'])) {
            state.setIn(['task', 'error'], t('Task must be selected'));
        } else {
            state.setIn(['task', 'error'], null);
        }

        const trigger = state.getIn(['trigger', 'value']);
        if (trigger) {
            if (!CUD.isPositiveInteger(trigger)) {
                state.setIn(['trigger', 'error'], t('Trigger must be positive integer'));
            } else {
                state.setIn(['trigger', 'error'], null);
            }
        } else {
            state.setIn(['trigger', 'error'], null);
        }

        let delay = state.getIn(['delay', 'value']);
        if (delay) {
            if (!CUD.isPositiveInteger(delay)) {
                state.setIn(['delay', 'error'], t('Delay must be positive integer'));
            } else {
                state.setIn(['delay', 'error'], null);
            }
        } else {
            state.setIn(['delay', 'error'], null);
        }

        const min_gap = state.getIn(['min_gap', 'value']);
        if (min_gap) {
            if (!CUD.isPositiveInteger(min_gap)) {
                state.setIn(['min_gap', 'error'], t('Minimal interval must be positive integer'));
            } else {
                state.setIn(['min_gap', 'error'], null);
            }
        } else {
            state.setIn(['min_gap', 'error'], null);
        }

        const paramPrefix = this.paramTypes.getParamPrefix();
        for (const paramId of state.keys()) {
            if (paramId.startsWith(paramPrefix)) {
                state.deleteIn([paramId, 'error']);
            }
        }

        const configSpec = state.getIn(['taskParams', 'value']);
        if (configSpec) {
            this.paramTypes.localValidate(configSpec, state);
        }

        validateNamespace(t, state);
    }


    async submitHandler() {
        const t = this.props.t;

        if (this.getFormValue('task') && !this.getFormValue('taskParams')) {
            this.setFormStatusMessage('warning', t('Task parameters are not selected. Wait for them to get displayed and then fill them in.'));
            return;
        }

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/jobs/${this.props.entity.id}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = 'rest/jobs'
        }

        try {
            this.disableForm();
            this.setFormStatusMessage('info', t('Saving ...'));

            const submitSuccessful = await this.validateAndSendFormValuesToURL(sendMethod, url, data => {
                if (this.props.entity) {
                    data.settings = this.props.entity.settings;
                }

                const triggers = [];
                for (const setUid of data.sets) {
                    const prefix = SETS_PREFIX + setUid + '_';
                    let trigger = data[prefix + 'trigger'];
                    if (trigger) {
                        triggers.push(trigger)
                    }
                }
                data.signal_sets_triggers = triggers;

                const params = this.paramTypes.getParams(data.taskParams, data);

                const paramPrefix = this.paramTypes.getParamPrefix();
                for (const paramId in data) {
                    if (paramId.startsWith(paramPrefix)) {
                        delete data[paramId];
                    }
                }

                delete data.taskParams;
                data.params = params;
            });


            if (submitSuccessful) {
                if (this.props.entity) {
                    await this.loadFormValues();
                    this.enableForm();
                    this.clearFormStatusMessage();
                    this.hideFormValidation();
                    this.setFlashMessage('success', t('Job saved'));
                } else {
                    this.navigateToWithFlashMessage('/settings/jobs', 'success', t('Job saved'));
                }
            } else {
                this.enableForm();
                this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
            }
        } catch (error) {
            throw error;
        }
    }

    static getStateOptions(t) {
        let states = getJobStates(t);
        const stateOptions = [];
        for (let key in states) {
            if (key != JobState.INVALID_PARAMS) {
                if (states.hasOwnProperty(key)) {
                    stateOptions.push({key: key, label: states[key]})
                }
            }
        }

        return stateOptions;
    }

    getNextSetEntryId() {
        const id = this.nextListEntryId;
        this.nextListEntryId += 1;
        return id;
    }

    onAddSetEntry() {
        this.updateForm(mutState => {
            const sets = mutState.getIn(['sets', 'value']);

            const setUid = this.getNextSetEntryId();

            const prefix = SETS_PREFIX + setUid + '_';

            mutState.setIn([prefix + 'trigger', 'value'], null);
            sets.push(setUid);
            mutState.setIn(['sets', 'value'], sets);
        });
    }

    onRemoveSetEntry(setUid) {
        this.updateForm(mutState => {
            const sets = this.getFormValue('sets');

            const prefix = SETS_PREFIX + setUid + '_';

            mutState.delete(prefix + 'trigger');

            mutState.setIn(['sets', 'value'], sets.filter(val => val !== setUid));
        });
    }

    render() {
        const t = this.props.t;
        const isEdit = !!this.props.entity;
        const canDelete = isEdit && this.props.entity.permissions.includes('delete');

        let stateOptions = CUD.getStateOptions(t);

        const setsColumns = [
            {data: 1, title: t('#')},
            {data: 2, title: t('Name')},
            {data: 3, title: t('Description')},
        ];


        const setsEditEntries = [];
        const sets = this.getFormValue('sets') || [];
        for (const setUid of sets) {
            const prefix = SETS_PREFIX + setUid + '_';

            setsEditEntries.push(
                <div key={setUid} className={cudStyles.entry + ' ' + cudStyles.entryWithButtons}>
                    <div className={cudStyles.entryButtons}>
                        <Button
                            className="btn-secondary"
                            icon="trash-alt fa-2x"
                            title={t('remove')}
                            onClickAsync={() => this.onRemoveSetEntry(setUid)}
                        />

                    </div>
                    <div className={cudStyles.entryContent}>
                        <TableSelect id={prefix + 'trigger'} label={t('Trigger on')} withHeader dropdown
                                     dataUrl='rest/signal-sets-table' columns={setsColumns} selectionLabelIndex={2}/>
                    </div>
                </div>
            );
        }

        const setTriggersEdit =
            <Fieldset label={t('Signal sets triggers')}>
                {setsEditEntries}
                <div key="newEntry" className={cudStyles.newEntry}>
                    <Button
                        className="btn-secondary"
                        icon="plus"
                        label={t('Add signal set')}
                        onClickAsync={() => this.onAddSetEntry()}
                    />
                </div>
            </Fieldset>;

        const taskColumns = [
            {data: 1, title: t('Name')},
            {data: 2, title: t('Description')},
            {data: 4, title: t('Created'), render: data => moment(data).fromNow()}
        ];

        const configSpec = this.getFormValue('taskParams');
        const params = configSpec ? this.paramTypes.render(configSpec, this) : null;

        return (
            <Panel title={isEdit ? t('Job Settings') : t('Create Job')}>
                {canDelete &&
                <DeleteModalDialog
                    stateOwner={this}
                    visible={this.props.action === 'delete'}
                    deleteUrl={`rest/jobs/${this.props.entity.id}`}
                    backUrl={`/settings/jobs/${this.props.entity.id}/edit`}
                    successUrl="/settings/jobs"
                    deletingMsg={t('Deleting job ...')}
                    deletedMsg={t('Job deleted')}/>
                }

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="name" label={t('Name')}/>
                    <TextArea id="description" label={t('Description')} help={t('HTML is allowed')}/>
                    <TableSelect id="task" label={t('Task')} withHeader dropdown dataUrl="rest/tasks-table"
                                 columns={taskColumns} selectionLabelIndex={1} disabled={isEdit}/>

                    <Dropdown id="state" label={t('State')} options={stateOptions}/>
                    <NamespaceSelect/>
                    <Fieldset id="triggers" label={t('Triggers')}>
                        <InputField id="trigger" label={t('Trigger')} placeholder="Automatic trigger time in seconds"/>
                        <InputField id="min_gap" label={t('Minimal interval')}
                                    placeholder="Minimal time between runs in seconds"/>
                        <InputField id="delay" label={t('Delay')} placeholder="Delay before triggering in seconds"/>
                    </Fieldset>

                    {setTriggersEdit}

                    {configSpec ?
                        params &&
                        <Fieldset label={t('Task parameters')}>
                            {params}
                        </Fieldset>
                        :
                        this.getFormValue('task') &&
                        <div className="alert alert-info" role="alert">{t('Loading task...')}</div>
                    }

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="ok" label={t('Save')}/>
                        {canDelete && <LinkButton className="btn-danger" icon="remove" label={t('Delete')}
                                                  to={`/settings/jobs/${this.props.entity.id}/delete`}/>}
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}
