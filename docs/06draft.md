# 21 天学会写个仿 Vue3 的轮子：（四）升级响应式模块 --（上）

目前已经有了简单的渲染器模块，响应式模块，接下来我们要将二者逐步升级，从一本科技升到二本。

因为响应式模块，跟其他模块的耦合度很低，我们先从它下手。

并且，开始建立单元测试，让我们这个玩具开始变得更正式一点。

## 升级 reactive

现阶段，主要有三个方面需要提升：

1. 一些针对数据特殊情况（corner cases）的检查。

2. 数据是数组（array）情况下，一些数组自带方法的支持，比如 push，shift 等等。

3. 之前的 proxy handler 只拦截了`set`, `get`方法，我们还需要`has`, `deleteProperty`, `ownKeys`。

我们一个一个来，先考虑下有哪些特殊情况要处理。

第一步要考虑下`reactive(target)`传入的 target 可能有哪些类型，除了 Object，Array 这种通常类型，

还可能有`Map`，`Set`，`WeakMap`，`WeakSet`这种 Collection 类型，需要不同的 handler 来处理拦截的操作。

最后，如果 target 不属于以上类型，或者 target 有 flag 表示不需要被 reactive（比如 SKIP），那就是 invalid 的。

所以我们可以更新下 typescript 的声明：

```js
export const enum ReactiveFlags {
    SKIP = '__v_skip',
    IS_REACTIVE = '__v_isReactive',
    IS_READONLY = '__v_isReadonly',
    RAW = '__v_raw',
}

export interface Target {
    [ReactiveFlags.SKIP]?: boolean;
    [ReactiveFlags.IS_REACTIVE]?: boolean;
    [ReactiveFlags.IS_READONLY]?: boolean;
    [ReactiveFlags.RAW]?: any;
}

const enum TargetType {
    INVALID = 0,
    COMMON = 1,
    COLLECTION = 2,
}
```

有了这些 flag，我们可以利用它们快速判断目标是不是合法的观察对象，是不是已经被观察，成为 proxy 了。

比如需要判断是否 reactive：

```js
export function isReactive(value: unknown): boolean {
    return !!(value && (value as Target)[ReactiveFlags.IS_REACTIVE]);
}
```

在 createReactiveObject 的时候，检查这些 corner cases。比如：

```js
function createReactiveObject(
    target: Target,
    isReadonly: boolean,
    baseHandlers: ProxyHandler<any>,
    collectionHandlers: ProxyHandler<any>
) {
    // ...
    const targetType = getTargetType(target);
    if (targetType === TargetType.INVALID) {
        return target;
    }
    // ...
}
```

自己想一想有哪些情况属于 corner cases，然后可以去开头是 05 的 branch， 跟我新加的代码比照下。

这些 corner cases 其实很简单，重点是我想借这个机会赶紧把单元测试启动起来。

建立新文件，`packages/reactivity/__tests__/reactive.spec.ts`。不需要你自己搭测试环境，从一开始我就已经搭好了基于 Jest 的配置了。

加入我们第一个测试。

```js
describe('reactivity/reactive', () => {
    test('Object', () => {
        const original = { foo: 1 };
        const observed = reactive(original);
        expect(observed).not.toBe(original);
        expect(isReactive(observed)).toBe(true);
        expect(isReactive(original)).toBe(false);
        // get
        expect(observed.foo).toBe(1);
    });
```

不会 jest 的可以去官网看看基本语法，几个小时内就上手可以写简单的测试了，后续边继续写边学。

写完第一个简单的测试，执行命令：`jest packages/reactivity/ --config=jest.config.js`跑一下。

不出意外，可以看到第一个测试就通过了。

## 支持数组方法

我们之前说过，Vue3 采取 Proxy 的方法，而不是 Vue2 的 defineProperty 方法，在实现监听数组方面简单了许多。

对于一个数组的 push 操作，我们先看看 proxy 会捕获哪些：

```js
let array = [1, 2, 3];

const handler = {
    // intercept `get` method
    get: function (target, prop, reveiver) {
        console.log('the prop to get is: ', prop);
        return Reflect.get(...arguments);
    },
    // intercept `set` method
    set: function (target, prop, value, receiver) {
        console.log('the prop to set is: ', prop);
        return Reflect.set(target, prop, value, receiver);
    },
};
const proxy = new Proxy(array, handler);

// use proxy to access data
proxy.push(1);
/*
terminal:
the prop to get is:  push
the prop to get is:  length
the prop to set is:  3
the prop to set is:  length
*/
```

两次 get，两次 set，set 时的 prop 分别是新元素的 index（也就是 key），和数组的 length。

（为了方便，后续简称第一个 get，第二个 get， set 也是第一个 set， 第二个 set）

如果一个 effect 已经依赖于数组的 length，那么当 push 的时候，去触发 length 这个 key 下的所有 effects，effect 的内容自然会得到再次执行。

唯一要小心的是，第二个 get 的时候，目前的代码，会 track 数组的 length，然后建立对 length 的依赖。

举个例子，如果我们在某个 effect 里有 push 操作，那么这个 effect 就会依赖 length（因为第二个 get）。

当任何时候数组的 length 变动，都会导致 effect 的内容再次执行，也就是会再执行 effect 里的 push，再引起变动，再。。。。

这就成了一个死循环了。

所以在执行 push 这类数组操作的时候，我们想要先停止 track，当 push 完后再 reset 回去。

可以将这些调整过的方法保存在`arrayInstrumentations`中。

```js
const arrayInstrumentations: Record<string, Function> = {};

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
```

在第一个捕获第一个 get 的时候，就去`arrayInstrumentations`里找 push 方法，

```js
// baseHandlers.ts
function get(target: Target, key: string | symbol, receiver: object) {
    // ...
    const targetIsArray = isArray(target);
    if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
        return Reflect.get(arrayInstrumentations, key, receiver);
    }
    // ...
}
```

这样，第一次 get 实际上返回了我们修改过的 push，实际 push 的时候，就不会因为第二个 get 导致对 length 进行追踪，避免了 effect 里出现 push 时的死循环。

当 push 引起第一个 set 时， 捕获了一个整数 index（也就是 key）。

首先修改下 set handler 里，对于 SET or ADD 操作的判断：

```js
function set(
    target: object,
    key: string | symbol,
    value: unknown,
    receiver: object
) {
    // ...
    const hadKey =
        isArray(target) && isIntegerKey(key)
            ? // @ts-ignore
              Number(key) < target.length
            : hasOwn(target, key);
    // ...
}
```

这样，push 一个新值的时候，`hadKey`为`false`，执行 ADD 类型的 trigger。

在`trigger`函数里，检查 ADD operation，如果是整数 key，触发 `length` 下所有的 effects。

```js
// ... in trigger function
if (type === TriggerOpTypes.ADD) {
    if (isIntegerKey(key)) {
        addEffects(depsMap.get('length'));
    }
}
// ...
```

这样，push 引起的第一个 set，就会触发对 length 有依赖的 effects。

有人问，那么第二次 set，key 为 length，该怎么处理？会不会引发额外执行 effect？

不会的。

因为我们在 set handler 里，会比较 key 对应的 value 新旧。只有`oldValue !== value`时，才会 trigger。

第二次 set 的时候，再去比较新旧 length 的值，会发现已经相等，所以不会 trigger。

以上就是实现 Array 响应式的思路。写个小 demo 试验下：

```js
import { reactive, effect } from '../packages/reactivity/src/index';

const arr = [1, 2, 3];

const proxy = reactive(arr);

effect(() => {
    console.log(proxy.length);
});

proxy.push(1);

// termial:
// 3
// 4
```

相关的 unit tests 在`reactiveArray.spec.ts`里，写完代码添加单元测试是个好习惯。

Array 上除了 push，shift 等等会改变数组的方法，还有不改变的方法，比如`includes`, `indexOf`, `lastIndexOf`。

这些方法更多的像是 get 的变形，主要用来作查询用途。

这些方法也需要改写，思路和上面的差不多，核心就是在恰当的时候执行`track()`，添加进`arrayInstrumentations`中。

我就不啰嗦了，你们如果看懂了 push 的实现原理，应该可以试着自己写写`includes`, `indexOf`, `lastIndexOf`。

如果实在不行，再去我新上传的 branch 05 看答案（去 Vue3 看源码也行）。

## 其他 handler

我们目前设置了 set 和 get 操作的 trap，但是对于其他操作呢，比如 delete（删除）类型的操作，目前是没有 trap 的。

详细的介绍可以去 MDN 上的 Proxy 介绍里看，这里讲的很简略。

捕获这些操作，无非就是为了 track 建立依赖关系，或者 trigger 通知某个依赖对应的 effect 执行。

比如`deleteProperty`会拦截删除类型的操作，我们用 Reflect 从原始数据上删除，并且需要执行 trigger。

```js
function deleteProperty(target: object, key: string | symbol): boolean {
    const hadKey = hasOwn(target, key);
    const oldValue = (target as any)[key];
    const result = Reflect.deleteProperty(target, key);
    if (result && hadKey) {
        trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue);
    }
    return result;
}
```

`has` 和 `ownKeys`不会改变原始数据，更多的是用来进行一种像查询的操作。所以不会 trigger，而是 track：

```js
function has(target: object, key: string | symbol): boolean {
    const result = Reflect.has(target, key);
    track(target, TrackOpTypes.HAS, key);
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
```

再次强调，虽然我没说明，但是如果你不知道在什么情况下，那些操作会被 has 和 ownKeys 捕获，一定要去看一眼 MDN。

至于代码则非常一目了然，就是进行 track，没什么好细讲的。

## 总结

响应式模块升级到二本科技了，同时我添加了大概 23 个单元测试（都是 Vue3 里现成的）。

如果你一步步跟着来，应该 branch `05-upgrade-reactive-module`里所有的测试都能通过。

接下来休息几天，我需要整理下思路，尤其是下一步升级渲染器，要考虑的细节有点多。

其次，github 上的 repo 连个正经的 README 都没有，需要好好维护下。

容我修整两天。
