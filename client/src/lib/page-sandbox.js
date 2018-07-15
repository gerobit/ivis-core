'use strict';

import React, {Component} from "react";
import {translate} from "react-i18next";
import PropTypes from "prop-types";
import {withRouter} from "react-router";
import {BrowserRouter as Router, Redirect, Route, Switch} from "react-router-dom";
import {withAsyncErrorHandler, withErrorHandling} from "./error-handling";
import styles from "./styles-content.scss";
import {getRoutes, needsResolve, resolve, withPageHelpers} from "./page-common";
import {getBaseDir} from "./urls";
import {parentRPC} from "./untrusted";


@translate()
@withErrorHandling
class RouteContent extends Component {
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
    async resolve(props) {
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
        this.resolve(this.props);
    }

    componentDidUpdate() {
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.match.params !== nextProps.match.params && needsResolve(this.props.route, nextProps.route, this.props.match, nextProps.match)) {
            this.resolve(nextProps);
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
@withErrorHandling
class SectionContent extends Component {
    constructor(props) {
        super(props);

        this.state = {
        };
    }

    static propTypes = {
        structure: PropTypes.object.isRequired,
        root: PropTypes.string.isRequired
    }

    static childContextTypes = {
        sectionContent: PropTypes.object
    }

    getChildContext() {
        return {
            sectionContent: this
        };
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
            <Switch>{routes.map(x => this.renderRoute(x))}</Switch>
        );
    }
}

@translate()
class Section extends Component {
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

export {
    Section,
    withPageHelpers,
};