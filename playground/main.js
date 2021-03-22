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
        //     <span> Counter: {this.counter} </span>
        // </div>
        // equivalence vnode:
        return h('div', null, [h('span', null, ['Counter: ' + this.counter])]);
    },
});
app.mount('#app');
