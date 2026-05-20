/**
 * Overlay plein écran : mot de passe projecteur (plusieurs tentatives possibles).
 * @param {(password: string) => Promise<{ ok: boolean, error?: string }>} tryLogin
 * @returns {Promise<void>}
 */
export function runDisplayPasswordGate(tryLogin) {
  return new Promise((resolve, reject) => {
    const prev = document.getElementById('zs-display-auth-overlay');
    if (prev) prev.remove();

    const wrap = document.createElement('div');
    wrap.id = 'zs-display-auth-overlay';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'Authentification projecteur');
    Object.assign(wrap.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '99999',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(5,5,8,0.92)',
      fontFamily: "'Teko', sans-serif"
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
      width: 'min(420px, 92vw)',
      padding: '28px 24px',
      background: 'linear-gradient(165deg, #15151c 0%, #0a0a0e 100%)',
      border: '1px solid rgba(255,140,60,0.35)',
      borderRadius: '8px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.6)'
    });

    const title = document.createElement('h1');
    title.textContent = 'ACCÈS PROJECTEUR';
    Object.assign(title.style, {
      margin: '0 0 8px 0',
      fontSize: '32px',
      fontWeight: '600',
      letterSpacing: '0.06em',
      color: '#f4f0e8'
    });

    const hint = document.createElement('p');
    hint.textContent = 'Saisissez le mot de passe pour afficher le lobby sur cet écran.';
    Object.assign(hint.style, {
      margin: '0 0 20px 0',
      fontSize: '18px',
      lineHeight: '1.35',
      color: 'rgba(244,240,232,0.75)'
    });

    const err = document.createElement('p');
    err.setAttribute('aria-live', 'polite');
    Object.assign(err.style, {
      minHeight: '22px',
      margin: '0 0 12px 0',
      fontSize: '17px',
      color: '#ff6b4a'
    });

    const form = document.createElement('form');
    const input = document.createElement('input');
    input.type = 'password';
    input.autocomplete = 'current-password';
    input.placeholder = 'Mot de passe';
    Object.assign(input.style, {
      width: '100%',
      boxSizing: 'border-box',
      padding: '12px 14px',
      marginBottom: '14px',
      fontSize: '20px',
      fontFamily: 'inherit',
      color: '#f4f0e8',
      background: '#0d0d12',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '4px',
      outline: 'none'
    });

    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', gap: '10px', justifyContent: 'flex-end' });

    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.textContent = 'Valider';
    Object.assign(btn.style, {
      padding: '10px 22px',
      fontSize: '20px',
      fontFamily: 'inherit',
      fontWeight: '600',
      letterSpacing: '0.04em',
      cursor: 'pointer',
      color: '#0a0a0e',
      background: 'linear-gradient(180deg, #ffb347 0%, #ff8c3a 100%)',
      border: 'none',
      borderRadius: '4px'
    });

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Annuler';
    Object.assign(cancel.style, {
      padding: '10px 18px',
      fontSize: '18px',
      fontFamily: 'inherit',
      cursor: 'pointer',
      color: 'rgba(244,240,232,0.85)',
      background: 'transparent',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: '4px'
    });

    const cleanup = () => {
      wrap.remove();
    };

    cancel.addEventListener('click', () => {
      cleanup();
      reject(new Error('cancelled'));
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pwd = String(input.value ?? '').trim();
      err.textContent = '';
      if (!pwd) {
        err.textContent = 'Mot de passe requis.';
        return;
      }
      btn.disabled = true;
      cancel.disabled = true;
      try {
        const res = await tryLogin(pwd);
        if (res?.ok) {
          cleanup();
          resolve();
        } else {
          err.textContent =
            res?.error === 'invalid'
              ? 'Mot de passe incorrect.'
              : res?.error === 'locked'
                ? 'Trop de tentatives. Rechargez la page.'
                : 'Échec de la connexion. Réessayez.';
          input.select();
        }
      } catch {
        err.textContent = 'Erreur réseau. Réessayez.';
      } finally {
        btn.disabled = false;
        cancel.disabled = false;
      }
    });

    row.appendChild(cancel);
    row.appendChild(btn);
    form.appendChild(input);
    form.appendChild(err);
    form.appendChild(row);
    box.appendChild(title);
    box.appendChild(hint);
    box.appendChild(form);
    wrap.appendChild(box);
    document.body.appendChild(wrap);

    setTimeout(() => {
      input.focus();
    }, 50);
  });
}
