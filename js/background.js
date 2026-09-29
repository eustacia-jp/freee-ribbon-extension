// background.js (エラーログ調整版 - 完全版)
console.log("freee Ribbon background script loaded (Error Log Adjusted - Complete).");

// デフォルト設定 (更新済み)
const defaultSettings = {
  enabled: true,
  ribbonOpacity: 100, // リボン背景の不透明度(100=不透明、50-100の範囲)
  hideMode: 'click-toggle', // リボンを一時的に消す方法('click-toggle' or 'hover-hide')
  companyColors: {
    '111-111-1111': 'blue' // サンプル
  },
  devSettings: {
    stagingRegex: '(stg-secure|aka|ao|kiiro)\\.freee\\.co\\.jp',
    stagingColor: 'orange', // 更新済み
    productionColor: 'red',
    subRibbonColor: '#666666',
    cidOverride: '', // 事業所番号の上書き文字列(空=上書きしない)
    disabledUrlRegex: '(invoice\\.secure\\.freee\\.co\\.jp|secure\\.freee\\.co\\.jp/ctax)' // リボンを表示しないURLの正規表現(空=制御なし)
  }
};

// データ取得関数 (全メソッド込み)
const getDataFromPageFunc = () => {
    return new Promise(async (resolve) => {
        // --- 機能フラグ ---
        // freee請求書(Method H)自体の取得は有効化しておき、表示の可否は
        // devSettings.disabledUrlRegex(オプション画面の「リボンを表示しないプロダクト・画面のURL」)に一本化する。
        const ENABLE_INVOICE_RIBBON = true;

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
                 } else {
                     // "company"オブジェクトを持たないプロダクト(申告など)向けフォールバック。
                     // 内部IDだけは freee.data.get('company_id') で取れることがあるので、
                     // それだけ拾っておき、事業所番号への変換はキャッシュ(cidLookupCache)による逆引きに任せる。
                     const companyIdFallback = window.freee.data.get('company_id');
                     if (typeof companyIdFallback !== 'undefined' && companyIdFallback !== null) {
                         data.companyId = companyIdFallback;
                     }
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
            // ★★★ Method F: freeeアプリストア ★★★
            } else if (url.includes("https://app.secure.freee.co.jp/")) {
                console.log("freee Ribbon (BG - Page): Trying method F (App Store)...");
                // 事業所番号は <head> 先頭付近の dataLayer 初期化スクリプトに書かれている
                // (例: dataLayer = window.dataLayer || [{'company_id': 0971687822}];)。
                // ただし window.dataLayer をそのまま読むと、引用符なし数値リテラルの
                // 先頭の0がJSエンジンによって落とされてしまう(0971687822 → 971687822 に化ける)ため、
                // 必ず<script>タグのソーステキストを正規表現で読むこと。
                let cidRaw = null;
                for (const script of document.scripts) {
                    if (!script.src && script.textContent.includes("'company_id'")) {
                        const m = script.textContent.match(/'company_id'\s*:\s*(\d+)/);
                        if (m) { cidRaw = m[1]; break; }
                    }
                }
                if (cidRaw) { data.external_cid_raw = cidRaw.padStart(10, '0'); }

                // 会社名・内部IDは $FREEE_DATA.data.currentCompany から
                if (typeof window.$FREEE_DATA === 'object' && window.$FREEE_DATA !== null) {
                    const company = window.$FREEE_DATA.data?.currentCompany;
                    if (company?.displayName) { data.company_name = company.displayName; }
                    if (typeof company?.id !== 'undefined') { data.companyId = company.id; }
                }
            // --- Method G: freee新UI基盤 (固定資産台帳など。/api/p/global_state を使用) ---
            } else if (url.includes("https://fixed-asset.secure.freee.co.jp/")) {
                console.log("freee Ribbon (BG - Page): Trying method G (global_state API)...");
                fetch('/api/p/global_state', { credentials: 'include' })
                    .then(res => res.json())
                    .then(json => {
                        const company = json?.currentCompany;
                        if (company) {
                            if (company.externalCid) { data.external_cid_raw = String(company.externalCid); }
                            if (company.displayName) { data.company_name = company.displayName; }
                            if (typeof company.id !== 'undefined') { data.companyId = company.id; }
                        }
                        // --- データ整形 (このメソッドは非同期なのでここで行う) ---
                        if (data.external_cid_raw) {
                            const cidStr = String(data.external_cid_raw).replace(/-/g, '');
                            if (/^\d{10}$/.test(cidStr)) { data.external_cid = `${cidStr.substring(0, 3)}-${cidStr.substring(3, 6)}-${cidStr.substring(6, 10)}`; }
                            else { data.external_cid = null; }
                        } else { data.external_cid = null; }
                        resolve(data);
                    })
                    .catch(err => {
                        console.error("freee Ribbon (BG - Page): Method G fetch failed:", err);
                        data.error = (data.error || "") + " Method G fetch error: " + err.message;
                        resolve(data);
                    });
                // ★★★ 非同期のfetch待ちなので、ここでreturnして下の同期resolveには進ませない ★★★
                return;
            }
            // --- Method H: freee請求書 (旧freee会計から分離された新UI画面) ---
            // URLは見かけ上 freee会計 と同じ場合があるため、URLでは判定せず、
            // 問い合わせチャットウィジェット埋め込み用に script 内に直接書かれている
            // params['FreeeExternalCid'] = '事業所番号'; を目印にする。
            else if (ENABLE_INVOICE_RIBBON && Array.from(document.scripts).some(s => !s.src && s.textContent.includes("FreeeExternalCid']"))) {
                console.log("freee Ribbon (BG - Page): Trying method H (invoice)...");
                let cidRaw = null;
                for (const script of document.scripts) {
                    if (!script.src && script.textContent.includes("FreeeExternalCid']")) {
                        const m = script.textContent.match(/FreeeExternalCid'\]\s*=\s*'(\d+)'/);
                        if (m) { cidRaw = m[1]; break; }
                    }
                }
                if (cidRaw) { data.external_cid_raw = cidRaw; }
                // 会社名は新ヘッダー(gnavi)の会社切替ボタンの表示テキストから取得
                const nameEl = document.querySelector('[id$="-trigger-company"] span');
                if (nameEl) { data.company_name = nameEl.textContent?.trim(); }
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

        // Method G(非同期fetch)は自分で resolve して return 済みなので、ここに来るのは同期系メソッドのみ
        resolve(data);
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
