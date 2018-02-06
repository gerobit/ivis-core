'use strict';

import React, { Component } from 'react';
import { translate } from 'react-i18next';
import PropTypes from 'prop-types';

import axios from './axios';

import { withPageHelpers } from '../lib/page'
import { withErrorHandling, withAsyncErrorHandler } from './error-handling';
import styles from "./styles.scss";
import "./map.css";
import L, { polygon } from 'leaflet';
import '../../node_modules/leaflet/dist/leaflet.css';

class Map extends Component {
    constructor(props) {
        super(props);
        L.Icon.Default.imagePath = '.';
        delete L.Icon.Default.prototype._getIconUrl;

        L.Icon.Default.mergeOptions({
            iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
            iconUrl: require('leaflet/dist/images/marker-icon.png'),
            shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
        });

    }

    shouldComponentUpdate(nextProps) {
        if (nextProps.markers !== this.props.markers)
            return true;
        else
            return false;
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.markers !== this.props.markers) {
            //console.log('cwrp: ', nextProps.markers);
            this.createMap(nextProps.markers);
        }

    }

    createMap(markers) {
        let mymap = L.map('mapid', {
            minZoom: 2,
            maxZoom: 20,
            layers: [
                L.tileLayer(
                    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                    { attribution: '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>' })
            ],
            attributionControl: false,
        }).setView(this.props.center, 10);

        /*const myIcon = L.icon({
            iconSize: [38, 95],
            iconAnchor: [22, 94],
            popupAnchor: [-3, -76],
            shadowSize: [68, 95],
            shadowAnchor: [22, 94]
        });*/

        const LeafIcon = L.Icon.extend({
            options: {
                iconSize: [30, 30],
                iconAnchor: [15, 30],
                popupAnchor: [0, -25],
            }
        });

        /*leaflet/dist/images/
        marker-icon.png
        marker-icon-2x.png
        marker-shadow.png        
        */

        const redImageMarkerUrl = 'http://icons.veryicon.com/128/System/Small%20%26%20Flat/map%20marker.png';

        const myIcon = new LeafIcon({ iconUrl: redImageMarkerUrl });
        let polygons = {};

        for (const data in markers) {
            //default icon let marker = L.marker(this.markers[data]).addTo(mymap);
            let marker = L.marker(markers[data].location, { icon: myIcon }).addTo(mymap);
            marker.bindPopup(markers[data].label).openPopup();

            if (polygons.hasOwnProperty(markers[data].group))
                polygons[markers[data].group].push(markers[data].location);
            else
                polygons[markers[data].group] = [markers[data].location];
        }

        //console.log(polygons);

        for (const group in polygons) {
            L.polygon(polygons[group]).addTo(mymap);
        }


        function onMapClick(e) {
            alert("You clicked the map at " + e.latlng);
        }

        mymap.on('click', onMapClick);
    }


    render() {
        //const t = this.props.t;
        //const props = this.props;
        /*console.log(smImg);
        console.log(sm2Img);
        const a = '../images/SM2.png';
        <img src={smImg} />
        <img src={sm2Img} />
        <img src={a} />*/

        return (
            <div>
                <div id="mapid">
                </div>
            </div>
        );
    }
}

export {
    Map
}