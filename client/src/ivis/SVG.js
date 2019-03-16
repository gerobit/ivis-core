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
        maxWidth: PropTypes.string,
        maxHeight: PropTypes.string,
        data: PropTypes.object,
        loadingMessage: PropTypes.oneOfType([PropTypes.string, PropTypes.object])
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
        for (const elem of this.svgNode.children) {
            if (elem.tagName === 'svg') {
                elem.removeAttribute('width');
                elem.removeAttribute('height');
                elem.style.width = this.props.width;
                elem.style.height = this.props.height;
                elem.style.maxWidth = this.props.maxWidth;
                elem.style.maxHeight = this.props.maxHeight;
            }
        }

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
        if (this.state.svg) {
            return (
                <div ref={node => this.svgNode = node}/>
            );
        } else {
            if (this.props.loadingMessage) {
                return this.props.loadingMessage;
            } else {
                return null;
            }
        }
    }
}
