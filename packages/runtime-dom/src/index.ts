import { render } from '../../runtime-core/src/renderer';
import { createVNode } from '../../runtime-core/src/vnode';

import { isString } from '../../shared/src/index';

// re-export everything from core
export * from '../../runtime-core/src/index';

export const createApp = (rootComponent) => {
    const app = {
        _component: rootComponent,
    };
    //* here to write mount method
    (app as any).mount = (containerOrSelector): any => {
        const container = normalizeContainer(containerOrSelector);
        if (!container) return;

        const component = app._component;
        // build a virtual node for this component
        const vnode = createVNode(component);
        render(vnode, container);
    };

    return app;
};

// TODO: make a better normalizer
function normalizeContainer(container) {
    if (isString(container)) {
        const res = document.querySelector(container);
        if (!res && __DEV__) {
            console.error('Cannot find the target container');
        }
        return res;
    }
}
