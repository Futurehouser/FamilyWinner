// FamilyWinner - interfaz
(function () {
  'use strict';
  const L = window.FWLogic;
  const STORE_KEY = 'fw-state-v1';
  const HIST_KEY = 'fw-history-v1';
  const MAX_HISTORY = 150;

  let state = null;        // estado de la partida (null = en pantalla de inicio)
  let history = [];        // estados anteriores para "deshacer"
  let setupSel = [];       // cartas elegidas en la pantalla de inicio

  // ---------- utilidades DOM ----------
  const $ = id => document.getElementById(id);
  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    children.flat().forEach(c => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); });
    return e;
  }
  const pct = p => Math.round(p * 100) + '%';

  function cardEl(card, opts) {
    opts = opts || {};
    const cls = ['card'];
    if (opts.size) cls.push(opts.size);
    if (opts.onClick) cls.push('clickable');
    if (opts.selected) cls.push('selected');
    if (opts.dim) cls.push('dim');
    return el('div', { class: cls.join(' '), title: L.cardName(card), onclick: opts.onClick },
      el('div', { class: 'card-label' },
        el('span', { class: 'fam' }, L.FAMILY_NAMES[L.famOf(card)]),
        el('span', { class: 'mem' }, L.MEMBER_NAMES[L.memOf(card)])),
      el('img', { src: 'cards/' + card + '.jpg', alt: L.cardName(card), loading: 'lazy', draggable: 'false' }),
      opts.badge ? el('span', { class: 'badge' + (opts.badgeWarn ? ' warn' : '') }, opts.badge) : null
    );
  }

  // ---------- persistencia ----------
  function save() {
    try {
      localStorage.setItem(STORE_KEY, state ? JSON.stringify(state) : '');
      localStorage.setItem(HIST_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
    } catch (e) { /* almacenamiento no disponible */ }
  }
  function load() {
    try {
      const s = localStorage.getItem(STORE_KEY);
      state = s ? JSON.parse(s) : null;
      const h = localStorage.getItem(HIST_KEY);
      history = h ? JSON.parse(h) : [];
    } catch (e) { state = null; history = []; }
  }

  // Aplica una acción de la lógica guardando historial
  function apply(fn) {
    let res;
    try { res = fn(state); } catch (e) { toast(e.message); return null; }
    history.push(state);
    if (history.length > MAX_HISTORY) history.shift();
    state = res.state;
    save();
    render();
    return res;
  }

  // ---------- modal y toast ----------
  let modalOnClose = null;
  function openModal(title, body, opts) {
    opts = opts || {};
    $('modal-title').textContent = title;
    const b = $('modal-body');
    b.innerHTML = '';
    b.append(body);
    $('modal-close').classList.toggle('hidden', opts.closable === false);
    modalOnClose = opts.onClose || null;
    $('modal').classList.remove('hidden');
    $('modal').querySelector('.modal-box').scrollTop = 0;
  }
  function closeModal() {
    $('modal').classList.add('hidden');
    const cb = modalOnClose; modalOnClose = null;
    if (cb) cb();
  }
  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 3500);
  }
  window.FWUI = { openModal, closeModal, toast, el };

  // Selector de cartas agrupado por familias
  function pickCard(title, cards, opts) {
    opts = opts || {};
    const body = el('div');
    if (opts.intro) body.append(el('p', { class: 'hint' }, opts.intro));
    if (opts.top && opts.top.length) {
      body.append(el('div', { class: 'subtitle' }, opts.topTitle || 'Recomendadas'));
      body.append(el('div', { class: 'fam-row-cards', style: 'margin-bottom:12px' },
        opts.top.map(c => cardEl(c, { size: 'small', onClick: () => { closeModal(); opts.onPick(c); }, badge: opts.badge && opts.badge(c), badgeWarn: opts.badgeWarn && opts.badgeWarn(c) }))));
    }
    L.FAMILIES.forEach(f => {
      const fc = cards.filter(c => L.famOf(c) === f);
      if (!fc.length) return;
      body.append(el('div', { class: 'fam-row' },
        el('div', { class: 'fam-row-title' }, L.FAMILY_NAMES[f]),
        el('div', { class: 'fam-row-cards' }, fc.map(c => cardEl(c, {
          size: 'small',
          onClick: () => { closeModal(); opts.onPick(c); },
          badge: opts.badge && opts.badge(c),
          badgeWarn: opts.badgeWarn && opts.badgeWarn(c)
        })))));
    });
    if (!cards.length) body.append(el('p', null, 'No hay cartas disponibles.'));
    openModal(title, body, { onClose: opts.onClose });
  }

  function alertsBlock(alerts) {
    if (!alerts || !alerts.length) return null;
    return el('div', null, alerts.map(a => el('div', { class: 'alert' },
      el('span', { class: 'icon' }, '🚨'),
      el('div', { class: 'txt' }, el('b', null, '¡El rival está haciendo trampas!'), a.text))));
  }
  function showCheats(alerts, then) {
    if (!alerts || !alerts.length) { if (then) then(); return; }
    const body = el('div', { class: 'cheat-big' },
      el('div', { class: 'icon' }, '🚨'),
      el('p', null, el('b', null, '¡Trampa detectada!')),
      alerts.map(a => el('p', null, a.text)),
      el('button', { class: 'btn danger big', onclick: () => closeModal() }, 'Entendido'));
    openModal('¡Cuidado!', body, { onClose: then });
  }

  // Ejecuta pasos de UI uno detrás de otro (cada paso llama a next al terminar)
  function runSteps(steps) {
    const next = () => { const f = steps.shift(); if (f) f(next); };
    next();
  }
  function infoModal(title, icon, text, next) {
    const body = el('div', { class: 'center' },
      el('div', { style: 'font-size:3rem;line-height:1' }, icon),
      el('p', { class: 'question' }, text),
      el('button', { class: 'btn primary big', onclick: () => closeModal() }, 'Aceptar'));
    openModal(title, body, { onClose: next });
  }
  function winnerModal(who, next) {
    const mine = who === 'me';
    infoModal(mine ? '¡Has ganado!' : 'Ha ganado el rival', '🏆',
      (mine ? '¡Enhorabuena! Has conseguido 4 familias y has ganado la partida.'
            : 'El rival ha conseguido 4 familias y ha ganado la partida.') +
      ' Puedes seguir jugando hasta completar todas las familias.', next);
  }
  // Pasos comunes tras una acción: trampas, avisos, robo automático del rival, ganador y robo pendiente
  function afterAction(res, extra) {
    const steps = [
      next => showCheats(res.alerts, next),
      next => { res.notes.forEach(toast); next(); }
    ].concat(extra || []);
    if (res.oppAutoDraw) steps.push(next => infoModal('El rival se queda sin cartas', '🃏',
      'Le has quitado su última carta al rival, así que roba una carta de la baraja automáticamente.', next));
    if (res.winner) steps.push(next => winnerModal(res.winner, next));
    if (res.mustDraw) steps.push(next => infoModal('Te has quedado sin cartas', '🃏',
      'El rival se ha llevado tu última carta. Roba una carta de la baraja y dime cuál es.', next));
    steps.push(() => { if (state.pendingDraw) flowMyDraw(state.pendingDrawReason); });
    runSteps(steps);
  }

  // ---------- flujos de juego ----------
  function flowMyAsk(card) {
    const body = el('div', { class: 'center' },
      el('div', { class: 'question' }, 'Le pides al rival:'),
      cardEl(card, { size: 'large' }),
      el('div', { class: 'question' }, '¿Te la ha dado?'),
      el('div', { class: 'btn-row', style: 'width:100%' },
        el('button', { class: 'btn good big', onclick: () => answerMyAsk(card, true) }, '✔ Sí, me la dio'),
        el('button', { class: 'btn danger big', onclick: () => answerMyAsk(card, false) }, '✘ No la tiene')));
    openModal('Pedir carta', body);
  }
  function answerMyAsk(card, had) {
    closeModal();
    const res = apply(s => L.myAsk(s, card, had));
    if (!res) return;
    afterAction(res);
  }

  function flowMyDraw(reason) {
    const intros = {
      miss: 'El rival no tenía la carta. Roba de la baraja y dime cuál te ha salido.',
      empty: 'Te has quedado sin cartas. Roba de la baraja y dime cuál te ha salido.'
    };
    pickCard('¿Qué carta has robado?', L.drawCandidates(state), {
      intro: intros[reason] || 'Indica la carta que has robado de la baraja.',
      onPick: c => {
        const res = apply(s => L.myDraw(s, c));
        if (res) afterAction(res);
      }
    });
  }

  function flowOppAsk() {
    const cards = L.ALL_CARDS.filter(c => !state.completed[L.famOf(c)]);
    pickCard('¿Qué carta te pide el rival?', cards, {
      badge: c => state.myHand.includes(c) ? 'La tienes' : null,
      onPick: c => {
        const res = apply(s => L.oppAsk(s, c));
        if (!res) return;
        const body = el('div', { class: 'center' },
          alertsBlock(res.alerts),
          el('div', { class: 'question' }, 'El rival te pide:'),
          cardEl(c, { size: 'large' }),
          res.gave
            ? el('div', null,
                el('div', { class: 'result-bad' }, 'Acierta: tienes esa carta'),
                el('p', null, res.alerts.length
                  ? 'Según las reglas tendrías que dársela, pero el rival ha hecho trampa. Si no se la das, pulsa «Deshacer».'
                  : 'Dásela al rival. Vuelve a pedir él.'))
            : el('div', null,
                el('div', { class: 'result-good' }, 'Falla: no tienes esa carta'),
                el('p', null, L.deckCount(res.state) < L.deckCount(history[history.length - 1])
                  ? 'Dile que no la tienes. El rival roba de la baraja y te toca a ti.'
                  : 'Dile que no la tienes (la baraja está vacía). Te toca a ti.')),
          el('button', { class: 'btn primary big', onclick: () => closeModal() }, 'Continuar'));
        openModal(res.alerts.length ? '🚨 ¡Trampa detectada!' : (res.gave ? 'El rival acierta' : 'El rival falla'), body,
          { onClose: () => afterAction(Object.assign({}, res, { alerts: [] })) });
      }
    });
  }

  function flowOppComplete() {
    const fams = L.FAMILIES.filter(f => !state.completed[f]);
    const body = el('div', null,
      el('p', null, '¿Qué familia ha completado el rival?'),
      el('div', { class: 'btn-row' }, fams.map(f => el('button', {
        class: 'btn', onclick: () => {
          closeModal();
          const res = apply(s => L.oppComplete(s, f));
          if (res) afterAction(res);
        }
      }, L.FAMILY_NAMES[f]))));
    openModal('El rival baja una familia', body);
  }

  function flowMore() {
    const body = el('div', { class: 'btn-row', style: 'flex-direction:column' },
      el('button', { class: 'btn', onclick: () => { closeModal(); flowMyDraw(null); } }, 'He robado una carta sin pedir'),
      el('button', { class: 'btn', onclick: () => { closeModal(); apply(s => L.oppDraw(s)); } }, 'El rival roba una carta sin pedir'),
      el('button', { class: 'btn', onclick: () => { closeModal(); flowOppComplete(); } }, 'El rival baja una familia completa'),
      el('button', { class: 'btn', onclick: () => { closeModal(); flowSetOpp(); } }, 'Corregir nº de cartas del rival'),
      el('button', { class: 'btn', onclick: () => { closeModal(); apply(s => { const r = { state: JSON.parse(JSON.stringify(s)), alerts: [], notes: [] }; r.state.turn = s.turn === 'me' ? 'opp' : 'me'; return r; }); } }, 'Cambiar de quién es el turno'));
    openModal('Más acciones', body);
  }

  function flowSetOpp() {
    const input = el('input', { type: 'number', min: '0', max: '42', value: String(state.oppCount), style: 'font-size:1.2rem;padding:8px;width:100px' });
    const body = el('div', { class: 'center' },
      el('p', null, '¿Cuántas cartas tiene el rival en la mano?'), input,
      el('button', { class: 'btn primary', onclick: () => { closeModal(); apply(s => L.setOppCount(s, parseInt(input.value, 10) || 0)); } }, 'Guardar'));
    openModal('Cartas del rival', body);
  }

  // ---------- render ----------
  function render() {
    $('setup').classList.toggle('hidden', !!state);
    $('game').classList.toggle('hidden', !state);
    $('btn-undo').disabled = !history.length;
    if (!state) renderSetup(); else renderGame();
  }

  function renderSetup() {
    $('setup-count').textContent = setupSel.length;
    $('btn-start').disabled = setupSel.length !== L.HAND_SIZE;
    const grid = $('setup-grid');
    grid.innerHTML = '';
    const full = setupSel.length >= L.HAND_SIZE;
    L.FAMILIES.forEach(f => {
      grid.append(el('div', { class: 'fam-row' },
        el('div', { class: 'fam-row-title' }, L.FAMILY_NAMES[f]),
        el('div', { class: 'fam-row-cards' }, L.famCards(f).map(c => {
          const sel = setupSel.includes(c);
          return cardEl(c, {
            size: 'small', selected: sel, dim: full && !sel, badge: sel ? '✔' : null,
            onClick: () => {
              if (sel) setupSel = setupSel.filter(x => x !== c);
              else if (!full) setupSel.push(c);
              else toast('Ya tienes 6 cartas. Quita una para cambiarla.');
              renderSetup();
            }
          });
        }))));
    });
  }

  function renderGame() {
    const s = state;
    const mineDone = Object.values(s.completed).filter(v => v === 'me').length;
    const oppDone = Object.values(s.completed).filter(v => v === 'opp').length;

    // estado
    $('status').innerHTML = '';
    $('status').append(
      el('span', { class: 'chip' + (s.turn === 'me' && s.phase === 'play' ? ' turn-me' : '') }, 'Turno: ', el('b', null, s.phase === 'end' ? '—' : (s.turn === 'me' ? 'Tú' : 'Rival'))),
      el('span', { class: 'chip' }, 'Baraja: ', el('b', null, String(L.deckCount(s)))),
      el('span', { class: 'chip' }, 'Rival: ', el('b', null, s.oppCount + (s.oppCount === 1 ? ' carta' : ' cartas'))),
      el('span', { class: 'chip' }, 'Familias: ', el('b', null, 'Tú ' + mineDone + ' – ' + oppDone + ' Rival'))
    );

    // alertas de trampa
    const al = $('alerts');
    al.innerHTML = '';
    s.alerts.slice(0, 3).forEach((a, i) => al.append(el('div', { class: 'alert' },
      el('span', { class: 'icon' }, '🚨'),
      el('div', { class: 'txt' }, el('b', null, 'Trampa detectada'), a.text),
      el('button', { title: 'Ocultar', onclick: () => { state.alerts.splice(i, 1); save(); renderGame(); } }, '✕'))));

    renderTurnPanel();

    // mi mano
    $('hand-count').textContent = '(' + s.myHand.length + ' cartas)';
    const hand = $('hand');
    hand.innerHTML = '';
    if (!s.myHand.length) hand.append(el('p', { class: 'muted' }, 'No tienes cartas en la mano.'));
    L.FAMILIES.forEach(f => {
      const fc = s.myHand.filter(c => L.famOf(c) === f);
      if (!fc.length) return;
      fc.sort((a, b) => L.MEMBERS.indexOf(L.memOf(a)) - L.MEMBERS.indexOf(L.memOf(b)));
      hand.append(el('div', { class: 'fam-row' },
        el('div', { class: 'fam-row-title' }, L.FAMILY_NAMES[f], el('span', { class: 'progress' }, fc.length + '/6')),
        el('div', { class: 'fam-row-cards' }, fc.map(c => cardEl(c)))));
    });

    // info del rival
    const oi = $('opp-info');
    oi.innerHTML = '';
    const has = L.knownHas(s), not = L.knownNot(s);
    const evid = Object.keys(s.oppFamEvidence).filter(f => s.oppFamEvidence[f] && !s.completed[f]);
    oi.append(
      el('div', { class: 'subtitle' }, 'Cartas que seguro tiene'),
      has.length ? el('div', { class: 'fam-row-cards' }, has.map(c => cardEl(c, { size: 'small', badge: '100%' }))) : el('p', { class: 'muted' }, 'Ninguna conocida.'),
      el('div', { class: 'subtitle' }, 'Cartas que seguro NO tiene (no ha robado desde que lo dijo)'),
      not.length ? el('div', { class: 'tag-list' }, not.map(c => el('span', { class: 'tag no' }, L.cardName(c)))) : el('p', { class: 'muted' }, '—'),
      el('div', { class: 'subtitle' }, 'Familias de las que tiene alguna carta (por lo que pide)'),
      evid.length ? el('div', { class: 'tag-list' }, evid.map(f => el('span', { class: 'tag yes' }, L.FAMILY_NAMES[f]))) : el('p', { class: 'muted' }, '—')
    );

    // familias completadas
    const cp = $('completed');
    cp.innerHTML = '';
    const done = L.FAMILIES.filter(f => s.completed[f]);
    cp.append(done.length
      ? el('div', { class: 'tag-list' }, done.map(f => el('span', { class: 'tag ' + (s.completed[f] === 'me' ? 'yes' : 'no') , style: 'text-decoration:none' },
          (s.completed[f] === 'me' ? '🏆 Tú: ' : 'Rival: ') + L.FAMILY_NAMES[f])))
      : el('p', { class: 'muted' }, 'Todavía ninguna.'));

    // registro
    const log = $('log');
    log.innerHTML = '';
    s.log.forEach(e => log.append(el('li', { class: e.kind }, e.text)));
  }

  function renderTurnPanel() {
    const s = state;
    const p = $('panel-turn');
    p.innerHTML = '';

    if (s.phase === 'end') {
      const me = Object.values(s.completed).filter(v => v === 'me').length;
      const opp = L.FAMILIES.length - me;
      p.append(el('div', { class: 'turn-banner' }, me > opp ? '🏆 ¡Has ganado!' : me < opp ? 'Ha ganado el rival' : 'Empate'),
        el('p', null, 'Tú ' + me + ' familias · Rival ' + opp + ' familias.'),
        el('button', { class: 'btn primary big', onclick: newGameConfirm }, 'Nueva partida'));
      return;
    }

    if (s.pendingDraw) {
      p.append(el('div', { class: 'turn-banner' }, s.pendingDrawReason === 'empty' ? 'Te has quedado sin cartas: roba una' : 'Has fallado: roba una carta'),
        el('button', { class: 'btn primary big', onclick: () => flowMyDraw(s.pendingDrawReason) }, '¿Qué carta has robado?'));
      return;
    }

    const sug = L.suggestions(s);
    const myTurn = s.turn === 'me';
    if (s.winner) p.append(el('div', { class: 'hint' }, s.winner === 'me' ? '🏆 Has ganado la partida (4 familias). Puedes seguir jugando hasta el final.' : '🏆 El rival ha ganado la partida (4 familias). Puedes seguir jugando hasta el final.'));
    p.append(el('div', { class: 'turn-banner' }, myTurn ? '👉 Tu turno: pide una carta' : '⏳ Turno del rival'));

    if (!s.myHand.length) {
      p.append(el('p', { class: 'hint' }, 'No tienes cartas. Si las reglas lo permiten, roba de la baraja.'),
        el('button', { class: 'btn primary', onclick: () => flowMyDraw(null) }, 'He robado una carta'));
    } else if (sug.length) {
      const top = sug.slice(0, 4);
      p.append(el('div', { class: 'subtitle' }, myTurn ? 'Te sugiero pedir:' : 'Cuando te toque, te sugiero pedir:'),
        el('div', { class: 'suggest-list' }, top.map((x, i) => el('div', { class: 'suggest' + (i === 0 ? ' best' : '') },
          cardEl(x.card, { size: 'small' }),
          el('div', { class: 'prob' }, pct(x.prob)),
          el('div', { class: 'why' }, x.reason + ' Tienes ' + x.mine + '/6.'),
          el('button', { class: 'btn ' + (i === 0 ? 'primary' : ''), onclick: () => flowMyAsk(x.card) }, 'Pedir')))));
      const best = sug[0];
      if (best.prob >= 1) p.append(el('div', { class: 'hint' }, '✅ Pide ' + L.cardName(best.card) + ': el rival la tiene seguro.'));
    }

    const askOther = el('button', { class: 'btn', onclick: () => {
      const cands = sug.map(x => x.card);
      pickCard('¿Qué carta pides?', cands, {
        intro: 'Solo puedes pedir cartas de familias de las que tienes alguna. El porcentaje es la probabilidad de que la tenga el rival.',
        badge: c => pct(L.probInOpp(state, c)),
        onPick: flowMyAsk
      });
    } }, 'Pedir otra carta…');
    const oppBtn = el('button', { class: 'btn ' + (myTurn ? '' : 'primary big'), onclick: flowOppAsk }, '¿Qué te pide el rival?');
    p.append(el('div', { class: 'btn-row' },
      myTurn ? askOther : oppBtn,
      myTurn ? oppBtn : askOther,
      el('button', { class: 'btn', onclick: flowOppComplete }, 'Rival baja familia'),
      el('button', { class: 'btn', onclick: flowMore }, 'Más…')));
  }

  function newGameConfirm() {
    if (!state || state.phase === 'end') return startOver();
    const body = el('div', { class: 'center' },
      el('p', null, '¿Seguro que quieres empezar otra partida? Se perderá la actual.'),
      el('div', { class: 'btn-row', style: 'width:100%' },
        el('button', { class: 'btn danger', onclick: () => { closeModal(); startOver(); } }, 'Sí, nueva partida'),
        el('button', { class: 'btn', onclick: closeModal }, 'Cancelar')));
    openModal('Nueva partida', body);
  }
  function startOver() {
    if (state) history.push(state);
    state = null;
    setupSel = [];
    save();
    render();
    window.scrollTo(0, 0);
  }

  // ---------- eventos ----------
  $('btn-start').addEventListener('click', () => {
    const starter = document.querySelector('input[name=starter]:checked').value;
    try {
      history.push(null);
      state = L.newGame(setupSel, starter);
      save();
      render();
      window.scrollTo(0, 0);
    } catch (e) { history.pop(); toast(e.message); }
  });
  $('btn-undo').addEventListener('click', () => {
    if (!history.length) return;
    state = history.pop();
    if (!state) setupSel = [];
    save();
    render();
    toast('Acción deshecha');
  });
  $('btn-new').addEventListener('click', newGameConfirm);
  $('btn-update').addEventListener('click', () => window.FWUpdater && window.FWUpdater.check(true));
  $('modal-close').addEventListener('click', closeModal);
  $('modal').addEventListener('click', e => { if (e.target.id === 'modal' && !$('modal-close').classList.contains('hidden')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('modal').classList.contains('hidden') && !$('modal-close').classList.contains('hidden')) closeModal(); });

  $('version').textContent = 'v' + (window.FW_VERSION || '');
  load();
  render();
  setTimeout(() => window.FWUpdater && window.FWUpdater.check(false), 1500);
})();
