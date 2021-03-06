/**
 * 名称:微信小程序工程打包配置文件
 * 日期:2017-12-18
 * 描述:
 *     1.使工程支持es6-es7语法，
 *     2.使微信小程序能使用node_modules
 *     3.实现脚本打包与压缩以及图片压缩
 */
const path = require('path')
const webpack = require('webpack')
const config = require('./index');

const isProduction = process.env.NODE_ENV === 'production';
//插件
//微信小程序插件
const WxappModulePlugin = require('webpack-wxapp-module-plugin/index');
//兼容vscode 盘符大小写问题(windows)
const ConflictPlugin = require('./plugins/conflict');
//清除插件
var CleanWebpackPlugin = require('clean-webpack-plugin')

//开发环境插件
var devPlugins = [
]

//生产环境插件
var productionPlugins = [
  new CleanWebpackPlugin('*', { root: config.dist })
]

module.exports = {
  devtool: isProduction ? '' : 'source-map',
  name: 'freedom',
  mode: isProduction ? 'production' : 'development',
  context: config.src,
  stats: { children: false, chunks: false, assets: false, modules: false },
  target: "node",
  entry: {
    'app': [
      './app.js'
    ]
  },
  output: {
    path: config.dist,
    filename: '[name]',
    chunkFilename: '[name]',
    libraryTarget: "commonjs2",
    publicPath: ''
  },
  plugins: [
    new ConflictPlugin(),
    new webpack.ProgressPlugin(),
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(isProduction ? 'production' : 'development'),
      }
    }),
    new WxappModulePlugin('third_modules', ['.scss']),
    new webpack.DefinePlugin({ 'process.env': { NODE_ENV: process.env.NODE_ENV } }),
    new webpack.NoEmitOnErrorsPlugin(),
  ].concat(isProduction ? productionPlugins : devPlugins),
  module: {
    rules: [
      {
        // 使用babel编译js
        test: /\.js$/,
        include: [
          /packages/,
          /dantejs/
        ],
        use: [
          {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              presets: config.presets,
              plugins: config.plugins
            }
          }
        ]
      },
      //使用file-loader处理资源文件复制
      {
        test: /\.(wxss)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[path][name].[ext]',
            },
          },
        ],
      },
      // {
      //   test: /\.wxss$/,
      //   use: [
      //     {
      //       loader: 'file-loader',
      //       options: {
      //         name: '[path][name].wxss',
      //       },
      //     },
      //     {
      //       loader: 'sass-loader',
      //       options: {
      //         includePaths: [
      //           path.join(config.src, 'styles')
      //         ],
      //       },
      //     },
      //   ],
      // },
      {
        // 图片类型模块资源访问
        test: /\.(png|jpg|jpeg|gif|webp|bmp|ico|jpeg)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[path][name].[ext]'
            }
          },
          // (
          //   !isProduction ?
          //     undefined
          //     :
          //     {
          //       loader: 'image-webpack-loader',
          //       options: config.minOptions,
          //     }
          // ),
        ].filter(function (loader) { return !!loader }),
      },
      //使用wxml-loader处理.wxml文件，主要用于搜索引用的图片等资源
      {
        test: /\.wxml$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[path][name].wxml',
            },
          },
          {
            loader: 'webpack-wxml-loader',
            options: {
              target:'Wechat',
              context:config.src,
              publicPath: '/',
              root: config.src,
            },
          },
          {
            loader: 'wxml-layout-loader',
            options: {
              app: path.resolve('app/app.json'),
              layout: path.resolve('app/app.wxml')
            },
          },
        ],
      }
    ]
  }
}