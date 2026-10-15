// FamilyWinner - auto-actualizador basado en las Releases de GitHub
(function () {
  'use strict';
  const REPO = 'Futurehouser/FamilyWinner';
  const API = 'https://api.github.com/repos/' + REPO + '/releases/latest';
  const SKIP_KEY = 'fw-skip-version';
  const ASSETS = { electron: /portable.*\.exe$/i, android: /\.apk$/i };

  function platform() {
    if (window.fwNative && window.fwNative.platform === 'electron') return 'electron';
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return 'android';
    return 'web';
  }

  function cmp(a, b) {
    const pa = String(a).replace(/^v/i, '').split(/[.-]/).map(n => parseInt(n, 10) || 0);
    const pb = String(b).replace(/^v/i, '').split(/[.-]/).map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d) return d;
    }
    return 0;
  }

  async function check(manual) {
    const UI = window.FWUI;
    let rel;
    try {
      const r = await fetch(API, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
      if (r.status === 404) { if (manual) UI.toast('Todavía no hay versiones publicadas.'); return; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      rel = await r.json();
    } catch (e) {
      if (manual) UI.toast('No se pudo comprobar si hay actualizaciones (¿sin conexión?).');
      return;
    }
    const latest = (rel.tag_name || '').replace(/^v/i, '');
    const current = window.FW_VERSION || '0.0.0';
    if (!latest || cmp(latest, current) <= 0) {
      if (manual) UI.toast('Ya tienes la última versión (v' + current + ').');
      return;
    }
    if (!manual) {
      try { if (localStorage.getItem(SKIP_KEY) === latest) return; } catch (e) { /* nada */ }
    }

    const plat = platform();
    const asset = (rel.assets || []).find(a => ASSETS[plat] && ASSETS[plat].test(a.name));
    const el = UI.el;
    const notes = (rel.body || '').trim();
    const body = el('div', { class: 'center' },
      el('div', { class: 'question' }, '¡Hay una nueva versión de FamilyWinner!'),
      el('p', null, 'Tienes la v' + current + ' y está disponible la v' + latest + '.'),
      notes ? el('pre', { style: 'white-space:pre-wrap;text-align:left;max-height:180px;overflow:auto;background:#fff;padding:8px;border-radius:8px;width:100%;font-family:inherit' }, notes) : null,
      el('p', { class: 'question' }, '¿Quieres actualizar ahora?'),
      el('div', { class: 'btn-row', style: 'width:100%' },
        el('button', { class: 'btn primary big', onclick: () => install(rel, asset) }, 'Actualizar'),
        el('button', { class: 'btn', onclick: () => UI.closeModal() }, 'Más tarde'),
        el('button', { class: 'btn ghost', onclick: () => { try { localStorage.setItem(SKIP_KEY, latest); } catch (e) { /* nada */ } UI.closeModal(); } }, 'Omitir esta versión')));
    UI.openModal('Actualización disponible', body);
  }

  function progressView(text) {
    const UI = window.FWUI;
    const bar = UI.el('div');
    const label = UI.el('p', null, text);
    UI.openModal('Actualizando…', UI.el('div', { class: 'center' }, label, UI.el('div', { class: 'progressbar' }, bar)), { closable: false });
    return {
      set(p) { bar.style.width = Math.round(p * 100) + '%'; },
      text(t) { label.textContent = t; }
    };
  }

  async function install(rel, asset) {
    const UI = window.FWUI;
    const plat = platform();
    if (!asset || plat === 'web') {
      UI.closeModal();
      window.open(rel.html_url, '_blank');
      return;
    }
    const pv = progressView('Descargando la v' + rel.tag_name.replace(/^v/i, '') + '…');
    try {
      if (plat === 'electron') {
        await window.fwNative.downloadAndInstall(asset.browser_download_url, p => pv.set(p));
        pv.text('Instalando y reiniciando…');
      } else {
        const plugin = window.Capacitor.Plugins.FWUpdater;
        const handle = await plugin.addListener('progress', e => pv.set(e.progress));
        await plugin.downloadAndInstall({ url: asset.browser_download_url });
        handle.remove();
        pv.set(1);
        pv.text('Descarga completa. Confirma la instalación en la ventana de Android.');
        setTimeout(() => UI.closeModal(), 4000);
      }
    } catch (e) {
      UI.closeModal();
      UI.toast('Error al actualizar: ' + (e && e.message ? e.message : e));
    }
  }

  window.FWUpdater = { check };
})();
