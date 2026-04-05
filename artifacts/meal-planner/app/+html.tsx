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
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>Sortii – Dinner. Sorted.</title>
        <ScrollViewStyleReset />

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
