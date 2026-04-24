import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * Web HTML shell — Expo Router injects this as the page wrapper.
 * The inline script runs synchronously before the app bundle so all
 * PWA meta tags are in the DOM before any browser parsing happens.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en-AU">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/*
          Accessibility-safe viewport: initial-scale=1 lets users pinch-zoom.
          No user-scalable=no / maximum-scale so assistive zoom is never blocked.
        */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <title>Sortii</title>
        <ScrollViewStyleReset />

        {/*
          Web-layout safety styles.
          1. dvh  — dynamic viewport height responds to browser chrome (address
                    bar appearing / disappearing) on mobile. Falls back to 100vh
                    on browsers that don't support dvh.
          2. Nav  — cap the tab bar so large system-font settings can't push it
                    taller than 60 px.
          3. Main — the scrollable content between top + bottom bars always fills
                    remaining space via flex:1 + overflow-y:auto.
          4. Font — font-size declared as 1rem on html so all relative em/rem
                    values the app generates scale with the user's system text
                    size preference.
        */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
html {
  font-size: 16px;
}
html, body {
  height: 100%;
  margin: 0;
  padding: 0;
}
#root {
  height: 100vh;       /* fallback */
  height: 100dvh;      /* respects mobile browser chrome */
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* Cap bottom tab-bar / top header so large font settings don't break layout */
[role="tablist"],
[aria-label="Tab bar"],
nav {
  max-height: 60px !important;
  overflow: hidden !important;
  flex-shrink: 0 !important;
}
/* Scrollable content area always fills remaining space */
[role="main"],
main {
  flex: 1 1 auto !important;
  overflow-y: auto !important;
  -webkit-overflow-scrolling: touch;
}
            `,
          }}
        />

        {/*
          Expo Router's dev-server doesn't always forward <link> and
          arbitrary <meta> tags from +html.tsx, so we inject them via a
          synchronous inline script that runs before the app bundle.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  var head = document.head;
  function addMeta(attrs) {
    var m = document.createElement('meta');
    Object.keys(attrs).forEach(function(k){ m.setAttribute(k, attrs[k]); });
    head.appendChild(m);
  }
  function addLink(attrs) {
    var l = document.createElement('link');
    Object.keys(attrs).forEach(function(k){ l.setAttribute(k, attrs[k]); });
    head.appendChild(l);
  }

  // PWA manifest — triggers Android "Add to Home Screen" banner
  addLink({ rel: 'manifest', href: '/manifest.json' });

  // iOS "Add to Home Screen" behaviour
  addMeta({ name: 'apple-mobile-web-app-capable', content: 'yes' });
  addMeta({ name: 'apple-mobile-web-app-status-bar-style', content: 'default' });
  addMeta({ name: 'apple-mobile-web-app-title', content: 'Sortii' });

  // iOS home-screen icon
  addLink({ rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' });

  // Prevent phone-number auto-detection
  addMeta({ name: 'format-detection', content: 'telephone=no' });
})();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
