/**
 * 名称：前端网络接口基础类
 * 日期：2017-12-24
 * 描述：基于wx.request 用于提供全局监听，以及派生业务接口用
 */
import { Type, EventEmitter } from 'dantejs'

let Options = {};
//创建一个事件容器
const emitter = new EventEmitter();

export default class Network {

    constructor() {

    }

    /**
     * 接口全局配置
     * @param {Object}  options 全局配置  { baseUri:'',data:{} }
     */
    static config(options) {
        Options = options || {};
    }

    /**
     * 添加一个全局监听事件 
     * @param {String} name 事件名称 目前支持 response / error
     * @param {Function} handler 响应函数
     * response ：  function(response){    }
     * error: function(error){}
     */
    static on(name, handler) {
        emitter.on(name, handler);
        return this;
    }

    /**
     * 发送一个get请求
     * @param {String} uri 服务端接口url 可以为完整路径或者相对路径
     * 完整路径例如: https://api.pendragon/rest/order/submit
     * 相对路径： 相对路径是相对于 Network.config() 配置的 baseUri
     * @param {Object/FormData} 发送的正文数据 ，可以为json对象或者字符串或者FormData
     * @param {Object} headers  发送报文首部配置
     */
    get(uri, data, headers) {
        return this.any(uri, data, 'Get', headers);
    }

    /**
     * 发送一个post请求
     * @param {String} uri 服务端接口url 可以为完整路径或者相对路径
     * 完整路径例如: https://api.pendragon/rest/order/submit
     * 相对路径： 相对路径是相对于 Network.config() 配置的 baseUri
     * @param {Object/FormData} 发送的正文数据 ，可以为json对象或者字符串或者FormData
     * @param {Object} headers  发送报文首部配置
     */
    post(uri, data, headers) {
        return this.any(uri, data, 'Post', headers);
    }

    /**
     * 发送一个网络请求
     * @param {String} uri 服务端接口url 可以为完整路径或者相对路径
     * 完整路径例如: https://api.pendragon/rest/order/submit
     * 相对路径： 相对路径是相对于 Network.config() 配置的 baseUri
     * @param {Object} 发送的正文数据 ，可以为json对象或者字符串或者
     * @param {String} method 请求类型 例如 Get Post Put Delete 等
     * @param {Object} headers  发送报文首部配置
     */
    any(uri, data, method, headers) {
        emitter.emit('start', data, headers);
        const context = { assert: defaultAssert, useTry: false, tryMax: 0, uri, data, method, headers };
        const promise = new Promise((resolve, reject) => {
            this.doRequest(context, resolve, reject, 0);
        })
        return new AttachResponse(promise, context);
    }

    /**
     * 发送wx.request请求
     * @param {Function} resolve 成功的回调通知函数
     * @param {Function} reject 失败时的回调通知函数
     * @param {Object} context 请求上下文参数
     * @param {Number} tryProcess 当前尝试的次数
     */
    doRequest(context, resolve, reject, tryProcess) {
        const { uri, data, headers, method } = context;
        const tryRequest = this.tryRequest.bind(this, context, reject, resolve, tryProcess);
        wx.request({
            url: combine(uri, method, data),
            //请求谓词
            method,
            //请求首部
            header: {
                'X-P': 'wxapp',
                'Content-Type': Options.defaultContentType || 'application/x-www-form-urlencoded',
                //合并传入的headers 传入的headers会覆盖前面行配置的默认headers
                ...headers,
            },
            //请求正文
            data: merge(data, Options.data),
            //请求成功
            success: (response) => {
                const { statusCode } = response;
                const isOK = statusCode >= 200 && statusCode < 300 || statusCode === 304;
                const tryAssert = context.useTry && context.assert(response);
                emitter.emit('end', response);
                emitter.emit('response', response);
                if (isOK && !tryAssert) {
                    resolve(response)
                } else if (!tryRequest()) {
                    reject(response);
                    emitter.emit('error', response);
                }
            },
            //请求失败
            fail: (error) => {
                if (!tryRequest()) {
                    emitter.emit('end', error);
                    emitter.emit('error', error);
                    reject(error);
                }
            }
        });
    }

    /**
     * 请求重试
     * @param {Function} resolve 成功的回调通知函数
     * @param {Function} reject 失败时的回调通知函数
     * @param {Object} context 请求上下文参数
     * @param {Number} tryProcess 当前尝试的次数
     */
    tryRequest(context, reject, resolve, tryProcess) {
        const { useTry, tryMax } = context;
        const needTry = useTry && tryProcess < tryMax;
        console.log('retry uri:' + context.uri);
        needTry ? this.doRequest(context, resolve, reject, ++tryProcess) : undefined;
        return needTry;
    }
}

/**
 * 链式钩子，用于丰富Network.get/post 返回对象
 */
class AttachResponse {

    constructor(promise, context) {
        this.contextResult = {};
        Object.defineProperty(this, 'context', { writable: false, configurable: false, value: context });
        this.promise = promise;
    }

    /**
     * 添加一个请求回调，在请求完成后触发
     * @param {Function} success 请求成功响应函数
     * @param {Function} error  请求失败响应函数
     * @returns this self
     */
    then(success, error) {
        const errorWrapper = (result) => {
            if (typeof error === 'function') {
                return error(result);
            } else {
                emitter.emit('error', result);
                return result;
            }
        }
        this.promise = this.promise.then(success, errorWrapper);
        return this;
    }

    /**
     * 添加一个请求异常捕获回调
     * @param {Function} errorHandle 异常处理函数
     * @returns this self
     */
    catch(...params) {
        this.promise = this.promise.catch(...params);
        return this;
    }

    /**
     * 本次接口显示悬浮的Loading效果
     * @param {String} message loading效果显示的文案 默认为：请稍后...
     * @param {Number} duration loaing效果显示时长 默认 1s 单位:秒
     * @returns this self
     */
    showLoading(message, duration = 1) {
        if (typeof Options.loading === 'function') {
            this.complete(Options.loading(message, duration))
        }
        return this;
    }

    /**
     * 回调处理，不管是成功还是失败，都出发该回调
     * @param  {Function} callback 回调函数
     */
    complete(callback) {
        const onlyCallback = (context) => { callback(); return context; }
        this.then(onlyCallback, onlyCallback);
        return this;
    }

    /**
     * 设定返回json数据
     */
    json() {
        return this.then((response) => JSON.parse(response));
    }

    /**
     * 合并其他请求
     * @param {Promise} promise 其他请求返回的promise
     * @param {String} name 当前合并请求的结果附加的属性名称
     */
    merge(promise, name) {
        if (name === 'original') {
            throw new Error(`name参数不能为original,改名称为默认返回值`)
        }
        const contextResult = this.contextResult;
        return this.then((response) => {
            if (!contextResult.original) {
                contextResult.original = response;
            }
            return promise.then((afterResponse) => {
                contextResult[name] = afterResponse;
                return contextResult;
            })
        });
    }

    /**
     * 开启重试机制
     * 当网络访问失败时，进行重试
     * @param {Number} max 重试最大的次数 默认值=1
     * @param {Function} errorAssert 需要进行重试的条件函数,默认重试条件为:请求网络错误
     *         例如: function(response){ return response.status!=200  };
     *           
     */
    try(max = 1, errorAssert) {
        this.context.useTry = true;
        this.context.tryMax = max;
        if (Type.isFunction(errorAssert)) {
            this.context.assert = errorAssert;
        }
        return this;
    }

}

/**
 * 合并全局参数
 * @param {Object/String/ArrayBuffer} data 请求参数
 * @param {Object} merge 全局参数
 */
function merge(data, merge) {
    data = data || {};
    merge = merge || {};
    if (typeof data === 'object') {
        return { ...merge, ...data };
    } else {
        return data;
    }
}

/**
 * 合并uri
 * @param {String} uri 请求的uri路径
 * @param {String} method 请求类型
 * @param {Object} data 请求数据
 */
function combine(uri, method, data) {
    if (!/(https:|http:)/.test(uri) && Options.baseUri) {
        uri = Options.baseUri + uri;
    }
    return uri;
}

function defaultAssert() {
    return false;
}