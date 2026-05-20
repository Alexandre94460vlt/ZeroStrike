/**
 * Adaptateur Socket.io → SocketPort (port application).
 */
 
export class SocketIoAdapter {
  /**
   * @param {{ displayNamespace: any, mobileNamespace: any }} p
   */
  constructor({ displayNamespace, mobileNamespace }) {
    this.displayNamespace = displayNamespace;
    this.mobileNamespace = mobileNamespace;
  }
 
  emitNamespace(ns, event, payload) {
    const n = ns === 'display' ? this.displayNamespace : this.mobileNamespace;
    n.emit(event, payload);
  }
 
  emitSocket(ns, socketId, event, payload) {
    const n = ns === 'display' ? this.displayNamespace : this.mobileNamespace;
    const sock = n.sockets.get(socketId);
    if (!sock) return;
    sock.emit(event, payload);
  }
 
  getSocketCounts() {
    return {
      display: this.displayNamespace?.sockets?.size || 0,
      mobile: this.mobileNamespace?.sockets?.size || 0
    };
  }
}
