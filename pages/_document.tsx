import Document, { Html, Head, Main, NextScript } from 'next/document';
import React from 'react';

// This custom Document injects a small script that applies the saved theme (or system preference)
// to <html data-theme="..."> before React hydrates. This prevents a flash between themes.
export default class MyDocument extends Document {
  render() {
    const setThemeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}else{var m=window.matchMedia('(prefers-color-scheme: dark)');document.documentElement.setAttribute('data-theme',m.matches? 'dark':'light');}}catch(e){} })();`;

    return (
      <Html>
        <Head>
          {/* PWA manifest and theme color */}
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#0f172a" />
          <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
          {/* Inline 180x180 PNG fallback for iOS (small transparent placeholder will be scaled) */}
          <link rel="apple-touch-icon" sizes="180x180" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAACXBIWXMAAAsTAAALEwEAmpwYAAABFElEQVR4nO3RAQ0AAAjDMO5fNCAh4YV6rQwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH4G2KQAAc0zbqkAAAAASUVORK5CYII=" />
          {/* iOS meta tags to improve Add to Home Screen behavior */}
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="Tr0hm" />
        </Head>
        <body>
          <script dangerouslySetInnerHTML={{ __html: setThemeScript }} />
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
