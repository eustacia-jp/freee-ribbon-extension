// content.js (色優先度変更版 - 完全版)
console.log("freee Ribbon content script loaded (Color Priority Changed - Complete).");

let ribbonElement = null; // リボン全体のコンテナ要素 (#freee-ribbon-extension)
let currentSettings = {}; // オプション設定
let isVisible = true; // 表示状態フラグ (ポップアップから制御)
let isEnabledGlobally = true; // オプション設定での有効/無効フラグ
let currentFreeeData = null; // 現在のページから取得したデータ
let listenerAttached = false; // メッセージリスナー登録フラグ

// リボン要素(コンテナ)を作成または取得する関数
function getOrCreateRibbon() {
    const existingRibbon = document.getElementById('freee-ribbon-extension');
    if (existingRibbon) {
        ribbonElement = existingRibbon;
    } else if (!ribbonElement) {
        ribbonElement = document.createElement('div');
        ribbonElement.id = 'freee-ribbon-extension';
        ribbonElement.style.display = 'none'; // 初期状態は非表示
        // クリックイベントリスナー (コンテナに設定)
        ribbonElement.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (ribbonElement) {
                ribbonElement.classList.toggle('moved'); // 位置切り替えクラス
            }
        });
        // bodyに要素を追加 (DOMContentLoaded後を考慮)
        if (document.body) {
            document.body.appendChild(ribbonElement);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                if (document.body) {
                    document.body.appendChild(ribbonElement);
                }
            });
        }
    }
    if (!ribbonElement) {
        console.error("freee Ribbon: Failed to get or create ribbon element!");
    }
    return ribbonElement;
}

// 受け取ったデータをもとにリボンのDOMを更新する関数 (色決定ロジック変更済み)
function updateRibbonDOM(freeeData) {
    const ribbonContainer = getOrCreateRibbon();
    if (!ribbonContainer) { return; }

    // 表示制御 (external_cid があれば表示試行)
    if (!isEnabledGlobally || !isVisible || !freeeData || !freeeData.external_cid) {
        // console.log("Hiding ribbon: Disabled, hidden, or no external_cid."); // ログ削減
        ribbonContainer.classList.add('hidden');
        ribbonContainer.style.display = 'none';
        return;
    }

    // --- リボン表示処理 ---
    const { external_cid } = freeeData; // external_cid は必須
    const displayName = freeeData.company_name || '[unknown]'; // 名前がなければ [unknown]
    const url = window.location.href;
    const devSettings = currentSettings.devSettings || {};
    const companyColors = currentSettings.companyColors || {};
    let ribbonColor = ''; // リボン色
    let isStaging = false; // ステージング判定
    let stagingEnvName = ''; // ステージング名

    // ステージング判定と名前取得
    const stagingRegexStr = devSettings.stagingRegex || '(xx-secure|aka|ao|midori)\\.freee\\.co\\.jp'; // デフォルト値を使用
    try {
        const match = url.match(new RegExp(stagingRegexStr, 'i'));
        if (match) {
            isStaging = true;
            stagingEnvName = match[1] || 'Staging'; // カッコで囲まれた部分 or "Staging"
        }
    } catch (e) {
         console.error("Error matching staging regex:", e);
    }

    // ★★★ 色決定ロジック (優先度変更済み) ★★★
    if (isStaging) {
        // 優先度1: ステージング環境
        ribbonColor = devSettings.stagingColor || 'orange'; // ステージング色を適用
        // console.log("Color set by: Staging Default"); // ログ削減
    } else {
        // ステージングでない場合
        const userDefinedColor = companyColors[external_cid];
        if (userDefinedColor) {
            // 優先度2: 事業所ごとの色設定
            ribbonColor = userDefinedColor; // 個別設定色を適用
            // console.log("Color set by: User Defined"); // ログ削減
        } else {
            // 優先度3: 本番環境のデフォルト色
            ribbonColor = devSettings.productionColor || 'red'; // 本番色を適用
            // console.log("Color set by: Production Default"); // ログ削減
        }
    }
    // ★★★ ここまで ★★★

    const subRibbonColor = devSettings.subRibbonColor || '#666666'; // 2段目の色

    // 1段目 HTML
    const nameHTML = `<span class="ribbon-text">${displayName}</span>`;
    const titleText = `${displayName} (${external_cid})`;
    const mainRibbonHTML = `<div class="ribbon-main" style="background-color: ${ribbonColor};" title="${titleText}">${nameHTML}</div>`;

    // 2段目 HTML (ステージング名表示ロジックは isStaging を使うので変更不要)
    const subRibbonText = isStaging ? `${stagingEnvName}: ${external_cid}` : external_cid;
    const subRibbonHTML = `<div class="ribbon-sub" style="background-color: ${subRibbonColor};" title="${titleText}">${subRibbonText}</div>`;

    // コンテナに設定 & 表示
    ribbonContainer.innerHTML = mainRibbonHTML + subRibbonHTML;
    ribbonContainer.classList.remove('hidden');
    ribbonContainer.style.display = 'block';
}


// 設定読み込み関数 (local storage 使用)
function loadSettingsAndApply() {
  // console.log("freee Ribbon: Loading settings from LOCAL storage..."); // ログ削減
  chrome.storage.local.get({
    enabled: true,
    companyColors: {},
    devSettings: {
        stagingRegex: '(xx-secure|aka|ao|midori)\\.freee\\.co\\.jp', // デフォルト値
        stagingColor: 'orange', // デフォルト値
        productionColor: 'red',
        subRibbonColor: '#666666'
    }
   }, (items) => {
     if (chrome.runtime.lastError) { console.error("freee Ribbon: Error loading from LOCAL:", chrome.runtime.lastError.message); items = { enabled: true, companyColors:{}, devSettings:{ stagingRegex: '(xx-secure|aka|ao|midori)\\.freee\\.co\\.jp', stagingColor: 'orange', productionColor: 'red', subRibbonColor: '#666666' } }; }
     currentSettings = items;
     isEnabledGlobally = items.enabled !== false;
     // console.log(`freee Ribbon: Settings loaded from LOCAL. Global enabled: ${isEnabledGlobally}`); // ログ削減
     if (isEnabledGlobally) {
         requestInitialData();
         if (!listenerAttached) {
             attachMessageListener();
             listenerAttached = true;
         }
     } else {
         console.log("freee Ribbon: Extension is disabled by settings.");
         updateRibbonDOM(null);
     }
  });
}

// データ取得要求関数
function requestInitialData() {
    if (isEnabledGlobally) {
        // console.log("freee Ribbon: ---> Sending getFreeePageData message..."); // ログ削減
        chrome.runtime.sendMessage({ action: "getFreeePageData" }, handleBackgroundResponse);
    }
}

// バックグラウンドからの応答を処理する共通関数
function handleBackgroundResponse(response) {
     // console.log("freee Ribbon: <--- sendMessage CALLBACK EXECUTED. Response:", response); // ログ削減
     if (chrome.runtime.lastError) {
         console.error("Error receiving message:", chrome.runtime.lastError.message);
         updateRibbonDOM(null);
         return;
     }
     if (response && response.success && response.data) {
         currentFreeeData = response.data;
         updateRibbonDOM(currentFreeeData);
     } else {
         console.warn("Received unsuccessful response or no data from background.", response);
         if (!currentFreeeData) { updateRibbonDOM(null); }
     }
 }

// --- メイン処理 ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSettingsAndApply);
} else {
    loadSettingsAndApply();
}

// 拡張機能メッセージリスナー定義 (ポップアップ連携版)
const messageListenerCallback = (request, sender, sendResponse) => {
    // console.log("freee Ribbon: Message received in content script:", request); // ログ削減
    if (request.action === "showRibbon") {
        isVisible = true;
        updateRibbonDOM(currentFreeeData);
        sendResponse({ success: true, isVisible: isVisible });
        return true;
    } else if (request.action === "hideRibbon") {
        isVisible = false;
        updateRibbonDOM(currentFreeeData);
        sendResponse({ success: true, isVisible: isVisible });
        return true;
    } else if (request.action === "settingsUpdated") {
        console.log("freee Ribbon: Settings updated message received. Reloading settings...");
        loadSettingsAndApply();
        sendResponse({ success: true });
        return true;
    } else if (request.action === "getRibbonState") {
         sendResponse({ success: true, isVisible: isVisible });
         return true;
    }
    return false;
};

// リスナー登録関数
function attachMessageListener() {
    // console.log("freee Ribbon: Attaching final onMessage listener..."); // ログ削減
    try {
        if (!chrome.runtime.onMessage.hasListener(messageListenerCallback)) {
             chrome.runtime.onMessage.addListener(messageListenerCallback);
             // console.log("freee Ribbon: Final onMessage listener attached."); // ログ削減
        }
    }
    catch (error) {
        console.error("freee Ribbon: Failed to attach listener:", error);
    }
}

console.log("freee Ribbon content script loaded (Color Priority Changed - Complete).");
