'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {withRouter} from "react-router";
import {BrowserRouter as Router, Route, Switch} from "react-router-dom";
import {withErrorHandling} from "./error-handling";
import styles from "./styles-content.scss";
import {getRoutes, renderRoute, Resolver, SectionContentContext, withPageHelpers} from "./page-common";
import {getBaseDir} from "./urls";
import {parentRPC} from "./untrusted";
import {withComponentMixins} from "./decorator-helpers";
import {withTranslation} from "./i18n";
import jQuery from 'jquery';

export { withPageHelpers }

function getLoadingMessage(t) {
    return (
        <div className="container-fluid">
            <div className={styles.loadingMessage}>{t('Loading...')}</div>
        </div>
    );
}

@withComponentMixins([
    withTranslation
])
class PanelRoute extends Component {
    static propTypes = {
        route: PropTypes.object.isRequired,
        location: PropTypes.object.isRequired,
        match: PropTypes.object.isRequired
    }

    render() {
        const t = this.props.t;
        const route = this.props.route;
        const params = this.props.match.params;

        if (route.insideIframe) {
            jQuery(document.body).addClass('inside-iframe');
        } else {
            jQuery(document.body).removeClass('inside-iframe');
        }

        const render = resolved => {
            if (resolved) {
                const compProps = {
                    match: this.props.match,
                    location: this.props.location,
                    resolved
                };

                let panel;
                if (route.panelComponent) {
                    panel = React.createElement(route.panelComponent, compProps);
                } else if (route.panelRender) {
                    panel = route.panelRender(compProps);
                }

                return (
                    <div className="container-fluid">
                        {panel}
                    </div>
                );

            } else {
                return getLoadingMessage(t);
            }
        };

        return <Resolver route={route} render={render} location={this.props.location} match={this.props.match} />;
    }
}


@withRouter
@withComponentMixins([
    withTranslation,
    withErrorHandling
])
export class SectionContent extends Component {
    constructor(props) {
        super(props);

        this.state = {
        };
    }

    static propTypes = {
        structure: PropTypes.object.isRequired,
        root: PropTypes.string.isRequired
    }

    setFlashMessage(severity, text) {
        parentRPC.ask('setFlashMessage', {severity, text})
    }

    navigateTo(path) {
        parentRPC.ask('navigateTo', {path});
    }

    navigateBack() {
        parentRPC.ask('navigateBack');
    }

    navigateToWithFlashMessage(path, severity, text) {
        parentRPC.ask('navigateToWithFlashMessage', {path, severity, text});
    }

    errorHandler(error) {
        if (error.response && error.response.data && error.response.data.message) {
            console.error(error);
            this.navigateToWithFlashMessage(this.props.root, 'danger', error.response.data.message);
        } else {
            console.error(error);
            this.navigateToWithFlashMessage(this.props.root, 'danger', error.message);
        }
        return true;
    }

    renderRoute(route) {
        const render = props => renderRoute(route, PanelRoute, () => getLoadingMessage(this.props.t), null, props);
        return <Route key={route.path} exact={route.exact} path={route.path} render={render} />
    }

    render() {
        let routes = getRoutes(this.props.structure);

        return (
            <SectionContentContext.Provider value={this}>
                <Switch>{routes.map(x => this.renderRoute(x))}</Switch>
            </SectionContentContext.Provider>
        );
    }
}

@withComponentMixins([
    withTranslation
])
export class Section extends Component {
    constructor(props) {
        super(props);

        let structure = props.structure;
        if (typeof structure === 'function') {
            structure = structure(props.t);
        }

        this.structure = structure;
    }

    static propTypes = {
        structure: PropTypes.oneOfType([PropTypes.object, PropTypes.func]).isRequired,
        root: PropTypes.string.isRequired
    }

    render() {
        return (
            <Router basename={getBaseDir()}>
                <SectionContent root={this.props.root} structure={this.structure} />
            </Router>
        );
    }
}
