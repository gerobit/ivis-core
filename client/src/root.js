'use strict';

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
import ShareSensor from './shares/ShareSensor'

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

import FarmsList from './settings/farms/List';
import FarmsCUD from './settings/farms/CUD';

import CropsList from './settings/crops/List';
import CropsCUD from './settings/crops/CUD';

import CropSeasonsList from './settings/cropseasons/List';
import CropSeasonsCUD from './settings/cropseasons/CUD';

import EventTypesList from './settings/event-types/List';
import EventTypesCUD from './settings/event-types/CUD';

import EventsList from './settings/events/List';
import EventsCUD from './settings/events/CUD';

import RecommendationsList from './settings/recommendations/List';
import RecommendationsCUD from './settings/recommendations/CUD';


import SignalsList from './settings/signal-sets/signals/List';
import SignalsCUD from './settings/signal-sets/signals/CUD';

import SettingsSidebar from './settings/Sidebar';

import SamplePanel from './workspaces/SamplePanel1';
import SamplePanel2 from './workspaces/SamplePanel2';
import SamplePanel3 from './workspaces/SamplePanel3';
import SamplePanelUPPA_Sensor10 from './workspaces/SamplePanelUPPA_Sensor10';

import FarmsSidebar from './workspaces/farms/FarmsSidebar';

import FarmsListPanel from './workspaces/farms/FarmsListPanel';
import FarmsMapPanel from './workspaces/farms/FarmsMapPanel';
import FarmsEventsPanel from './workspaces/farms/FarmsEventsPanel';
import FarmsRecommendationsPanel from './workspaces/farms/FarmsRecommendationsPanel';

import FarmViewPanel from './workspaces/farms/FarmViewPanel';
import FarmMapPanel from './workspaces/farms/FarmMapPanel';
import FarmRecommendationsPanel from './workspaces/farms/FarmRecommendationsPanel';
import FarmEventsPanel from './workspaces/farms/FarmEventsPanel';
import FarmSensorsPanel from './workspaces/farms/FarmSensorsPanel';
import FarmsCropSeasonsPanel from './workspaces/farms/FarmsCropSeasonsPanel';
import FarmCropSeasonsAnalysis from './workspaces/farms/FarmCropSeasonsAnalysis';

import MainMenuAuthenticated from './MainMenuAuthenticated';
import MainMenuAnonymous from './MainMenuAnonymous';

import WorkspacesOverview from './workspaces/Overview';
import WorkspacesPanelsOverview from './workspaces/panels/Overview';
import WorkspacePanel from './workspaces/panels/WorkspacePanel';

import WorkspaceSidebar from './workspaces/Sidebar';

import ivisConfig from "ivisConfig";

const getStructure = t => {

    return {
        '': {
            title: t('Home'),
            link: () => ivisConfig.isAuthenticated ? 'workspaces/farms' : '/login',
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
                        workspacesVisible: params => `/rest/workspaces-visible`
                    },
                    panelComponent: Account,
                    primaryMenuComponent: MainMenuAuthenticated
                },
                workspaces: {
                    title: t('Workspaces'),
                    link: '/workspaces',
                    panelComponent: WorkspacesOverview,
                    resolve: {
                        workspacesVisible: params => `/rest/workspaces-visible`
                    },
                    primaryMenuComponent: MainMenuAuthenticated,
                    children: {
                        ':workspaceId([0-9]+)': {
                            title: resolved => resolved.workspace.name,
                            resolve: {
                                workspace: params => `/rest/workspaces/${params.workspaceId}`,
                                panelsVisible: params => `/rest/panels-visible/${params.workspaceId}`
                            },
                            link: params => `/workspaces/${params.workspaceId}`,
                            panelRender: props => <WorkspacesPanelsOverview workspace={props.resolved.workspace} />,
                            secondaryMenuComponent: WorkspaceSidebar,
                            children: {
                                ':panelId([0-9]+)': {
                                    title: resolved => resolved.panel.name,
                                    resolve: {
                                        panel: params => `/rest/panels/${params.panelId}`,
                                        initialAccessToken: params => `/rest/panel-token/${params.panelId}`
                                    },
                                    link: params => `/workspaces/${params.workspaceId}/${params.panelId}`,
                                    panelRender: props => <WorkspacePanel panel={props.resolved.panel} initialAccessToken={props.resolved.initialAccessToken} />
                                }
                            }
                        },

                        sample1: {
                            title: t('Sample workspace'),
                            link: '/workspaces/sample',
                            panelComponent: SamplePanel,
                        },
                        sample2: {
                            title: t('Turbidity'),
                            link: '/workspaces/sample2',
                            panelComponent: SamplePanel2,
                        },
                        sample3: {
                            title: t('Activated Processes'),
                            link: '/workspaces/sample3',
                            panelComponent: SamplePanel3,
                        },
                        sample4: {
                            title: t('Sample workspace waziup'),
                            link: '/workspaces/sample4',
                            panelComponent: SamplePanelUPPA_Sensor10,
                        },
                        'crop-seasons': {
                            title: t('Farm Crop Season'),
                            link: params => `/workspaces/crop-seasons`,
                            panelRender: props => <FarmsCropSeasonsPanel />,
                            children: {
                                ':csId([0-9]+)': {
                                    title: resolved => t('Crop Season "{{name}}"', { name: resolved.cropSeason.name || resolved.cropSeason.id }),
                                    resolve: {
                                        cropSeason: params => `/rest/crop-seasons/${params.csId}`
                                    },
                                    link: params => `/workspaces/crop-seasons/${params.csId}`,
                                    panelRender: props => <FarmCropSeasonsAnalysis cropSeason={props.resolved.cropSeason} />,
                                    /*
                                    link: params => `/workspaces/crop-seasons/${params.csId}/analysis`,
                                    navs: {
                                        ':action(analysis)': {
                                            title: t('Analysis'),
                                            link: params => `/settings/workspaces/${params.workspaceId}/edit`,
                                            visible: resolved => resolved.workspace.permissions.includes('edit'),
                                            panelRender: props => <WorkspacesCUD action={props.match.params.action} entity={props.resolved.workspace} workspacesVisible={props.resolved.workspacesVisible} />
                                        },*/
                                    
                                }
                            }
                        },
                        farms: {
                            title: t('Farm Management'),
                            link: '/workspaces/farms',
                            panelComponent: FarmsListPanel,
                            secondaryMenuComponent: FarmsSidebar,
                            resolve: {
                                farms: params => `/rest/farms/`
                            },
                            navs: {
                                map: {
                                    title: t('Your Farms Map'),
                                    link: '/workspaces/farms/map',
                                    panelComponent: FarmsMapPanel
                                },
                                list: {
                                    title: t('Your Farms'),
                                    link: '/workspaces/farms/list',
                                    panelComponent: FarmsListPanel
                                }
                            },
                            children: {
                                events: {
                                    title: t('Farms Events'),
                                    link: params => `/workspaces/farms/events`,
                                    visible: resolved => resolved.farms.permissions.includes('viewEvents'),
                                    panelRender: props => <FarmsEventsPanel />,
                                },
                                recommendations: {
                                    title: t('Farms Schedules & Timeline'),
                                    link: params => `/workspaces/farms/recommendations`,
                                    visible: resolved => resolved.farm.permissions.includes('viewRecommendations'),
                                    panelRender: props => <FarmsRecommendationsPanel />,
                                },
                                'crop-seasons': {
                                    title: t('Farms Crop Seasons'),
                                    link: params => `/workspaces/farms/crop-seasons`,
                                    visible: resolved => resolved.farm.permissions.includes('viewCropSeasons'),
                                    panelRender: props => <FarmsCropSeasonsPanel />,
                                    children: {
                                        ':csId([0-9]+)': {
                                            title: resolved => t('Crop Season "{{name}}"', { name: resolved.cropSeason.name || resolved.cropSeason.id }),
                                            resolve: {
                                                cropSeason: params => `/rest/crop-seasons/${params.csId}`
                                            },
                                            link: params => `/workspaces/farms/crop-seasons/${params.csId}/analysis`,
                                            panelRender: props => <FarmCropSeasonsAnalysis cropSeason={props.resolved.cropSeason} />,

                                            /*navs: {
                                                ':action(edit|delete)': {
                                                    title: t('Edit'),
                                                    link: params => `/settings/crop-seasons/${params.csId}/edit`,
                                                    visible: resolved => resolved.cs.permissions.includes('createCropSeason'),
                                                    panelRender: props => <CropSeasonsCUD action={props.match.params.action} entity={props.resolved.cs} />
                                                }
                                            }*/
                                        }
                                    }
                                },
                                notifications: {
                                    title: t('Farms Notifications'),
                                    link: params => `/workspaces/farms/notifications`,
                                    visible: resolved => resolved.farm.permissions.includes('viewNotifications'),
                                    panelRender: props => <FarmsEventsPanel />,
                                },
                                ':farmId([0-9]+)': {
                                    title: resolved => t('{{name}}\'s Farm View', { name: resolved.farm.name || resolved.farm.id }),
                                    resolve: {
                                        farm: params => `/rest/farms/${params.farmId}`
                                    },
                                    link: params => `/workspaces/farms/${params.farmId}`,
                                    panelRender: props => <FarmViewPanel farm={props.resolved.farm} />,
                                    secondaryMenuComponent: FarmsSidebar,
                                    navs: {
                                        view: {
                                            title: t('View'),
                                            link: params => `/workspaces/farms/${params.farmId}/view`,
                                            visible: resolved => resolved.farm.permissions.includes('view'),
                                            panelRender: props => <FarmViewPanel farm={props.resolved.farm} />,
                                        },
                                        map: {
                                            title: t('Map'),
                                            link: params => `/workspaces/farms/${params.farmId}/map`,
                                            visible: resolved => resolved.farm.permissions.includes('view'),
                                            panelRender: props => <FarmMapPanel farm={props.resolved.farm} />,
                                        },
                                        sensors: {
                                            title: t('Sensors'),
                                            link: params => `/workspaces/farms/${params.farmId}/sensors`,
                                            visible: resolved => resolved.farm.permissions.includes('view'),
                                            panelRender: props => <FarmSensorsPanel farm={props.resolved.farm} />,
                                        },
                                        events: {
                                            title: t('Events'),
                                            link: params => `/workspaces/farms/${params.farmId}/events`,
                                            visible: resolved => resolved.farm.permissions.includes('view'),
                                            panelRender: props => <FarmEventsPanel farm={props.resolved.farm} />,
                                        },
                                        recommendations: {
                                            title: t('Recommendations'),
                                            link: params => `/workspaces/farms/${params.farmId}/recommendations`,
                                            visible: resolved => resolved.farm.permissions.includes('view'),
                                            panelRender: props => <FarmRecommendationsPanel farm={props.resolved.farm} />,
                                        },
                                        /*map: {
                                            title: t('Your Farms Map'),
                                            link: '/workspaces/farms/map',
                                            panelComponent: FarmsMapPanel
                                        },
                                        list: {
                                            title: t('Your Farms'),
                                            link: '/workspaces/farms/list',
                                            panelComponent: FarmsListPanel
                                        }*/
                                    }
                                }
                            }
                        }
                    }
                },
                settings: {
                    title: t('Administration'),
                    resolve: {
                        workspacesVisible: params => `/rest/workspaces-visible`
                    },
                    link: '/settings/farms',
                    primaryMenuComponent: MainMenuAuthenticated,
                    secondaryMenuComponent: SettingsSidebar,
                    children: {
                        workspaces: {
                            title: t('Workspaces'),
                            link: '/settings/workspaces',
                            panelComponent: WorkspacesList,
                            children: {
                                ':workspaceId([0-9]+)': {
                                    title: resolved => t('Workspace "{{name}}"', { name: resolved.workspace.name }),
                                    resolve: {
                                        workspace: params => `/rest/workspaces/${params.workspaceId}`
                                    },
                                    link: params => `/settings/workspaces/${params.workspaceId}/edit`,
                                    navs: {
                                        ':action(edit|delete)': {
                                            title: t('Edit'),
                                            link: params => `/settings/workspaces/${params.workspaceId}/edit`,
                                            visible: resolved => resolved.workspace.permissions.includes('edit'),
                                            panelRender: props => <WorkspacesCUD action={props.match.params.action} entity={props.resolved.workspace} workspacesVisible={props.resolved.workspacesVisible} />
                                        },
                                        panels: {
                                            title: t('Panels'),
                                            link: params => `/settings/workspaces/${params.workspaceId}/panels`,
                                            panelRender: props => <PanelsList workspace={props.resolved.workspace} />,
                                            children: {
                                                ':panelId([0-9]+)': {
                                                    title: resolved => t('Panel "{{name}}"', { name: resolved.panel.name }),
                                                    resolve: {
                                                        panel: params => `/rest/panels/${params.panelId}`
                                                    },
                                                    link: params => `/settings/workspaces/${params.workspaceId}/panels/${params.panelId}/edit`,
                                                    navs: {
                                                        ':action(edit|delete)': {
                                                            title: t('Edit'),
                                                            resolve: {
                                                                panelsVisible: params => `/rest/panels-visible/${params.workspaceId}`
                                                            },
                                                            link: params => `/settings/workspaces/${params.workspaceId}/panels/${params.panelId}/edit`,
                                                            visible: resolved => resolved.panel.permissions.includes('edit'),
                                                            panelRender: props => <PanelsCUD action={props.match.params.action} entity={props.resolved.panel} workspace={props.resolved.workspace} panelsVisible={props.resolved.panelsVisible} />
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
                                                        panelsVisible: params => `/rest/panels-visible/${params.workspaceId}`
                                                    },
                                                    panelRender: props => <PanelsCUD action="create" workspace={props.resolved.workspace} panelsVisible={props.resolved.panelsVisible} />
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
                                    panelRender: props => <WorkspacesCUD action="create" workspacesVisible={props.resolved.workspacesVisible} />
                                }
                            }
                        },
                        templates: {
                            title: t('Templates'),
                            link: '/settings/templates',
                            panelComponent: TemplatesList,
                            children: {
                                ':templateId([0-9]+)': {
                                    title: resolved => t('Template "{{name}}"', { name: resolved.template.name }),
                                    resolve: {
                                        template: params => `/rest/templates/${params.templateId}`
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
                        farms: {
                            title: t('Farms'),
                            link: '/settings/farms',
                            panelComponent: FarmsList,
                            children: {
                                ':farmId([0-9]+)': {
                                    title: resolved => t('Farm "{{name}}"', { name: resolved.farm.name || resolved.farm.id }),
                                    resolve: {
                                        farm: params => `/rest/farms/${params.farmId}`
                                    },
                                    link: params => `/settings/farms/${params.farmId}/edit`,
                                    navs: {
                                        ':action(edit|delete)': {
                                            title: t('Edit'),
                                            link: params => `/settings/farms/${params.farmId}/edit`,
                                            visible: resolved => resolved.farm.permissions.includes('edit'),
                                            panelRender: props => <FarmsCUD action={props.match.params.action} entity={props.resolved.farm} />
                                        },
                                        ':action(sensors)': {
                                            title: t('Sensors'),
                                            link: params => `/settings/farms/${params.farmId}/sensors`,
                                            visible: resolved => resolved.farm.permissions.includes('edit'),
                                            panelRender: props => <ShareSensor title={t('Sensor')} entity={props.resolved.farm} entityTypeId="signalSet" />
                                        },
                                        share: {
                                            title: t('Share'),
                                            link: params => `/settings/farms/${params.farmId}/share`,
                                            visible: resolved => resolved.farm.permissions.includes('share'),
                                            panelRender: props => <Share title={t('Share')} entity={props.resolved.farm} entityTypeId="farm" />
                                        }
                                    }
                                },
                                create: {
                                    title: t('Create'),
                                    panelRender: props => <FarmsCUD action="create" />
                                }
                            }
                        },
                        'crop-seasons': {
                            title: t('Crop Seasons'),
                            link: '/settings/crop-seasons',
                            panelComponent: CropSeasonsList,
                            children: {
                                ':csId([0-9]+)': {
                                    title: resolved => t('Crop Season "{{name}}"', { name: resolved.cs.name || resolved.cs.id }),
                                    resolve: {
                                        cs: params => `/rest/crop-seasons/${params.csId}`
                                    },
                                    link: params => `/settings/crop-seasons/${params.csId}/edit`,
                                    navs: {
                                        ':action(edit|delete)': {
                                            title: t('Edit'),
                                            link: params => `/settings/crop-seasons/${params.csId}/edit`,
                                            visible: resolved => resolved.cs.permissions.includes('createCropSeason'),
                                            panelRender: props => <CropSeasonsCUD action={props.match.params.action} entity={props.resolved.cs} />
                                        }
                                    }
                                },
                                create: {
                                    title: t('Create'),
                                    panelRender: props => <CropSeasonsCUD action="create" />
                                }
                            }
                        },
                        cattles: {
                            title: t('Cattles'),
                            link: '/settings/cattles',
                            panelComponent: FarmsList,
                            children: {
                                ':farmId([0-9]+)': {
                                    title: resolved => t('Cattle "{{name}}"', { name: resolved.farm.name || resolved.farm.id }),
                                    resolve: {
                                        farm: params => `/rest/farms/${params.farmId}`
                                    },
                                    link: params => `/settings/farms/${params.farmId}/edit`,
                                    navs: {
                                        ':action(edit|delete)': {
                                            title: t('Edit'),
                                            link: params => `/settings/farms/${params.farmId}/edit`,
                                            visible: resolved => resolved.farm.permissions.includes('edit'),
                                            panelRender: props => <FarmsCUD action={props.match.params.action} entity={props.resolved.farm} />
                                        },
                                        ':action(sensors)': {
                                            title: t('Sensors'),
                                            link: params => `/settings/farms/${params.farmId}/sensors`,
                                            visible: resolved => resolved.farm.permissions.includes('edit'),
                                            panelRender: props => <ShareSensor title={t('Sensor')} entity={props.resolved.farm} entityTypeId="signalSet" />
                                        },
                                        share: {
                                            title: t('Share'),
                                            link: params => `/settings/farms/${params.farmId}/share`,
                                            visible: resolved => resolved.farm.permissions.includes('share'),
                                            panelRender: props => <Share title={t('Share')} entity={props.resolved.farm} entityTypeId="farm" />
                                        }
                                    }
                                },
                                create: {
                                    title: t('Create'),
                                    panelRender: props => <FarmsCUD action="create" />
                                }
                            }
                        },
                        crops: {
                            title: t('Crops'),
                            link: '/settings/crops',
                            panelComponent: CropsList,
                            children: {
                                ':cropId([0-9]+)': {
                                    title: resolved => t('Crop "{{name}}"', { name: resolved.crop.name || resolved.crop.id }),
                                    resolve: {
                                        crop: params => `/rest/crops/${params.cropId}`
                                    },
                                    link: params => `/settings/crops/${params.cropId}/edit`,
                                    navs: {
                                        ':action(edit|delete)': {
                                            title: t('Edit'),
                                            link: params => `/settings/crops/${params.cropId}/edit`,
                                            visible: true,
                                            //visible: resolved => resolved.crop.permissions.includes('manageFarms'),
                                            panelRender: props => <CropsCUD action={props.match.params.action} entity={props.resolved.crop} />
                                        }
                                    }
                                },
                                create: {
                                    title: t('Create'),
                                    panelRender: props => <CropsCUD action="create" />
                                }
                            }
                        },
                        'event-types': {
                            title: t('Event Types'),
                            link: '/settings/event-types',
                            panelComponent: EventTypesList,
                            children: {
                                ':eventTypeId([0-9]+)': {
                                    title: resolved => t('Event Type "{{name}}"', { name: resolved.eventType.name || resolved.eventType.id }),
                                    resolve: {
                                        eventType: params => `/rest/event-types/${params.eventTypeId}`
                                    },
                                    link: params => `/settings/event-types/${params.eventTypeId}/edit`,
                                    navs: {
                                        ':action(edit|delete)': {
                                            title: t('Edit'),
                                            link: params => `/settings/event-types/${params.eventTypeId}/edit`,
                                            visible: true,
                                            panelRender: props => <EventTypesCUD action={props.match.params.action} entity={props.resolved.eventType} />
                                        }
                                    }
                                },
                                create: {
                                    title: t('Create'),
                                    panelRender: props => <EventTypesCUD action="create" />
                                }
                            }
                        },
                        events: {
                            title: t('Events'),
                            link: '/settings/events',
                            panelComponent: EventsList,
                            children: {
                                ':eventId([0-9]+)': {
                                    title: resolved => t('Event "{{name}}"', { name: resolved.event.name || resolved.event.id }),
                                    resolve: {
                                        event: params => `/rest/events/${params.eventId}`
                                    },
                                    link: params => `/settings/events/${params.eventId}/edit`,
                                    navs: {
                                        ':action(edit|delete)': {
                                            title: t('Edit'),
                                            link: params => `/settings/events/${params.eventId}/edit`,
                                            visible: true,
                                            panelRender: props => <EventsCUD action={props.match.params.action} entity={props.resolved.event} />
                                        }
                                    }
                                },
                                create: {
                                    title: t('Create'),
                                    panelRender: props => <EventsCUD action="create" />
                                }
                            }
                        },
                        recommendations: {
                            title: t('Recommendations'),
                            link: '/settings/recommendations',
                            panelComponent: RecommendationsList,
                            children: {
                                ':recommendationId([0-9]+)': {
                                    title: resolved => t('Recommendation "{{name}}"', { name: resolved.recommendation.id }),
                                    resolve: {
                                        recommendation: params => `/rest/recommendations/${params.recommendationId}`
                                    },
                                    link: params => `/settings/recommendations/${params.recommendationId}/edit`,
                                    navs: {
                                        ':action(edit|delete)': {
                                            title: t('Edit'),
                                            link: params => `/settings/recommendations/${params.recommendationId}/edit`,
                                            visible: true,
                                            panelRender: props => <RecommendationsCUD action={props.match.params.action} entity={props.resolved.recommendation} />
                                        }
                                    }
                                },
                                create: {
                                    title: t('Create'),
                                    panelRender: props => <RecommendationsCUD action="create" />
                                }
                            }
                        },
                        'signal-sets': {
                            title: t('Signals'),
                            link: '/settings/signal-sets',
                            panelComponent: SignalSetsList,
                            children: {
                                ':signalSetId([0-9]+)': {
                                    title: resolved => t('Signal Set "{{name}}"', { name: resolved.signalSet.name || resolved.signalSet.cid }),
                                    resolve: {
                                        signalSet: params => `/rest/signal-sets/${params.signalSetId}`
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
                                            panelRender: props => <SignalsList action={props.match.params.action} signalSet={props.resolved.signalSet} />,
                                            children: {
                                                ':signalId([0-9]+)': {
                                                    title: resolved => t('Signal "{{name}}"', { name: resolved.signal.name || resolved.signal.cid }),
                                                    resolve: {
                                                        signal: params => `/rest/signals/${params.signalId}`
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
                                    title: resolved => t('User "{{name}}"', { name: resolved.user.name }),
                                    resolve: {
                                        user: params => `/rest/users/${params.userId}`
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
                                    title: resolved => t('Namespace "{{name}}"', { name: resolved.namespace.name }),
                                    resolve: {
                                        namespace: params => `/rest/namespaces/${params.namespaceId}`
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
};

ReactDOM.render(
    <I18nextProvider i18n={i18n}><Section root='/' structure={getStructure} /></I18nextProvider>,
    document.getElementById('root')
);


