export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <title>This page didn't load</title>
    <meta name="viewport"content="width=device-width, initial-scale=1"/>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #ffffff; --fg: #1f2328; --mut: #4c525c; --line: #d1d9e0;
        --btn-bg: #1f2328; --btn-fg: #ffffff; --card-bg: #ffffff; --ring: #0969da;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #0c0f14; --fg: #e6edf3; --mut: #a5adba; --line: #2b313a;
          --btn-bg: #e6edf3; --btn-fg: #0c0f14; --card-bg: #14181f; --ring: #4493f8;
        }
      }
      body { font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--fg); display: grid; place-items: center; min-height: 100dvh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: var(--mut); margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 4px; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      a:focus-visible, button:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
      .primary { background: var(--btn-bg); color: var(--btn-fg); }
      .secondary { background: var(--card-bg); color: var(--fg); border-color: var(--line); }
    </style>

  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <button class="primary"onclick="location.reload()">Try again</button>
        <a class="secondary"href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
