import './style.css'

const host = document.querySelector<HTMLDivElement>('#app')

if (!host) throw new Error('Missing #app mount point')

const playgroundId = new URLSearchParams(window.location.search).get('playground')
const stop =
  playgroundId === 'f1'
    ? await import('./platforms/browser.ts').then(({ startBrowserPlayground }) =>
        startBrowserPlayground(host),
      )
    : await import('./model-browser/browser.ts').then(({ startModelBrowser }) =>
        startModelBrowser(host),
      )

if (import.meta.hot) {
  import.meta.hot.dispose(stop)
}
