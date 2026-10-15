// Tests de la lógica del juego: node scripts/test-logic.js
const assert = require('assert');
const L = require('../www/js/logic.js');

const HAND = ['bantu_abuelo', 'bantu_abuela', 'bantu_padre', 'bantu_madre', 'bantu_hijo', 'chino_hijo'];

// 1. Trampa: tengo 5 bantú, pido la 6ª, dice que no, robo y luego me pide un bantú
{
  let s = L.newGame(HAND, 'me');
  assert.strictEqual(L.deckCount(s), 30);
  s = L.myAsk(s, 'bantu_hija', false).state;
  assert.ok(s.pendingDraw);
  s = L.myDraw(s, 'arabe_padre').state;
  assert.strictEqual(s.turn, 'opp');
  const r = L.oppAsk(s, 'bantu_padre');
  assert.strictEqual(r.alerts.length, 1, 'debe detectar la trampa');
  assert.ok(r.gave);
}

// 2. Sin trampa: el rival roba entre medias, así que pudo conseguir la bantú hija
{
  let s = L.newGame(HAND, 'me');
  s = L.myAsk(s, 'bantu_hija', false).state;
  s = L.myDraw(s, 'arabe_padre').state;
  s = L.oppAsk(s, 'indio_hijo').state; // falla y roba
  s = L.myAsk(s, 'chino_padre', false).state;
  s = L.myDraw(s, 'arabe_hijo').state;
  const r = L.oppAsk(s, 'bantu_padre');
  assert.strictEqual(r.alerts.length, 0, 'no debe haber falso positivo');
  // ahora sé que tiene bantu_padre: la sugerencia principal debe ser recuperarla
  assert.strictEqual(L.suggestions(r.state)[0].card, 'bantu_padre');
  assert.strictEqual(L.suggestions(r.state)[0].prob, 1);
}

// 3. Trampa: dice que no tiene una carta que yo le di
{
  let s = L.newGame(HAND, 'opp');
  s = L.oppAsk(s, 'chino_hijo').state; // se la doy
  const r = L.myAsk(s, 'chino_hijo', false);
  assert.strictEqual(r.alerts.length, 1);
}

// 4. Completar familia
{
  let s = L.newGame(HAND, 'me');
  s = L.myAsk(s, 'bantu_hija', true).state;
  assert.strictEqual(s.completed.bantu, 'me');
  assert.strictEqual(s.myHand.length, 1);
  assert.strictEqual(s.oppCount, 5);
  assert.strictEqual(L.deckCount(s), 30);
}

// 5. Rival baja familia tras negar una carta sin robar
{
  let s = L.newGame(['chino_hijo', 'arabe_padre', 'arabe_madre', 'indio_hijo', 'indio_hija', 'esquimal_hijo'], 'me');
  s = L.myAsk(s, 'tiroles_padre', false).state;
  s = L.myDraw(s, 'mexicano_hijo').state;
  const r = L.oppComplete(s, 'tiroles');
  assert.strictEqual(r.alerts.length, 1, 'negó tener tiroles_padre');
  assert.strictEqual(r.state.oppCount, 0);
  assert.throws(() => L.oppComplete(s, 'chino')); // tengo chino_hijo
}

console.log('Todos los tests de lógica han pasado ✔');
