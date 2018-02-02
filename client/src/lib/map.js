'use strict';

import React, { Component } from 'react';
import { translate } from 'react-i18next';
import PropTypes from 'prop-types';

import axios from './axios';

import { withPageHelpers } from '../lib/page'
import { withErrorHandling, withAsyncErrorHandler } from './error-handling';
import styles from "./styles.scss";
import "./map.css";
import L from 'leaflet';
import '../../node_modules/leaflet/dist/leaflet.css';
const smImg = require('../../public/SM.jpg');
const sm2Img = require('../images/SM2.png');

class Map extends Component {
    constructor(props) {
        super(props);
    }

    shouldComponentUpdate(nextProps, nextState) {
    }

    componentDidMount() {
        let mymap = L.map('mapid', {
            minZoom: 2,
            maxZoom: 20,
            layers: [
                L.tileLayer(
                    'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                    { attribution: '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>' })
            ],
            attributionControl: false,
        }).setView(this.props.center, 10);

        console.log('markers received', this.props.markers);

        /*const myIcon = L.icon({
            iconSize: [38, 95],
            iconAnchor: [22, 94],
            popupAnchor: [-3, -76],
            shadowSize: [68, 95],
            shadowAnchor: [22, 94]
        });*/

        const LeafIcon = L.Icon.extend({
            options: {
                iconSize:    [30, 30],
                iconAnchor:  [15, 30],
                popupAnchor: [0, -25],
            }
        });
    

        const myIcon = new LeafIcon({iconUrl: 'http://icons.veryicon.com/128/System/Small%20%26%20Flat/map%20marker.png'});

        for (const data in this.props.markers) {
            let marker = L.marker(this.props.markers[data], { icon: myIcon }).addTo(mymap);
            marker.bindPopup(data).openPopup();
        }

        function onMapClick(e) {
            alert("You clicked the map at " + e.latlng);
        }

        mymap.on('click', onMapClick);
    }

    componentDidUpdate(prevProps, prevState) {
    }

    render() {
        const t = this.props.t;
        const props = this.props;
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