# 将响应式模块连入框架

我们之前写了一个超级简单的 reactivity 模块，能够做到监视数据，以及自动执行数据更新后的后续影响。

但是它目前更多的是作为一个独立的模块，还没有和之前写的框架连起来。

我们希望它能监视组件的数据，数据变化时，触发组件的重新渲染。

## 今天的小目标

假设我们有一个叫 `Counter` 的组件，只有一条数据，就是 counter 变量，初始值为 0。

之前我们已经的部分框架，可以做到把 counter 渲染到屏幕上。

但是今天我们要更进一步，希望 counter 的值变化后，浏览器页面上的数字也随之变化。

如果用原生 js 处理，那我们首先更改 counter 变量的值后，还需要手动选中 DOM element，把节点内容修改成新的值。

现在我们想，只关注并维护 counter 的状态（state），DOM 的更新操作交给框架。

但因为目前阶段，框架已完成的功能，还不包括给“事件”功能，所以我们没办法按正常思路来让 counter 的值变化。

比如创建个按钮，按钮上挂一个 onClick 事件，每次点击 counter 都会加 1。

后面肯定会实现，但目前阶段我不想分心到事件功能上去，所以就用了个很傻的方式。

```js
import { createApp, createVNode as h } from '../packages/runtime-dom/src/index';
const app = createApp({
    data() {
        return {
            counter: 0,
        };
    },
    render() {
        setTimeout(() => {
            this.counter++;
        }, 1000);
        // <div>
        //     <span>Counter: {this.counter} </span>
        // </div>
        // equivalence vnode:
        return h('div', null, [h('span', null, ['Counter: ' + this.counter])]);
    },
});
app.mount('#app');
```

对的，我在 render 里放了个 setTimeout 来更改 counter，1 秒钟之后 counter 的值就会加 1。

然后重新执行 render，此时再挂上 setTimeout，1s 后加一，再次渲染，挂上，渲染。。。

这就成了个秒表一样的玩意，屏幕上的数字每秒加 1。

接下来就让我们看看目前写好的框架还需要开发哪些地方，才能让这个秒表动起来。

## 接入 reactive

reactive 监视数据，拦截针对数据对象的操作，然后通知 effect 处理数据更新的后续操作。这是我们在上一篇文章实现的功能。

对于有状态，或者更具体点，有自己数据的组件，我们第一步先让它的数据 reactive 起来。

修改`finishComponentSetup`函数。

```js
function finishComponentSetup(instance) {
    const Component = instance.type;
    instance.render = Component.render || (() => {});
    if (isFunction(Component.data)) {
        const dataFn = Component.data;
        const data = dataFn.call(instance.proxy);
        // make data reactive and save into the instance
        instance.data = reactive(data);
    }
}
```

其实就修改 1 行，把数据 reactive 一下，然后挂到 instance 下面。

但是问题来了，在写 Vue 的时候，我们不管是调用 data 还是 method，用于都是直接`this.xxxName`。

很不会`this.data.counter`或者`this.methods.increaseCounter`

直接挂到 instance 下面，没法直接 this 上取数据，所以还需要多一步。

```js
function setupStatefulComponent(instance) {
    instance.proxy = new Proxy(instance, PublicInstanceProxyHandlers);
}

const PublicInstanceProxyHandlers = {
    get: function (target, key) {
        if (hasOwn(target.data, key)) return target.data[key];
    },
    set: function (target, key, value, receiver) {
        return (target.data[key] = value);
    },
};
```

简单来说，就是把 instance 也变成 proxy，然后将`this.counter`拦截后变成`this.data.counter`。

我们目前只有 data，之后的 methods 等等，都会进行这样的，我称之为快捷方式（shortcut）的处理，直接`this.xxx`调用。

## 接入 effect

data 是 reactive 了，接下来要考虑在哪里接入 effect 呢？

我们希望 effect 可以触发渲染，那当然是将渲染的活，作为 callback 传入 effect 中。

```js
function setupRenderEffect(instance, initialVNode, container) {
    instance.update = effect(function componentEffect() {
        const { proxy, render } = instance;
        let subTree, preTree, nextTree;
        if (!instance.isMounted) {
            subTree = instance.subTree = render.call(proxy);
            patch(null, subTree, container);
            instance.isMounted = true;
        } else {
            nextTree = render.call(proxy);
            preTree = instance.subTree;
            instance.subTree = nextTree;
            patch(preTree, nextTree, container);
        }
    });
}
```

因为这个 effect 不是 lazy 的，所以刚创建就会立刻执行，这时候组件还没有 mount，所以会进第一个 if，也就是我们之前完成的功能。

而当数据更新，引发二次渲染，就会进 else 部分，我们重新再执行 render，渲染新的 vnode，传入 patch 里，最后更新 DOM。

但是还记得吗，我们的 path 之前只写了首次 mount 的逻辑，并没有写更新的部分。

所以还需要把这块补上。

## 补补 patch

因为我们今天需要更新的，其实就是组件里的 element，所以只需补下 patchElement 函数：

我们的 DOM 更新算法（甚至都称不上算法）很简单，就是把旧的连根拔起，把新的栽上去，DOM 就更新了哈哈。

```js
function processElement(n1, n2, container) {
    if (!n1) mountElement(n2, container);
    else patchElement(n1, n2, container);
}

function patchElement(n1, n2, container) {
    // remove old tree, then insert the new one
    container.removeChild(n1.el);
    mountElement(n2, container);
}
```

正常情况下的 patch，是有一套全面又复杂的 diff 算法的。

因为对于 DOM 来说，删掉节点在重新创建，是一个很昂贵的操作。

尤其你有一个列表，列表里上千上万条数据，你把整个列表删了，重新创建来进行更新。

会卡的你妈妈都不认识。

（我记得超过 16ms 的卡顿用户就能感知到了？如果不是 16ms，请在评论里指出，我懒得查了）

所以不管是 react 还是 vue，任何前端框架，如果走虚拟节点的路线，肯定都有一套威力强大的 diff 算法来 patch。

不信你打开 Vue2 的源码，搜 patch 函数，看看多少行。如果第一次见，是不是觉得像看到了牛魔王。

我们后面也会写个简单的 diff 来进行 patch，但是目前就，整体删掉，整体插入吧。

等具体谈到了渲染器的部分，我们再详细讲讲 patch。

## demo 跑起来

完成了以上的补充，今天的例子应该就可以跑起来了。

```js
import { createApp, createVNode as h } from '../packages/runtime-dom/src/index';
const app = createApp({
    data() {
        return {
            counter: 0,
        };
    },
    render() {
        setTimeout(() => {
            this.counter++;
        }, 1000);
        // <div>
        //     <span>Counter: {this.counter} </span>
        // </div>
        // equivalence vnode:
        return h('div', null, [h('span', null, ['Counter: ' + this.counter])]);
    },
});
app.mount('#app');
```

浏览器里可以看到 counter 每秒都在加 1，虽然我们并没有任何直接的 DOM 操作，框架替我们完成了。

所以可以把更多的精力放在业务逻辑，放在组件的状态上。

## 后续计划

其实一个简单的渲染器，和一个简单的响应式模块，现在已经有了。

后续的一个主要工作就是把渲染器和响应式变得更完善，再添加一些 Vue 的功能，比如 slots。

另外，重要的还有添加单元测试！
