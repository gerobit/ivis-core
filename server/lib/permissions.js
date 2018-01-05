'use strict';
const em = require('./extension-manager');

let entityTypes = {
    namespace: {
        entitiesTable: 'namespaces',
        sharesTable: 'shares_namespace',
        permissionsTable: 'permissions_namespace'
    },
    template: {
        entitiesTable: 'templates',
        sharesTable: 'shares_template',
        permissionsTable: 'permissions_template'
    },
    workspace: {
        entitiesTable: 'workspaces',
        sharesTable: 'shares_workspace',
        permissionsTable: 'permissions_workspace'
    },
    panel: {
        entitiesTable: 'panels',
        sharesTable: 'shares_panel',
        permissionsTable: 'permissions_panel'
    },
    signal: {
        entitiesTable: 'signals',
        sharesTable: 'shares_signal',
        permissionsTable: 'permissions_signal'
    },
    signalSet: {
        entitiesTable: 'signal_sets',
        sharesTable: 'shares_signal_set',
        permissionsTable: 'permissions_signal_set'
    }
};

function getEntityTypes() {
    return entityTypes;
}

function getEntityType(entityTypeId) {
    const entityType = entityTypes[entityTypeId];

    if (!entityType) {
        throw new Error(`Unknown entity type ${entityTypeId}`);
    }

    return entityType
}

function addEntityType(newEntityTypes) {
    for(const key in newEntityTypes) {
        entityTypes[key] = newEntityTypes[key];
    }
}

em.on('permissions.extra', (entityTypes) => {
    addEntityType(entityTypes);
});

module.exports = {
    getEntityTypes,
    getEntityType,
    addEntityType
}