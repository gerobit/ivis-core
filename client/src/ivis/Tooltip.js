'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import styles from "./Tooltip.scss";
import {Icon} from "../lib/bootstrap-components";
import {format as d3Format} from "d3-format";
import * as dateMath from "../lib/datemath";

export class TooltipContent extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        signalConfig: PropTypes.array.isRequired,
        selection: PropTypes.object
    }

    render() {
        if (this.props.selection) {
            const rows = [];
            let ts;

            for (let idx = 0; idx < this.props.signalConfig.length; idx++) {
                const sig = this.props.signalConfig[idx];
                const sel = this.props.selection[idx];

                if (sel) {
                    ts = sel.ts;
                    const numberFormat = d3Format('.3f');

                    const avg = numberFormat(sel.avg);
                    const min = numberFormat(sel.min);
                    const max = numberFormat(sel.max);

                    rows.push(
                        <div key={idx}>
                            <span className={styles.signalColor} style={{color: sig.color}}><Icon icon="minus"/></span>
                            <span className={styles.signalLabel}>{sig.label}:</span>
                            <span className={styles.signalAvg}>Ø {avg}</span>
                            <span className={styles.signalMinMax}><Icon icon="chevron-left" family="fa"/>{min} <Icon icon="ellipsis-h" family="fa"/> {max}<Icon icon="chevron-right" family="fa"/></span>
                        </div>
                    );
                }
            }

            return (
                <div>
                    <div className={styles.time}>{dateMath.format(ts)}</div>
                    {rows}
                </div>
            );

        } else {
            return null;
        }
    }
}

export class Tooltip extends Component {
    constructor(props) {
        super(props);

        this.state = {
            height: 0
        }
    }

    static propTypes = {
        signalConfig: PropTypes.array.isRequired,
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
                signalConfig: this.props.signalConfig
            };

            if (this.props.contentComponent) {
                content = <this.props.contentComponent {...contenProps}/>;
            } else if (this.props.contentRender) {
                content = this.props.contentRender(contentProps);
            } else {
                content = <TooltipContent {...contentProps}/>;
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
