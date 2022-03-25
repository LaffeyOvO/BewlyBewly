import { createSharedComposable } from '@vueuse/core'
import { sendMessage, onMessage } from 'webext-bridge'
import { browserSettings, Tabs } from 'webextension-polyfill'

// only on dev mode
if (import.meta.hot) {
  // @ts-expect-error for background HMR
  import('/@vite/client')
  // load latest content script
  import('./contentScriptHMR')
}

let previousTabId = 0

// communication example: send previous tab title from background page
// see shim.d.ts for type declaration
browser.tabs.onActivated.addListener(async({ tabId }) => {
  if (!previousTabId) {
    previousTabId = tabId
    return
  }

  let tab: Tabs.Tab

  try {
    tab = await browser.tabs.get(previousTabId)
    previousTabId = tabId
  }
  catch {
    return
  }

  // eslint-disable-next-line no-console
  console.log('previous tab', tab)
  sendMessage('tab-prev', { title: tab.title }, { context: 'content-script', tabId })
})

onMessage('get-current-tab', async() => {
  try {
    const tab = await browser.tabs.get(previousTabId)
    return {
      title: tab?.title,
    }
  }
  catch {
    return {
      title: undefined,
    }
  }
})

// preinsert css
browser.tabs.onUpdated.addListener((tabId: number, changInfo: Tabs.OnUpdatedChangeInfoType, tab: Tabs.Tab) => {
  if (/https?:\/\/bilibili.com\/?$/.test(`${tab.url}`)
  || /https?:\/\/www.bilibili.com\/?$/.test(`${tab.url}`)
  || /https?:\/\/bilibili.com\/\?spm_id_from=.*/.test(`${tab.url}`)
  || /https?:\/\/www.bilibili.com\/\?spm_id_from=(.)*/.test(`${tab.url}`)) {
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    if (changInfo.status === 'loading') {
      const css = `
      body::after {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        content: '';
        overflow: hidden;
        background: ${isDark ? 'hsl(230 12% 6%)' : 'rgb(243 244 246)'}!important;
        z-index: 99999;
      }
      `

      browser.tabs.insertCSS(tabId, {
        code: css,
        runAt: 'document_start',
        matchAboutBlank: true,
      })
    }

    else if (changInfo.status === 'complete') {
      const css = `
      body::after {
        display: none;
      }
      `

      browser.tabs.insertCSS(tabId, {
        code: css,
        runAt: 'document_start',
        matchAboutBlank: true,
      })
    }
  }
})

chrome.runtime.onMessage.addListener((message: any, sender: chrome.runtime.MessageSender, sendResponse: any) => {
  const APP_URL = 'https://app.bilibili.com'
  const API_URL = 'https://api.bilibili.com'

  if (message.contentScriptQuery === 'getRecommendVideo') {
    const url = `${APP_URL}/x/feed/index?build=1&idx=${message.idx}&appkey=27eb53fc9058f8c3&access_key=${message.accessKey}`
    fetch(url)
      .then(response => response.json())
      .then(data => sendResponse(data))
      .catch(error => console.error(error))
    return true
  }
  if (message.contentScriptQuery === 'getUserInfo') {
    // https://api.bilibili.com/x/web-interface/nav
    // const url = `${API_URL}/x/web-interface/card?mid=${message.mid}&photo=true`
    const url = `${API_URL}/x/web-interface/nav`
    fetch(url)
      .then(response => response.json())
      .then(data => sendResponse(data))
      .catch(error => console.error(error))
    return true // Will respond asynchronously.
  }
  if (message.contentScriptQuery === 'getUserStat') {
    const url = `${API_URL}/x/web-interface/nav/stat`
    fetch(url)
      .then(response => response.json())
      .then(data => sendResponse(data))
      .catch(error => console.error(error))
    return true
  }
  if (message.contentScriptQuery === 'getSearchSuggestion') {
    const url = `https://s.search.bilibili.com/main/suggest?term=${message.term}`
    fetch(url)
      .then(response => response.json())
      .then(data => sendResponse(data))
      .catch(error => console.error(error))
    return true
  }
  if (message.contentScriptQuery === 'logout') {
    const url = `https://passport.bilibili.com/login/exit/v2?biliCSRF=${message.biliCSRF}`
    fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        biliCSRF: message.biliJct,
      }),
    })
      .then(response => response.json())
      .then(data => sendResponse(data))
      .catch(error => console.error(error))
    return true
  }
  if (message.contentScriptQuery === 'getUnreadMsg') {
    const url = `${API_URL}/x/msgfeed/unread?build=0&mobi_app=web`
    fetch(url)
      .then(response => response.json())
      .then(data => sendResponse(data))
      .catch(error => console.error(error))
    return true
  }
  if (message.contentScriptQuery === 'getUnreadDm') {
    const url = 'https://api.vc.bilibili.com/session_svr/v1/session_svr/single_unread?build=0&mobi_app=web&unread_type=0'
    fetch(url)
      .then(response => response.json())
      .then(data => sendResponse(data))
      .catch(error => console.error(error))
    return true
  }
  if (message.contentScriptQuery === 'getNewMomentsCount') {
    // https://api.bilibili.com/x/web-interface/dynamic/entrance
    const url = `${API_URL}/x/web-interface/dynamic/entrance`
    fetch(url)
      .then(response => response.json())
      .then(data => sendResponse(data))
      .catch(error => console.error(error))
    return true
  }
})
