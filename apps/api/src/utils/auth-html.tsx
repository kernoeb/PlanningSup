/* eslint ts/ban-ts-comment: 0 */
// @ts-nocheck
// TODO replace with Vue page ?

import config from '@api/config'

// eslint-disable-next-line unused-imports/no-unused-imports
import { html, Html } from '@elysiajs/html'
import { Elysia } from 'elysia'

const pageCss = `
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
              background-color: #1a1a1a;
              color: #e0e0e0;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              text-align: center;
            }

            .card {
              background: #2a2a2a;
              padding: 2rem 3rem;
              border-radius: 12px;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
              border: 1px solid #333;
            }

            h1 {
              font-size: 1.5rem;
              margin-bottom: 1rem;
              font-weight: 600;
            }

            p {
              font-size: 1rem;
              margin-bottom: 1.5rem;
              color: #aaa;
            }

            a {
              color: #3498db;
              text-decoration: none;
              font-weight: 600;
              border-bottom: 2px solid transparent;
              transition: all 0.3s ease;
            }

            a:hover {
              color: #5dade2;
              border-bottom-color: #5dade2;
            }

            .loader {
              width: 40px;
              height: 40px;
              border: 4px solid #444;
              border-top-color: #3498db;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin: 0 auto 1.5rem;
            }

            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
        `

export default new Elysia().use(html()).get('/api/auth/auto-redirect/:provider', async (c) => {
  const allowedProviders = ['discord', 'github']
  if (!allowedProviders.includes(c.params.provider)) return c.status(400, 'Unsupported provider')

  const requestUrl = new URL(c.request.url)
  const code = requestUrl.searchParams.get('code')
  const state = requestUrl.searchParams.get('state')
  const client = requestUrl.searchParams.get('client')

  if (!code || !state || !client) return c.status(400)
  if (client !== 'tauri' && client !== 'extension') return c.status(400)

  // Simple validation: only allow base64url-like characters for code and state
  const allowedPattern = /^[-\w.~]+$/
  if (!allowedPattern.test(code) || !allowedPattern.test(state)) return c.status(400)

  if (client === 'tauri') {
    // Rebuild safe search params
    const safeUrl = new URL(`planningsup://auth-callback/${c.params.provider}`)
    safeUrl.searchParams.set('code', code)
    safeUrl.searchParams.set('state', state)

    return (
      <html>
        <head>
          <meta http-equiv="refresh" content={`0; url=${safeUrl.toString()}`} />
          <title>Redirecting...</title>
          <style>
            {pageCss}
          </style>
        </head>
        <body>
          <div class="card">
            <div class="loader"></div>
            <h1>Redirecting...</h1>
            <p>
              If nothing happens, click
              {' '}
              <a href={safeUrl.toString()}>here</a>
              .
            </p>
          </div>
          <script>
            {`
            window.addEventListener('load', () => {
              // The meta refresh tag will handle the redirect.
              // This script provides visual feedback.
              setTimeout(() => {
                const loader = document.querySelector('.loader');
                const title = document.querySelector('h1');

                if (loader) {
                  loader.style.animation = 'none';
                  loader.style.borderTopColor = 'transparent';
                  loader.style.borderColor = '#2ecc71'; // Success green
                }
                if (title) {
                  title.textContent = 'Redirected!';
                }
              }, 250);
            });
          `}
          </script>
        </body>
      </html>
    )
  } else {
    if (!config.chromeExtensionId && !config.firefoxExtensionId) return c.status(500, 'No extension IDs configured on server')

    return (
      <html>
        <head>
          <title>Completing Sign-In...</title>
          <style>
            {pageCss}
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Please wait, completing authentication...</h1>
          </div>
        </body>
        <script>
          {`
            function sendMessageToExtension(message) {
              if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
                // For Firefox and browsers supporting webextension-polyfill
                if (${!!config.chromeExtensionId}) return browser.runtime.sendMessage('${config.chromeExtensionId || '*'}', message);
              } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                // For Chrome
                return new Promise((resolve, reject) => {
                  if (${!!config.firefoxExtensionId}) chrome.runtime.sendMessage('${config.firefoxExtensionId || '*'}', message, (response) => {
                    console.log('chrome.runtime.sendMessage response:', response);
                    const err = chrome.runtime.lastError;
                    if (err) reject(err);
                    else resolve(response);
                  });
                });
              } else {
                return Promise.reject(new Error('No extension runtime found'));
              }
            }

            window.addEventListener('load', () => {
              const message = {
                type: 'authCallback',
                provider: '${c.params.provider}',
                code: '${code}',
                state: '${state}'
              };

              sendMessageToExtension(message)
                .then(response => {
                  document.querySelector('h1').textContent = 'Authentication complete! You can close this tab.';
                })
                .catch(error => {
                  console.error('Error sending message to extension:', error);
                  document.querySelector('h1').textContent = 'Error completing authentication. Please try again.';
                });
            });
          `}
        </script>
      </html>
    )
  }
})
