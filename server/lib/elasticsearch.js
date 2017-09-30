'use strict';

const elasticsearch = require('elasticsearch');
const config = require('config');

module.exports = new elasticsearch.Client({
    host: `${config.elasticsearch.host}:${config.elasticsearch.port}`
    // , log: 'trace'
});