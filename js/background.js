// background.js (エラーログ調整版 - 完全版)
console.log("freee Ribbon background script loaded (Error Log Adjusted - Complete).");

// デフォルト設定 (更新済み)
const defaultSettings = {
  enabled: true,
  companyColors: {
    '111-111-1111': 'blue' // サンプル
  },
  devSettings: {
    stagingRegex: '(xx-secure|aka|ao|midori)\\.freee\\.co\\.jp',
    stagingColor: 'orange', // 更新済み
    productionColor: 'red',
    subRibbonColor: '#666666'
  }
};

// データ取得関数 (全メソッド込み)
const getDataFromPageFunc = () => {
    return new Promise(async (resolve) => {
        const WAIT_MS = 1000; // 待機時間 3秒
        // console.log(`freee Ribbon (BG - Page): Waiting ${WAIT_MS}ms...`); // ログ削減
        await new Promise(res => setTimeout(res, WAIT_MS));
        // console.log("freee Ribbon (BG - Page): Wait finished. Executing..."); // ログ削減
        const data = {
            external_cid: null,
            company_name: null,
            companyId: null,
            error: null,
            external_cid_raw: null
        };
        const url = window.location.href;
        let isAppStorePath = false; // アプリストアのパスかどうかのフラグ

        try {
            // --- Method 1: freee会社設立 ---
            if (url.includes("https://k.secure.freee.co.jp/")) {
                console.log("freee Ribbon (BG - Page): Trying method 1 (k.secure)...");
                if (window.freee?.company) {
                    data.external_cid_raw = window.freee.company.external_cid;
                    data.company_name = window.freee.company.trade_name;
                    data.companyId = window.freee.company.id;
                }
            // --- Method 2: freee人事労務 ---
            } else if (url.includes("https://p.secure.freee.co.jp/")) {
                 console.log("freee Ribbon (BG - Page): Trying method 2 (p.secure)...");
                 if (typeof window.$FREEE_DATA === 'object' && window.$FREEE_DATA !== null) {
                     data.external_cid_raw = window.$FREEE_DATA.company_external_cid;
                     data.company_name = window.$FREEE_DATA.loginUser?.company;
                     data.companyId = window.$FREEE_DATA.loginUser?.company_id;
                 }
            // --- Method 3: freee会計 ---
            } else if (typeof window.freee?.data?.get === 'function') {
                 console.log("freee Ribbon (BG - Page): Trying method 3 (freee.data.get)...");
                 const companyData = window.freee.data.get("company");
                 if (companyData) {
                     data.external_cid_raw = companyData?.external_cid;
                     data.company_name = companyData?.display_name;
                     data.companyId = companyData?.id;
                 }
            // --- Method M: freeeマイナンバー管理 ---
            } else if (url.includes("https://m.secure.freee.co.jp/")) {
                console.log("freee Ribbon (BG - Page): Trying method M (MyNumber DOM)...");
                try {
                    const nameElement = document.querySelector('a.switch-company');
                    if (nameElement) { data.company_name = nameElement.textContent?.trim(); }
                    const cidSpanElement = document.querySelector('span.company-cid > span');
                    if (cidSpanElement) { const rawId = cidSpanElement.textContent?.trim(); if (rawId && /^[0-9-]+$/.test(rawId)) { data.external_cid_raw = rawId; } }
                    data.companyId = null;
                } catch (domError) { data.error = (data.error || "") + " MyNumber DOM Error: " + domError.message; }
            // ★★★ Method F: freeeアプリストア ($FREEE_DATA を先に試す) ★★★
            } else if (url.includes("https://app.secure.freee.co.jp/")) {
                isAppStorePath = true; // アプリストアパスフラグを立てる
                console.log("freee Ribbon (BG - Page): Trying method F (App Store $FREEE_DATA)...");
                let foundExternalCidInF = false;
                if (typeof window.$FREEE_DATA === 'object' && window.$FREEE_DATA !== null) {
                    // $FREEE_DATA から external_cid_raw や companyId, company_name を取得試行
                    if (window.$FREEE_DATA.company_external_cid) { data.external_cid_raw = window.$FREEE_DATA.company_external_cid; foundExternalCidInF = true; }
                    if (window.$FREEE_DATA.currentCompany?.external_cid && !foundExternalCidInF) { data.external_cid_raw = window.$FREEE_DATA.currentCompany.external_cid; foundExternalCidInF = true; }
                    if (typeof window.$FREEE_DATA.companyId !== 'undefined') { const id = String(window.$FREEE_DATA.companyId); if (/^\d{10}$/.test(id) && !foundExternalCidInF) { data.external_cid_raw = id; foundExternalCidInF = true; data.companyId = null; } else if (!data.companyId) { data.companyId = window.$FREEE_DATA.companyId; } }
                    if (window.$FREEE_DATA.loginUser?.company && !data.company_name) { data.company_name = window.$FREEE_DATA.loginUser.company; }
                    if (window.$FREEE_DATA.currentCompany?.displayName && !data.company_name) { data.company_name = window.$FREEE_DATA.currentCompany.displayName; }
                    if (window.$FREEE_DATA.currentCompany?.name && !data.company_name) { data.company_name = window.$FREEE_DATA.currentCompany.name; }
                    if (window.$FREEE_DATA.currentCompany?.trade_name && !data.company_name) { data.company_name = window.$FREEE_DATA.currentCompany.trade_name; }
                    if (window.$FREEE_DATA.loginUser?.company_id && !data.companyId) { data.companyId = window.$FREEE_DATA.loginUser.company_id; }
                    if (window.$FREEE_DATA.currentCompany?.id && !data.companyId) { data.companyId = window.$FREEE_DATA.currentCompany.id; }
                    // console.log("Method F finished check. Found external_cid_raw:", foundExternalCidInF); // ログ削減
                } else { console.log("freee Ribbon (BG - Page): Method F - $FREEE_DATA not found."); }

                // ★ Method F で external_cid が見つからなかった場合のみ dataLayer ポーリング ★
                if (!foundExternalCidInF) {
                    console.log("freee Ribbon (BG - Page): Method F failed. Trying Method A (dataLayer Polling)...");
                    const POLLING_INTERVAL = 200; const MAX_ATTEMPTS = 15;
                    let attempts = 0; let foundCidInDL = false;
                    const pollDataLayer = () => {
                        attempts++;
                        if (Array.isArray(window.dataLayer)) {
                            for (const item of window.dataLayer) {
                                if (typeof item === 'object' && item !== null && typeof item.company_id !== 'undefined') {
                                    const potentialRawCid = String(item.company_id);
                                    if (/^\d{10}$/.test(potentialRawCid)) {
                                        data.external_cid_raw = potentialRawCid; data.company_name = null; data.companyId = null;
                                        // console.log("Method A - Found external_cid_raw via polling:", data.external_cid_raw); // ログ削減
                                        foundCidInDL = true; resolve(data); return; // ★ resolve & return
                                    }
                                }
                            }
                        }
                        if (!foundCidInDL && attempts < MAX_ATTEMPTS) { setTimeout(pollDataLayer, POLLING_INTERVAL); }
                        else { if (!foundCidInDL) { console.log("Method A - Polling finished, not found."); } resolve(data); } // ★ resolve & return
                    };
                    pollDataLayer();
                    // ★★★ ポーリングが開始されたら、この Promise の解決はポーリングに任せるので、ここでは return ★★★
                    return;
                }
                // Method F で external_cid が見つかった場合は、そのまま下の整形処理へ進む (resolve は関数の最後で)
            }
            // --- Method 4: freee設定画面など (FREEE_DATA fallback) ---
            else if (typeof window.FREEE_DATA === 'object' && window.FREEE_DATA !== null && typeof window.FREEE_DATA.companyId !== 'undefined') {
                console.log("freee Ribbon (BG - Page): Trying method 4 (FREEE_DATA fallback)...");
                data.companyId = window.FREEE_DATA.companyId;
            }

            // --- データ整形 ---
            if (data.external_cid_raw) {
                const cidStr = String(data.external_cid_raw).replace(/-/g, '');
                if (/^\d{10}$/.test(cidStr)) { data.external_cid = `${cidStr.substring(0, 3)}-${cidStr.substring(3, 6)}-${cidStr.substring(6, 10)}`; }
                else { data.external_cid = null; }
            } else { data.external_cid = null; }

        } catch (error) { console.error("freee Ribbon (BG - Page): Error:", error); data.error = error.message; }

        // ★★★ アプリストアのポーリングが開始されなかった場合にのみ、ここで resolve する ★★★
        if (!isAppStorePath || data.external_cid) { // アプリストアでないか、アプリストア(Method F)で external_cid が見つかった場合
             // console.log("freee Ribbon (BG - Page): Returning final data (Non-polling path or Method F success):", data); // ログ削減
             resolve(data);
        }
        // アプリストアのポーリング中は pollDataLayer 内で resolve される
    });
}; // End of getDataFromPageFunc


// content scriptからのメッセージ受信 (エラーログ調整済み .catch)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getFreeePageData") {
      const targetFunction = getDataFromPageFunc;
      if (!sender.tab || !sender.tab.id) { return false; }
      const targetTabId = sender.tab.id;
      // console.log(`Background: Received getFreeePageData for tab ${targetTabId}`); // ログ削減
      chrome.scripting.executeScript({ target: { tabId: targetTabId, allFrames: false }, world: 'MAIN', func: targetFunction })
      .then(results => {
          if (chrome.runtime.lastError || !results || !results[0] || typeof results[0].result === 'undefined') { console.error(`executeScript failed or returned invalid result for tab ${targetTabId}:`, chrome.runtime.lastError?.message, results); try { sendResponse({ success: false, error: "..." }); } catch (e) {} return; }
          let pageData = results[0].result;
          // console.log(`Background: Data received from page promise (tab ${targetTabId}):`, pageData); // ログ削減
          if (pageData.error && !pageData.external_cid && !pageData.companyId) { console.error(`Error from page context for tab ${targetTabId}:`, pageData.error); try { sendResponse({ success: false, error: `...` }); } catch (e) {} return; }

          // --- 非同期キャッシュ・補完処理 ---
          // console.log(`Background: Getting caches for tab ${targetTabId}...`); // ログ削減
          chrome.storage.local.get(['companyNameCache', 'cidLookupCache'], (cacheResult) => {
              // console.log(`Background: storage.get callback for tab ${targetTabId}.`); // ログ削減
              if (chrome.runtime.lastError) { console.error("Error getting caches:", chrome.runtime.lastError.message); try { sendResponse({ success: true, data: pageData }); } catch (e) {} return; }
              const nameCache = cacheResult.companyNameCache || {};
              const cidLookupCache = cacheResult.cidLookupCache || {};
              let nameCacheUpdated = false;
              let cidLookupCacheUpdated = false;

              // 2. キャッシュ更新
              if (pageData.external_cid && pageData.company_name) { const cid = pageData.external_cid; const name = pageData.company_name; if (!nameCache[cid] || nameCache[cid] !== name) { nameCache[cid] = name; nameCacheUpdated = true; } }
              if (pageData.companyId && pageData.external_cid) { const internalId = pageData.companyId; const externalId = pageData.external_cid; if (!cidLookupCache[internalId] || cidLookupCache[internalId] !== externalId) { cidLookupCache[internalId] = externalId; cidLookupCacheUpdated = true; } }

              // 3. external_cid の補完
              if (!pageData.external_cid && pageData.companyId) {
                  const internalId = pageData.companyId;
                  const cachedExternalCid = cidLookupCache[internalId];
                  if (cachedExternalCid) {
                      console.log(`Background: Found external_cid '${cachedExternalCid}' for companyId ${internalId} in cache.`);
                      pageData.external_cid = cachedExternalCid;
                      if (!pageData.company_name && nameCache[cachedExternalCid]) { pageData.company_name = nameCache[cachedExternalCid]; console.log(`Background: Found company_name '${pageData.company_name}' from cache.`); }
                  } else { console.log(`Background: external_cid not found in cache for companyId ${internalId}.`); }
              }

              // 4. 名前の補完 (external_cid があるが名前がない場合)
              if (pageData.external_cid && !pageData.company_name) {
                   const cachedName = nameCache[pageData.external_cid];
                   if (cachedName) {
                       pageData.company_name = cachedName;
                       console.log(`Background: Found company_name '${cachedName}' from cache for external_cid ${pageData.external_cid}.`);
                   } else {
                        console.log(`Background: company_name not found in cache for external_cid ${pageData.external_cid}.`);
                   }
              }

              // 5. キャッシュ保存と応答送信
              const cachesToUpdate = {};
              if (nameCacheUpdated) cachesToUpdate.companyNameCache = nameCache;
              if (cidLookupCacheUpdated) cachesToUpdate.cidLookupCache = cidLookupCache;
              const finalDataToSend = { ...pageData }; // ★応答用にデータをコピー
              if (Object.keys(cachesToUpdate).length > 0) {
                  console.log("Background: Saving updated caches:", Object.keys(cachesToUpdate));
                  chrome.storage.local.set(cachesToUpdate, () => {
                      if (chrome.runtime.lastError) { console.error("Error setting caches:", chrome.runtime.lastError.message); }
                      // else { console.log("Background: Caches updated successfully."); } // ログ削減
                      // console.log(`Background: Sending final response (after cache save) for tab ${targetTabId}:`, finalDataToSend); // ログ削減
                      try { sendResponse({ success: true, data: finalDataToSend }); } catch (e) { console.error("SendResponse failed after cache save:", e); }
                  });
              } else {
                  // console.log(`Background: Sending final response (no cache update) for tab ${targetTabId}:`, finalDataToSend); // ログ削減
                  try { sendResponse({ success: true, data: finalDataToSend }); } catch (e) { console.error("SendResponse failed (no cache update):", e); }
              }
          }); // End storage get callback
      }) // End .then()
      // ★★★ .catch ブロック内の処理を変更 ★★★
      .catch(error => { // executeScript failed
          // 特定の "Frame removed" エラーかどうかをチェック
          if (error && error.message && error.message.includes("Frame with ID 0 was removed")) {
              // このエラーはタブが閉じられた等で発生しうるので、警告レベルでログ出力（またはログなし）
              console.warn(`executeScript failed for tab ${targetTabId} (Frame removed, likely harmless):`, error.message);
              // sendResponse({ success: false, error: "Target frame removed." }); // 必要なら応答を返す
          } else {
              // それ以外の executeScript エラーは通常通りエラーとして記録
              console.error(`executeScript failed for tab ${targetTabId}:`, error);
              try { sendResponse({ success: false, error: error.message }); } catch (e) { console.error("SendResponse failed in catch block:", e); }
          }
      });
      // ★★★ ここまで修正 ★★★
      return true; // 非同期応答
  }
  return false;
});

// onInstalled リスナー (local ストレージ使用)
chrome.runtime.onInstalled.addListener(() => {
    console.log("freee Ribbon: onInstalled event fired.");
    chrome.storage.local.get(null, (existingSettings) => { // local storage
        // console.log("freee Ribbon: Existing local settings on install:", existingSettings); // ログ削減
        if (chrome.runtime.lastError) { console.error("Error getting local settings on install:", chrome.runtime.lastError.message); return; }
        const needsDefaults = !existingSettings || typeof existingSettings.enabled === 'undefined' || typeof existingSettings.companyColors === 'undefined' || typeof existingSettings.devSettings === 'undefined';
        if (needsDefaults) {
             console.log("freee Ribbon: Saving default settings...");
            chrome.storage.local.set(defaultSettings, () => { // ★ 更新された defaultSettings を使用 ★
                 if (chrome.runtime.lastError) { console.error("Error setting default local settings:", chrome.runtime.lastError.message); }
                 else { console.log("freee Ribbon: Default settings saved to LOCAL storage."); }
            });
        } else { console.log("freee Ribbon: Existing local settings found."); }
    });
});

console.log("freee Ribbon background script loaded (Error Log Adjusted - Complete)."); // ★ ログメッセージ修正
