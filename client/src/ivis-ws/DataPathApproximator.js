'use strict';

import React from "react";
import {bisector} from "d3-array";
import "d3-transition";

const pathTracingThreshold = 10;
const pathTracingSegmentLength = 10;

export class DataPathApproximator {
    constructor(pathNode, xScale, yScale, chartWidth) {
        const dataPoints = pathNode.__data__.map(p => ({x: xScale(p.ts), y: yScale(p.avg)}));

        if (dataPoints.length > chartWidth / pathTracingThreshold) {
            this.points = dataPoints;
        } else {
            this.points = [];

            const pth = pathNode;
            const pthLen = pth.getTotalLength();
            let pthPos = 0;
            let dataPointIdx = 0;

            let pthPoint = null;
            let dataPoint = null;

            while (true) {
                if (pthPoint === null && pthPos < pthLen) {
                    pthPoint = pth.getPointAtLength(pthPos);
                    pthPos += pathTracingSegmentLength;
                }

                if (dataPoint === null && dataPointIdx < dataPoints.length) {
                    dataPoint = dataPoints[dataPointIdx];
                    dataPointIdx += 1;
                }

                if (pthPoint === null && dataPoint === null) {
                    break;
                }

                if (dataPoint === null || (pthPoint !== null && pthPoint.x < dataPoint.x)) {
                    this.points.push({x: pthPoint.x, y: pthPoint.y});
                    pthPoint = null;
                } else if (pthPoint !== null && pthPoint.x === dataPoint.x ) {
                    this.points.push(dataPoint);
                    dataPoint = null;
                    pthPoint = null;
                } else {
                    this.points.push(dataPoint);
                    dataPoint = null;
                }
            }
        }
    }

    isPointContained(x, y) {
        const bisectTs = bisector(p => p.x).right;

        let selIdx = bisectTs(this.points, x);

        if (selIdx > 0 && selIdx < this.points.length) {
            const p1 = this.points[selIdx - 1];
            const p2 = this.points[selIdx];

            const delta = (x - p1.x) / (p2.x - p1.x);
            const intY =  p1.y * (1 - delta) + p2.y * delta;

            const slope = Math.abs((p2.y - p1.y) / (p2.x - p1.x));
            const thickness = 5 * (slope + 1);

            return y <= intY + thickness && y >= intY - thickness;

        } else {
            return false;
        }
    }
}

