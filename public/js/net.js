// Client WebSocket minimaliste : connexion, envoi JSON, abonnement par type de message.

export class Net {
  constructor() {
    this.ws = null;
    this.handlers = new Map();
    this.intentionalClose = false;
  }

  connect() {
    if (this.ws && this.ws.readyState <= 1) return Promise.resolve();
    this.intentionalClose = false;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${proto}//${location.host}`);
    this.ws.addEventListener('message', (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      const fn = this.handlers.get(m.type);
      if (fn) fn(m);
    });
    this.ws.addEventListener('close', () => {
      this.ws = null;
      if (this.intentionalClose) return;
      const fn = this.handlers.get('_close');
      if (fn) fn();
    });
    return new Promise((resolve, reject) => {
      this.ws.addEventListener('open', () => resolve(), { once: true });
      this.ws.addEventListener('error', () => reject(new Error('Connexion impossible au serveur.')), { once: true });
    });
  }

  on(type, fn) { this.handlers.set(type, fn); }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  disconnect() {
    this.intentionalClose = true;
    if (this.ws && this.ws.readyState <= 1) this.ws.close();
    this.ws = null;
  }
}
