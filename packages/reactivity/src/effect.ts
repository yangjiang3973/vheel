import { TrackOpTypes, TriggerOpTypes } from './operations';
import { isIntegerKey } from '../../shared/src/index';

const targetMap = new WeakMap<any, KeyToDepMap>();
type KeyToDepMap = Map<any, Dep>;
type Dep = Set<ReactiveEffect>;
export interface ReactiveEffect<T = any> {
    (): T;
    _isEffect: true;
    id: number;
    active: boolean;
    raw: () => T;
    deps: Array<Dep>;
    options: ReactiveEffectOptions;
}
export interface ReactiveEffectOptions {
    lazy?: boolean;
    onTrack?: (event: DebuggerEvent) => void;
    onTrigger?: (event: DebuggerEvent) => void;
    onStop?: () => void;
}
export type DebuggerEvent = {
    effect: ReactiveEffect;
    target: object;
    type: TrackOpTypes | TriggerOpTypes;
    key: any;
} & DebuggerEventExtraInfo;

export interface DebuggerEventExtraInfo {
    newValue?: any;
    oldValue?: any;
    oldTarget?: Map<any, any> | Set<any>;
}

export const ITERATE_KEY = Symbol(__DEV__ ? 'iterate' : '');

let activeEffect: ReactiveEffect | undefined;
const effectStack: ReactiveEffect[] = [];

let shouldTrack = true;
const trackStack: boolean[] = [];

export function pauseTracking() {
    trackStack.push(shouldTrack);
    shouldTrack = false;
}

export function enableTracking() {
    trackStack.push(shouldTrack);
    shouldTrack = true;
}

export function resetTracking() {
    const last = trackStack.pop();
    shouldTrack = last === undefined ? true : last;
}

export function effect<T = any>(
    fn: () => T,
    options: ReactiveEffectOptions = {}
): ReactiveEffect<T> {
    const effect = createReactiveEffect(fn, options);
    if (!options.lazy) {
        effect();
    }
    return effect;
}

let uid = 0;
function createReactiveEffect<T = any>(
    fn: () => T,
    options: ReactiveEffectOptions
): ReactiveEffect<T> {
    const effect = function reactiveEffect() {
        // avoid infinite loop when set inside effect callback function
        if (!effectStack.includes(effect)) {
            try {
                effectStack.push(effect);
                activeEffect = effect;
                return fn();
            } finally {
                effectStack.pop();
                activeEffect = effectStack[effectStack.length - 1];
            }
        }
    } as ReactiveEffect;
    effect.id = uid++;
    effect._isEffect = true;
    effect.active = true;
    effect.raw = fn;
    effect.deps = [];
    effect.options = options;
    return effect;
}

export function track(target: object, type: TrackOpTypes, key: unknown) {
    if (activeEffect === undefined) return;
    let depsMap = targetMap.get(target);
    if (!depsMap) {
        depsMap = new Map();
        targetMap.set(target, depsMap);
    }
    let dep = depsMap.get(key);
    if (!dep) {
        dep = new Set();
        depsMap.set(key, dep);
    }
    if (!dep.has(activeEffect)) {
        dep.add(activeEffect);
        activeEffect.deps.push(dep);
        // this for debugging
        if (__DEV__ && activeEffect.options.onTrack) {
            activeEffect.options.onTrack({
                effect: activeEffect,
                target,
                type,
                key,
            });
        }
    }
}

export function trigger(
    target: object,
    type: TriggerOpTypes,
    key?: unknown,
    newValue?: unknown,
    oldValue?: unknown,
    oldTarget?: Map<unknown, unknown> | Set<unknown>
) {
    const depsMap = targetMap.get(target);

    if (!depsMap) {
        // never been tracked
        return;
    }

    // save effects that should execute, run at the end
    const effectsToExe = new Set<ReactiveEffect>();
    const addEffects = (effectsToAdd) => {
        if (!effectsToAdd) return;
        effectsToAdd.forEach((effect) => {
            effectsToExe.add(effect);
        });
    };

    // SET | ADD
    if (key !== undefined) {
        const dep = depsMap.get(key);
        addEffects(dep);
    }

    if (type === TriggerOpTypes.ADD) {
        if (isIntegerKey(key)) {
            addEffects(depsMap.get('length'));
        }
    }
    // run
    effectsToExe.forEach((effect) => {
        if (__DEV__ && effect.options.onTrigger) {
            effect.options.onTrigger({
                effect,
                target,
                key,
                type,
                newValue,
                oldValue,
                oldTarget,
            });
        }
        effect();
    });
}
