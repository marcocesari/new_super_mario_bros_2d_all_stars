// native-gamepad-bridge.js
// ------------------------------------------------------------------
// Ponte fra un'app nativa iOS contenitore e un gioco p5.js che usa la
// Web Gamepad API (navigator.getGamepads()).
//
// Perché esiste: su iOS e iPadOS molti gamepad Bluetooth (incluso il
// GameSir G8) non vengono propagati al webview, anche se il sistema li
// vede via GameController framework. Una app Swift contenitore può
// leggerli con GCController, serializzarli in JSON e spingerli qui via
// webView.evaluateJavaScript(...). Questo script "finge" un gamepad
// standard per il codice del gioco, che non deve sapere nulla.
//
// Contratto lato nativo:
//   - Prima del caricamento della pagina iniettare window.__p5NativeHost = true
//     (via WKUserScript atDocumentStart), così il ponte si attiva.
//   - Circa a 60Hz chiamare window.__nativeGamepadUpdate({ buttons, axes })
//     dove buttons è [{p: bool, v: number}] (0..16 indici standard) e
//     axes è un array di float (0..3 indici standard).
//   - All'arrivo/partenza del controller chiamare
//     window.__nativeGamepadConnection(true/false).
//
// Fuori da un host nativo questo file è un NO-OP: la versione web del
// gioco continua a usare navigator.getGamepads() originale.
// ------------------------------------------------------------------

(function () {
  'use strict';

  var LOG_PREFIX = '[native-gamepad-bridge]';

  // Rileva se siamo dentro l'app iOS contenitore. I modi sono due:
  //   1) Il bootstrap nativo ha iniettato __p5NativeHost via WKUserScript.
  //   2) Siamo in un WKWebView con messageHandlers disponibili.
  var isNativeHost =
    (typeof window.__p5NativeHost !== 'undefined' && window.__p5NativeHost === true) ||
    (typeof window.webkit !== 'undefined' &&
      window.webkit &&
      window.webkit.messageHandlers);

  if (!isNativeHost) {
    // Browser normale: non tocchiamo nulla. Il gioco userà
    // navigator.getGamepads() come sempre.
    return;
  }

  // ---- Stato interno, popolato da Swift ----
  var state = {
    connected: false,
    timestamp: 0,
    buttons: [], // array di {p: bool, v: number}
    axes: [],    // array di float
  };

  // Costruisce un oggetto "Gamepad" sintetico compatibile con la
  // struttura che il gioco (e in generale la Web Gamepad API) si aspetta.
  function emptyButton() {
    return { pressed: false, touched: false, value: 0 };
  }

  function buildSyntheticGamepad() {
    // 17 bottoni = mapping standard esteso (A,B,X,Y,L1,R1,L2,R2,
    // Select,Start,L3,R3,Up,Down,Left,Right,Home).
    var buttons = new Array(17);
    for (var i = 0; i < 17; i++) {
      var b = state.buttons && state.buttons[i];
      if (b) {
        var pressed = !!b.p;
        var value = typeof b.v === 'number' ? b.v : (pressed ? 1 : 0);
        buttons[i] = { pressed: pressed, touched: pressed, value: value };
      } else {
        buttons[i] = emptyButton();
      }
    }

    // 4 assi = left stick X/Y + right stick X/Y. Se il nativo invia meno,
    // riempiamo a zero (innocuo per readGamepadAxisX del gioco).
    var axes = [0, 0, 0, 0];
    if (state.axes && state.axes.length) {
      for (var j = 0; j < Math.min(4, state.axes.length); j++) {
        var v = state.axes[j];
        axes[j] = typeof v === 'number' && !isNaN(v) ? v : 0;
      }
    }

    return {
      id: 'Native iOS Gamepad (GCController bridge)',
      index: 0,
      connected: state.connected,
      timestamp: state.timestamp,
      mapping: 'standard',
      axes: axes,
      buttons: buttons,
      // Metodi stub per completezza (il gioco non li usa)
      vibrationActuator: null,
      hapticActuators: [],
    };
  }

  // ---- API chiamate da Swift ----

  // Aggiorna stato bottoni/assi a ogni tick nativo (circa 60Hz).
  window.__nativeGamepadUpdate = function (incoming) {
    if (!incoming) return;
    state.buttons = Array.isArray(incoming.buttons) ? incoming.buttons : [];
    state.axes = Array.isArray(incoming.axes) ? incoming.axes : [];
    state.connected = true;
    state.timestamp = (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();
  };

  // Chiamata quando un controller si connette o disconnette.
  window.__nativeGamepadConnection = function (connected) {
    var wasConnected = state.connected;
    state.connected = !!connected;
    if (!state.connected) {
      state.buttons = [];
      state.axes = [];
    }
    try {
      var eventName = state.connected ? 'gamepadconnected' : 'gamepaddisconnected';
      // Usiamo GamepadEvent se disponibile, altrimenti un Event generico
      // con la property gamepad attaccata manualmente.
      var ev;
      if (typeof GamepadEvent === 'function') {
        ev = new GamepadEvent(eventName, { gamepad: buildSyntheticGamepad() });
      } else {
        ev = new Event(eventName);
        ev.gamepad = buildSyntheticGamepad();
      }
      if (state.connected !== wasConnected) {
        window.dispatchEvent(ev);
      }
    } catch (e) {
      console.warn(LOG_PREFIX, 'dispatch connection event failed:', e);
    }
  };

  // ---- Monkey-patch di navigator.getGamepads ----
  // getGamepads può non esistere su alcune versioni di iOS. In quel caso
  // lo creiamo dal nulla; in caso contrario avvolgiamo quello originale.
  var originalGetGamepads = (typeof navigator.getGamepads === 'function')
    ? navigator.getGamepads.bind(navigator)
    : null;

  navigator.getGamepads = function patchedGetGamepads() {
    if (state.connected) {
      return [buildSyntheticGamepad(), null, null, null];
    }
    // Nessun gamepad nativo attivo → torniamo a quello originale del browser
    // (in pratica su iOS sarà sempre vuoto, ma restiamo corretti).
    if (originalGetGamepads) {
      try {
        return originalGetGamepads();
      } catch (e) {
        return [null, null, null, null];
      }
    }
    return [null, null, null, null];
  };

  // Flag di comodo per i file del gioco che vogliano sapere che siamo
  // dentro la app iOS (utile per futuro, al momento il gioco non lo usa).
  window.__nativeGamepadBridgeReady = true;

  console.log(LOG_PREFIX, 'Attivato: modalità app iOS contenitore.');
})();
