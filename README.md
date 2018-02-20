# IVIS-CORE
## Introduction 
IVIS-CORE project provides core components, and modules in order to develop and realize modern Web applications for data visualization, and analytics. In particular, this project offers the visualization components (LineChart, AreaChart, OnOffAreaChart, PieChart) and other core functionalities at the client- and the server-side for the development of domain-specific applications through IVIS extensions.

## Structure
This project consists of the client-, and the server-side modules. The client module provides all components (UI components, visualization), libraries, etc. that will be presented to the users of Web applications through Web browsers. While the server-side module provides all components, services, and libraries to operate security, database, searching, indexing, etc.

## Technologies
IVIS-CORE has been realized on top of several technologies, in particular based on JavaScript ecosystem, as the following:

- Frontend: 
-- User Interface: Reactjs (a javascript library)
-- User Interface Design: bootstrap
-- Visualizations: D3 (a javascript library)
-- JSX:
- Backend:
-- IVIS routes, and API: NodeJS
-- Database: MySQL
-- Indexing & Searching: ElasticSearch
-- Security: Passport


## IVIS Concept
IVIS framework has been designed around several concepts namely workspace, namespace, panel, template. Collectively, they are named entities in IVIS.

### Sharing Mechanism

### Workspace
Workspace can contain several panels; workspace is about presenting things in UI. 

### Panel
A panel is part of a Workspace that has a special purpose to present UIs. 

### SignalSet (Sensor)

### Workspace

### Namespace
Namespace is a method to manage security and access control of different entities in the organisational structure; namespace is about visibility based on position of the user in the organisational structure. Those two concepts are fully orthogonal.

#### Permission

A permission is essentially a tripple; the entities are for instance: signal, panel, workspace, namespace; meaning entities have types and the potential operations are tied to their types.

You can see the types and operations in default.yaml (in ivis-core).

## IVIS for Admins
This section targets IVIS admins describing first the permissions/roles, and then workspaces/panels/templates.

### Defining Permissions 
IVIS supports two types of permissions: one per entity, and the other one global. The default permissions has been defined in server/config/default.yaml under roles entry.
### Global Permissions 
The global permissions are then defined under roles.global entry; these permissions are for the Root namespace of your application. In this section, you define all roles of your application; for instance, you define in the configuration the principal role "master", "visitor", "manager", "analyst", "supervisor", etc. Then, you define all global permissions for each role under its permissions entry.
The following configuration defines global permission for the role of master. In terms of global permissions, this role will have the permissions of rebuildPermissions, allocateSignalSet, and manageWorkspaces. These permissions are specific to IVIS-CORE project. You can define your own permissions based on your requirements in the applications considering different roles of your application.

```
roles:
  global:
    master:
      name: "Master"
      admin: true
      description: "All permissions"
      permissions:
      - rebuildPermissions
      - allocateSignalSet
      - manageWorkspaces
      rootNamespaceRole: master
```
In this config, setting "admin" attribute to true will give all permissions to this user within Root namespace by default.
By specifying "rootNamespaceRole" to master, we define the role of user in the Root namespace.
We can also specify "ownNamespaceRole" attribute in order to define user's role in its own namespace (role), .i.e the namespace that a user (role) owns.

### Per Entity Permissions 
In order to have fine-grained permissions at entity level, you can define per entity permissions in IVIS config. For instance, the following config defines permissions on "workspace" entity for the master role.
```
roles:
  workspace:
    master:
      name: "Master"
      description: "All permissions"
      permissions: ["view", "edit", "delete", "share", "createPanel"]
```
When we create a user in IVIS, a user can get a default role. However, this is only the default role of this user, and based on shares that have been given to this user (user's shares), he/she may get other roles for other entities. With this sharing mechanism, each user is not bounded to its default role.

The idea of this configuration is that the operations are too fine-grained to be set via UI; so you define what these roles mean in terms of the fine-grained permissions. Then in the UI, you share a entity (e.g. a workspace, or a panel) with someone in the particular role; i.e. you can have a role "master" to a particular panel which would entitle you to do anything with the particular panel.

Thus, recapping "per entity permissions" defines what permissions a particular role has to an entity; therefore, if you make some users a "master" for a namespace (e.g. "root"), this user will have all the permissions to the particular namespace and its children. Effectively, making a user a "master" to the "Root" namespace, he/she will get access to everything. 
But you make a user a "master" to some namespace lower in the namespace hierarchy, which would give the user access to only the subtree.

In summary, in order to see the effect of "per entity permissions", IVIS admins have to share entities with respective users; so these things are coupled together.
The complete config of "per entity permissions" for IVIS-CORE project are as the following:

```
roles:
  namespace:
    master:
      name: "Master"
      description: "All permissions"
      permissions: ["view", "edit", "delete", "share", "createNamespace", "createTemplate", "createWorkspace", "createPanel", "createSignal", "createSignalSet", "manageUsers"]
      children:
        namespace: ["view", "edit", "delete", "share", "createNamespace", "createTemplate", "createWorkspace", "createPanel", "createSignal", "createSignalSet", "manageUsers"]
        template: ["view", "edit", "delete", "share", "execute"]
        workspace: ["view", "edit", "delete", "share", "createPanel"]
        panel: ["view", "edit", "delete", "share"]
        signal: ["view", "edit", "delete", "insert", "query", "share"]
        signalSet: ["view", "edit", "delete", "insert", "query", "share", "manageSignals", "reindex", "createSignal"]

  template:
    master:
      name: "Master"
      description: "All permissions"
      permissions: ["view", "edit", "delete", "share", "execute", "createPanel"]

  workspace:
    master:
      name: "Master"
      description: "All permissions"
      permissions: ["view", "edit", "delete", "share", "createPanel"]

  panel:
    master:
      name: "Master"
      description: "All permissions"
      permissions: ["view", "edit", "delete", "share"]

  signal:
    master:
      name: "Master"
      description: "All permissions"
      permissions: ["view", "edit", "delete", "query", "share"]

  signalSet:
    master:
      name: "Master"
      description: "All permissions"
      permissions: ["view", "edit", "delete", "insert", "query", "share", "manageSignals", "reindex", "createSignal"]
      # Manage signals gives full permission to all signals contained in a signalSet
```


## IVIS Extension for Domain-Specific Applications
IVIS-CORE can be extended thourgh IVIS extensions mechanism, and plug-ins in order to develop Domain-Specific Applications. For that, we need to create another project in another repository for the Domain-Specific Application, where we include the core as a git submodule and add domain-specific modules, and components, import/management components and possibly some branding.
