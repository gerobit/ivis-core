'use strict';

import React, {Component} from 'react';
import axios, {HTTPMethod} from './axios';
import {withTranslation} from './i18n';
import PropTypes
    from 'prop-types';
import {
    Icon,
    ModalDialog
} from "./bootstrap-components";
import {getUrl} from "./urls";
import {withPageHelpers} from "./page";
import styles
    from './styles.scss';
import interoperableErrors
    from '../../../shared/interoperable-errors';
import {Link} from "react-router-dom";
import {withComponentMixins} from "./decorator-helpers";

@withComponentMixins([
    withTranslation,
    withPageHelpers
])
export class RestActionModalDialog extends Component {
    static propTypes = {
        title: PropTypes.string.isRequired,
        message: PropTypes.string.isRequired,
        stateOwner: PropTypes.object,
        visible: PropTypes.bool.isRequired,
        actionMethod: PropTypes.func.isRequired,
        actionUrl: PropTypes.string.isRequired,
        actionData: PropTypes.object,

        backUrl: PropTypes.string,
        successUrl: PropTypes.string,

        onBack: PropTypes.func,
        onPerformingAction: PropTypes.func,
        onSuccess: PropTypes.func,

        actionInProgressMsg:  PropTypes.string.isRequired,
        actionDoneMsg:  PropTypes.string.isRequired,

        onErrorAsync: PropTypes.func
    }

    async hideModal(isBack) {
        if (this.props.backUrl) {
            this.navigateTo(this.props.backUrl);
        } else {
            if (isBack) {
                this.props.onBack();
            } else {
                this.props.onPerformingAction();
            }
        }
    }

    async performAction() {
        const props = this.props;
        const t = props.t;
        const owner = props.stateOwner;

        await this.hideModal(false);

        try {
            if (!owner) {
                this.setFlashMessage('info', props.actionInProgressMsg);
            } else {
                owner.disableForm();
                owner.setFormStatusMessage('info', props.actionInProgressMsg);
            }

            await axios.method(props.actionMethod, getUrl(props.actionUrl), props.actionData);

            if (props.successUrl) {
                this.navigateToWithFlashMessage(props.successUrl, 'success', props.actionDoneMsg);
            } else {
                props.onSuccess();
                this.setFlashMessage('success', props.actionDoneMsg);
            }
        } catch (err) {
            if (props.onErrorAsync) {
                await props.onErrorAsync(err);
            } else {
                throw err;
            }
        }
    }

    render() {
        const t = this.props.t;

        return (
            <ModalDialog hidden={!this.props.visible} title={this.props.title} onCloseAsync={() => this.hideModal(true)} buttons={[
                { label: t('no'), className: 'btn-primary', onClickAsync: async () => this.hideModal(true) },
                { label: t('yes'), className: 'btn-danger', onClickAsync: ::this.performAction }
            ]}>
                {this.props.message}
            </ModalDialog>
        );
    }
}

const entityTypeLabels = {
    'namespace': t => t('namespace'),
    'template': t => t('Template'),
    'signalSet': t => t('Signal set'),
    'signal': t => t('Signal'),
    'panel': t => t('Panel'),
    'workspace': t => t('Workspace')
};

function _getDependencyErrorMessage(err, t, name) {
    return (
        <div>
            <p>{t('cannoteDeleteNameDueToTheFollowing', {name})}</p>
            <ul className={styles.dependenciesList}>
                {err.data.dependencies.map(dep =>
                    dep.link ?
                        <li key={dep.link}><Link to={dep.link}>{entityTypeLabels[dep.entityTypeId](t)}: {dep.name}</Link></li>
                        : // if no dep.link is present, it means the user has no permission to view the entity, thus only id without the link is shown
                        <li key={dep.id}>{entityTypeLabels[dep.entityTypeId](t)}: [{dep.id}]</li>
                )}
                {err.data.andMore && <li>{t('andMore')}</li>}
            </ul>
        </div>
    );
}


@withComponentMixins([
    withTranslation,
    withPageHelpers
])
export class DeleteModalDialog extends Component {
    constructor(props) {
        super(props);
        const t = props.t;
    }

    static propTypes = {
        visible: PropTypes.bool.isRequired,
        stateOwner: PropTypes.object.isRequired,
        deleteUrl: PropTypes.string.isRequired,
        backUrl: PropTypes.string,
        successUrl: PropTypes.string,
        deletingMsg:  PropTypes.string.isRequired,
        deletedMsg:  PropTypes.string.isRequired,
        name: PropTypes.string
    }

    async onErrorAsync(err) {
        const t = this.props.t;

        if (err instanceof interoperableErrors.DependencyPresentError) {
            const owner = this.props.stateOwner;

            const name = owner.getFormValue('name');
            this.setFlashMessage('danger', _getDependencyErrorMessage(err, t, name));

            window.scrollTo(0, 0); // This is to scroll up because the flash message appears on top and it's quite misleading if the delete fails and the message is not in the viewport

            owner.enableForm();
            owner.clearFormStatusMessage();

        } else {
            throw err;
        }
    }

    render() {
        const t = this.props.t;
        const owner = this.props.stateOwner;
        const name = this.props.name || owner.getFormValue('name') || '';

        return <RestActionModalDialog
            title={t('confirmDeletion')}
            message={t('areYouSureYouWantToDeleteName?', {name})}
            stateOwner={this.props.stateOwner}
            visible={this.props.visible}
            actionMethod={HTTPMethod.DELETE}
            actionUrl={this.props.deleteUrl} 
            backUrl={this.props.backUrl}
            successUrl={this.props.successUrl}
            actionInProgressMsg={this.props.deletingMsg}
            actionDoneMsg={this.props.deletedMsg}
            onErrorAsync={::this.onErrorAsync}
        />
    }
}

export function tableRestActionDialogInit(owner) {
    owner.tableRestActionDialogData = {};
    owner.state.tableRestActionDialogShown = false;
}



function _hide(owner, dontRefresh = false) {
    owner.tableRestActionDialogData = {};
    owner.setState({ tableRestActionDialogShown: false });
    if (!dontRefresh) {
        owner.table.refresh();
    }
}

export function tableAddDeleteButton(actions, owner, perms, deleteUrl, name, deletingMsg, deletedMsg) {
    const t = owner.props.t;

    async function onErrorAsync(err) {
        if (err instanceof interoperableErrors.DependencyPresentError) {
            owner.setFlashMessage('danger', _getDependencyErrorMessage(err, t, name));
            window.scrollTo(0, 0); // This is to scroll up because the flash message appears on top and it's quite misleading if the delete fails and the message is not in the viewport
            _hide(owner);
        } else {
            throw err;
        }
    }

    if (!perms || perms.includes('delete')) {
        if (owner.tableRestActionDialogData.shown) {
            actions.push({
                label: <Icon className={styles.iconDisabled} icon="trash-alt" title={t('delete')}/>
            });
        } else {
            actions.push({
                label: <Icon icon="trash-alt" title={t('delete')}/>,
                action: () => {
                    owner.tableRestActionDialogData = {
                        shown: true,
                        title: t('confirmDeletion'),
                        message:t('areYouSureYouWantToDeleteName?', {name}),
                        httpMethod: HTTPMethod.DELETE,
                        actionUrl: deleteUrl,
                        actionInProgressMsg: deletingMsg,
                        actionDoneMsg: deletedMsg,
                        onErrorAsync: onErrorAsync
                    };

                    owner.setState({
                        tableRestActionDialogShown: true
                    });

                    owner.table.refresh();
                }
            });
        }
    }
}

export function tableAddRestActionButton(actions, owner, action, button, title, message, actionInProgressMsg, actionDoneMsg, onErrorAsync) {
    const t = owner.props.t;

    if (owner.tableRestActionDialogData.shown) {
        actions.push({
            label: <Icon className={styles.iconDisabled} icon={button.icon} title={button.label}/>
        });
    } else {
        actions.push({
            label: <Icon icon={button.icon} title={button.label}/>,
            action: () => {
                owner.tableRestActionDialogData = {
                    shown: true,
                    title: title,
                    message: message,
                    httpMethod: action.method,
                    actionUrl: action.url,
                    actionData: action.data,
                    actionInProgressMsg: actionInProgressMsg,
                    actionDoneMsg: actionDoneMsg,
                    onErrorAsync: onErrorAsync
                };

                owner.setState({
                    tableRestActionDialogShown: true
                });

                owner.table.refresh();
            }
        });
    }
}

export function tableRestActionDialogRender(owner) {
    const data = owner.tableRestActionDialogData;

    return <RestActionModalDialog
        title={data.title || ''}
        message={data.message || ''}
        visible={owner.state.tableRestActionDialogShown}
        actionMethod={data.httpMethod || HTTPMethod.POST}
        actionUrl={data.actionUrl || ''}
        actionData={data.actionData}
        onBack={() => _hide(owner)}
        onPerformingAction={() => _hide(owner, true)}
        onSuccess={() => _hide(owner)}
        actionInProgressMsg={data.actionInProgressMsg || ''}
        actionDoneMsg={data.actionDoneMsg || ''}
        onErrorAsync={data.onErrorAsync}
    />

}
