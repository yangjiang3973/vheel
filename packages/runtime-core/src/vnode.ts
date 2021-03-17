export const Text = Symbol(__DEV__ ? 'Text' : undefined);

export type VNodeTypes = string | typeof Text;

export interface VNode {
    __v_isVNode: true;
    type: VNodeTypes;
    props: any;
    children: any;
    el: any;
}

export function createVNode(type, props?, children?) {
    const vnode: VNode = {
        __v_isVNode: true,
        type,
        props,
        children,
        el: null,
    };

    return vnode;
}
