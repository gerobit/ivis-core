import React, {Component} from "react";
import ReactDOMServer from 'react-dom/server';
import PropTypes from "prop-types";
import {withAsyncErrorHandler, withErrorHandling} from "../lib/error-handling";
import axios from "../lib/axios";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";
import {select} from "d3-selection";

@withComponentMixins([
    withTranslation,
    withErrorHandling,
])
export class SVG extends Component {
    constructor(props) {
        super(props);

        this.state = {
            svg: null
        };
    }

    static propTypes = {
        url: PropTypes.string,
        width: PropTypes.string,
        height: PropTypes.string,
        data: PropTypes.object
    }

    static defaultProps = {
        data: {}
    }

    @withAsyncErrorHandler
    async fetchSvg() {
        const url = this.props.url;
        const result = await axios.get(url);

        if (url === this.props.url) {
            this.setState({
                svg: result.data
            });
        }
    }

    componentDidMount() {
        // noinspection JSIgnoredPromiseFromCall
        this.fetchSvg();
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevProps.url !== this.props.url) {
            // noinspection JSIgnoredPromiseFromCall
            this.fetchSvg();

        } else {
            this.renderSvg();
        }
    }

    renderSvg() {
        this.svgNode.innerHTML = this.state.svg;

        for (const key in this.props.data) {
            const entryData = this.props.data[key];
            const nodes = select(this.svgNode).selectAll('#' + key);

            if (typeof entryData === 'function') {
                entryData(nodes);
            } else {
                const html = ReactDOMServer.renderToStaticMarkup(entryData);
                nodes.html(html);
            }
        }
    }


    render() {
        return (
            <div ref={node => this.svgNode = node} style={{width: this.props.width, height: this.props.height}}/>
        );
    }
}
