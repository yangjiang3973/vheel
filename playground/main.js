// import { createApp, createVNode as h } from '../packages/runtime-dom/src/index';
// const app = createApp({
//     data() {
//         return {
//             counter: 0,
//         };
//     },
//     render() {
//         setTimeout(() => {
//             this.counter++;
//         }, 1000);
//         // <div>
//         //     <span> Counter: {this.counter} </span>
//         // </div>
//         // equivalence vnode:
//         return h('div', null, [h('span', null, ['Counter: ' + this.counter])]);
//     },
// });
// app.mount('#app');

import { reactive, effect } from '../packages/reactivity/src/index';

const arr = [1, 2, 3];
const trackEvents = [];
const triggerEvents = [];

const proxy = reactive(arr);

effect(
    () => {
        console.log(proxy.length);
    },
    {
        onTrack: (e) => {
            trackEvents.push(e);
        },
        onTrigger: (e) => {
            triggerEvents.push(e);
        },
    }
);

proxy.push(1);
console.log(trackEvents);
console.log(triggerEvents);
