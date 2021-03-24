import {
    reactive,
    Target,
    ReactiveFlags,
    reactiveMap,
    toRaw,
} from './reactive';
import { track, trigger } from './effect';
import { TrackOpTypes, TriggerOpTypes } from './operations';
import { isObject, hasOwn, hasChanged } from '../../shared/src/index';

export const mutableHandlers: ProxyHandler<object> = {
    get,
    set,
    // deleteProperty,
    // has,
    // @ts-ignore
    // ownKeys,
};

function get(target: Target, key: string | symbol, receiver: object) {
    //*
    if (key === ReactiveFlags.IS_REACTIVE) {
        //   return !isReadonly
        return true;
    } else if (
        key === ReactiveFlags.RAW &&
        receiver === reactiveMap.get(target)
        //   receiver === (isReadonly ? readonlyMap : reactiveMap).get(target)
    ) {
        return target;
    }

    const res = Reflect.get(target, key, receiver);

    track(target, TrackOpTypes.GET, key);

    if (isObject(res)) {
        return reactive(res);
    }

    return res;
}

function set(
    target: object,
    key: string | symbol,
    value: unknown,
    receiver: object
): boolean {
    const oldValue = target[key];
    // check key exists or not(modify or add)
    const hadKey = hasOwn(target, key);

    const result = Reflect.set(target, key, value, receiver);

    //*
    if (target === toRaw(receiver)) {
        if (!hadKey) {
            trigger(target, TriggerOpTypes.ADD, key, value);
        } else if (hasChanged(value, oldValue)) {
            trigger(target, TriggerOpTypes.SET, key, value, oldValue);
        }
    }

    return result;
}
