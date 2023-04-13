import { ReactiveEffect, trackOpBit } from './effect'

export type Dep = Set<ReactiveEffect> & TrackedMarkers

/**
 * wasTracked and newTracked maintain the status for several levels of effect
 * tracking recursion. One bit per level is used to define whether the dependency
 * was/is tracked.
 */
type TrackedMarkers = {
  /**
   * wasTracked
   */
  w: number
  /**
   * newTracked
   */
  n: number
}

export const createDep = (effects?: ReactiveEffect[]): Dep => {
  const dep = new Set<ReactiveEffect>(effects) as Dep
  dep.w = 0
  dep.n = 0
  return dep
}

// (dep.w & trackOpBit) > 0 代表重位了,打个最简单的例子 1111 & 0001 > 0, 1011 & 0100 = 0
// 又因为trackOpBit是通过1左移N位得到的二进制数字,所以上述所说的重位在这里意味着在当前这个嵌套层级中,该依赖被搜集过
export const wasTracked = (dep: Dep): boolean => (dep.w & trackOpBit) > 0

export const newTracked = (dep: Dep): boolean => (dep.n & trackOpBit) > 0

export const initDepMarkers = ({ deps }: ReactiveEffect) => {
  if (deps.length) {
    // 设置为已追踪
    for (let i = 0; i < deps.length; i++) {
      deps[i].w |= trackOpBit // set was tracked
    }
  }
}

export const finalizeDepMarkers = (effect: ReactiveEffect) => {
  const { deps } = effect
  if (deps.length) {
    let ptr = 0
    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i]
      // 将已经在追踪且不是新加入追踪的副作用删除
      // todo: 这么做是为了解决什么问题
      // 猜测,为了解决分支切换问题,也就是 document.innerText = false ? obj.key : 'hello',改变obj.key不应该执行这个副作用
      // 验证猜测,确实是解决这个问题,但不完全是为了解决这个问题,还有额外的原因还需要理解
      if (wasTracked(dep) && !newTracked(dep)) {
        dep.delete(effect)
      } else {
        deps[ptr++] = dep
      }
      // clear bits
      // 回退依赖执行状态
      dep.w &= ~trackOpBit
      dep.n &= ~trackOpBit
    }
    deps.length = ptr
  }
}
