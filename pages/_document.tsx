import Document, { Html, Head, Main, NextScript } from 'next/document';
import React from 'react';

// This custom Document injects a small script that applies the saved theme (or system preference)
// to <html data-theme="..."> before React hydrates. This prevents a flash between themes.
export default class MyDocument extends Document {
  render() {
    const setThemeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}else{var m=window.matchMedia('(prefers-color-scheme: dark)');document.documentElement.setAttribute('data-theme',m.matches? 'dark':'light');}}catch(e){} })();`;

    return (
      <Html>
        <Head />
        <body>
          <script dangerouslySetInnerHTML={{ __html: setThemeScript }} />
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
