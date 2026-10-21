/*
 * ClearPass marketing site: attribution + consented ad measurement.
 *
 * Loaded synchronously in <head> so the ref is stored before the inline
 * script at the end of <body> (which carries ?ref= onto web-app links and
 * from there into profiles.signup_ref).
 *
 * 1. Attribution (no cookies, always on): a visitor arriving from a Google
 *    Ads click (gclid) or with ?ref= gets a campaign ref, kept for the tab
 *    session. Store buttons are rewritten to tracked links:
 *      App Store: pt (provider token) + ct (campaign) -> App Store Connect
 *                 > Analytics > Campaigns
 *      Google Play: referrer=utm_* -> Play Console > Store performance,
 *                 by UTM campaign
 * 2. Google tag (Google Ads conversions): only loaded after the visitor
 *    accepts the cookie banner (PECR). Until then nothing is sent to Google.
 *    Conversions: tap on an App Store / Play button, tap on a "Start free"
 *    web-app button.
 */
(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────────────────────
  var ADS_ID = 'AW-18499569453';                // Google Ads tag ID (ClearPass account)
  var LABEL_STORE_TAP = 'G1q6CJ-x6KQdEK2OpPVE'; // conversion: "Store button tap" (Outbound click)
  var LABEL_WEB_START = 'OnUGCJyx6KQdEK2OpPVE'; // conversion: "Web app start" (Sign-up)
  var APPLE_APP_ID = '6779180259';
  var APPLE_PROVIDER_TOKEN = '129017368';
  var PLAY_PACKAGE = 'co.uk.getclearpass.app';
  var CONSENT_KEY = 'clearpass_consent';        // 'granted' | 'denied'
  var REF_KEY = 'clearpass_ref';                // shared with the inline script

  var adsConfigured = ADS_ID.indexOf('REPLACE_ME') === -1;

  // ── Storage helpers (storage can throw in private modes) ─────────────────
  function get(store, key) { try { return window[store].getItem(key); } catch (e) { return null; } }
  function set(store, key, val) { try { window[store].setItem(key, val); } catch (e) {} }

  // ── 1. Work out the campaign ref, before anything else runs ──────────────
  var params = new URLSearchParams(window.location.search);
  var ref = params.get('ref');
  if (!ref && (params.get('gclid') || params.get('gbraid') || params.get('wbraid'))) ref = 'gads';
  if (!ref && params.get('utm_source')) ref = params.get('utm_source');
  if (ref) {
    ref = ref.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
    if (ref) set('sessionStorage', REF_KEY, ref);
  }
  ref = get('sessionStorage', REF_KEY);
  var campaign = ref || 'website';

  function appleUrl() {
    return 'https://apps.apple.com/gb/app/id' + APPLE_APP_ID +
      '?pt=' + APPLE_PROVIDER_TOKEN + '&ct=' + encodeURIComponent(campaign) + '&mt=8';
  }
  function playUrl() {
    var referrer = 'utm_source=' + (ref ? campaign : 'getclearpass') +
      '&utm_medium=' + (ref === 'gads' ? 'cpc' : 'website') +
      '&utm_campaign=' + campaign;
    return 'https://play.google.com/store/apps/details?id=' + PLAY_PACKAGE +
      '&referrer=' + encodeURIComponent(referrer);
  }

  // ── 2. Consent + Google tag ───────────────────────────────────────────────
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  var tagLoaded = false;

  function loadGoogleTag() {
    if (tagLoaded || !adsConfigured) return;
    tagLoaded = true;
    gtag('consent', 'default', {
      ad_storage: 'granted', ad_user_data: 'granted',
      ad_personalization: 'denied', analytics_storage: 'denied',
    });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ADS_ID);
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', ADS_ID);
  }

  function conversion(label, extra) {
    if (!tagLoaded || !adsConfigured) return;
    var data = { send_to: ADS_ID + '/' + label, transport_type: 'beacon' };
    for (var k in extra) data[k] = extra[k];
    gtag('event', 'conversion', data);
  }

  if (get('localStorage', CONSENT_KEY) === 'granted') loadGoogleTag();

  function showBanner() {
    if (get('localStorage', CONSENT_KEY)) return;
    var bar = document.createElement('div');
    bar.className = 'cookie-banner';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Cookie choices');
    bar.innerHTML =
      '<p>We’d like to use cookies to see which of our adverts bring people to ClearPass. ' +
      'Nothing is set unless you accept. <a href="https://clearpass-app.vercel.app/privacy-policy">Privacy policy</a></p>' +
      '<div class="cookie-banner-btns">' +
      '<button type="button" class="cookie-btn cookie-btn-secondary" data-choice="denied">Reject</button>' +
      '<button type="button" class="cookie-btn" data-choice="granted">Accept</button>' +
      '</div>';
    bar.addEventListener('click', function (e) {
      var choice = e.target && e.target.getAttribute('data-choice');
      if (!choice) return;
      set('localStorage', CONSENT_KEY, choice);
      if (choice === 'granted') loadGoogleTag();
      bar.remove();
    });
    document.body.appendChild(bar);
  }

  // ── 3. DOM work once the page is parsed ──────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (/apps\.apple\.com/.test(href)) {
        a.href = appleUrl();
        a.addEventListener('click', function () { conversion(LABEL_STORE_TAP, { store: 'app_store', campaign: campaign }); });
      } else if (/play\.google\.com\/store\/apps/.test(href)) {
        a.href = playUrl();
        a.addEventListener('click', function () { conversion(LABEL_STORE_TAP, { store: 'google_play', campaign: campaign }); });
      } else if (/clearpass-app\.vercel\.app\/?(\?|$)|getclearpass\.co\.uk\/start/.test(a.href) && a.textContent.trim() !== 'Sign In') {
        a.addEventListener('click', function () { conversion(LABEL_WEB_START, { campaign: campaign }); });
      }
    });
    if (adsConfigured) showBanner();
  });

  // For the /app redirect and debugging.
  window.ClearPassTracking = { ref: ref, campaign: campaign, appleUrl: appleUrl, playUrl: playUrl };
})();
