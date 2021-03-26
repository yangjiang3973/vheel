import {
    reactive,
    Target,
    ReactiveFlags,
    reactiveMap,
    toRaw,
} from './reactive';
import {
    track,
    trigger,
    pauseTracking,
    resetTracking,
    ITERATE_KEY,
} from './effect';
import { TrackOpTypes, TriggerOpTypes } from './operations';
import {
    isObject,
    hasOwn,
    hasChanged,
    isArray,
    isIntegerKey,
} from '../../shared/src/index';

const arrayInstrumentations: Record<string, Function> = {};

const ISM = ['includes', 'indexOf', 'lastIndexOf'];
ISM.forEach((methodName) => {
    const method = Array.prototype[methodName];
    arrayInstrumentations[methodName] = function (this, ...args) {
        const arr = toRaw(this);
        for (let i = 0, l = this.length; i < l; i++) {
            track(arr, TrackOpTypes.GET, i + '');
        }
        const res = method.apply(arr, args);
        if (res === -1 || res === false) {
            return method.apply(arr, args.map(toRaw));
        } else {
            return res;
        }
    };
});

const LAM = ['push', 'pop', 'shift', 'unshift', 'splice'];
LAM.forEach((methodName) => {
    const method = Array.prototype[methodName] as any;
    arrayInstrumentations[methodName] = function (this, ...args) {
        pauseTracking();
        const res = method.apply(this, args);
        resetTracking();
        return res;
    };
});

function get(target: Target, key: string | symbol, receiver: object) {
    if (key === ReactiveFlags.IS_REACTIVE) {
        return true;
    } else if (
        key === ReactiveFlags.RAW &&
        receiver === reactiveMap.get(target)
    ) {
        return target;
    }

    // handle some array methods
    const targetIsArray = isArray(target);
    if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
        return Reflect.get(arrayInstrumentations, key, receiver);
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
    value = toRaw(value);

    const hadKey =
        isArray(target) && isIntegerKey(key)
            ? // @ts-ignore
              Number(key) < target.length
            : hasOwn(target, key);

    const result = Reflect.set(target, key, value, receiver);

    if (target === toRaw(receiver)) {
        if (!hadKey) {
            trigger(target, TriggerOpTypes.ADD, key, value);
        } else if (hasChanged(value, oldValue)) {
            trigger(target, TriggerOpTypes.SET, key, value, oldValue);
        }
    }

    return result;
}

function deleteProperty(target: object, key: string | symbol): boolean {
    const hadKey = hasOwn(target, key);
    const oldValue = (target as any)[key];
    const result = Reflect.deleteProperty(target, key);
    if (result && hadKey) {
        trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue);
    }
    return result;
}

function has(target: object, key: string | symbol): boolean {
    const result = Reflect.has(target, key);
    // TODO:
    // if (!isSymbol(key) || !builtInSymbols.has(key)) {
    track(target, TrackOpTypes.HAS, key);
    // }
    return result;
}

function ownKeys(target: object): (string | number | symbol)[] {
    track(
        target,
        TrackOpTypes.ITERATE,
        isArray(target) ? 'length' : ITERATE_KEY
    );
    return Reflect.ownKeys(target);
}
export const mutableHandlers: ProxyHandler<object> = {
    get,
    set,
    deleteProperty,
    has,
    // @ts-ignore
    ownKeys,
};
