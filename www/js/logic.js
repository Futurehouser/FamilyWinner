// FamilyWinner - lógica del juego de las familias (sin dependencias de UI).
// Funciona en navegador (window.FWLogic) y en Node (module.exports) para tests.
(function (root) {
  'use strict';

  const FAMILIES = ['arabe', 'bantu', 'chino', 'esquimal', 'indio', 'mexicano', 'tiroles'];
  const MEMBERS = ['abuelo', 'abuela', 'padre', 'madre', 'hijo', 'hija'];
  const FAMILY_NAMES = {
    arabe: 'Árabe', bantu: 'Bantú', chino: 'Chino', esquimal: 'Esquimal',
    indio: 'Indio', mexicano: 'Mexicano', tiroles: 'Tirolés'
  };
  const MEMBER_NAMES = {
    abuelo: 'Abuelo', abuela: 'Abuela', padre: 'Padre', madre: 'Madre', hijo: 'Hijo', hija: 'Hija'
  };
  const TOTAL = FAMILIES.length * MEMBERS.length; // 42
  const HAND_SIZE = 6;

  const ALL_CARDS = [];
  FAMILIES.forEach(f => MEMBERS.forEach(m => ALL_CARDS.push(f + '_' + m)));

  const famOf = c => c.split('_')[0];
  const memOf = c => c.split('_')[1];
  const cardName = c => FAMILY_NAMES[famOf(c)] + ' · ' + MEMBER_NAMES[memOf(c)];
  const famCards = f => MEMBERS.map(m => f + '_' + m);
  const clone = o => JSON.parse(JSON.stringify(o));

  function newGame(hand, starter) {
    if (!Array.isArray(hand) || hand.length !== HAND_SIZE) throw new Error('La mano debe tener ' + HAND_SIZE + ' cartas');
    const s = {
      phase: 'play',
      myHand: hand.slice(),
      oppCount: HAND_SIZE,
      opp: {},            // carta -> 'has' (seguro que la tiene) | 'not' (seguro que no la tiene)
      oppFamEvidence: {}, // familia -> true si el rival pidió de esa familia (debe tener alguna)
      completed: {},      // familia -> 'me' | 'opp'
      turn: starter === 'opp' ? 'opp' : 'me',
      pendingDraw: false, // tengo que indicar qué carta robo
      pendingDrawReason: null, // 'miss' (he fallado) | 'empty' (me he quedado sin cartas)
      winner: null,       // primer jugador en llegar a 4 familias ('me' | 'opp')
      log: [],
      alerts: []
    };
    addLog(s, 'Partida nueva. Tu mano: ' + hand.map(cardName).join(', ') + '.', 'info');
    const res = { state: s, alerts: [], notes: [] };
    checkMyCompleted(res);
    return s;
  }

  // ---------- consultas ----------
  const inMyHand = (s, c) => s.myHand.includes(c);
  const isCompleted = (s, f) => !!s.completed[f];
  const completedCount = s => Object.keys(s.completed).length;
  const deckCount = s => TOTAL - s.myHand.length - s.oppCount - HAND_SIZE * completedCount(s);
  const myFamCount = (s, f) => s.myHand.filter(c => famOf(c) === f).length;
  const knownHas = s => Object.keys(s.opp).filter(c => s.opp[c] === 'has');
  const knownNot = s => Object.keys(s.opp).filter(c => s.opp[c] === 'not');

  // Cartas cuya ubicación desconozco (pueden estar en la mano del rival o en la baraja)
  function unknownCards(s) {
    return ALL_CARDS.filter(c => !inMyHand(s, c) && !isCompleted(s, famOf(c)) && !s.opp[c]);
  }
  const unknownSlots = s => s.oppCount - knownHas(s).length;

  function possibleInOpp(s, c) {
    if (inMyHand(s, c) || isCompleted(s, famOf(c))) return false;
    return s.opp[c] !== 'not';
  }
  const famPossibleInOpp = (s, f) => famCards(f).some(c => possibleInOpp(s, c));

  function probInOpp(s, c) {
    if (inMyHand(s, c) || isCompleted(s, famOf(c))) return 0;
    if (s.opp[c] === 'has') return 1;
    if (s.opp[c] === 'not') return 0;
    const unk = unknownCards(s).length;
    const slots = unknownSlots(s);
    if (unk <= 0 || slots <= 0) return 0;
    let p = Math.min(1, slots / unk);
    const f = famOf(c);
    // Si el rival pidió de esta familia y no le conozco ninguna, tiene al menos una de las desconocidas
    if (s.oppFamEvidence[f] && !famCards(f).some(x => s.opp[x] === 'has')) {
      const k = famCards(f).filter(x => !inMyHand(s, x) && !s.opp[x]).length;
      if (k > 0 && p < 1) p = Math.min(1, p / (1 - Math.pow(1 - p, k)));
    }
    return p;
  }

  // Sugerencias de qué carta pedir, ordenadas de mejor a peor
  function suggestions(s) {
    const out = [];
    FAMILIES.forEach(f => {
      if (isCompleted(s, f)) return;
      const mine = myFamCount(s, f);
      if (mine === 0) return; // solo se puede pedir de familias que tienes
      famCards(f).forEach(c => {
        if (inMyHand(s, c)) return;
        const p = probInOpp(s, c);
        let reason;
        if (s.opp[c] === 'has') reason = 'Seguro: el rival la tiene (se la diste tú).';
        else if (s.opp[c] === 'not') reason = 'El rival dijo que no la tenía y no ha robado desde entonces.';
        else if (s.oppFamEvidence[f]) reason = 'El rival pidió cartas de esta familia, así que tiene alguna.';
        else reason = 'Probabilidad según las cartas que quedan.';
        out.push({
          card: c, prob: p, mine,
          missing: HAND_SIZE - mine,
          score: p * (1 + 0.15 * mine) + (p >= 1 ? 1 : 0),
          reason
        });
      });
    });
    out.sort((a, b) => b.score - a.score || b.mine - a.mine);
    return out;
  }

  // Cartas que puedo haber robado de la baraja
  function drawCandidates(s) {
    return ALL_CARDS.filter(c => !inMyHand(s, c) && !isCompleted(s, famOf(c)) && s.opp[c] !== 'has');
  }

  // ---------- helpers de mutación ----------
  function addLog(s, text, kind) {
    s.log.unshift({ text, kind: kind || 'info', ts: Date.now() });
    if (s.log.length > 300) s.log.length = 300;
  }
  function cheat(res, text) {
    const a = { text, ts: Date.now() };
    res.state.alerts.unshift(a);
    res.alerts.push(a);
    addLog(res.state, '⚠ TRAMPA: ' + text, 'cheat');
  }
  function checkConsistency(res) {
    const s = res.state;
    if (unknownSlots(s) > unknownCards(s).length) {
      cheat(res, 'Las cuentas no cuadran: el rival tiene ' + s.oppCount + ' cartas pero ha negado tener cartas que solo podían estar en su mano.');
    }
  }
  function checkMyCompleted(res) {
    const s = res.state;
    FAMILIES.forEach(f => {
      if (!isCompleted(s, f) && myFamCount(s, f) === MEMBERS.length) {
        s.myHand = s.myHand.filter(c => famOf(c) !== f);
        s.completed[f] = 'me';
        famCards(f).forEach(c => delete s.opp[c]);
        delete s.oppFamEvidence[f];
        addLog(s, '🎉 ¡Has completado la familia ' + FAMILY_NAMES[f] + '!', 'good');
        res.notes.push('¡Familia ' + FAMILY_NAMES[f] + ' completada!');
      }
    });
    checkWinner(res);
    checkEnd(s);
  }
  // Con 4 de las 7 familias la partida ya está ganada (aunque se puede seguir jugando)
  const WIN_FAMILIES = 4;
  function checkWinner(res) {
    const s = res.state;
    if (s.winner) return;
    ['me', 'opp'].forEach(who => {
      if (s.winner) return;
      const n = Object.values(s.completed).filter(v => v === who).length;
      if (n >= WIN_FAMILIES) {
        s.winner = who;
        res.winner = who;
        addLog(s, who === 'me' ? '🏆 ¡Tienes ' + n + ' familias: has ganado la partida!' : '🏆 El rival tiene ' + n + ' familias: ha ganado la partida.', who === 'me' ? 'good' : 'bad');
      }
    });
  }
  function checkEnd(s) {
    if (completedCount(s) === FAMILIES.length) {
      s.phase = 'end';
      const me = Object.values(s.completed).filter(v => v === 'me').length;
      addLog(s, 'Fin de la partida: tú ' + me + ' familias, rival ' + (FAMILIES.length - me) + '.', 'info');
    }
  }
  function begin(state) { return { state: clone(state), alerts: [], notes: [] }; }

  // ---------- acciones ----------

  // Yo pido una carta. had = true si el rival me la dio.
  function myAsk(state, card, had) {
    const res = begin(state);
    const s = res.state;
    const f = famOf(card);
    if (inMyHand(s, card) || isCompleted(s, f)) throw new Error('Esa carta no se puede pedir');
    if (had) {
      if (s.oppCount <= 0) cheat(res, 'El rival dice tener ' + cardName(card) + ' pero no le quedan cartas.');
      else if (s.opp[card] === 'not') cheat(res, 'El rival te ha dado ' + cardName(card) + ', pero antes dijo que no la tenía y no ha robado desde entonces.');
      s.myHand.push(card);
      s.oppCount = Math.max(0, s.oppCount - 1);
      delete s.opp[card];
      delete s.oppFamEvidence[f]; // ha perdido una carta de la familia: la evidencia ya no es segura
      addLog(s, 'Pides ' + cardName(card) + ' → el rival te la da. Repites turno.', 'good');
      s.turn = 'me';
      checkMyCompleted(res);
      // Si le he quitado su última carta, el rival roba una automáticamente
      if (s.phase === 'play' && s.oppCount === 0 && deckCount(s) > 0) {
        s.oppCount = 1;
        knownNot(s).forEach(c => delete s.opp[c]);
        res.oppAutoDraw = true;
        addLog(s, 'El rival se ha quedado sin cartas y roba una de la baraja.', 'info');
      }
    } else {
      if (s.opp[card] === 'has') {
        cheat(res, 'El rival dice que no tiene ' + cardName(card) + ', pero se la diste tú y no la ha devuelto.');
      } else {
        s.opp[card] = 'not';
        if (s.oppFamEvidence[f] && !famPossibleInOpp(s, f)) {
          cheat(res, 'El rival pidió una carta de la familia ' + FAMILY_NAMES[f] + ' (luego tenía alguna), pero ahora niega tener las que quedan.');
          delete s.oppFamEvidence[f];
        }
      }
      addLog(s, 'Pides ' + cardName(card) + ' → el rival no la tiene.', 'bad');
      checkConsistency(res);
      if (deckCount(s) > 0) {
        s.pendingDraw = true;
        s.pendingDrawReason = 'miss';
      } else {
        addLog(s, 'La baraja está vacía: no robas. Turno del rival.', 'info');
        s.turn = 'opp';
      }
    }
    return res;
  }

  // Indico qué carta he robado de la baraja.
  function myDraw(state, card) {
    const res = begin(state);
    const s = res.state;
    if (!drawCandidates(s).includes(card)) throw new Error('Esa carta no puede estar en la baraja');
    if (deckCount(s) <= 0) throw new Error('La baraja está vacía');
    s.myHand.push(card);
    delete s.opp[card];
    const wasPending = s.pendingDraw;
    s.pendingDraw = false;
    s.pendingDrawReason = null;
    addLog(s, 'Robas ' + cardName(card) + ' de la baraja.', 'info');
    if (wasPending) s.turn = 'opp';
    checkMyCompleted(res);
    return res;
  }

  // El rival me pide una carta. Devuelve gave=true si la tenía (y se la he dado).
  function oppAsk(state, card) {
    const res = begin(state);
    const s = res.state;
    const f = famOf(card);
    if (isCompleted(s, f)) throw new Error('Esa familia ya está completada');

    // Detección de trampas: para pedir, el rival debe tener alguna carta de esa familia.
    if (s.oppCount <= 0) {
      cheat(res, 'El rival te pide ' + cardName(card) + ' pero no tiene cartas en la mano.');
    } else if (!famPossibleInOpp(s, f)) {
      const mine = famCards(f).filter(c => inMyHand(s, c));
      const denied = famCards(f).filter(c => s.opp[c] === 'not');
      let why = 'El rival te pide ' + cardName(card) + ', pero es imposible que tenga ninguna carta de la familia ' + FAMILY_NAMES[f] + '.';
      if (mine.length) why += ' Tú tienes ' + mine.length + (mine.length === 1 ? ' carta' : ' cartas') + ' de esa familia.';
      if (denied.length) why += ' Te dijo que no tenía: ' + denied.map(c => MEMBER_NAMES[memOf(c)]).join(', ') + ' (y no ha robado desde entonces). Te mintió.';
      cheat(res, why);
    }
    if (s.opp[card] === 'has') {
      cheat(res, 'El rival te pide ' + cardName(card) + ', una carta que ya tiene (se la diste tú).');
    }

    let gave = false;
    if (inMyHand(s, card)) {
      gave = true;
      s.myHand = s.myHand.filter(c => c !== card);
      s.opp[card] = 'has';
      s.oppCount += 1;
      s.oppFamEvidence[f] = true;
      addLog(s, 'El rival te pide ' + cardName(card) + ' → la tienes y se la das. Repite turno.', 'bad');
      s.turn = 'opp';
      // Si era mi última carta, tengo que robar una automáticamente
      if (s.myHand.length === 0 && deckCount(s) > 0) {
        s.pendingDraw = true;
        s.pendingDrawReason = 'empty';
        res.mustDraw = true;
        addLog(s, 'Te has quedado sin cartas: robas una de la baraja.', 'info');
      }
    } else {
      s.oppFamEvidence[f] = true;
      if (s.opp[card] !== 'has') delete s.opp[card];
      addLog(s, 'El rival te pide ' + cardName(card) + ' → no la tienes. El rival roba.', 'good');
      if (deckCount(s) > 0) {
        s.oppCount += 1;
        // ha robado una carta desconocida: lo que negó tener puede haberlo robado ahora
        knownNot(s).forEach(c => delete s.opp[c]);
      }
      s.turn = 'me';
    }
    checkConsistency(res);
    res.gave = gave;
    return res;
  }

  // El rival roba sin pedir (por si las reglas de la mesa lo permiten).
  function oppDraw(state) {
    const res = begin(state);
    const s = res.state;
    if (deckCount(s) <= 0) throw new Error('La baraja está vacía');
    s.oppCount += 1;
    knownNot(s).forEach(c => delete s.opp[c]);
    addLog(s, 'El rival roba una carta.', 'info');
    return res;
  }

  // El rival baja una familia completa.
  function oppComplete(state, f) {
    const res = begin(state);
    const s = res.state;
    if (isCompleted(s, f)) throw new Error('Esa familia ya está completada');
    const mine = famCards(f).filter(c => inMyHand(s, c));
    if (mine.length) throw new Error('No puede: tú tienes ' + mine.map(cardName).join(', ') + '. Revisa tu mano.');
    const denied = famCards(f).filter(c => s.opp[c] === 'not');
    if (denied.length) cheat(res, 'El rival baja la familia ' + FAMILY_NAMES[f] + ', pero te dijo que no tenía ' + denied.map(cardName).join(', ') + ' y no ha robado desde entonces.');
    if (s.oppCount < MEMBERS.length) cheat(res, 'El rival baja la familia ' + FAMILY_NAMES[f] + ' con solo ' + s.oppCount + ' cartas en la mano.');
    s.completed[f] = 'opp';
    s.oppCount = Math.max(0, s.oppCount - MEMBERS.length);
    famCards(f).forEach(c => delete s.opp[c]);
    delete s.oppFamEvidence[f];
    addLog(s, 'El rival completa la familia ' + FAMILY_NAMES[f] + '.', 'bad');
    checkWinner(res);
    checkEnd(s);
    return res;
  }

  // Corrige el número de cartas del rival (por si se escapa algo).
  function setOppCount(state, n) {
    const res = begin(state);
    res.state.oppCount = Math.max(0, n | 0);
    addLog(res.state, 'Ajustas las cartas del rival a ' + res.state.oppCount + '.', 'info');
    return res;
  }

  const api = {
    FAMILIES, MEMBERS, FAMILY_NAMES, MEMBER_NAMES, ALL_CARDS, TOTAL, HAND_SIZE,
    famOf, memOf, cardName, famCards,
    newGame, deckCount, myFamCount, knownHas, knownNot, unknownCards, probInOpp,
    famPossibleInOpp, suggestions, drawCandidates, completedCount,
    myAsk, myDraw, oppAsk, oppDraw, oppComplete, setOppCount
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FWLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
