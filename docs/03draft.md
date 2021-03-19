# 关于响应式的准备

上一篇文章里，我们已经可以让框架从虚拟节点渲染真实的 DOM 节点。

用户可以在组件的 render 函数里直接写虚拟节点来构建视图，剩下的交给框架。

但是这还没有解决掉视图层和数据层的鸿沟，数据的更新还没有能直接应用到视图。

接下来我们就要添加响应式功能。

当数据变化，视图也随之更新。

## 分析问题

我们想想，如果要实现这个所谓的响应式，需要具体有哪些功能。

先简化下问题，假设数据都是原生 js 里的 object 类型：

```js
const data = {
   "title": "counter",
   "count"：1，
}
```

然后 data 里的数据被用到了，比如 data.count。

```js
const simpleComponent = {
    // ignore other options in component..
    render() {
        // <span>1<span>
        return h('span', null, [data.count]);
    },
};
```

当 data.count 变化了之后，比如变成了 2，我们需要再次调用 render，重新生成新的 vnode（虚拟节点）。

这一过程中，vnode 自然会去 data.count 再次取值（这时候是新值）。

将这个新的 vnode，patch 到真实 DOM 里，视图层不就更新了？

所以，我们一定要有：

1. 一个通知的功能，当用户设置`data.count = 2`，会自动`通知`使用了此数据的组件，调用它的 render。

2. 该通知谁呢，谁`订阅`了这个数据通知谁。所以还得维护一个订阅列表。凡是对数据使用过广义`get`方法的，都是订阅者。

## Vue2 与 defineProperty

Vue2 主要用了 defineProperty 来实现订阅和通知。

对于不了解的童鞋，我就再这里简单介绍下。如果感兴趣的，可以去 MDN 看详细文档（https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty）。

`Object.defineProperty(obj, prop, descriptor)` 可以给 object 的 prop 属性加上额外订制的 descriptor，

比如给 data 的 count 属性加上高端定制上档次的 set 和 get。

这样每次对 data.count 取值或者修改的时候，都可以附加额外功能。

下面的例子我简单加了个 console.log 打印下消息。

```js
const data = {
    count: 1,
};

let value = data.count;

Object.defineProperty(data, 'count', {
    get() {
        console.log('some one is accessing the count');
        return value;
    },
    set(newValue) {
        console.log('some one is changing the count');
        value = newValue;
    },
});

// get
console.log(data.count);

// set
data.count = 2;

/*
terminal:
some one is accessing the count
1
some one is changing the count
*/
```

有了 defineProperty 的帮助，我们可以给 Object 的每个 prop 都添加 get 和 set 函数，

针对每条数据（或者说每个 prop），建立一个订阅列表。

当该条数据被 get 的时候，就添加取值者进入订阅者列表。

当该条数据被 set 新值得时候，就同时订阅列表的每一个元素。

写成伪代码大概是这样：

```js
// subs is short for subscribers
// currentItem need to access data.count
Object.defineProperty(data, 'count', {
    get() {
        subs.push(currentItem);
        return value;
    },
    set(newValue) {
        subs.notifyAll();
        value = newValue;
    },
});
```

当数据更新了，只需要通知对应的订阅者，订阅者再重新渲染虚拟节点，最后 patch 一下，更新真实 DOM。

这就是 Vue2 的响应流程，我极其简略的写了下，如果感兴趣的人多，我可以之后写个更详细的番外篇，做个能跑的 demo 出来。

## Vue3 响应式进化

话题继续回到 Vue3 里，`Object.defineProperty(obj, prop, descriptor)`确实基本上解决了我们监视数据，通知更新的问题，但是它本身固有的缺陷，导致了 Vue2 不完美的地方。

我举两个最明显的缺陷。

假设有一数据，我们要对它 defineProperty 一下：

```js
const data = {
    a: 1,
    b: 2,
    c: 3,
};
// loop through all key-value pair
Object.keys(data).forEach((key) => {
    defineReactive(data, key, obj[key]);
});

function defineReactive(obj, key, val) {
    Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        get: function definedGet() {
            // add to subs
        },
        set: function (newVal) {
            // notify
        },
    });
}
```

只能对当前 data 里有的数据，循环一遍，挨个进行 defineProperty，而后来添加的 key 就不会自带响应功能。

另外，数组怎么办。我们操作数组，很多时候用的都是数组自带的方法，`'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'`。

这七个方法都会改变数组，但是 set 并不会捕捉到。那就更别提通知了。

所以 Vue3 的响应式模块，抛弃了 defineProperty，用了新的 Proxy 功能重写了这个模块。

虽然因为使用的工具从 defineProperty 变成了 Proxy，代码变化了不少。

但是整体思路并没有颠覆性的变化，还是我上面所说的数据订阅，通知变化的路子。

不太恰当的比喻，就是“苟或”变成了“荀彧（xun yu）”。

## Porxy

之前我们 defineProperty，都是在 Object 本身上进行了调整（set，get），但 Proxy 本身不会修改原始的 Object，而是建立了一个代理（难怪叫 Proxy）。

我们后续的操作，都是在跟代理对话，不会碰原始 Object。

所谓的响应，都是操作被代理捕获后，代理的 handler 处理。

举个例子：

```js
let target = {
    msg1: 'hello',
    msg2: 'everyone',
};
const handler = {
    // intercept `get` method
    get: function (target, prop, reveiver) {
        console.log('in get method');
        return Reflect.get(...arguments);
    },
    // intercept `set` method
    set: function (target, prop, value, receiver) {
        console.log('in set method');
        return Reflect.set(target, prop, value, receiver);
    },
};
const proxy = new Proxy(target, handler);

// use proxy to access data
console.log(proxy.msg1);
```

这里再次强调，我们后续操作应该应用到代理身上，也就是 proxy.keyName。绝对不要直接操作原来的 target，这样会使响应式失效。

在看看之前所说的 defineProperty 的缺陷，对于旧的 prop，Proxy 当然可以处理。

同样，新的 prop，Proxy 也可以处理。因为 Proxy 不是针对具体的某一个 prop 进行捕获 get 或 set 操作。

而是针对整个 Object，进行了代理。

再看监视数组的问题，Vue2 里为了应对数组的 push，pop 等方法，不得不在原型链上进行了 override。

（这里就不展开细讲 Vue2 对数组的处理了，有感兴趣的童鞋可以在评论里留言，如果想看的人多，我可以写个番外篇）

而 Proxy 是如何应对数组问题呢？

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

我们看 terminal 里打印的 log，可以发现一次 push 进行了 2 次 get 操作，2 次 set 操作。

聪明的童鞋可以想想如何对数组进行监视和通知。

## 最后

详细的，基于 Proxy 的，代码实现 Vue3 的 reactive 功能，我们留到下一篇继续搞。

本来我想今天一口气把 reactivity 写进 vheel 里，但是考虑到不是所有人都了解过 Vue2 的底层原理。

为了适应更多的人，今天先把思路和一些必备的知识点写出来。（我只是简略介绍，抛砖引玉，想看详细的可以去 MDN 边看边试验）

下一篇再带你们把 vheel 这个轮子加上响应式。

这样有虚拟节点到真实 DOM 的渲染，有响应式更新。就已经有一个框架最基础的样子了。

虽然目前看起来只是个“艹戈”，连“苟或”都算不上，但是慢慢开发，会变成“荀彧”的

对了，有任何的批评建议，都可以在评论区留言，或者去 github 上提 issue（顺便给个 star 呗）

vheel：https://github.com/yangjiang3973/vheel
