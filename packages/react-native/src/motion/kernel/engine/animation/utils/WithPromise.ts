// Received from motion-dom 12.40.0. See UPSTREAM.json and LICENSE.motion-dom.md.
export class WithPromise {
  protected _finished!: Promise<void>

  resolve!: () => void

  constructor() {
    this.updateFinished()
  }

  get finished() {
    return this._finished
  }

  protected updateFinished() {
    this._finished = new Promise<void>((resolve) => {
      this.resolve = resolve
    })
  }

  protected notifyFinished() {
    this.resolve()
  }

  /**
   * Allows the animation to be awaited.
   *
   * @deprecated Use `finished` instead.
   */
  then(onResolve: () => void, onReject?: () => void) {
    return this.finished.then(onResolve, onReject)
  }
}
