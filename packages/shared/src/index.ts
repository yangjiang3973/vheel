export const isString = (val: unknown): val is string =>
    typeof val === 'string';

export const isObject = function (obj) {
    return obj !== null && typeof obj === 'object';
};
export const isFunction = (val: unknown): val is Function =>
    typeof val === 'function';

export const hasOwn = function (obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
};
