// Client-side script for admin to manage push subscriptions
(async function(){
  // fetch VAPID public key from server (requires admin auth cookie)
  const vapidKeyResp = await fetch('/admin/getVapidPublicKey', { credentials: 'same-origin' });
  const vapidKey = vapidKeyResp.ok ? await vapidKeyResp.text() : null;

  const isSupported = ('serviceWorker' in navigator) && ('PushManager' in window);
  const btnId = 'notificationToggleBtn';
  const resetId = 'notificationResetBtn';

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function registerAndSubscribe() {
    if (!isSupported) return alert('Push not supported in this browser');
    if (!vapidKey) return alert('VAPID public key missing on the server. Make sure you have VAPID_PUBLIC_KEY set.');
    console.log('[notifications] registerAndSubscribe() starting');
    // register the service worker and wait until it's active
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch (err) {
      console.error('[notifications] Service worker registration failed', err);
      return alert('Service worker registration failed: ' + err.message);
    }
    const reg = await navigator.serviceWorker.ready; // ensures active service worker
  let applicationKey;
    try {
      applicationKey = urlBase64ToUint8Array(vapidKey);
    } catch (err) {
      console.error('Invalid VAPID key format', err);
      return alert('Invalid VAPID public key format. Check server configuration.');
    }

    // Request Notification permission explicitly so user sees the prompt
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        console.warn('[notifications] Notification permission not granted:', perm);
        return alert('Please allow notifications in the browser to enable push.');
      }
    } catch (err) {
      console.error('[notifications] Notification.requestPermission failed', err);
      // continue to attempt subscribe, browser may still show prompt
    }

    let sub;
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationKey
      });
      console.log('[notifications] push subscription succeeded', sub.endpoint);
    } catch (err) {
      console.error('[notifications] Failed to subscribe for push', err);
      return alert('Subscription failed: ' + (err && err.message ? err.message : err));
    }

    // send subscription to server
    await fetch('/admin/saveSubscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(sub)
    });
    updateButtons();
  }

  async function unsubscribeAll() {
    // ask server to delete all subscriptions for this admin session (or globally)
    await fetch('/admin/resetSubscriptions', { method: 'POST', credentials: 'same-origin' });
    // Also unsubscribe client side
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }
    updateButtons();
  }

  async function updateButtons() {
    let subscribed = false;
    try {
      const reg = await navigator.serviceWorker.getRegistration(); // check for existing registration
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        subscribed = !!sub;
      } else {
        subscribed = false;
      }
    } catch (e) {
      // no active service worker or error
      subscribed = false;
    }
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.textContent = subscribed ? 'Disable Notifications' : 'Enable Notifications';
  }

  // attach to DOM when available
  function attach() {
    const btn = document.getElementById(btnId);
    const reset = document.getElementById(resetId);
    if (!btn) return setTimeout(attach, 300);
    btn.onclick = async () => {
      console.log('[notifications] toggle button clicked');
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await sub.unsubscribe();
            // tell server to remove this endpoint
            await fetch('/admin/removeSubscription', { method: 'POST', credentials: 'same-origin', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ endpoint: sub.endpoint }) });
          } else {
            await registerAndSubscribe();
          }
        } else {
          // no registration — register then subscribe
          await registerAndSubscribe();
        }
      } catch (e) {
        console.warn('Error while toggling subscription, attempting to register and subscribe.', e);
        await registerAndSubscribe();
      }
      updateButtons();
    };
    if (reset) reset.onclick = unsubscribeAll;
    updateButtons();
  }

  attach();
})();