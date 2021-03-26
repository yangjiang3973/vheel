import { isObject, toRawType } from '../../shared/src/index';
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

    SKIP = '__v_skip',
}

export interface Target {
    [ReactiveFlags.IS_REACTIVE]?: boolean;
    [ReactiveFlags.RAW]?: any;

    [ReactiveFlags.SKIP]?: boolean;
}

const enum TargetType {
    INVALID = 0,
    COMMON = 1,
    COLLECTION = 2,
}

export function reactive(target: object) {
    return createReactiveObject(target, mutableHandlers);
}

function createReactiveObject(target: Target, baseHandlers: ProxyHandler<any>) {
    if (!isObject(target)) {
        return target;
    }

    // target `is` already a proxy, return
    if (target[ReactiveFlags.RAW] && target[ReactiveFlags.IS_REACTIVE]) {
        return target;
    }

    // check target if `has` a proxy ({target: proxy})
    const existingProxy = reactiveMap.get(target);
    if (existingProxy) {
        return existingProxy;
    }

    // Collection: 'Map', 'Set', 'WeakMap', 'WeakSet'
    // Common: 'Object', 'Array'
    // Invalid: others + SKIP
    const targetType = getTargetType(target);
    if (targetType === TargetType.INVALID) {
        return target;
    }

    const proxy = new Proxy(target, baseHandlers);
    reactiveMap.set(target, proxy); // keep new proxy in proxyMap
    return proxy;
}

function getTargetType(target: Target) {
    return target[ReactiveFlags.SKIP] || !Object.isExtensible(target)
        ? TargetType.INVALID
        : targetTypeMap(toRawType(target));
}

function targetTypeMap(rawType: string) {
    switch (rawType) {
        case 'Object':
        case 'Array':
            return TargetType.COMMON;
        case 'Map':
        case 'Set':
        case 'WeakMap':
        case 'WeakSet':
            return TargetType.COLLECTION;
        default:
            return TargetType.INVALID;
    }
}

export function toRaw<T>(observed: T): T {
    return (
        (observed && toRaw((observed as Target)[ReactiveFlags.RAW])) || observed
    );
}

export function isReactive(value: unknown): boolean {
    return !!(value && (value as Target)[ReactiveFlags.IS_REACTIVE]);
}
