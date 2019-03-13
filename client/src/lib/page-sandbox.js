'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {withRouter} from "react-router";
import {BrowserRouter as Router, Redirect, Route, Switch} from "react-router-dom";
import {withAsyncErrorHandler, withErrorHandling} from "./error-handling";
import styles from "./styles-content.scss";
import {getRoutes, needsResolve, resolve, SectionContentContext, withPageHelpers} from "./page-common";
import {getBaseDir} from "./urls";
import {parentRPC} from "./untrusted";
import {withComponentMixins} from "./decorator-helpers";
import {withTranslation} from "./i18n";
import jQuery from 'jquery';

export { withPageHelpers }

@withComponentMixins([
    withTranslation,
    withErrorHandling
])
export class RouteContent extends Component {
    constructor(props) {
        super(props);
        this.state = {};

        if (Object.keys(props.route.resolve).length === 0) {
            this.state.resolved = {};
        }
    }

    static propTypes = {
        route: PropTypes.object.isRequired
    }

    @withAsyncErrorHandler
    async resolve() {
        const props = this.props;

        if (Object.keys(props.route.resolve).length === 0) {
            this.setState({
                resolved: {}
            });

        } else {
            this.setState({
                resolved: null
            });

            const resolved = await resolve(props.route, props.match);

            if (!this.disregardResolve) { // This is to prevent the warning about setState on discarded component when we immediatelly redirect.
                this.setState({
                    resolved
                });
            }
        }
    }

    componentDidMount() {
        this.resolve();
    }

    componentDidUpdate(prevProps) {
        if (this.props.match.params !== prevProps.match.params && needsResolve(prevProps.route, this.props.route, prevProps.match, this.props.match)) {
            this.resolve();
        }
    }

    componentWillUnmount() {
        this.disregardResolve = true; // This is to prevent the warning about setState on discarded component when we immediatelly redirect.
    }

    render() {
        const t = this.props.t;
        const route = this.props.route;
        const params = this.props.match.params;
        const resolved = this.state.resolved;

        if (route.insideIframe) {
            jQuery(document.body).addClass('inside-iframe');
        } else {
            jQuery(document.body).removeClass('inside-iframe');
        }

        if (!route.panelRender && !route.panelComponent && route.link) {
            let link;
            if (typeof route.link === 'function') {
                link = route.link(params);
            } else {
                link = route.link;
            }

            return <Redirect to={link}/>;

        } else {
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
                return (
                    <div className="container-fluid">
                        <div className={styles.loadingMessage}>{t('Loading...')}</div>
                    </div>
                );
            }
        }
    }
}


@withRouter
@withComponentMixins([
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
        const render = props => <RouteContent route={route} {...props}/>;

        return <Route key={route.path} exact path={route.path} render={render} />
    }

    render() {
        let routes = getRoutes('', {}, [], this.props.structure, [], null, null);

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
