import configurable from 'configurable.js';
import filterData from './filterData';

import './style.css';

import defaultConfig from './config';
import drawer from './drawer';
import zoom from './zoom';
import * as d3 from 'd3';

function eventDrops(config = {}) {
    const finalConfiguration = { ...defaultConfig, ...config };

    const yScale = data =>
        d3.scaleOrdinal()
            .domain(data.map(d => d.name))
            .range(data.map((d, i) => i * finalConfiguration.lineHeight));

    const xScale = (width, timeBounds) =>
        d3.scaleTime().domain(timeBounds).range([0, width]);

    function getScales(dimensions, configuration, data) {
        return {
            x: xScale(
                dimensions.width -
                (configuration.labelsWidth +
                    configuration.labelsRightMargin),
                [configuration.start, configuration.end]
            ),
            y: yScale(data),
        };
    }

    function eventDropGraph(selection) {
        let scales;

        const chart = selection.each(function selector(data) {
            d3.select(this).select('.event-drops-chart').remove();

            const dimensions = {
                width: this.clientWidth,
                height: data.length * finalConfiguration.lineHeight,
            };

            const svg = d3
                .select(this)
                .append('svg')
                .classed('event-drops-chart', true)
                .attr('width', dimensions.width)
                .attr(
                'height',
                dimensions.height +
                finalConfiguration.margin.top +
                finalConfiguration.margin.bottom
                );

            scales = getScales(dimensions, finalConfiguration, data);
            const draw = drawer(svg, dimensions, scales, finalConfiguration);
            draw(data);

            if (finalConfiguration.zoomable) {
                zoom(svg, dimensions, scales, finalConfiguration);
            }
        });

        chart.scales = scales;
        chart.visibleDataInRow = (data, scale) =>
            filterData(data, scale, finalConfiguration.date);

        return chart;
    }

    /*
    eventDropGraph.start = function (value) {
        //if (!arguments.length) return defaultConfig.start;
        finalConfiguration.start = value;
        return eventDropGraph;
    };

    eventDropGraph.end = function (value) {
        //if (!arguments.length) return defaultConfig.start;
        finalConfiguration.end = value;
        return eventDropGraph;
    };

    eventDropGraph.eventLineColor = function (value) {
        //if (!arguments.length) return defaultConfig.start;
        finalConfiguration.eventLineColor = value;
        return eventDropGraph;
    };
    
    eventDropGraph.date = function (value) {
        //if (!arguments.length) return defaultConfig.start;
        finalConfiguration.date = value;
        return eventDropGraph;
    };

    eventDropGraph.mouseover = function (value) {
        //if (!arguments.length) return defaultConfig.start;
        finalConfiguration.mouseover = value;
        return eventDropGraph;
    };

    eventDropGraph.mouseout = function (value) {
        //if (!arguments.length) return defaultConfig.start;
        finalConfiguration.mouseout = value;
        return eventDropGraph;
    };

    eventDropGraph.zoomend = function (value) {
        //if (!arguments.length) return defaultConfig.start;
        finalConfiguration.zoomend = value;
        return eventDropGraph;
    };

    eventDropGraph.margin = function (value) {
        //if (!arguments.length) return defaultConfig.start;
        finalConfiguration.margin = value;
        return eventDropGraph;
    };

    eventDropGraph.hasBottomAxis = function (value) {
        //if (!arguments.length) return defaultConfig.start;
        finalConfiguration.hasBottomAxis = value;
        return eventDropGraph;
    };*/
    
    eventDropGraph = configurable(eventDropGraph, finalConfiguration);

    return eventDropGraph;
}

d3.chart = d3.chart || {};
d3.chart.eventDrops = eventDrops;

export default eventDrops;
