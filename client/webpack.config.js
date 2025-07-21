const path = require('path');
const { env } = require('process');
const webpack = require('webpack');
const dotenv = require('dotenv').config({
    path: path.join(__dirname, '.env')
})

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
                test: /\.css$/i,
                use: ["style-loader", "css-loader"],
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
    devtool: 'source-map'
}