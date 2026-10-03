import type { ThemeAdapter, ThemeId } from './core.js'

/** One account per instance. Serial writes, latest intent wins, stale reads never win. */
export class ThemeSync {
  private abort = new AbortController()
  private revision = 0
  private pending: ThemeId | undefined
  private writing = false
  private reading = false
  constructor(private adapter: ThemeAdapter, private apply: (theme: ThemeId | null) => void,
    private status: (state: 'loading' | 'saving' | 'idle' | 'error') => void) {}

  async refresh() {
    if (this.abort.signal.aborted || this.writing || this.pending || this.reading) return
    const revision = this.revision
    this.reading = true
    this.status('loading')
    try {
      const theme = await this.adapter.load(this.abort.signal)
      if (!this.abort.signal.aborted && revision === this.revision) {
        this.apply(theme)
        this.status('idle')
      }
    } catch {
      if (!this.abort.signal.aborted && revision === this.revision) this.status('error')
    } finally {
      this.reading = false
    }
  }

  select(theme: ThemeId) {
    if (this.abort.signal.aborted) return
    this.revision++
    this.apply(theme)
    this.pending = theme
    void this.flush()
  }

  retry() {
    if (this.pending) void this.flush()
    else void this.refresh()
  }

  dispose() {
    this.abort.abort()
  }

  private async flush() {
    if (this.writing || this.abort.signal.aborted) return
    this.writing = true
    this.status('saving')
    try {
      while (this.pending && !this.abort.signal.aborted) {
        const theme = this.pending
        this.pending = undefined
        try {
          await this.adapter.save(theme, this.abort.signal)
        } catch {
          // Retain the newest intent for an explicit retry; never silently claim success.
          this.pending ??= theme
          if (!this.abort.signal.aborted) this.status('error')
          return
        }
      }
      if (!this.abort.signal.aborted) this.status('idle')
    } finally {
      this.writing = false
    }
  }
}
