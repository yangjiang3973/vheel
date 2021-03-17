import { createApp, createVNode as h } from '../packages/runtime-dom/src/index';
const app = createApp({
    data() {
        return {
            title: 'Hello world!',
        };
    },
    render() {
        // <div>
        //     <span>“Hello world!”</span>
        // </div>
        // equivalence vnode:
        return h('div', null, [h('span', null, [this.title])]);
    },
});
app.mount('#app');
