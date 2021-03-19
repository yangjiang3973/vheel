// let target = {
//     msg1: 'hello',
//     msg2: 'everyone',
// };

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
