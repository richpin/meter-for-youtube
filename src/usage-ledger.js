// A ledger belongs to one local date. Storage notifications can arrive before
// the response to our own write; defer those totals until that write settles.
globalThis.UsageLedger = class UsageLedger {
  constructor(date, stored = { focus: 0, watch: 0 }) {
    this.date = date;
    this.stored = stored;
    this.pending = { focus: 0, watch: 0 };
    this.inFlight = null;
    this.deferred = null;
  }

  get total() {
    return {
      focus: this.stored.focus + this.pending.focus,
      watch: this.stored.watch + this.pending.watch,
    };
  }

  update(day) {
    if (this.inFlight) this.deferred = day;
    else this.stored = day;
  }

  async flush(send) {
    if (this.inFlight) {
      await this.inFlight;
      return this.flush(send);
    }
    if (!this.pending.focus && !this.pending.watch) return;
    const delta = { ...this.pending };
    const commit = async () => {
      await Promise.resolve(); // assign inFlight before even a synchronous send failure
      try {
        const response = await send({ type: "ADD_TIME", date: this.date, ...delta });
        if (!Number.isFinite(response?.focus) || !Number.isFinite(response?.watch)) {
          throw new Error(response?.error || "Usage save failed");
        }
        this.pending.focus -= delta.focus;
        this.pending.watch -= delta.watch;
        this.stored = {
          focus: Math.max(response.focus, this.deferred?.focus || 0),
          watch: Math.max(response.watch, this.deferred?.watch || 0),
        };
      } catch (error) {
        // A different tab may have saved successfully while our write failed.
        if (this.deferred) this.stored = this.deferred;
        throw error;
      } finally {
        this.deferred = null;
        this.inFlight = null;
      }
    };
    this.inFlight = commit();
    await this.inFlight;
  }
};
