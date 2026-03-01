(function () {
  var endpoint = '/__dangerously/errors';

  function report(kind, payload) {
    try {
      var body = JSON.stringify({
        kind: kind,
        payload: payload,
        href: window.location.href,
        ua: navigator.userAgent,
        timestamp: Date.now(),
      });

      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, body);
      } else {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          keepalive: true,
        }).catch(function () {});
      }
    } catch (_error) {}
  }

  window.addEventListener('error', function (event) {
    report('error', {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error && event.error.stack ? String(event.error.stack) : null,
    });
  });

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    report('unhandledrejection', {
      message: reason && reason.message ? String(reason.message) : String(reason),
      stack: reason && reason.stack ? String(reason.stack) : null,
    });
  });
})();
