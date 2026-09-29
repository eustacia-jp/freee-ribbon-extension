// content.js (色優先度変更版 - 完全版)
console.log("freee Ribbon content script loaded (Color Priority Changed - Complete).");

let ribbonElement = null; // リボン全体のコンテナ要素 (#freee-ribbon-extension)
let currentSettings = {}; // オプション設定
let isVisible = true; // 表示状態フラグ (ポップアップから制御)
let isEnabledGlobally = true; // オプション設定での有効/無効フラグ
let currentFreeeData = null; // 現在のページから取得したデータ
let listenerAttached = false; // メッセージリスナー登録フラグ
let isHoverHidden = false; // 「ホバーで消える」モードで現在消えている状態か
let hoverHideRect = null; // 消える直前に記憶したリボンの表示範囲
let hoverHideListenerAttached = false; // mousemove監視リスナー登録フラグ

// リボン要素(コンテナ)を作成または取得する関数
function getOrCreateRibbon() {
    const existingRibbon = document.getElementById('freee-ribbon-extension');
    if (existingRibbon) {
        ribbonElement = existingRibbon;
    } else if (!ribbonElement) {
        ribbonElement = document.createElement('div');
        ribbonElement.id = 'freee-ribbon-extension';
        ribbonElement.style.display = 'none'; // 初期状態は非表示
        // クリックイベントリスナー (コンテナに設定、「クリックで位置切替」モードのときだけ動作)
        ribbonElement.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (ribbonElement && currentSettings.hideMode !== 'hover-hide') {
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

// 「マウスをのせると自動的に消える」モード用のmousemoveハンドラ
// リボン自身をpointer-events:noneにするため、リボンの座標は消える直前に記憶し、
// document全体のmousemoveでその範囲からマウスが出たかどうかを判定する(チラつき防止)
function handleMouseMoveForHoverHide(e) {
    if (!ribbonElement || ribbonElement.classList.contains('hidden')) { return; }
    if (!isHoverHidden) {
        const rect = ribbonElement.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
            hoverHideRect = rect;
            isHoverHidden = true;
            ribbonElement.classList.add('hover-peek');
        }
    } else if (hoverHideRect) {
        if (e.clientX < hoverHideRect.left || e.clientX > hoverHideRect.right || e.clientY < hoverHideRect.top || e.clientY > hoverHideRect.bottom) {
            isHoverHidden = false;
            hoverHideRect = null;
            if (ribbonElement) { ribbonElement.classList.remove('hover-peek'); }
        }
    }
}

// 設定に応じてmousemove監視の付け外しを行う
function updateHoverHideListenerState() {
    const shouldBeActive = isEnabledGlobally && currentSettings.hideMode === 'hover-hide';
    if (shouldBeActive && !hoverHideListenerAttached) {
        document.addEventListener('mousemove', handleMouseMoveForHoverHide);
        hoverHideListenerAttached = true;
    } else if (!shouldBeActive && hoverHideListenerAttached) {
        document.removeEventListener('mousemove', handleMouseMoveForHoverHide);
        hoverHideListenerAttached = false;
        isHoverHidden = false;
        hoverHideRect = null;
        if (ribbonElement) { ribbonElement.classList.remove('hover-peek'); }
    }
}

// 色文字列(色名 or #HEX)を指定アルファ値のrgba()文字列に変換する関数
function colorToRgba(colorString, alpha) {
    try {
        const tempDiv = document.createElement('div');
        tempDiv.style.display = 'none';
        tempDiv.style.color = colorString;
        document.body.appendChild(tempDiv);
        const computedColor = window.getComputedStyle(tempDiv).color;
        document.body.removeChild(tempDiv);
        const rgbaMatch = computedColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
        if (rgbaMatch) {
            return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${alpha})`;
        }
    } catch (e) {
        console.error("freee Ribbon: Error converting color to rgba:", e);
    }
    return colorString; // 変換失敗時は元の色文字列をそのまま使う(不透明度は適用されない)
}

// 受け取ったデータをもとにリボンのDOMを更新する関数 (色決定ロジック変更済み)
function updateRibbonDOM(freeeData) {
    const ribbonContainer = getOrCreateRibbon();
    if (!ribbonContainer) { return; }

    const url = window.location.href;
    const devSettings = currentSettings.devSettings || {};

    // このURLがリボン非表示の対象かどうかチェック
    // (未設定時はデフォルト値を使用。保存済みの値が空文字列なら明示的な「制御なし」として扱う)
    let isDisabledByUrl = false;
    const disabledUrlRegexStr = typeof devSettings.disabledUrlRegex === 'string'
        ? devSettings.disabledUrlRegex.trim()
        : '(invoice\\.secure\\.freee\\.co\\.jp|secure\\.freee\\.co\\.jp/ctax)';
    if (disabledUrlRegexStr) {
        try {
            isDisabledByUrl = new RegExp(disabledUrlRegexStr, 'i').test(url);
        } catch (e) {
            console.error("freee Ribbon: Invalid disabledUrlRegex:", e);
        }
    }

    // 表示制御 (external_cid があれば表示試行)
    if (!isEnabledGlobally || !isVisible || !freeeData || !freeeData.external_cid || isDisabledByUrl) {
        // console.log("Hiding ribbon: Disabled, hidden, no external_cid, or URL matched disabledUrlRegex."); // ログ削減
        ribbonContainer.classList.add('hidden');
        ribbonContainer.style.display = 'none';
        // 「ホバーで消える」状態のまま非表示になった場合に備えてリセット
        ribbonContainer.classList.remove('hover-peek');
        isHoverHidden = false;
        hoverHideRect = null;
        return;
    }

    // --- リボン表示処理 ---
    const { external_cid } = freeeData; // external_cid は必須
    const displayName = freeeData.company_name || '[unknown]'; // 名前がなければ [unknown]
    const companyColors = currentSettings.companyColors || {};
    let ribbonColor = ''; // リボン色
    let isStaging = false; // ステージング判定
    let stagingEnvName = ''; // ステージング名

    // ステージング判定と名前取得
    const stagingRegexStr = devSettings.stagingRegex || '(stg-secure|aka|ao|kiiro)\\.freee\\.co\\.jp'; // デフォルト値を使用
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

    // 事業所番号の上書き(スクリーンショット等でダミー表示にしたい場合)
    const cidOverride = (devSettings.cidOverride || '').trim();
    const displayedCid = cidOverride || external_cid;

    // 背景の不透明度 (50-100 -> 0.5-1)。100(不透明)の場合は元の色文字列のまま使う
    const ribbonOpacity = typeof currentSettings.ribbonOpacity === 'number' ? currentSettings.ribbonOpacity : 100;
    const alpha = Math.min(100, Math.max(50, ribbonOpacity)) / 100;
    const mainBgColor = alpha < 1 ? colorToRgba(ribbonColor, alpha) : ribbonColor;
    const subBgColor = alpha < 1 ? colorToRgba(subRibbonColor, alpha) : subRibbonColor;

    // 1段目 HTML
    const nameHTML = `<span class="ribbon-text">${displayName}</span>`;
    const titleText = `${displayName} (${displayedCid})`;
    const mainRibbonHTML = `<div class="ribbon-main" style="background-color: ${mainBgColor};" title="${titleText}">${nameHTML}</div>`;

    // 2段目 HTML (ステージング名表示ロジックは isStaging を使うので変更不要)
    const subRibbonText = isStaging ? `${stagingEnvName}: ${displayedCid}` : displayedCid;
    const subRibbonHTML = `<div class="ribbon-sub" style="background-color: ${subBgColor};" title="${titleText}">${subRibbonText}</div>`;

    // コンテナに設定 & 表示 (再表示のたびにホバー消去状態はリセットする)
    ribbonContainer.innerHTML = mainRibbonHTML + subRibbonHTML;
    ribbonContainer.classList.remove('hidden');
    ribbonContainer.classList.remove('hover-peek');
    isHoverHidden = false;
    hoverHideRect = null;
    ribbonContainer.style.display = 'block';
}


// 設定読み込み関数 (local storage 使用)
function loadSettingsAndApply() {
  // console.log("freee Ribbon: Loading settings from LOCAL storage..."); // ログ削減
  chrome.storage.local.get({
    enabled: true,
    ribbonOpacity: 100,
    hideMode: 'click-toggle',
    companyColors: {},
    devSettings: {
        stagingRegex: '(stg-secure|aka|ao|kiiro)\\.freee\\.co\\.jp', // デフォルト値
        stagingColor: 'orange', // デフォルト値
        productionColor: 'red',
        subRibbonColor: '#666666',
        cidOverride: ''
    }
   }, (items) => {
     if (chrome.runtime.lastError) { console.error("freee Ribbon: Error loading from LOCAL:", chrome.runtime.lastError.message); items = { enabled: true, ribbonOpacity: 100, hideMode: 'click-toggle', companyColors:{}, devSettings:{ stagingRegex: '(stg-secure|aka|ao|kiiro)\\.freee\\.co\\.jp', stagingColor: 'orange', productionColor: 'red', subRibbonColor: '#666666', cidOverride: '' } }; }
     currentSettings = items;
     isEnabledGlobally = items.enabled !== false;
     // console.log(`freee Ribbon: Settings loaded from LOCAL. Global enabled: ${isEnabledGlobally}`); // ログ削減
     updateHoverHideListenerState();
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
