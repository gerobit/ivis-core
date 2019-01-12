const webpack = require('webpack');
const path = require('path');

module.exports = {
    entry: {
        'ivis': ['./src/ivis.js']
    },
    output: {
        filename: 'ivis.js',
        path: path.resolve(__dirname, 'dist'),
        library: 'IVIS'
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: path.join(__dirname, 'node_modules'),
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                ['@babel/preset-env', {
                                    targets: {
                                        "chrome": "58",
                                        "edge": "15",
                                        "firefox": "55",
                                        "ios": "10"
                                    }
                                }],
                                '@babel/preset-react'
                            ],
                            plugins: [
                                ["@babel/plugin-proposal-decorators", { "legacy": true }],
                                ["@babel/plugin-proposal-class-properties", { "loose" : true }],
                                "@babel/plugin-proposal-function-bind"
                            ]
                        }
                    }
                ]
            },
            {
                test: /\.css$/,
                use: [ 'style-loader', 'css-loader' ]
            },
            {
                test: /\.(png|jpg|gif|woff2?|svg)$/,
                use: [
                    {
                        loader: 'url-loader',
                        options: {
                            limit: 8192 // inline base64 URLs for <=8k images, direct URLs for the rest
                        }
                    }
                ]
            },
            {
                test: /\.scss$/,
                exclude: path.join(__dirname, 'node_modules'),
                use: [
                    'style-loader',
                    {
                        loader: 'css-loader',
                        options: {
                            modules: true,
                            localIdentName: '[path][name]__[local]--[hash:base64:5]'
                        }
                    },
                    'sass-loader'
                ]
            },
            {
                test: /\.(png|jpg|gif)$/,
                use: [
                    {
                        loader: 'url-loader',
                        options: {
                            limit: 8192 // inline base64 URLs for <=8k images, direct URLs for the rest
                        }
                    }
                ]
            },
            {
                test: /\.(ttf|eot)$/,
                use: [ 'file-loader' ]
            }
        ]
    },
    externals: {
    },
    plugins: [
//        new webpack.optimize.UglifyJsPlugin()
    ],
    watchOptions: {
        ignored: 'node_modules/',
        poll: 1000
    },
    resolve: {
    }
};
