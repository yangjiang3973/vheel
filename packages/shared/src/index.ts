export const isString = (val: unknown): val is string =>
    typeof val === 'string';

export const isObject = function (obj) {
    return obj !== null && typeof obj === 'object';
};

export const isArray = function (obj) {
    return Array.isArray(obj);
};

export const isFunction = (val: unknown): val is Function =>
    typeof val === 'function';

export const hasOwn = function (obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
};

export const hasChanged = (value, oldValue) =>
    value !== oldValue && (value === value || oldValue === oldValue);

export const toRawType = (value) => {
    // extract "RawType" from strings like "[object RawType]"
    return toTypeString(value).slice(8, -1);
};

export const toTypeString = (value: unknown): string =>
    objectToString.call(value);

export const objectToString = Object.prototype.toString;

export const isIntegerKey = (key: unknown) =>
    isString(key) &&
    key !== 'NaN' &&
    key[0] !== '-' && // negative integer
    '' + parseInt(key, 10) === key;
