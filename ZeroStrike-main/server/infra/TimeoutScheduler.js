/**
 * Scheduler simple basé sur setTimeout, adressé par clé.
 * Permet au domaine de demander des timers sans appeler setTimeout directement.
 */
 
export class TimeoutScheduler {
  constructor() {
    /** @type {Map<string, any>} */
    this.handles = new Map();
  }
 
  schedule(key, delayMs, fn) {
    this.cancel(key);
    const h = setTimeout(() => {
      this.handles.delete(key);
      fn();
    }, Math.max(0, delayMs));
    this.handles.set(key, h);
  }
 
  cancel(key) {
    const h = this.handles.get(key);
    if (h) clearTimeout(h);
    this.handles.delete(key);
  }
}
