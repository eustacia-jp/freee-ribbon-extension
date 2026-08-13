// popup.js (アクティブ表示修正版 - 完全版)

const showButton = document.getElementById('showRibbon');
const hideButton = document.getElementById('hideRibbon');

// --- Helper Function: Check if the tab is a valid freee page ---
// manifest.json の matches と exclude_matches に基づいてチェック
function isTargetFreeePage(url) {
    if (!url) return false;

    // matches pattern (簡易チェック: *.freee.co.jp)
    const matchPattern = /^https?:\/\/([a-zA-Z0-9-]+\.)*freee\.co\.jp\//;
    if (!matchPattern.test(url)) {
        return false;
    }

    // exclude patterns
    const excludePatterns = [
        /^https?:\/\/support\.freee\.co\.jp\//,
        /^https?:\/\/brand\.freee\.co\.jp\//,
        /^https?:\/\/a11y-guidelines\.freee\.co\.jp\//
    ];
    for (const pattern of excludePatterns) {
        if (pattern.test(url)) {
            return false; // 除外パターンに一致したら false
        }
    }

    // どの除外パターンにも一致しなければ true
    return true;
}

// --- Update Button State ---
// ボタンのアクティブ状態を更新する (ロジック修正済み)
function updateButtonState(isVisible) {
    if (!showButton || !hideButton) return; // 要素がなければ何もしない

    if (isVisible) {
        // 表示されている場合：非表示ボタンをアクティブに
        showButton.classList.remove('active');
        hideButton.classList.add('active');
    } else {
        // 非表示の場合：表示ボタンをアクティブに
        showButton.classList.add('active');
        hideButton.classList.remove('active');
    }
    // 状態が取得できたらボタンを有効化
    showButton.disabled = false;
    hideButton.disabled = false;
}

// --- Initialize Popup ---
// ポップアップが開かれたときの初期化処理
document.addEventListener('DOMContentLoaded', () => {
    if (!showButton || !hideButton) {
         console.error("Popup buttons not found!");
         return;
    }
    // ボタンを初期状態で無効化
    showButton.disabled = true;
    hideButton.disabled = true;

    // 現在アクティブなタブの情報を取得
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError || !tabs || tabs.length === 0) {
            console.error("Popup: Could not query active tab.", chrome.runtime.lastError?.message);
            // エラーの場合もボタンは無効のまま
            return;
        }
        const currentTab = tabs[0];

        // ★★★ 現在のタブが対象の freee ページかチェック ★★★
        if (currentTab.id && isTargetFreeePage(currentTab.url)) {
            // 対象ページの場合のみ content script に状態を問い合わせる
            // console.log("Popup: Sending getRibbonState to tab", currentTab.id); // ログ削減
            chrome.tabs.sendMessage(currentTab.id, { action: "getRibbonState" }, (response) => {
                if (chrome.runtime.lastError) {
                    // content script が応答しない場合 (読み込み途中など)
                    console.warn("Popup: Could not get ribbon state (maybe script not ready?).", chrome.runtime.lastError.message);
                    // ボタンは無効のまま
                    return;
                }
                if (response && response.success) {
                    // console.log("Popup: Received ribbon state:", response.isVisible); // ログ削減
                    updateButtonState(response.isVisible); // ボタンの状態を更新
                } else {
                     console.warn("Popup: Failed to get ribbon state from content script.", response);
                     // 応答が失敗した場合もボタンは無効のまま
                }
            });
        } else {
            // 対象外のページの場合
            console.log("Popup: Not a target freee page. Buttons remain disabled.");
            // ここでボタンを非表示にしたり、メッセージを表示したりすることも可能
            // 例: document.body.innerHTML = '<p style="font-size: 12px; color: #666;">このページでは操作できません。</p>';
        }
    });
});

// --- Button Click Handlers ---
// 「リボンを表示」ボタンのクリックイベント
showButton?.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError || !tabs || tabs.length === 0 || !tabs[0].id) {
             console.error("ShowRibbon Error: Could not query active tab.");
             return;
        }
        const currentTab = tabs[0];
        // ★★★ 対象ページかチェックしてからメッセージ送信 ★★★
        if (isTargetFreeePage(currentTab.url)) {
            // console.log("Popup: Sending showRibbon to tab", currentTab.id); // ログ削減
            chrome.tabs.sendMessage(tabs[0].id, { action: "showRibbon" }, (response) => {
                if (chrome.runtime.lastError) { console.error("ShowRibbon Error:", chrome.runtime.lastError.message); return; }
                if (response && response.success) {
                    // console.log("Popup: showRibbon successful. New state:", response.isVisible); // ログ削減
                    updateButtonState(response.isVisible);
                }
            });
        } else {
             console.log("Popup: showRibbon clicked on non-target page.");
        }
    });
});

// 「リボンを隠す」ボタンのクリックイベント
hideButton?.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError || !tabs || tabs.length === 0 || !tabs[0].id) {
             console.error("HideRibbon Error: Could not query active tab.");
             return;
        }
        const currentTab = tabs[0];
         // ★★★ 対象ページかチェックしてからメッセージ送信 ★★★
        if (isTargetFreeePage(currentTab.url)) {
            // console.log("Popup: Sending hideRibbon to tab", currentTab.id); // ログ削減
            chrome.tabs.sendMessage(tabs[0].id, { action: "hideRibbon" }, (response) => {
                if (chrome.runtime.lastError) { console.error("HideRibbon Error:", chrome.runtime.lastError.message); return; }
                if (response && response.success) {
                    // console.log("Popup: hideRibbon successful. New state:", response.isVisible); // ログ削減
                    updateButtonState(response.isVisible);
                }
            });
        } else {
             console.log("Popup: hideRibbon clicked on non-target page.");
        }
    });
});
