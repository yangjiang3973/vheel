import { hasOwn, isFunction } from '../../shared/src/index';

const PublicInstanceProxyHandlers = {
    get: function (target, key) {
        if (hasOwn(target.data, key)) return Reflect.get(target.data, key);
    },
};

function finishComponentSetup(instance) {
    const Component = instance.type;
    instance.render = Component.render || (() => {});
    if (isFunction(Component.data)) {
        const dataFn = Component.data;
        const data = dataFn.call(instance.proxy);
        instance.data = data;
    }
}

function setupStatefulComponent(instance) {
    instance.proxy = new Proxy(instance, PublicInstanceProxyHandlers);
}

export function setupComponent(instance) {
    setupStatefulComponent(instance);
    finishComponentSetup(instance);
}

export function createComponentInstance(compVNode) {
    const instance = {
        type: compVNode.type,
        vnode: compVNode,
        data: {},
        proxy: {},
    };

    return instance;
}
