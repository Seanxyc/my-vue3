import { effect } from "../reactivity/effect"
import { EMPTY_OBJ, isEvent, isObject } from "../shared/index"
import { ShapeFlags } from "../shared/ShapeFlags"
import { createComponentInstance, setupComponent } from "./component"
import { createAppAPI } from "./createApp"
import { Fragment, Text } from "./vnode"

/**
* @description
* @param createElement
* @param patchProp 
* @param insert 
*/
export function createRenderer(options) {

  const {
    createElement: hostCreateElement,
    patchProp: hostPatchProp,
    insert: hostInsert,
    remove: hostRemove,
    setElementText: hostSetElementText
  } = options

  function render(vnode: any, container: any) {
    // patch
    patch(null, vnode, container, null, null)
  }

  /**
   * @description patch
   * @param n1 旧VNode
   * @param n2 新VNode
   * @param container 
   * @param parentComponent 
   */
  function patch(n1: any, n2: any, container: any, parentComponent: any, anchor: any) {
    // ShapeFlags   element | stateful component
    const { type, shapeFlag } = n2

    switch (type) {
      case Fragment:
        processFragment(n1, n2, container, parentComponent, anchor)
        break;

      case Text:
        processText(n1, n2, container)
        break;

      default:
        if (shapeFlag & ShapeFlags.ELEMENT) { // 与运算比较
          // 处理element类型
          processElement(n1, n2, container, parentComponent, anchor)
        } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
          // 处理组件类型
          propcessComponent(n1, n2, container, parentComponent, anchor)
        }
        break;
    }
  }

  function processFragment(n1: any, n2: any, container: any, parentComponent: any, anchor: any) {
    mountChildren(n2.children, container, parentComponent, anchor)
  }

  function processText(n1: any, n2: any, container: any) {
    const { children } = n2
    const textNode = document.createTextNode(children)
    container.append(textNode)
  }

  function processElement(n1: any, n2: any, container: any, parentComponent: any, anchor: any) {
    if (!n1) {
      // 初始化
      mountElement(n2, container, parentComponent, anchor)
    } else {
      patchElement(n1, n2, container, parentComponent, anchor)
    }
  }

  /**
    * @description
    * @param n1 oldVNode
    * @param n2 newVNode 
    * @param container
    */
  function patchElement(n1: any, n2: any, container: any, parentComponent: any, anchor: any) {
    const oldProps = n1.props || EMPTY_OBJ
    const newProps = n2.props || EMPTY_OBJ
    const el = (n2.el = n1.el)
    // children
    patchChildren(n1, n2, el, parentComponent, anchor)
    // props
    patchProps(el, oldProps, newProps)
  }


  /**
  * @description 
  * @param n1 oldVNode
  * @param n2 newVNode
  */
  function patchChildren(n1: any, n2: any, container: any, parentComponent: any, anchor: any) {
    const prevShapeFlag = n1.shapeFlag
    const shapeFlag = n2.shapeFlag
    const c1 = n1.children
    const c2 = n2.children

    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // array to text
        // 1. 把旧的children清空
        unmountChildren(n1.children)
        // 2. 设置text
        // hostSetElementText(container, c2)
      }

      // text to text / array to text
      if (c1 !== c2) {
        hostSetElementText(container, c2)
      }
    } else {
      if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
        hostSetElementText(container, '')
        mountChildren(c2, container, parentComponent, anchor)
      } else {
        // array to array
        patchKeyedChildren(c1, c2, container, parentComponent, anchor)
      }
    }
  }

  /**
   * @description diff
   * @param c1 oldChildren
   * @param c2 newChildren
   * @param container 
   * @param parentComponent 
   */
  function patchKeyedChildren(
    c1: any,
    c2: any,
    container: any,
    parentComponent: any,
    parentAnchor: any
  ) {
    const l2 = c2.length
    let i = 0
    let e1 = c1.length - 1
    let e2 = l2 - 1

    function isSameVNodeType(n1, n2) {
      return n1.type === n2.type && n1.key === n2.key
    }

    // left
    while (i <= e1 && i <= e2) {
      const n1 = c1[i] // old
      const n2 = c2[i] // new 

      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, container, parentComponent, parentAnchor)
      } else {
        break
      }
      i++
    }

    // right
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1]
      const n2 = c2[e2]

      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, container, parentComponent, parentAnchor)
      } else {
        break
      }
      e1--
      e2--
    }

    // 3. 新的比旧的长----创建
    if (i > e1) {
      if (i <= e2) {
        const nextPos = e2 + 1
        const anchor = nextPos < l2 ? c2[nextPos].el : null // 在前面添加, 利用锚点
        while (i <= e2) {
          patch(null, c2[i], container, parentComponent, anchor)
          i++
        }
      }
    } else if (i > e2) { // 4. 旧的比新的长----删除
      while (i <= e1) {
        hostRemove(c1[i].el)
        i++
      }
    }
  }

  /**
  * @description
  * @param children
  */
  function unmountChildren(children: any) {
    for (let i = 0; i < children.length; i++) {
      const el = children[i].el;
      hostRemove(el)
    }
  }

  /**
  * @description 遍历新props和旧props对比
  * @param el
  * @param oldProps
  * @param newProps
  */
  function patchProps(el: any, oldProps: any, newProps: any) {
    if (oldProps !== newProps) {
      for (const key in newProps) {
        const prevProp = oldProps[key]
        const nextProp = newProps[key]

        if (prevProp !== nextProp) {
          hostPatchProp(el, key, prevProp, nextProp)
        }
      }

      if (oldProps !== EMPTY_OBJ) {
        for (const key in oldProps) {
          if (!(key in newProps)) {
            hostPatchProp(el, key, oldProps[key], null)
          }
        }
      }
    }
  }

  function mountElement(vnode: any, container: any, parentComponent: any, anchor: any) {
    // vnode -> element

    // 基于DOM
    // const el = (vnode.el = document.createElement(vnode.type)) // string | array
    // 自定义渲染
    const el = (vnode.el = hostCreateElement(vnode.type)) // string | array
    const { children, props, shapeFlag } = vnode

    // text children | array children
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      el.textContent = children
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 每个child调用patch
      mountChildren(vnode.children, el, parentComponent, anchor)
    }

    for (const key in props) {
      if (props.hasOwnProperty(key)) {
        const val = props[key];
        // 基于DOM
        // if (isEvent(key)) {
        //   const event = key.slice(2).toLowerCase()
        //   el.addEventListener(event, val)
        // } else {
        //   el.setAttribute(key, val)
        // }
        // 自定义渲染
        hostPatchProp(el, key, null, val)
      }
    }

    // 基于DOM
    // container.append(el)
    // 自定义渲染
    hostInsert(el, container, anchor)
  }

  /**
   * @description 处理数组类型children
   */
  function mountChildren(children: any, container: any, parentComponent: any, anchor: any) {
    children.forEach(v => {
      patch(null, v, container, parentComponent, anchor)
    });
  }

  /**
   * @description 处理组件类型
   */
  function propcessComponent(n1: any, n2: any, container: any, parentComponent: any, anchor: any) {
    mountComponent(n2, container, parentComponent, anchor)
  }

  /**
    * @description 组件初始化
    */
  function mountComponent(initialVNode: any, container: any, parentComponent: any, anchor: any) {
    // 创建实例
    const instance = createComponentInstance(initialVNode, parentComponent)

    // 执行setup
    setupComponent(instance)

    // 调用render
    setupRenderEffect(instance, initialVNode, container, anchor)
  }

  /**
    * @description 生成虚拟节点
    */
  function setupRenderEffect(instance: any, initialVNode: any, container: any, anchor: any) {
    effect(() => {

      if (!instance.isMounted) {
        // init
        const { proxy } = instance
        const subTree = instance.subTree = instance.render.call(proxy) // 虚拟节点树

        patch(null, subTree, container, instance, anchor)

        initialVNode.el = subTree.el

        instance.isMounted = true
      } else {
        // update
        const { proxy } = instance
        const subTree = instance.render.call(proxy) // 虚拟节点树
        const prevSubTree = instance.subTree
        // 更新subTree
        instance.subTree = subTree

        patch(prevSubTree, subTree, container, instance, anchor)
      }
    })
  }

  return {
    createApp: createAppAPI(render)
  }
}
