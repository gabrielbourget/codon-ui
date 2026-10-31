type TTask = (complete: () => void) => void

// Native admission is asynchronous. Preserve the observed item event order across that boundary.
export class NativeComboBoxItemPressQueue {
  readonly #current: () => boolean
  readonly #tasks: TTask[] = []
  #running = false
  #retired = false

  constructor(current: () => boolean) {
    this.#current = current
  }

  push = (task: TTask) => {
    if (this.#retired) return
    this.#tasks.push(task)
    this.#drain()
  }

  emit = (callback: () => void) => {
    this.push((complete) => {
      callback()
      complete()
    })
  }

  retire = () => {
    this.#retired = true
    this.#tasks.length = 0
  }

  #drain = () => {
    if (this.#retired || this.#running) return
    if (!this.#current()) {
      this.retire()
      return
    }
    const task = this.#tasks.shift()
    if (!task) return
    this.#running = true
    let completed = false
    try {
      task(() => {
        if (completed) return
        completed = true
        this.#running = false
        this.#drain()
      })
    } catch (error) {
      this.#running = false
      this.retire()
      throw error
    }
  }
}
