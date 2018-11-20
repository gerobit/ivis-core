'use strict';

import './lib/public-path';

import em from './lib/extension-manager';

import React from 'react';
import ReactDOM from 'react-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from './lib/i18n';

import 'bootstrap/dist/js/bootstrap.min';
import '../public/bootflat-admin/css/site.min.css';

import { Section } from './lib/page';
import Account from './account/Account';
import Login from './login/Login';
import Reset from './login/Forgot';
import ResetLink from './login/Reset';

import Share from './shares/Share'

import UsersList from './settings/users/List';
import UsersCUD from './settings/users/CUD';
import UserShares from './shares/UserShares';

import NamespacesList from './settings/namespaces/List';
import NamespacesCUD from './settings/namespaces/CUD';

import TemplatesList from './settings/templates/List';
import TemplatesCUD from './settings/templates/CUD';
import TemplatesDevelop from './settings/templates/Develop';
import TemplatesOutput from './settings/templates/Output';

import WorkspacesList from './settings/workspaces/List';
import WorkspacesCUD from './settings/workspaces/CUD';

import PanelsList from './settings/workspaces/panels/List';
import PanelsCUD from './settings/workspaces/panels/CUD';

import SignalSetsList from './settings/signal-sets/List';
import SignalSetsCUD from './settings/signal-sets/CUD';

import SignalsList from './settings/signal-sets/signals/List';
import SignalsCUD from './settings/signal-sets/signals/CUD';

import SettingsSidebar from './settings/Sidebar';

import settings from './settings/settings/root';

import SamplePanel from './workspaces/SamplePanel';
import SamplePanel2 from './workspaces/SamplePanel2';

import MainMenuAuthenticated from './MainMenuAuthenticated';
import MainMenuAnonymous from './MainMenuAnonymous';

import WorkspacesOverview from './workspaces/Overview';
import WorkspacesPanelsOverview from './workspaces/panels/Overview';
import WorkspacePanel from './workspaces/panels/WorkspacePanel';

import WorkspaceSidebar from './workspaces/Sidebar';

import ivisConfig from "ivisConfig";

const getStructure = t => {

    const structure = {
        '': {
            title: t('Home'),
            link: () => ivisConfig.isAuthenticated ? '/workspaces' : '/login',
            children: {
                login: {
                    title: t('Sign in'),
                    link: '/login',
                    panelComponent: Login,
                    primaryMenuComponent: MainMenuAnonymous,
                    children: {
                        forgot: {
                            title: t('Password reset'),
                            extraParams: [':username?'],
                            link: '/login/forgot',
                            panelComponent: Reset
                        },
                        reset: {
                            title: t('Password reset'),
                            extraParams: [':username', ':resetToken'],
                            link: '/login/reset',
                            panelComponent: ResetLink
                        }
                    }
                },
                account: {
                    title: t('Account'),
                    link: '/account',
                    resolve: {
                        workspacesVisible: params => `rest/workspaces-visible`
                    },
                    panelComponent: Account,
                    primaryMenuComponent: MainMenuAuthenticated
                },
                workspaces: {
                    title: t('Workspaces'),
                    link: '/workspaces',
                    panelComponent: WorkspacesOverview,
                    resolve: {
                        workspacesVisible: params => `rest/workspaces-visible`
                    },
                    primaryMenuComponent: MainMenuAuthenticated,
                    children: {
                        ':workspaceId([0-9]+)': {
                            title: resolved => resolved.workspace.name,
                            resolve: {
                                workspace: params => `rest/workspaces/${params.workspaceId}`,
                                panelsVisible: params => `rest/panels-visible/${params.workspaceId}`
                            },
                            link: params => `/workspaces/${params.workspaceId}`,
                            panelRender: props => <WorkspacesPanelsOverview workspace={props.resolved.workspace}/>,
                            secondaryMenuComponent: WorkspaceSidebar,
                            children: {
                                ':panelId([0-9]+)': {
                                    title: resolved => resolved.panel.name,
                                    resolve: {
                                        panel: params => `rest/panels/${params.panelId}`
                                    },
                                    link: params => `/workspaces/${params.workspaceId}/${params.panelId}`,
                                    panelRender: props => <WorkspacePanel panel={props.resolved.panel}/>
                                }
                            }
                        },

                        sample: {
                            title: t('Sample workspace'),
                            link: '/workspaces/sample',
                            panelComponent: SamplePanel,
                        },

                        sample2: {
                            title: t('Sample workspace 2'),
                            link: '/workspaces/sample2',
                            panelComponent: SamplePanel2,
                        }
                    }
                },
                settings: {
                    title: t('Administration'),
                    resolve: {
                        workspacesVisible: params => `rest/workspaces-visible`
                    },
                    link: '/settings/workspaces',
                    primaryMenuComponent: MainMenuAuthenticated,
                    secondaryMenuComponent: SettingsSidebar,
                    children: {
                        ...settings.getMenus(t),
                        workspaces: {
                            title: t('Workspaces'),
                            link: '/settings/workspaces',
                            panelComponent: WorkspacesList,
                            children: {
                                ':workspaceId([0-9]+)': {
                                    title: resolved => t('Workspace "{{name}}"', {name: resolved.workspace.name}),
                                    resolve: {
                                        workspace: params => `rest/workspaces/${params.workspaceId}`
                                    },
                                    link: params => `/settings/workspaces/${params.workspaceId}/edit`,
                                    navs: {
                                        ':action(edit|delete)': {
                                            title: t('Edit'),
                                            link: params => `/settings/workspaces/${params.workspaceId}/edit`,
                                            visible: resolved => resolved.workspace.permissions.includes('edit'),
                                            panelRender: props => <WorkspacesCUD action={props.match.params.action} entity={props.resolved.workspace} workspacesVisible={props.resolved.workspacesVisible}/>
                                        },
                                        panels: {
                                            title: t('Panels'),
                                            link: params => `/settings/workspaces/${params.workspaceId}/panels`,
                                            panelRender: props => <PanelsList workspace={props.resolved.workspace}/>,
                                            children: {
                                                ':panelId([0-9]+)': {
                                                    title: resolved => t('Panel "{{name}}"', {name: resolved.panel.name}),
                                                    resolve: {
                                                        panel: params => `rest/panels/${params.panelId}`
                                                    },
                                                    link: params => `/settings/workspaces/${params.workspaceId}/panels/${params.panelId}/edit`,
                                                    navs: {
                                                        ':action(edit|delete)': {
                                                            title: t('Edit'),
                                                            resolve: {
                                                                panelsVisible: params => `rest/panels-visible/${params.workspaceId}`
                                                            },
                                                            link: params => `/settings/workspaces/${params.workspaceId}/panels/${params.panelId}/edit`,
                                                            visible: resolved => resolved.panel.permissions.includes('edit'),
                                                            panelRender: props => <PanelsCUD action={props.match.params.action} entity={props.resolved.panel} workspace={props.resolved.workspace} panelsVisible={props.resolved.panelsVisible}/>
                                                        },
                                                        share: {
                                                            title: t('Share'),
                                                            link: params => `/settings/workspaces/${params.workspaceId}/panels/${params.panelId}/share`,
                                                            visible: resolved => resolved.panel.permissions.includes('share'),
                                                            panelRender: props => <Share title={t('Share')} entity={props.resolved.panel} entityTypeId="panel" />
                                                        }
                                                    }
                                                },
                                                create: {
                                                    title: t('Create'),
                                                    resolve: {
                                                        panelsVisible: params => `rest/panels-visible/${params.workspaceId}`
                                                    },
                                                    panelRender: props => <PanelsCUD action="create" workspace={props.resolved.workspace} panelsVisible={props.resolved.panelsVisible}/>
                                                },

                                            }
                                        },
                                        share: {
                                            title: t('Share'),
                                            link: params => `/settings/workspaces/${params.workspaceId}/share`,
                                            visible: resolved => resolved.workspace.permissions.includes('share'),
                                            panelRender: props => <Share title={t('Share')} entity={props.resolved.workspace} entityTypeId="workspace" />
                                        }
                                    }
                                },
                                create: {
                                    title: t('Create'),
                                    panelRender: props => <WorkspacesCUD action="create" workspacesVisible={props.resolved.workspacesVisible}/>
                                }
                            }
                        },
                        templates: {
                            title: t('Templates'),
                            link: '/settings/templates',
                            panelComponent: TemplatesList,
                            children: {
                                ':templateId([0-9]+)': {
                                    title: resolved => t('Template "{{name}}"', {name: resolved.template.name}),
                                    resolve: {
                                        template: params => `rest/templates/${params.templateId}`
                                    },
                                    link: params => `/settings/templates/${params.templateId}/edit`,
                                    navs: {
                                        develop: {
                                            title: t('Code'),
                                            link: params => `/settings/templates/${params.templateId}/develop`,
                                            visible: resolved => resolved.template.permissions.includes('edit'),
                                            panelRender: props => <TemplatesDevelop entity={props.resolved.template} />
                                        },
                                        output: {
                                            title: t('Output'),
                                            link: params => `/settings/templates/${params.templateId}/output`,
                                            visible: resolved => resolved.template.permissions.includes('edit'),
                                            panelRender: props => <TemplatesOutput entity={props.resolved.template} />
                                        },
                                        ':action(edit|delete)': {
                                            title: t('Settings'),
                                            link: params => `/settings/templates/${params.templateId}/edit`,
                                            visible: resolved => resolved.template.permissions.includes('edit'),
                                            panelRender: props => <TemplatesCUD action={props.match.params.action} entity={props.resolved.template} />
                                        },
                                        share: {
                                            title: t('Share'),
                                            link: params => `/settings/templates/${params.templateId}/share`,
                                            visible: resolved => resolved.template.permissions.includes('share'),
                                            panelRender: props => <Share title={t('Share')} entity={props.resolved.template} entityTypeId="template" />
                                        }
                                    }
                                },
                                create: {
                                    title: t('Create'),
                                    panelRender: props => <TemplatesCUD action="create" />
                                }
                            }
                        },
                        'signal-sets': {
                            title: !em.get('settings.signalSetsAsSensors', false) ? t('Signal Sets') : t('Sensor Nodes'),
                            link: '/settings/signal-sets',
                            panelComponent: SignalSetsList,
                            children: {
                                ':signalSetId([0-9]+)': {
                                    title: resolved =>
                                        !em.get('settings.signalSetsAsSensors', false)
                                            ? t('Signal Set "{{name}}"', {name: resolved.signalSet.name || resolved.signalSet.cid})
                                            : t('Sensor Node "{{name}}"', {name: resolved.signalSet.name || resolved.signalSet.cid}),
                                    resolve: {
                                        signalSet: params => `rest/signal-sets/${params.signalSetId}`
                                    },
                                    link: params => `/settings/signal-sets/${params.signalSetId}/edit`,
                                    navs: {
                                        ':action(edit|delete)': {
                                            title: t('Edit'),
                                            link: params => `/settings/signal-sets/${params.signalSetId}/edit`,
                                            visible: resolved => resolved.signalSet.permissions.includes('edit'),
                                            panelRender: props => <SignalSetsCUD action={props.match.params.action} entity={props.resolved.signalSet} />
                                        },
                                        ':action(signals|reindex)': {
                                            title: t('Signals'),
                                            link: params => `/settings/signal-sets/${params.signalSetId}/signals`,
                                            panelRender: props => <SignalsList action={props.match.params.action} signalSet={props.resolved.signalSet}/>,
                                            children: {
                                                ':signalId([0-9]+)': {
                                                    title: resolved => t('Signal "{{name}}"', {name: resolved.signal.name || resolved.signal.cid}),
                                                    resolve: {
                                                        signal: params => `rest/signals/${params.signalId}`
                                                    },
                                                    link: params => `/settings/signal-sets/${params.signalSetId}/signals/${params.signalId}/edit`,
                                                    navs: {
                                                        ':action(edit|delete)': {
                                                            title: t('Edit'),
                                                            link: params => `/settings/signal-sets/${params.signalSetId}/signals/${params.signalId}/edit`,
                                                            visible: resolved => resolved.signal.permissions.includes('edit'),
                                                            panelRender: props => <SignalsCUD action={props.match.params.action} signalSet={props.resolved.signalSet} entity={props.resolved.signal} />
                                                        },
                                                        share: {
                                                            title: t('Share'),
                                                            link: params => `/settings/signal-sets/${params.signalSetId}/signals/${params.signalId}/share`,
                                                            visible: resolved => resolved.signal.permissions.includes('share'),
                                                            panelRender: props => <Share title={t('Share')} entity={props.resolved.signal} entityTypeId="signal" />
                                                        }
                                                    }
                                                },
                                                create: {
                                                    title: t('Create'),
                                                    panelRender: props => <SignalsCUD signalSet={props.resolved.signalSet} action="create" />
                                                }
                                            }
                                        },
                                        share: {
                                            title: t('Share'),
                                            link: params => `/settings/signal-sets/${params.signalSetId}/share`,
                                            visible: resolved => resolved.signalSet.permissions.includes('share'),
                                            panelRender: props => <Share title={t('Share')} entity={props.resolved.signalSet} entityTypeId="signalSet" />
                                        }
                                    }
                                },
                                create: {
                                    title: t('Create'),
                                    panelRender: props => <SignalSetsCUD action="create" />
                                }
                            }
                        },
                        users: {
                            title: t('Users'),
                            link: '/settings/users',
                            panelComponent: UsersList,
                            children: {
                                ':userId([0-9]+)': {
                                    title: resolved => t('User "{{name}}"', {name: resolved.user.name}),
                                    resolve: {
                                        user: params => `rest/users/${params.userId}`
                                    },
                                    link: params => `/settings/users/${params.userId}/edit`,
                                    navs: {
                                        ':action(edit|delete)': {
                                            title: t('Edit'),
                                            link: params => `/settings/users/${params.userId}/edit`,
                                            panelRender: props => (<UsersCUD action={props.match.params.action} entity={props.resolved.user} />)
                                        },
                                        shares: {
                                            title: t('Shares'),
                                            link: params => `/settings/users/${params.userId}/shares`,
                                            panelRender: props => <UserShares user={props.resolved.user} />
                                        }
                                    }
                                },
                                create: {
                                    title: t('Create User'),
                                    panelRender: props => (<UsersCUD action="create" />)
                                }
                            }
                        },
                        namespaces: {
                            title: t('Namespaces'),
                            link: '/settings/namespaces',
                            panelComponent: NamespacesList,
                            children: {
                                ':namespaceId([0-9]+)': {
                                    title: resolved => t('Namespace "{{name}}"', {name: resolved.namespace.name}),
                                    resolve: {
                                        namespace: params => `rest/namespaces/${params.namespaceId}`
                                    },
                                    link: params => `/settings/namespaces/${params.namespaceId}/edit`,
                                    navs: {
                                        ':action(edit|delete)': {
                                            title: t('Edit'),
                                            link: params => `/settings/namespaces/${params.namespaceId}/edit`,
                                            visible: resolved => resolved.namespace.permissions.includes('edit'),
                                            panelRender: props => <NamespacesCUD action={props.match.params.action} entity={props.resolved.namespace} />
                                        },
                                        share: {
                                            title: t('Share'),
                                            link: params => `/settings/namespaces/${params.namespaceId}/share`,
                                            visible: resolved => resolved.namespace.permissions.includes('share'),
                                            panelRender: props => <Share title={t('Share')} entity={props.resolved.namespace} entityTypeId="namespace" />
                                        }
                                    }
                                },
                                create: {
                                    title: t('Create'),
                                    panelRender: props => <NamespacesCUD action="create" />
                                },
                            }
                        }
                    }
                }
            }
        }
    };

    em.invoke('client.installRoutes', structure, t);

    return structure;
};

ReactDOM.render(
    <I18nextProvider i18n={i18n}><Section root='/' structure={getStructure} /></I18nextProvider>,
    document.getElementById('root')
);