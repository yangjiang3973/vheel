import { effect } from '../../reactivity/src/index';
import { createComponentInstance, setupComponent } from './component';
import { Text, createVNode } from './vnode';
import { isString, isObject } from '../../shared/src/index';

export function render(vnode, container) {
    patch(container._vnode || null, vnode, container);
}

function patch(oldVNode, newVNode, container) {
    const { type } = newVNode;
    if (isObject(type)) {
        processComponent(oldVNode, newVNode, container);
    } else if (isString(type)) {
        processElement(oldVNode, newVNode, container);
    } else if (type === Text) {
        processText(oldVNode, newVNode, container);
    }
}

function processText(n1, n2, container) {
    if (!n1) {
        n2.el = document.createTextNode(n2.children);
        container.append(n2.el);
    }
    // TODO:
    // else
}

function processElement(n1, n2, container) {
    if (!n1) mountElement(n2, container);
    else patchElement(n1, n2, container);
}

function patchElement(n1, n2, container) {
    // remove old tree, then insert the new one
    container.removeChild(n1.el);
    mountElement(n2, container);
}

function mountElement(vnode, container) {
    const el = (vnode.el = document.createElement(vnode.type));
    if (vnode.children) {
        mountChildren(vnode.children, el);
    }
    container.appendChild(el);
}

function mountChildren(children, container) {
    for (let i = 0; i < children.length; i++) {
        let child = children[i];
        if (isString(child)) {
            child = createVNode(Text, null, child);
        }
        patch(null, child, container);
    }
}

function processComponent(n1, n2, container) {
    if (!n1) mountComponent(n2, container);
    // else {
    //     TODO:
    //     updateComponent(n1, n2);
    // }
}

function mountComponent(compVNode, container) {
    // init component instance
    const instance = createComponentInstance(compVNode);
    compVNode.component = instance;

    // setup component, such as props, slots....
    setupComponent(instance);

    // generate component's root vnode tree then patch
    setupRenderEffect(instance, compVNode, container);
}

// TODO:
function setupRenderEffect(instance, initialVNode, container) {
    instance.update = effect(function componentEffect() {
        const { proxy, render } = instance;
        let subTree, preTree, nextTree;
        if (!instance.isMounted) {
            subTree = instance.subTree = render.call(proxy);
            patch(null, subTree, container);
            instance.isMounted = true;
        } else {
            nextTree = render.call(proxy);
            preTree = instance.subTree;
            instance.subTree = nextTree;
            patch(preTree, nextTree, container);
        }
    });
}
