const path = require('path');
const webpack = require('webpack');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Create a new object with only the environment variables we want to expose
const envVars = {
    'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
        REACT_APP_API_BASE_URL: JSON.stringify(process.env.REACT_APP_API_BASE_URL || 'http://localhost:8099'),
        REACT_APP_CLIENT_PORT: JSON.stringify(process.env.REACT_APP_CLIENT_PORT || '5001')
    }
};

module.exports = {

    entry: {
        bundle: ["@babel/polyfill", path.resolve(__dirname, './src/index.js')]
    },
    output: {
        path: __dirname + '/public'
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: ['babel-loader']               
            },
            {
                test: /\.module\.css$/,
                use: [
                    'style-loader',
                    {
                        loader: 'css-loader',
                        options: {
                            modules: {
                                localIdentName: '[name]__[local]--[hash:base64:5]',
                                auto: true
                            },
                            importLoaders: 1,
                            sourceMap: true
                        }
                    }
                ]
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader',
                    'postcss-loader'
                ],
                exclude: /\.module\.css$/
            }
        ]
    },
    resolve: {
        extensions: ['.js', '.jsx'],
    },
    devServer: {
    //    contentBase: path.join(__dirname, 'public'),
        // disableHostCheck: true,
        // port: 5601
    },
    devtool: 'source-map',
    plugins: [
        new webpack.DefinePlugin(envVars)
    ]
}