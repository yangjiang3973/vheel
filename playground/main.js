// import { createApp, createVNode as h } from '../packages/runtime-dom/src/index';
// const app = createApp({
//     data() {
//         return {
//             title: 'Hello world!',
//         };
//     },
//     render() {
//         // <div>
//         //     <span>“Hello world!”</span>
//         // </div>
//         // equivalence vnode:
//         return h('div', null, [h('span', null, [this.title])]);
//     },
// });
// app.mount('#app');

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
