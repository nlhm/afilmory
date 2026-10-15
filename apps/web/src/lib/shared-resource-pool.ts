export interface ResourceSubscription<T> {
  promise: Promise<T>
  cancel: () => void
}

interface Consumer<T, U> {
  resolve: (value: T) => void
  reject: (error: unknown) => void
  onUpdate?: (update: U) => void
}

interface ResourceTask<T, U> {
  controller: AbortController
  consumers: Set<Consumer<T, U>>
  lastUpdate?: U
}

export class SharedResourcePool<T, U> {
  private readonly tasks = new Map<string, ResourceTask<T, U>>()

  subscribe(
    key: string,
    start: (signal: AbortSignal, publish: (update: U) => void) => Promise<T>,
    onUpdate?: (update: U) => void,
  ): ResourceSubscription<T> {
    let task = this.tasks.get(key)
    const isNew = !task
    if (!task) {
      task = { controller: new AbortController(), consumers: new Set() }
      this.tasks.set(key, task)
    }
    const activeTask = task
    let consumer: Consumer<T, U>
    const promise = new Promise<T>((resolve, reject) => {
      consumer = { resolve, reject, onUpdate }
      activeTask.consumers.add(consumer)
    })

    if (activeTask.lastUpdate !== undefined) {
      onUpdate?.(activeTask.lastUpdate)
    }

    if (isNew) {
      const finish = (result: { value: T } | { error: unknown }) => {
        if (this.tasks.get(key) === activeTask) {
          this.tasks.delete(key)
        }
        for (const subscriber of activeTask.consumers) {
          if ('value' in result) {
            subscriber.resolve(result.value)
          }
          else {
            subscriber.reject(result.error)
          }
        }
        activeTask.consumers.clear()
      }
      void Promise.resolve()
        .then(() => {
          activeTask.controller.signal.throwIfAborted()
          return start(activeTask.controller.signal, (update) => {
            activeTask.lastUpdate = update
            for (const subscriber of activeTask.consumers) {
              subscriber.onUpdate?.(update)
            }
          })
        })
        .then(value => finish({ value }), error => finish({ error }))
    }

    return {
      promise,
      cancel: () => {
        if (!activeTask.consumers.delete(consumer!)) {
          return
        }
        consumer!.reject(new DOMException('Resource load aborted', 'AbortError'))
        if (activeTask.consumers.size === 0) {
          if (this.tasks.get(key) === activeTask) {
            this.tasks.delete(key)
          }
          activeTask.controller.abort()
        }
      },
    }
  }
}
