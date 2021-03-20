# 开始响应式

重要的事情放到开头说，

首先，我尽可能的仿照 Vue3 里的函数起名和划分，同时把现阶段的用不到的 TypeScript 规则甚至一些闭包给简化掉，

但是如果你发现文章里的例子，或者 vheel 代码里的有些地方，

可能函数划分的太繁琐了等等，那是为了方便以后进一步的添加功能。

其次，我建议在电脑上读这个系列的文章，方便打开 vheel 的代码，看看函数和文件的划分，甚至是一些文章中没提到的细节。

最好跟着一起造轮子，毕竟编程是像骑自行车一样，贴近实践的活动。

好了，回到正文。

## 一个简单的响应式模块

我们先分析一下这个响应式模块要做什么，才能设计主要的函数。

当数据变化的时候，我们需要监测到变化，并且再次执行组件的 render 函数，重新生成新的 vnode，更新到真实 DOM 中去。

其中，监测和执行 render 都是响应式模块的责任。

数据大多数时候都是 Object 类型，为了能监测它，我们需要用 Proxy 进行代理，捕获一些对数据的操作。

这就需要一个`reactive`函数，接受 data，返回 proxy。

```js
const data = {
    counter: 0,
};

const dataProxy = reactive(data);

dataProxy.counter = 1;
```

后续把我们想在 data 上进行的操作，转而用到 dataProxy 上，这样操作才能被监测到。

而且，我们还要定义数据更新后，要做的事情，处理后续影响（effect）

```js
effect(function jobAfterDataChange() => (
    // maybe need to re-render
    // and do other things here
));
```

将这些要做的事情，作为一个 callback 函数传入 effect 中，每次数据，都会触发（trigger）这个 callback 函数的执行。

将以上的思路合起来，写成代码：

```js
const data = {
    counter: 0,
};
let myCounter = data.counter;

const dataProxy = reactive(data);

effect(function jobAfterDataChange() => (
    myCounter = data.counter
));

data.counter = 1;
// myCounter should also be 1 now
```

我希望 myCounter 的值永远等于 data.counter 的值，

如果没有 effect 来处理 data.counter 变化之后的影响（也就是更新 myCounter）。

我必须每次自己手动重新赋值：myCounter = data.counter。

而现在有了 effect，当 data.counter 变成 1，effect 里的 callback 自动执行，这样 myCounter 自动更新成 1。

以上就是我们今天要做的事情，实现 reactive 和 effect。

## 数据代理中的追踪和触发

昨天我们已经简单举了个关于 Proxy 的例子。完全可以在 get 和 set 操作的时候，进行拦截。

如果是 get，就说明这条数据被使用，需要追踪（track）。

如果是 set，就说明这条数据被修改，需要触发更新(trigger)。

```js
let target = {
    msg1: 'hello',
    msg2: 'everyone',
};
const handler = {
    // intercept `get` method
    get: function (target, prop, reveiver) {
        track();
        return Reflect.get(...arguments);
    },
    // intercept `set` method
    set: function (target, prop, value, receiver) {
        trigger();
        return Reflect.set(target, prop, value, receiver);
    },
};
const proxy = new Proxy(target, handler);

console.log(proxy.msg1); // track proxy.msg1
proxy.msg1 = 'fuck'; // should trigger because proxy.msg1 is tracked
```

我们先进行关于追踪的代码实现，这是触发的前提。

而不管是追踪还是触发，都要先给数据对象创建 proxy。

这就是 reactive 函数。

## reactive

reactive 是一个入口函数，负责将传入的数据对象变得 reactive，也就是返回代理 proxy。

想明白了参数和返回什么，这个函数可以写成这样：

(为了行文流畅，正文里我不再提函数在哪个文件，文件在哪个路径。大家去 github 上看吧)

```js
export function reactive(target: object) {
    return createReactiveObject(target, mutableHandlers);
}
```

具体的创建 proxy 的代码，放到 createReactiveObject 里。

检查下传入的数据是不是对象，是不是已经创建过 proxy。

如果创建过了，不用重复，直接返回对于的 proxy。

如果没有，那就 new 一个吧。记得把 new 出来的 proxy 记录到 reactiveMap 里哦。

```js
function createReactiveObject(target: Target, baseHandlers: ProxyHandler<any>) {
    if (!isObject(target)) {
        return target;
    }

    // check if target `has` a proxy ({target: proxy})
    const existingProxy = reactiveMap.get(target);
    if (existingProxy) {
        return existingProxy;
    }

    const proxy = new Proxy(target, baseHandlers);
    reactiveMap.set(target, proxy); // keep new proxy in proxyMap
    return proxy;
}
```

以上是创建 proxy 的简单流程，而一个 proxy 最关键的地方当然是 handler 了。

我们要拦截的 get 和 set 方法，以及拦截后要干的事情，都在 baseHandlers 里。

目前我们只需要最简单的 get 和 set，其他的 deleteProperty，has，ownKeys 方法暂时不拦截，后面再搞。

```js
export const mutableHandlers: ProxyHandler<object> = {
    get,
    set,
    // deleteProperty,
    // has,
    // @ts-ignore
    // ownKeys,
};
```

感兴趣的可以提前去看看 MDN 上 proxy 的文档，看看 deleteProperty，has，ownKeys 什么情况下会用到。

get 和 set 才是核心，先从比较简单的 get 开始实现。

```js
function get(target: Target, key: string | symbol, receiver: object) {
    const res = Reflect.get(target, key, receiver);

    // TrackOpTypes.GET is to mark this operation as 'get'.
    // It is helpful for debugging
    track(target, TrackOpTypes.GET, key);

    if (isObject(res)) {
        return reactive(res);
    }

    return res;
}
```

够简化了吧，一共就干三件事情，把需要 get 的值找到，如果值是个 Object，将它也变成 reactive，

这里最关键的是，要追踪（track）这条数据（每条数据都有个对应的 key, 用 key 追踪）

## track

解释 track，最简单的比喻还是订阅模型，虽然有细微差别。

就好比你运营 N 个公众号，什么《b 站女主播精选》，《p 站本月最火》等等等等。

每次有更新了，为了触发通知，告诉订阅者。

这就需要维护一个订阅名单，哪个 lsp 订阅了哪个公众号。

track 这个函数，就是在把 lsp 添加到这个名单里，以便后续的通知。

区别在于，名单里的 lsp 变成了一个个 effect（后面介绍 effect）

“名单”的结构简单的说，分为三层。

```js
{
    "targetA": {
        key1: [effect1, effect2];
        key2: [effect1, effect8];
    },

    "targetB": {
        key3: [effect1, effect3];
    }
}
```

首先要根据不同的数据对象建立一层，每个数据有不同的 key（第二层），每个 key 有依赖它的 effect（第三层）。

运营->公众号->订阅的 lsp

多说一句，key 和 effect 是个多对多的关系，一个 effect 可以依赖多个 key（多条数据），一条数据也可以有多个 effect。

每次 track 执行，开头肯定是检查，

第一层建立过没有，没有就新建第一层，建过就直接添加 target 进去。

第二层建立过没有，没有就新建第二层，建过就直接添加 key 进去。

第三层建立过没有，没有就新建第三层，建过就直接添加 effect 进去。

最好结尾检查下是不是开发环境（`__DEV__`）,如果是的话，可以把每次 track 的信息放进一个队列，方便 debug。

```js
export function track(target: object, type: TrackOpTypes, key: unknown) {
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
        // this for debugging, you can ignore it
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
```

## effect

在 track 里提到的 effect 到底是个什么，我们这就开始实现它。

```js
export function effect(fn, options) {
    const effect = createReactiveEffect(fn, options);
    //* run effect immediately
    if (!options.lazy) {
        effect();
    }
    return effect;
}
```

还是做一个简单的入口函数，一方面接受后续要自动执行的 callback function，另一方面提供一个选项，方便进行细微的配置。

比如，这个 effect 是创建后立刻执行一次，然后数据每次更新也执行。

还是创建后不立刻执行？

这就可以添加个 lazy 作为配置 effect 的 option。

重点还是`createReactiveEffect`这个函数。

```js
let uid = 0;
function createReactiveEffect(fn, options) {
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
    };
    effect.id = uid++;
    effect._isEffect = true;
    effect.active = true;
    effect.raw = fn;
    effect.deps = [];
    effect.options = options;
    return effect;
}
```

简单来说，effect 是个函数，同时带了一堆 props，描述它自身的信息，比如 id，是否 active，有哪些依赖（deps），配置的选项（options）等等

执行 effect，自然就会执行 callback（这里是 fn）。

所以回想我们的三层结构的“订阅名单”，每当一个 key 对应的数据发生了改变，比如`data.counter = 1`

找到 key(此时是 counter)，然后把 key 对应的 effect 全部执行一遍，不就把 callback 全部执行了一遍, 是不是就把更新的工作做了？

```js
{
    "targetA": {
        key1: [effect1, effect2];  // a set of effects
        key2: [effect1, effect8];
    },

    "targetB": {
        key3: [effect1, effect3];
    }
}
```

## trigger

目前我们的 trigger 都是简单的 set 引起的，所以只在 set 里执行 trigger 就够了。

在 set 里先检查是 key 是否存在，如果不存在那就是 ADD（添加）类型的操作。

记录下这些信息，其实后面 debug 很方便。

不管是 set 还是 add 操作，数据都变化了，执行 trigger。

```js
function set(target, key, value, receiver): boolean {
    const oldValue = target[key];
    // check key exists or not(modify or add)
    const hadKey = hasOwn(target, key);

    const result = Reflect.set(target, key, value, receiver);

    if (!hadKey) {
        trigger(target, TriggerOpTypes.ADD, key, value);
    } else if (hasChanged(value, oldValue)) {
        trigger(target, TriggerOpTypes.SET, key, value, oldValue);
    }

    return result;
}
```

之前提过，key 和 effect 可以是多对多的关系，一个 key（也就是一条数据）可以被许多个 effect 依赖。

所以我们 new 一个 Set（集合）来存放这些需要执行的 effect，并且定义个 addEffects 方法来将 effect 添加进集合。

最终一口气把集合里的 effect 执行一遍。

当然，结尾还是检查下是不是开发环境（`__DEV__`），保存下 trigger 事件的记录，方便后续 debug。

```js
export function trigger(
    target,
    type,
    key,
    newValue,
    oldValue,
    oldTarget
) {
    const depsMap = targetMap.get(target);
    if (!depsMap) {
        // never been tracked
        return;
    }

    // save effects that should execute, run them at the end
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
```

## 跑一遍

以上就是 reactivity 模块的全部关键函数.

如果有看不懂的地方，可以去 github 上看 vheel，我稍后建个新 branch(`03-simple-reactive-1`)，把今天的代码传上去。

我们试验一下 reactive 和 effect，看能不能做到监测数据，自动更新。

试验内容就是，让 myCounter 这个变量，永远等于 data.counter 的值。

每次更新 data.counter，myCounter 都会自动更新，而不用每次手动给 myCounter 更新。

```js
import { reactive, effect } from '../packages/reactivity/src/index';

// for effect options
const onTrackEvents = [];
const onTriggerEvents = [];
const debuggerOptions = {
    onTrack: (event) => {
        onTrackEvents.push(event);
    },
    onTrigger: (event) => {
        onTriggerEvents.push(event);
    },
};

const data = {
    counter: 0,
};
const dataProxy = reactive(data);

let myCounter = 0;
effect(() => {
    myCounter = dataProxy.counter;
}, debuggerOptions);

dataProxy.counter = 1; // set data's counter to 1
console.log(onTrackEvents);
console.log(onTriggerEvents);
console.log(myCounter); // myCounter will become 1 automatically
```

如果你的代码没问题，那么 onTrackEvents，onTriggerEvents 应该分别记录了一次 get 操作和 set 操作，

并且 myCounter 自动变成了 1。

以上就是今天的极简 reactivity 模块，让`reactive`和`effect`函数运作了起来。

接下来，我们可以想到，把组件里的 data 变得 reactive，把 render 函数传给 effect，

那么是不是就可以让虚拟节点在每次数据变化后，都能自动更新了呢？

债见~

连载周末不一定有更新，让我休息休息吧。

附上 github 链接：https://github.com/yangjiang3973/vheel
