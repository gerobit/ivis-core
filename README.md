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
This section targets IVIS admins describing the permissions/roles, workspaces/panels/templates.

## IVIS Extension for Domain-Specific Applications
IVIS-CORE can be extended thourgh IVIS extensions mechanism, and plug-ins in order to develop Domain-Specific Applications. For that, we need to create another project in another repository for the Domain-Specific Application, where we include the core as a git submodule and add domain-specific modules, and components, import/management components and possibly some branding.
