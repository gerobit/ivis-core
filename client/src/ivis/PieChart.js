'use strict';

import React, { Component } from "react";

import { translate } from "react-i18next";
import { withErrorHandling } from "../lib/error-handling";
import PropTypes from "prop-types";
import * as d3Color from "d3-color";
import * as d3Shape from "d3-shape";
import { select } from "d3-selection";
import { StaticLegend } from "./Legend";
import styles from './PieChart.scss'

export const LegendPosition = {
    NONE: 0,
    RIGHT: 1,
    BOTTOM: 2
}

const legendStructure = [
    {
        labelAttr: 'label',
        colorAttr: 'color'
    }
];

@translate()
@withErrorHandling
export class StaticPieChart extends Component {
    constructor(props) {
        super(props);

        this.state = {
            width: 0
        };

        this.resizeListener = () => this.createChart();
    }

    static propTypes = {
        config: PropTypes.object.isRequired,
        height: PropTypes.number.isRequired,
        margin: PropTypes.object,
        getArcColor: PropTypes.func,
        legendWidth: PropTypes.number,
        legendPosition: PropTypes.number,
        legendRowClass: PropTypes.string
    }

    static defaultProps = {
        getArcColor: color => color,
        getLabelColor: color => {
            const hsl = d3Color.hsl(color);
            if (hsl.l > 0.7) {
                return d3Color.color('black');
            } else {
                return d3Color.color('white');
            }
        },
        margin: {
            left: 5,
            right: 5,
            top: 5,
            bottom: 5
        },
        legendWidth: 120,
        legendRowClass: 'col-xs-12',
        legendPosition: LegendPosition.RIGHT
    }

    componentDidMount() {
        window.addEventListener('resize', this.resizeListener);
        this.createChart(true);
    }

    componentDidUpdate(prevProps, prevState, prevContext) {
        const forceRefresh = this.prevContainerNode !== this.containerNode
            || prevProps.data !== this.props.data
            || prevProps.config !== this.props.config;

        this.createChart(forceRefresh);
        this.prevContainerNode = this.containerNode;
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.resizeListener);
    }

    createChart(forceRefresh) {
        const width = this.containerNode.clientWidth;

        if (this.state.width !== width) {
            this.setState({
                width
            });
        }

        if (!forceRefresh && width === this.renderedWidth) {
            return;
        }
        this.renderedWidth = width;


        const t = this.props.t;
        const innerWidth = width - this.props.margin.left - this.props.margin.right;
        const innerHeight = this.props.height - this.props.margin.top - this.props.margin.bottom;
        const radius = Math.min(innerWidth / 2, innerHeight / 2);

        const centerX = innerWidth / 2 + this.props.margin.left;
        const centerY = innerHeight / 2 + this.props.margin.top;
        this.shadowsSelection.attr('transform', `translate(${centerX},${centerY})`);
        this.pieSelection.attr('transform', `translate(${centerX},${centerY})`);
        this.labelsSelection.attr('transform', `translate(${centerX},${centerY})`);

        let total = 0;
        for (const entry of this.props.config.arcs) {
            total += entry.value;
        }

        const pieGen = d3Shape.pie()
            .padAngle(0.02)
            .sort(null)
            .value(d => d.value);

        const arcGen = d3Shape.arc()
            .outerRadius(radius)
            .innerRadius(radius - 60);

        const shadows = this.shadowsSelection.selectAll('path').data(pieGen(this.props.config.arcs));
        shadows.enter().append('path')
            .merge(shadows)
            .attr('d', arcGen)
            .attr('filter', 'url(#shadow)')
            .attr('fill', 'rgba(0,0,0, 0.3)');

        const arcs = this.pieSelection.selectAll('path').data(pieGen(this.props.config.arcs));
        arcs.enter().append('path')
            .merge(arcs)
            .attr('d', arcGen)
            .attr('fill', d => this.props.getArcColor(d.data.color));

        const labels = this.labelsSelection.selectAll('text').data(pieGen(this.props.config.arcs));
        labels.enter().append('text')
            .merge(labels)
            .attr('transform', d => `translate(${arcGen.centroid(d)})`)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .attr('class', styles.label)
            .attr('fill', d => this.props.getLabelColor(d.data.color))
            .text(d => {
                const ratio = Math.floor(d.data.value * 100 / total);
                return ratio > 5 ? `${ratio}%` : '';
            })
    }

    render() {
        return (
            <div>
                <svg className={styles.pie} ref={node => this.containerNode = node} height={this.props.height} width="100%">
                    <defs>
                        <filter id="shadow">
                            <feOffset result="offOut" in="SourceGraphic" dx="2" dy="2" />
                            <feGaussianBlur result="blurOut" in="offOut" stdDeviation="2" />
                        </filter>
                    </defs>
                    <g ref={node => this.shadowsSelection = select(node)} />
                    <g ref={node => this.pieSelection = select(node)} />
                    <g ref={node => this.labelsSelection = select(node)} />

                    {this.props.legendPosition === LegendPosition.RIGHT &&
                    <g>
                        <foreignObject requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility" width={this.props.legendWidth} height="50" x={this.state.width - this.props.margin.right - this.props.legendWidth} y={this.props.margin.top}>
                            <StaticLegend config={this.props.config.arcs} structure={legendStructure} className={`${styles.legend} ${styles.legendRight}`} rowClassName={this.props.legendRowClass}/>
                        </foreignObject>
                    </g>
                    }
                </svg>
                {this.props.legendPosition === LegendPosition.BOTTOM &&
                    <StaticLegend config={this.props.config.arcs} structure={legendStructure} className={`${styles.legend} ${styles.legendBottom}`} rowClassName={this.props.legendRowClass}/>
                }
            </div>
        );
    }
}
