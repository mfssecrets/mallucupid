/*
 * MalluCupid native bridge v1.10.0 — injected into the WebView by MainActivity
 * after each page load. Pure vanilla JS, no framework dependency, idempotent.
 * All calls gracefully no-op on the web (Capacitor absent) so the same bundle
 * runs unchanged on mallucupid.com.
 */
(function () {
  if (window.__mcNativeBridge) return;
  window.__mcNativeBridge = true;

  var Cap = window.Capacitor;
  var isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  var platform = (Cap && Cap.getPlatform) ? Cap.getPlatform() : 'web';
  var Plugins = (Cap && Cap.Plugins) || {};

  var App = Plugins.App;
  var Share = Plugins.Share;
  var InAppReview = Plugins.InAppReview;
  var Haptics = Plugins.Haptics;
  var LocalNotifications = Plugins.LocalNotifications;
  var Network = Plugins.Network;
  var Clipboard = Plugins.Clipboard;
  var Device = Plugins.Device;
  var McToast = Plugins.McToast;
  var McRatePrompt = Plugins.McRatePrompt;
  var BiometricAuth = Plugins.BiometricAuth;
  var Filesystem = Plugins.Filesystem;
  var Browser = Plugins.Browser;
  var PushNotifications = Plugins.PushNotifications;
  var McAppInfo = Plugins.McAppInfo;
  var KeepAwake = Plugins.KeepAwake;

  // ---- app-state listeners ------------------------------------------------
  var appState = 'active';
  var stateCbs = [];
  function setState(s) {
    if (s === appState) return;
    appState = s;
    try { window.dispatchEvent(new CustomEvent('mc:statechange', { detail: { state: s } })); } catch (e) {}
    for (var i = 0; i < stateCbs.length; i++) { try { stateCbs[i]({ state: s, isActive: s === 'active' }); } catch (e) {} }
  }
  if (App && App.addListener) {
    try {
      App.addListener('appStateChange', function (info) { setState(info && info.isActive ? 'active' : 'inactive'); });
      App.addListener('pause', function () { setState('inactive'); window.dispatchEvent(new CustomEvent('mc:pause')); });
      App.addListener('resume', function () { setState('active'); window.dispatchEvent(new CustomEvent('mc:resume')); maybePromptForRating(); });
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', function () { setState(document.hidden ? 'inactive' : 'active'); }, false);

  // ---- connectivity listeners ---------------------------------------------
  var netCbs = [];
  var lastNet = { online: navigator.onLine, connectionType: 'unknown' };
  function parseStatus(s) { if (!s) return { online: navigator.onLine, connectionType: 'unknown' }; return { online: s.connected !== false, connectionType: s.connectionType || 'unknown' }; }
  function fireNet(info) {
    if (info) lastNet = parseStatus(info);
    var ev = lastNet.online ? 'mc:online' : 'mc:offline';
    try { window.dispatchEvent(new CustomEvent(ev, { detail: lastNet })); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('mc:networkchange', { detail: lastNet })); } catch (e) {}
    for (var i = 0; i < netCbs.length; i++) { try { netCbs[i](lastNet); } catch (e) {} }
  }
  window.addEventListener('online', function () { fireNet({ connected: true, connectionType: lastNet.connectionType }); }, false);
  window.addEventListener('offline', function () { fireNet({ connected: false, connectionType: 'none' }); }, false);
  if (Network && Network.addListener) { try { Network.addListener('networkStatusChange', function (s) { fireNet(s); }); } catch (e) {} }

  // ---- haptics ------------------------------------------------------------
  function haptic(style) { if (!Haptics) return; try { var map = { light: 'impactLight', medium: 'impactMedium', heavy: 'impactHeavy' }; var fn = map[style] || 'impactLight'; if (Haptics[fn]) Haptics[fn](); } catch (e) {} }

  // ---- share --------------------------------------------------------------
  function share(opts) {
    opts = opts || {};
    if (!Share) return Promise.resolve({ shared: false, reason: 'unavailable' });
    return Share.share({ title: opts.title || 'MalluCupid', text: opts.text || '', url: opts.url || 'https://www.mallucupid.com', dialogTitle: opts.dialogTitle || 'Share MalluCupid' }).then(function () { return { shared: true }; }).catch(function (e) { return { shared: false, reason: (e && e.message) || 'cancelled' }; });
  }

  // ---- in-app review ------------------------------------------------------
  function requestReview() { if (!InAppReview) return Promise.resolve({ reviewed: false, reason: 'unavailable' }); return InAppReview.requestReview().then(function () { return { reviewed: true }; }).catch(function (e) { return { reviewed: false, reason: (e && e.message) || 'error' }; }); }

  // ---- rate prompt (session-based auto-gate) ------------------------------
  var ratePromptedThisSession = false;
  function maybePromptForRating() {
    if (ratePromptedThisSession || !McRatePrompt) return;
    McRatePrompt.shouldPrompt().then(function (r) {
      if (r && r.shouldPrompt) { ratePromptedThisSession = true; try { window.dispatchEvent(new CustomEvent('mc:rateprompt', { detail: r })); } catch (e) {} requestReview().then(function () { if (McRatePrompt.markPrompted) McRatePrompt.markPrompted(); }); }
    }).catch(function () {});
  }
  function ratePromptStatus() { if (!McRatePrompt) return Promise.resolve({ shouldPrompt: false, reason: 'unavailable' }); return McRatePrompt.shouldPrompt().catch(function (e) { return { shouldPrompt: false, reason: (e && e.message) || 'error' }; }); }
  function markRatePrompted() { if (!McRatePrompt) return Promise.resolve({ marked: false }); return McRatePrompt.markPrompted().catch(function () { return { marked: false }; }); }
  setTimeout(maybePromptForRating, 4000);

  // ---- toast --------------------------------------------------------------
  function toast(opts) { opts = opts || {}; if (!McToast) { try { console.log('[mc:toast]', opts.message || ''); } catch (e) {} return Promise.resolve({ shown: false, reason: 'unavailable' }); } return McToast.show({ message: String(opts.message || ''), style: opts.style || 'info', duration: opts.duration === 'long' ? 1 : 0 }).then(function () { return { shown: true }; }).catch(function (e) { return { shown: false, reason: (e && e.message) || 'error' }; }); }

  // ---- local notifications ------------------------------------------------
  function scheduleNotification(opts) {
    opts = opts || {};
    if (!LocalNotifications) return Promise.resolve({ scheduled: false, reason: 'unavailable' });
    var id = (opts.id && opts.id > 0) ? opts.id : Math.floor(Math.random() * 1000000) + 1;
    var at = opts.at instanceof Date ? opts.at : (typeof opts.at === 'number' ? new Date(opts.at) : null);
    if (!at) return Promise.resolve({ scheduled: false, reason: 'invalid_at' });
    return LocalNotifications.schedule({ notifications: [{ id: id, title: opts.title || 'MalluCupid', body: opts.body || '', schedule: { at: at }, smallIcon: 'ic_launcher', largeIcon: 'ic_launcher', channelId: opts.channelId || 'mallucupid-reminders', sound: null, extra: opts.extra || null }] }).then(function (r) { return { scheduled: true, id: id, notifications: r && r.notifications }; }).catch(function (e) { return { scheduled: false, reason: (e && e.message) || 'error' }; });
  }
  function cancelNotification(id) { if (!LocalNotifications || !id) return Promise.resolve({ cancelled: false }); return LocalNotifications.cancel({ notifications: [{ id: id }] }).then(function () { return { cancelled: true }; }).catch(function (e) { return { cancelled: false, reason: (e && e.message) || 'error' }; }); }
  function cancelAllNotifications() { if (!LocalNotifications) return Promise.resolve({ cancelled: false }); return LocalNotifications.getPending().then(function (r) { var list = (r && r.notifications) || []; if (!list.length) return { cancelled: 0 }; return LocalNotifications.cancel({ notifications: list }).then(function () { return { cancelled: list.length }; }); }).catch(function (e) { return { cancelled: 0, reason: (e && e.message) || 'error' }; }); }
  function pendingNotifications() { if (!LocalNotifications) return Promise.resolve({ notifications: [] }); return LocalNotifications.getPending().then(function (r) { return { notifications: ((r && r.notifications) || []).map(function (n) { return { id: n.id, title: n.title, body: n.body, at: n.schedule && n.schedule.at }; }) }; }).catch(function (e) { return { notifications: [], reason: (e && e.message) || 'error' }; }); }

  // ---- badge --------------------------------------------------------------
  var badgeCount = 0;
  function setBadgeCount(n) { badgeCount = Math.max(0, parseInt(n, 10) || 0); return Promise.resolve({ set: true, count: badgeCount }); }
  function clearBadge() { return setBadgeCount(0); }

  // ---- clipboard ----------------------------------------------------------
  function copyToClipboard(text) { if (!Clipboard) return Promise.resolve({ copied: false, reason: 'unavailable' }); return Clipboard.write({ string: String(text == null ? '' : text) }).then(function () { return { copied: true }; }).catch(function (e) { return { copied: false, reason: (e && e.message) || 'error' }; }); }
  function readClipboard() { if (!Clipboard) return Promise.resolve({ value: null, reason: 'unavailable' }); return Clipboard.read().then(function (r) { return { value: r && r.value }; }).catch(function (e) { return { value: null, reason: (e && e.message) || 'error' }; }); }

  // ---- device info --------------------------------------------------------
  function getDeviceInfo() { if (!Device) return Promise.resolve({ platform: platform, isNative: isNative, osVersion: null, model: null, appVersion: null, manufacturer: null, reason: 'unavailable' }); return Device.getInfo().then(function (info) { return { platform: info.platform, isNative: isNative, osVersion: info.osVersion, model: info.model, manufacturer: info.manufacturer, appVersion: info.appVersion, appBuild: info.appBuild, webViewVersion: info.webViewVersion }; }).catch(function (e) { return { reason: (e && e.message) || 'error' }; }); }

  // ---- connectivity snapshot ----------------------------------------------
  function getConnectivity() { if (Network && Network.getStatus) { return Network.getStatus().then(function (s) { return parseStatus(s); }).catch(function () { return lastNet; }); } return Promise.resolve(lastNet); }

  // ---- biometric auth -----------------------------------------------------
  function checkBiometry() { if (!BiometricAuth) return Promise.resolve({ available: false, reason: 'unavailable' }); return BiometricAuth.checkBiometry().then(function (r) { return { available: !!(r && r.available), biometryType: r && r.biometryType, strong: r && r.strong, reason: r && r.reason }; }).catch(function (e) { return { available: false, reason: (e && e.message) || 'error' }; }); }
  function biometricAuth(opts) { opts = opts || {}; if (!BiometricAuth) return Promise.resolve({ authenticated: false, reason: 'unavailable' }); return BiometricAuth.authenticate(opts).then(function (r) { return { authenticated: true, biometryType: r && r.biometryType }; }).catch(function (e) { return { authenticated: false, reason: (e && (e.message || e.code)) || 'cancelled' }; }); }

  // ---- filesystem ---------------------------------------------------------
  function saveFile(opts) { opts = opts || {}; if (!Filesystem) return Promise.resolve({ saved: false, reason: 'unavailable' }); return Filesystem.writeFile({ path: opts.path || ('mallucupid-' + Date.now() + (opts.ext || '.txt')), data: opts.data || '', directory: opts.directory || 'DOCUMENTS', encoding: opts.encoding || 'utf8', recursive: opts.recursive !== false }).then(function (r) { return { saved: true, uri: r && r.uri }; }).catch(function (e) { return { saved: false, reason: (e && e.message) || 'error' }; }); }
  function readFile(opts) { opts = opts || {}; if (!Filesystem) return Promise.resolve({ read: false, reason: 'unavailable' }); return Filesystem.readFile({ path: opts.path, directory: opts.directory || 'DOCUMENTS', encoding: opts.encoding || 'utf8' }).then(function (r) { return { read: true, data: r && r.data }; }).catch(function (e) { return { read: false, reason: (e && e.message) || 'error' }; }); }

  // ---- open external ------------------------------------------------------
  function openExternal(opts) { opts = opts || {}; var url = opts.url; if (!url) return Promise.resolve({ opened: false, reason: 'no_url' }); if (Browser && /^https?:\/\//i.test(url)) { return Browser.open({ url: url, windowName: opts.windowName || '_blank' }).then(function () { return { opened: true, mode: 'customtab' }; }).catch(function (e) { return { opened: false, reason: (e && e.message) || 'error' }; }); } try { window.open(url, '_blank'); return Promise.resolve({ opened: true, mode: 'window' }); } catch (e) { return Promise.resolve({ opened: false, reason: (e && e.message) || 'error' }); } }

  // ---- keep-awake ---------------------------------------------------------
  function keepAwake() { if (!KeepAwake) return Promise.resolve({ kept: false, reason: 'unavailable' }); return KeepAwake.keepAwake().then(function () { return { kept: true }; }).catch(function (e) { return { kept: false, reason: (e && e.message) || 'error' }; }); }
  function allowSleep() { if (!KeepAwake) return Promise.resolve({ allowed: true }); return KeepAwake.allowSleep().then(function () { return { allowed: true }; }).catch(function (e) { return { allowed: false, reason: (e && e.message) || 'error' }; }); }

  // ---- app info + play store ---------------------------------------------
  function getAppInfo() { if (!McAppInfo) return Promise.resolve({ reason: 'unavailable' }); return McAppInfo.getAppInfo().catch(function (e) { return { reason: (e && e.message) || 'error' }; }); }
  function openPlayStore() { if (!McAppInfo) return Promise.resolve({ opened: false, reason: 'unavailable' }); return McAppInfo.openPlayStore().catch(function (e) { return { opened: false, reason: (e && e.message) || 'error' }; }); }
  function checkForUpdateLight() { if (McAppInfo) return McAppInfo.checkForUpdate().catch(function (e) { return { available: 'unknown', reason: (e && e.message) || 'error' }; }); return Promise.resolve({ available: 'unknown', reason: 'unavailable' }); }

  // ---- exit confirm -------------------------------------------------------
  var exitGuardActive = true;
  function setExitGuard(enabled) { exitGuardActive = !!enabled; return Promise.resolve({ set: true, exitGuard: exitGuardActive }); }

  // ---- deep linking -------------------------------------------------------
  var deepLinkCbs = [];
  if (App && App.addListener) { try { App.addListener('appUrlOpen', function (data) { var url = data && data.url; if (!url) return; try { window.dispatchEvent(new CustomEvent('mc:deeplink', { detail: { url: url } })); } catch (e) {} for (var i = 0; i < deepLinkCbs.length; i++) { try { deepLinkCbs[i]({ url: url }); } catch (e) {} } }); } catch (e) {} }

  // ---- push notifications -------------------------------------------------
  function registerForPushNotifications() {
    if (!PushNotifications) return Promise.resolve({ registered: false, reason: 'unavailable' });
    return PushNotifications.requestPermissions().then(function (perm) { if (!perm || perm.receive === false) return { registered: false, reason: 'permission_denied' }; return PushNotifications.register().then(function () { return { registered: true }; }).catch(function (e) { return { registered: false, reason: (e && e.message) || 'error' }; }); }).catch(function (e) { return { registered: false, reason: (e && e.message) || 'error' }; });
  }
  if (PushNotifications && PushNotifications.addListener) {
    try {
      PushNotifications.addListener('registration', function (token) { try { window.dispatchEvent(new CustomEvent('mc:pushtoken', { detail: { value: token && token.value } })); } catch (e) {} });
      PushNotifications.addListener('registrationError', function (err) { try { window.dispatchEvent(new CustomEvent('mc:pusherror', { detail: err })); } catch (e) {} });
      PushNotifications.addListener('pushNotificationReceived', function (notif) { try { window.dispatchEvent(new CustomEvent('mc:pushreceived', { detail: notif })); } catch (e) {} });
      PushNotifications.addListener('pushNotificationActionPerformed', function (action) { try { window.dispatchEvent(new CustomEvent('mc:pushaction', { detail: action })); } catch (e) {} });
    } catch (e) {}
  }

  // ---- public API ---------------------------------------------------------
  window.MalluCupidNative = {
    isNative: isNative, platform: platform, appState: appState, version: '1.10.0',
    share: share, requestReview: requestReview, haptic: haptic,
    onAppState: function (fn) { if (typeof fn !== 'function') return function () {}; stateCbs.push(fn); return function () { var i = stateCbs.indexOf(fn); if (i >= 0) stateCbs.splice(i, 1); }; },
    onConnectivity: function (fn) { if (typeof fn !== 'function') return function () {}; netCbs.push(fn); return function () { var i = netCbs.indexOf(fn); if (i >= 0) netCbs.splice(i, 1); }; },
    toast: toast, scheduleNotification: scheduleNotification, cancelNotification: cancelNotification, cancelAllNotifications: cancelAllNotifications, pendingNotifications: pendingNotifications,
    setBadgeCount: setBadgeCount, clearBadge: clearBadge, copyToClipboard: copyToClipboard, readClipboard: readClipboard, getDeviceInfo: getDeviceInfo, getConnectivity: getConnectivity,
    biometricAuth: biometricAuth, checkBiometry: checkBiometry, saveFile: saveFile, readFile: readFile, openExternal: openExternal, ratePromptStatus: ratePromptStatus, markRatePrompted: markRatePrompted,
    keepAwake: keepAwake, allowSleep: allowSleep, getAppInfo: getAppInfo, openPlayStore: openPlayStore, setExitGuard: setExitGuard, checkForUpdateLight: checkForUpdateLight,
    registerForPushNotifications: registerForPushNotifications,
    onDeepLink: function (fn) { if (typeof fn !== 'function') return function () {}; deepLinkCbs.push(fn); return function () { var i = deepLinkCbs.indexOf(fn); if (i >= 0) deepLinkCbs.splice(i, 1); }; },
    notificationChannels: ['mallucupid-reminders', 'mallucupid-chat', 'mallucupid-general'],
    isSecureMode: isNative,
    showProgressBar: function () { var bar = document.getElementById('mc-progress-bar'); if (bar) { bar.style.opacity = '1'; bar.style.width = '30%'; } return Promise.resolve({ shown: true }); },
    hideProgressBar: function () { var bar = document.getElementById('mc-progress-bar'); if (bar) { bar.style.width = '100%'; setTimeout(function () { bar.style.opacity = '0'; }, 200); } return Promise.resolve({ hidden: true }); },
    showErrorScreen: function () { var el = document.getElementById('mc-error-screen'); if (el) el.style.display = 'flex'; return Promise.resolve({ shown: true }); },
    hideErrorScreen: function () { var el = document.getElementById('mc-error-screen'); if (el) el.style.display = 'none'; return Promise.resolve({ hidden: true }); }
  };

  try { window.dispatchEvent(new CustomEvent('mc:nativeready', { detail: { platform: platform, isNative: isNative, version: '1.10.0', secureMode: isNative, channels: ['mallucupid-reminders', 'mallucupid-chat', 'mallucupid-general'] } })); } catch (e) {}
})();
