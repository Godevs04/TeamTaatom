type ShortsTabRefreshListener = () => void;

class ShortsEvents {
  private tabRefreshListeners: Set<ShortsTabRefreshListener> = new Set();

  addTabRefreshListener(listener: ShortsTabRefreshListener) {
    this.tabRefreshListeners.add(listener);
    return () => {
      this.tabRefreshListeners.delete(listener);
    };
  }

  emitTabRefresh() {
    this.tabRefreshListeners.forEach((listener) => {
      try {
        listener();
      } catch {}
    });
  }
}

export const shortsEvents = new ShortsEvents();
