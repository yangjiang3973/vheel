# 将响应式模块连入框架

我们之前写了一个超级简单的 reactivity 模块，能够做到监视数据，以及自动执行数据更新后的后续影响。

但是它目前更多的是作为一个独立的模块，还没有和之前写的框架连起来。

我们希望它能监视组件的数据，数据变化时，触发组件的重新渲染。

## 今天的小目标

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
        //     <span>“Hello world!”</span>
        // </div>
        // equivalence vnode:
        return h('div', null, [h('span', null, ['Counter: ' + this.counter])]);
    },
});
app.mount('#app');
```
