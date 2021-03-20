import { isObject } from '../../shared/src/index';
import {
    mutableHandlers,
    // readonlyHandlers,
    // shallowReactiveHandlers,
    // shallowReadonlyHandlers
} from './baseHandlers';

export const reactiveMap = new WeakMap<Target, any>();

export const enum ReactiveFlags {
    IS_REACTIVE = '__v_isReactive',
    RAW = '__v_raw',
}

export interface Target {
    [ReactiveFlags.IS_REACTIVE]?: boolean;
    [ReactiveFlags.RAW]?: any;
}

export function reactive(target: object) {
    return createReactiveObject(target, mutableHandlers);
}

function createReactiveObject(target: Target, baseHandlers: ProxyHandler<any>) {
    if (!isObject(target)) {
        return target;
    }

    // check target if `has` a proxy ({target: proxy})
    const existingProxy = reactiveMap.get(target);
    if (existingProxy) {
        return existingProxy;
    }

    const proxy = new Proxy(target, baseHandlers);
    reactiveMap.set(target, proxy); // keep new proxy in proxyMap
    return proxy;
}
