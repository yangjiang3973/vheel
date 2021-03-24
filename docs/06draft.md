# 21 天学会写个仿 Vue3 的轮子：（四）升级响应式模块

目前已经有了简单的渲染器模块，响应式模块，接下来我们要将二者逐步升级，从一本科技升到二本。

因为响应式模块的耦合度，对其他模块的依赖性很低，我们先从它下手。

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

所以我们可以这样定义

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

有了这些 flag，我们可以快速判断目标是不是合法的观察对象，是不是已经被观察，成为 proxy 了。

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

自己想一想有哪些情况属于 corner cases，然后可以去开头是 05 的 branch 跟我写的比照下。

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

不会 jest 的可以去官网看看基本语法，几个小时就上手可以写简单的测试了，边继续写边学。

写完第一个简单的测试，执行命令：`jest packages/reactivity/ --config=jest.config.js`跑一下。

不出意外，可以看到第一个测试就通过了。

## 支持数组方法
