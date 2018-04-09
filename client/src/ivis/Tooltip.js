'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import styles from "./Tooltip.scss";

export class Tooltip extends Component {
    constructor(props) {
        super(props);

        this.state = {
            height: 0
        }
    }

    static propTypes = {
        signalSetsConfig: PropTypes.array.isRequired,
        selection: PropTypes.object,
        mousePosition: PropTypes.object,
        containerWidth: PropTypes.number.isRequired,
        containerHeight: PropTypes.number.isRequired,
        width: PropTypes.number,
        contentComponent: PropTypes.func,
        contentRender: PropTypes.func
    }

    static defaultProps = {
        width: 350
    }

    componentDidMount() {
        this.setState({
            height: this.tooltipNode ? this.tooltipNode.clientHeight : 0
        });
    }

    componentDidUpdate() {
        const height = this.tooltipNode ? this.tooltipNode.clientHeight : 0;

        if (this.state.height !== height) {
            this.setState({
                height
            });
        }
    }

    render() {
        if (this.props.containerWidth && this.props.containerHeight && this.props.selection) {
            const xDists = [ 10, -60, 60 - this.props.width, -10 - this.props.width];
            const xDist = xDists.find(d => this.props.mousePosition.x + d + this.props.width <= this.props.containerWidth) || xDists.length - 1;
            const x = this.props.mousePosition.x + xDist;

            const yDists = [ 10, -10 - this.state.height];
            const yDist = yDists.find(d => this.props.mousePosition.y + d + this.state.height <= this.props.containerHeight - 15) || yDists.length - 1;
            const y = this.props.mousePosition.y + yDist;

            let content;
            const contentProps = {
                selection: this.props.selection,
                signalSetsConfig: this.props.signalSetsConfig
            };

            if (this.props.contentComponent) {
                content = <this.props.contentComponent {...contentProps}/>;
            } else if (this.props.contentRender) {
                content = this.props.contentRender(contentProps);
            }

            return (
                <g>
                    <foreignObject requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility" width={this.props.width} height="50" x={x} y={y}>
                        <div ref={node => this.tooltipNode = node} className={styles.tooltip}>
                            {content}
                        </div>
                    </foreignObject>
                </g>
            );

        } else {
            return null;
        }
    }
}
