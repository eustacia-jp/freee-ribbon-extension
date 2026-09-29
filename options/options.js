// options.js (デフォルトRegex表示修正版 - 完全版)
console.log("options.js: Script loading...");

// --- 定数 ---
// ★★★ デフォルトの正規表現を background.js と合わせる ★★★
const DEFAULT_STAGING_REGEX = '(stg-secure|aka|ao|kiiro)\\.freee\\.co\\.jp';
// ★★★ ここまで修正 ★★★
const DEFAULT_STAGING_COLOR = 'orange'; // background.js と合わせる
const DEFAULT_PRODUCTION_COLOR = 'red';
const DEFAULT_ROW_COLOR = '#2864f0'; // マッピング追加時のデフォルト色
const DEFAULT_SUB_RIBBON_COLOR = '#666666'; // 2段目のデフォルト色
const DEFAULT_RIBBON_OPACITY = 100; // リボン背景の不透明度デフォルト(100=不透明)
const MIN_RIBBON_OPACITY = 50; // これ未満は視認性が落ちすぎるため下限
const DEFAULT_HIDE_MODE = 'click-toggle'; // リボンを一時的に消す方法のデフォルト
const DEFAULT_CID_OVERRIDE = ''; // 事業所番号の上書き文字列のデフォルト(空=上書きしない)
const CID_OVERRIDE_REGEX = /^[A-Za-z0-9-]{0,18}$/; // 英数字とハイフン、最大18文字
// ★★★ デフォルトの正規表現を background.js / content.js と合わせる ★★★
const DEFAULT_DISABLED_URL_REGEX = '(invoice\\.secure\\.freee\\.co\\.jp|secure\\.freee\\.co\\.jp/ctax)'; // リボンを表示しないURLのデフォルト(空=制御なし)

// --- Helper Function: toHex ---
const toHex = (c) => {
    try {
        const num = Number(c);
        if (isNaN(num) || num < 0 || num > 255) return '00';
        const hex = num.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    } catch (e) {
        console.error("Error in toHex:", e);
        return '00';
    }
};
// console.log("options.js: toHex defined.");

// --- Helper Function: normalizeColorToHex (最終修正版) ---
function normalizeColorToHex(colorString) {
    try {
        if (!colorString) return '#000000';
        const str = String(colorString).trim().toLowerCase();
        if (!str) return '#000000';
        const hexRegex = /^#([0-9a-fA-F]{3}){1,2}$/;
        if (hexRegex.test(str)) {
            if (str.length === 4) { const r = str[1]; const g = str[2]; const b = str[3]; return `#${r}${r}${g}${g}${b}${b}`; }
            return str;
        }
        const tempDiv = document.createElement('div'); tempDiv.style.display = 'none';
        if (!document.body) { console.warn("normalizeColorToHex: document.body not available yet."); return '#000000'; }
        document.body.appendChild(tempDiv);
        let computedColor = '';
        try { tempDiv.style.color = 'transparent'; tempDiv.style.color = str; computedColor = window.getComputedStyle(tempDiv).color; }
        catch(e) { console.error("Err getComputedStyle:", e); computedColor = ''; }
        finally { if (tempDiv.parentNode === document.body) { document.body.removeChild(tempDiv); } }
        const rgbaMatch = computedColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
        if (rgbaMatch) { try { const r = parseInt(rgbaMatch[1], 10); const g = parseInt(rgbaMatch[2], 10); const b = parseInt(rgbaMatch[3], 10); if (!isNaN(r) && !isNaN(g) && !isNaN(b)) { return `#${toHex(r)}${toHex(g)}${toHex(b)}`; } else { console.error("Error parsing RGB:", computedColor); } } catch (e) { console.error("Error converting RGB:", computedColor, e); } }
        // console.warn("Could not normalize color:", colorString); // ログ削減
        return '#000000';
    } catch (e) {
        console.error("Unexpected error in normalizeColorToHex:", e);
        return '#000000';
    }
}
// console.log("options.js: normalizeColorToHex defined (Final Corrected).");

// 設定項目を読み込んでフォームに表示する関数
function restoreOptions() {
  // console.log("restoreOptions: Function started."); // ログ削減
  try {
      // ★ storage.get のデフォルト値も最新に合わせる ★
      chrome.storage.local.get({
        enabled: true, companyColors: {},
        ribbonOpacity: DEFAULT_RIBBON_OPACITY,
        hideMode: DEFAULT_HIDE_MODE,
        devSettings: {
            stagingRegex: DEFAULT_STAGING_REGEX, // 更新された定数を使用
            stagingColor: DEFAULT_STAGING_COLOR, // 更新された定数を使用
            productionColor: DEFAULT_PRODUCTION_COLOR,
            subRibbonColor: DEFAULT_SUB_RIBBON_COLOR,
            cidOverride: DEFAULT_CID_OVERRIDE,
            disabledUrlRegex: DEFAULT_DISABLED_URL_REGEX
        },
        companyNameCache: {}
       }, (items) => {
        if (chrome.runtime.lastError) { console.error("restoreOptions Error:", chrome.runtime.lastError.message); items = { enabled: true, companyColors:{}, ribbonOpacity: DEFAULT_RIBBON_OPACITY, hideMode: DEFAULT_HIDE_MODE, devSettings:{ stagingRegex: DEFAULT_STAGING_REGEX, stagingColor: DEFAULT_STAGING_COLOR, productionColor: DEFAULT_PRODUCTION_COLOR, subRibbonColor: DEFAULT_SUB_RIBBON_COLOR, cidOverride: DEFAULT_CID_OVERRIDE, disabledUrlRegex: DEFAULT_DISABLED_URL_REGEX }, companyNameCache:{} }; } // エラー時もデフォルト設定

        // --- フォームへの値設定 ---
        const enableRibbonCheckbox = document.getElementById('enableRibbon');
        const ribbonOpacityInput = document.getElementById('ribbonOpacity');
        const ribbonOpacityValueSpan = document.getElementById('ribbonOpacityValue');
        const hideModeClickToggleInput = document.getElementById('hideModeClickToggle');
        const hideModeHoverHideInput = document.getElementById('hideModeHoverHide');
        const mappingsDiv = document.getElementById('colorMappings');
        const stagingRegexInput = document.getElementById('stagingRegex');
        const stagingColorInput = document.getElementById('stagingColor');
        const stagingColorTextInput = document.getElementById('stagingColorText');
        const productionColorInput = document.getElementById('productionColor');
        const productionColorTextInput = document.getElementById('productionColorText');
        const defaultRegexDisplay = document.getElementById('defaultRegexDisplay');
        const subRibbonColorInput = document.getElementById('subRibbonColor');
        const subRibbonColorTextInput = document.getElementById('subRibbonColorText');
        const cidOverrideInput = document.getElementById('cidOverride');
        const disabledUrlRegexInput = document.getElementById('disabledUrlRegex');
        const defaultDisabledUrlRegexDisplay = document.getElementById('defaultDisabledUrlRegexDisplay');

        if (!enableRibbonCheckbox || !ribbonOpacityInput || !ribbonOpacityValueSpan || !hideModeClickToggleInput || !hideModeHoverHideInput || !mappingsDiv || !stagingRegexInput || !stagingColorInput || !stagingColorTextInput || !productionColorInput || !productionColorTextInput || !defaultRegexDisplay || !subRibbonColorInput || !subRibbonColorTextInput || !cidOverrideInput || !disabledUrlRegexInput || !defaultDisabledUrlRegexDisplay) {
            console.error("restoreOptions: One or more essential elements not found!"); return;
        }

        enableRibbonCheckbox.checked = items.enabled !== false;
        const storedRibbonOpacity = typeof items.ribbonOpacity === 'number' ? items.ribbonOpacity : DEFAULT_RIBBON_OPACITY;
        const ribbonOpacityValue = Math.min(100, Math.max(MIN_RIBBON_OPACITY, storedRibbonOpacity));
        ribbonOpacityInput.value = ribbonOpacityValue;
        ribbonOpacityValueSpan.textContent = ribbonOpacityValue;
        const hideModeValue = items.hideMode === 'hover-hide' ? 'hover-hide' : DEFAULT_HIDE_MODE;
        hideModeClickToggleInput.checked = hideModeValue === 'click-toggle';
        hideModeHoverHideInput.checked = hideModeValue === 'hover-hide';
        mappingsDiv.innerHTML = '';
        const companyColors = items.companyColors || {};
        const nameCache = items.companyNameCache || {};
        for (const cid in companyColors) { try { addMappingRow(cid, companyColors[cid], nameCache[cid] || ''); } catch (e) { console.error(`Error adding mapping row for ${cid}:`, e); } }
        const devSettings = items.devSettings || { stagingRegex: DEFAULT_STAGING_REGEX, stagingColor: DEFAULT_STAGING_COLOR, productionColor: DEFAULT_PRODUCTION_COLOR, subRibbonColor: DEFAULT_SUB_RIBBON_COLOR, cidOverride: DEFAULT_CID_OVERRIDE, disabledUrlRegex: DEFAULT_DISABLED_URL_REGEX }; // デフォルトを確実に適用

        stagingRegexInput.value = devSettings.stagingRegex || DEFAULT_STAGING_REGEX; // 保存値がなければ定数を使う

        const stagingColorValue = devSettings.stagingColor || DEFAULT_STAGING_COLOR;
        stagingColorTextInput.value = stagingColorValue;
        stagingColorInput.value = normalizeColorToHex(stagingColorValue);

        const productionColorValue = devSettings.productionColor || DEFAULT_PRODUCTION_COLOR;
        productionColorTextInput.value = productionColorValue;
        productionColorInput.value = normalizeColorToHex(productionColorValue);

        const subRibbonColorValue = devSettings.subRibbonColor || DEFAULT_SUB_RIBBON_COLOR;
        subRibbonColorTextInput.value = subRibbonColorValue;
        subRibbonColorInput.value = normalizeColorToHex(subRibbonColorValue);

        cidOverrideInput.value = devSettings.cidOverride || DEFAULT_CID_OVERRIDE;

        // 未設定(undefined)ならデフォルト値、保存済みの値が空文字列なら「制御なし」の明示的な指定として尊重する
        disabledUrlRegexInput.value = typeof devSettings.disabledUrlRegex === 'string' ? devSettings.disabledUrlRegex : DEFAULT_DISABLED_URL_REGEX;

        if (defaultRegexDisplay) {
            // ★★★ 表示するデフォルト値も更新された定数を使用 ★★★
            defaultRegexDisplay.textContent = `デフォルト：${DEFAULT_STAGING_REGEX}`;
        }
        if (defaultDisabledUrlRegexDisplay) {
            defaultDisabledUrlRegexDisplay.textContent = `デフォルト：${DEFAULT_DISABLED_URL_REGEX}`;
        }
        // console.log("restoreOptions: Function finished applying values."); // ログ削減
      });
  } catch (e) { console.error("Error calling chrome.storage.local.get:", e); }
}
// console.log("options.js: restoreOptions defined.");

// 設定を保存する関数 (検証ロジック最終調整版 + 2段目色)
function saveOptions() {
    // console.log("saveOptions: Function started.");
    try {
        const enabled = document.getElementById('enableRibbon').checked;
        const ribbonOpacityInput = document.getElementById('ribbonOpacity');
        let ribbonOpacity = ribbonOpacityInput ? parseInt(ribbonOpacityInput.value, 10) : DEFAULT_RIBBON_OPACITY;
        if (isNaN(ribbonOpacity)) ribbonOpacity = DEFAULT_RIBBON_OPACITY;
        ribbonOpacity = Math.min(100, Math.max(MIN_RIBBON_OPACITY, ribbonOpacity));
        const checkedHideModeInput = document.querySelector('input[name="hideMode"]:checked');
        const hideMode = checkedHideModeInput && checkedHideModeInput.value === 'hover-hide' ? 'hover-hide' : DEFAULT_HIDE_MODE;
        const companyColors = {};
        const mappings = document.querySelectorAll('.color-mapping');
        let validationError = false;
        const status = document.getElementById('status');
        if (!status) { console.error("Save Error: Status element not found!"); return; }
        status.textContent = ''; status.style.color = 'red';
        document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
        const stagingRegexInput = document.getElementById('stagingRegex');
        if (stagingRegexInput) stagingRegexInput.classList.remove('input-error');
        const stagingColorTextInput = document.getElementById('stagingColorText');
        if (stagingColorTextInput) stagingColorTextInput.classList.remove('input-error');
        const productionColorTextInput = document.getElementById('productionColorText');
        if (productionColorTextInput) productionColorTextInput.classList.remove('input-error');
        const subRibbonColorTextInput = document.getElementById('subRibbonColorText');
        if (subRibbonColorTextInput) subRibbonColorTextInput.classList.remove('input-error');
        const cidOverrideInput = document.getElementById('cidOverride');
        if (cidOverrideInput) cidOverrideInput.classList.remove('input-error');
        const disabledUrlRegexInput = document.getElementById('disabledUrlRegex');
        if (disabledUrlRegexInput) disabledUrlRegexInput.classList.remove('input-error');
        mappings.forEach(m => {
            m.querySelector('.company-id')?.classList.remove('input-error');
            m.querySelector('.color-text-input')?.classList.remove('input-error');
            m.querySelector('.color-value')?.classList.remove('input-error');
        });

        // Duplicate CID Check
        const seenCids = new Map();
        mappings.forEach((mapping) => {
            const cidInput = mapping.querySelector('.company-id');
            if (!cidInput) return;
            const cid = cidInput.value.trim();
            if (cid) {
                const formattedCid = cid.replace(/-/g, '').replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
                if (!/^\d{3}-\d{3}-\d{4}$/.test(formattedCid)) { status.textContent = `無効な事業所番号形式: ${cid}`; cidInput.classList.add('input-error'); validationError = true; }
                 else { if (!seenCids.has(formattedCid)) { seenCids.set(formattedCid, []); } seenCids.get(formattedCid).push(cidInput); }
            }
        });
        let duplicateFound = false;
        seenCids.forEach((elements, cid) => { if (elements.length > 1) { duplicateFound = true; elements.forEach(el => el.classList.add('input-error')); } });
        if (duplicateFound) { status.textContent = `事業所番号が重複しています`; validationError = true; }

        // Process mappings if no duplicate CID error so far
        if (!validationError) {
            mappings.forEach((mapping, index) => {
                if (validationError) return;
                const cidInput = mapping.querySelector('.company-id');
                const colorInput = mapping.querySelector('.color-value');
                const colorTextInput = mapping.querySelector('.color-text-input');
                if (!cidInput || !colorInput || !colorTextInput) { return; }
                const cid = cidInput.value.trim();
                const colorTextValue = colorTextInput.value.trim();
                const colorPickerValue = colorInput.value;
                const finalColorValue = colorTextValue || colorPickerValue;
                if (!cid && !colorTextValue) { return; } // Skip empty rows
                if (cid) {
                    const formattedCid = cid.replace(/-/g, '').replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
                    if (!colorTextValue && colorPickerValue === '#000000') { status.textContent = `事業所番号 ${formattedCid} の色が指定されていません`; colorTextInput.classList.add('input-error'); colorInput.classList.add('input-error'); validationError = true; return; }
                    if (!validationError) { companyColors[formattedCid] = finalColorValue; }
                }
                else if (!cid && colorTextValue) { status.textContent = `事業所番号が空で色が指定されています`; cidInput.classList.add('input-error'); validationError = true; return; }
            });
        }

        // Dev Settings Validation
        const stagingRegex = stagingRegexInput ? stagingRegexInput.value.trim() : '';
        const stagingColorText = stagingColorTextInput ? stagingColorTextInput.value.trim() : '';
        const stagingColorPicker = document.getElementById('stagingColor')?.value || '';
        const productionColorText = productionColorTextInput ? productionColorTextInput.value.trim() : '';
        const productionColorPicker = document.getElementById('productionColor')?.value || '';
        const subRibbonColorText = subRibbonColorTextInput ? subRibbonColorTextInput.value.trim() : '';
        const subRibbonColorPicker = document.getElementById('subRibbonColor')?.value || '';
        const cidOverride = cidOverrideInput ? cidOverrideInput.value.trim() : '';
        const disabledUrlRegex = disabledUrlRegexInput ? disabledUrlRegexInput.value.trim() : '';

        const devSettings = {
            stagingRegex: stagingRegex,
            stagingColor: stagingColorText || stagingColorPicker,
            productionColor: productionColorText || productionColorPicker,
            subRibbonColor: subRibbonColorText || subRibbonColorPicker,
            cidOverride: cidOverride,
            disabledUrlRegex: disabledUrlRegex
        };

        if (devSettings.stagingRegex === '') { if (!validationError) status.textContent = 'ステージングURLは空不可'; if(stagingRegexInput) stagingRegexInput.classList.add('input-error'); validationError = true; }
        if (!devSettings.stagingColor) { if (!validationError) status.textContent = 'ステージングの色が空'; if (stagingColorTextInput) stagingColorTextInput.classList.add('input-error'); validationError = true; }
        if (!devSettings.productionColor) { if (!validationError) status.textContent = '本番環境の色が空'; if (productionColorTextInput) productionColorTextInput.classList.add('input-error'); validationError = true; }
        if (!devSettings.subRibbonColor) { if (!validationError) status.textContent = '2段目リボンの色が空です'; if (subRibbonColorTextInput) subRibbonColorTextInput.classList.add('input-error'); validationError = true; }
        if (!CID_OVERRIDE_REGEX.test(devSettings.cidOverride)) { if (!validationError) status.textContent = '事業所番号の上書きは英数字とハイフンのみ、18文字以内で入力してください'; if (cidOverrideInput) cidOverrideInput.classList.add('input-error'); validationError = true; }
        if (devSettings.disabledUrlRegex !== '') { try { new RegExp(devSettings.disabledUrlRegex, 'i'); } catch (e) { if (!validationError) status.textContent = 'リボンを表示しないURLの正規表現が不正です'; if (disabledUrlRegexInput) disabledUrlRegexInput.classList.add('input-error'); validationError = true; } }

        // --- 保存処理 ---
        if (validationError) { setTimeout(() => { status.textContent = ''; status.style.color = 'green'; }, 3000); return; }

        const settingsToSave = { enabled, ribbonOpacity, hideMode, companyColors, devSettings };
        chrome.storage.local.set(settingsToSave, () => { // local storage
            const status = document.getElementById('status');
            if (!status) return;
            if (chrome.runtime.lastError) { console.error("Error saving:", chrome.runtime.lastError.message); status.textContent = `保存失敗: ${chrome.runtime.lastError.message}`; status.style.color = 'red'; setTimeout(() => { status.textContent=''; status.style.color='green'; }, 5000); }
            else { console.log("saveOptions: Settings saved successfully."); status.textContent = '設定を保存しました。'; status.style.color = 'green'; setTimeout(() => { status.textContent=''; }, 1500);
                chrome.tabs.query({ url: "https://*.freee.co.jp/*" }, (tabs) => { tabs.forEach(tab => { try { chrome.tabs.sendMessage(tab.id, { action: "settingsUpdated" }, (res)=>{if(chrome.runtime.lastError){}}); } catch (e) {} }); });
            }
        });
    } catch (error) {
         console.error("saveOptions: Unexpected error:", error);
         const status = document.getElementById('status');
         if (status) { status.textContent = `予期せぬエラー: ${error.message}`; status.style.color = 'red'; setTimeout(() => { status.textContent = ''; status.style.color = 'green'; }, 5000); }
    }
}
// console.log("options.js: saveOptions defined.");

// 事業所番号と色のマッピング行を追加する関数
function addMappingRow(cid = '', color = '#000000', name = '') {
  // console.log(`addMappingRow: Started.`); // ログ削減
  const mappingsDiv = document.getElementById('colorMappings');
  if (!mappingsDiv) { return; }
  const mappingDiv = document.createElement('div');
  mappingDiv.classList.add('color-mapping');
  try {
      const cidInput = document.createElement('input'); cidInput.type = 'text'; cidInput.classList.add('company-id'); cidInput.placeholder = '事業所番号 (例: 123-456-7890)'; cidInput.value = cid; mappingDiv.appendChild(cidInput);
      const colorInput = document.createElement('input'); colorInput.type = 'color'; colorInput.classList.add('color-value'); colorInput.value = normalizeColorToHex(color); mappingDiv.appendChild(colorInput);
      const colorTextInput = document.createElement('input'); colorTextInput.type = 'text'; colorTextInput.classList.add('color-text-input'); colorTextInput.placeholder = '色名 or #HEX'; colorTextInput.value = color; mappingDiv.appendChild(colorTextInput);
      const nameSpan = document.createElement('span'); nameSpan.classList.add('company-name-display'); nameSpan.textContent = name; nameSpan.title = name; mappingDiv.appendChild(nameSpan);
      const removeButton = document.createElement('button'); removeButton.type = 'button'; removeButton.textContent = '削除'; removeButton.addEventListener('click', () => { mappingDiv.remove(); }); mappingDiv.appendChild(removeButton);
      // Event listeners
      colorTextInput.addEventListener('input', (e) => { colorInput.value = normalizeColorToHex(e.target.value); });
      colorInput.addEventListener('input', (e) => { colorTextInput.value = e.target.value; });
      mappingsDiv.appendChild(mappingDiv);
  } catch (error) { console.error("addMappingRow: Error:", error); }
}
// console.log("options.js: addMappingRow defined.");

// ★★★ 設定エクスポート関数 ★★★
function exportSettings() {
    console.log("Export button clicked.");
    const keysToExport = ['enabled', 'ribbonOpacity', 'hideMode', 'companyColors', 'devSettings'];
    chrome.storage.local.get(keysToExport, (items) => {
        if (chrome.runtime.lastError) { console.error("Error getting settings for export:", chrome.runtime.lastError.message); alert("設定のエクスポート中にエラーが発生しました。"); return; }
        const settingsToExport = {
            enabled: typeof items.enabled !== 'undefined' ? items.enabled : true,
            ribbonOpacity: typeof items.ribbonOpacity === 'number' ? items.ribbonOpacity : DEFAULT_RIBBON_OPACITY,
            hideMode: items.hideMode === 'hover-hide' ? 'hover-hide' : DEFAULT_HIDE_MODE,
            companyColors: items.companyColors || {},
            devSettings: {
                stagingRegex: items.devSettings?.stagingRegex ?? DEFAULT_STAGING_REGEX,
                stagingColor: items.devSettings?.stagingColor ?? DEFAULT_STAGING_COLOR,
                productionColor: items.devSettings?.productionColor ?? DEFAULT_PRODUCTION_COLOR,
                subRibbonColor: items.devSettings?.subRibbonColor ?? DEFAULT_SUB_RIBBON_COLOR,
                cidOverride: items.devSettings?.cidOverride ?? DEFAULT_CID_OVERRIDE,
                disabledUrlRegex: typeof items.devSettings?.disabledUrlRegex === 'string' ? items.devSettings.disabledUrlRegex : DEFAULT_DISABLED_URL_REGEX
            }
        };
        const jsonString = JSON.stringify(settingsToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date();
        const dateString = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
        a.download = `freee-ribbon-settings-${dateString}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        console.log("Settings exported.");
        const ioStatus = document.getElementById('io-status');
        if(ioStatus) { ioStatus.textContent = '設定をエクスポートしました。'; ioStatus.style.color = 'green'; setTimeout(() => ioStatus.textContent = '', 2000); }
    });
}

// ★★★ 設定インポート関数 (メッセージ修正) ★★★
function importSettings(file) {
    if (!file) { return; }
    // console.log("Import file selected:", file.name); // ログ削減
    const reader = new FileReader();
    const ioStatus = document.getElementById('io-status');

    reader.onload = (event) => {
        try {
            const jsonString = event.target.result;
            const importedSettings = JSON.parse(jsonString);
            // console.log("Parsed imported settings:", importedSettings); // ログ削減
            if (typeof importedSettings !== 'object' || importedSettings === null) { throw new Error("無効なファイル形式です。"); }
            const requiredKeys = ['enabled', 'companyColors', 'devSettings'];
            if (!requiredKeys.every(key => key in importedSettings)) { throw new Error("設定ファイルの形式が正しくありません。(必須キー不足)"); }
            if (typeof importedSettings.devSettings !== 'object' || importedSettings.devSettings === null) { throw new Error("devSettings の形式が正しくありません。"); }

            const settingsToSave = {
                enabled: typeof importedSettings.enabled !== 'undefined' ? importedSettings.enabled : true,
                ribbonOpacity: typeof importedSettings.ribbonOpacity === 'number' ? importedSettings.ribbonOpacity : DEFAULT_RIBBON_OPACITY,
                hideMode: importedSettings.hideMode === 'hover-hide' ? 'hover-hide' : DEFAULT_HIDE_MODE,
                companyColors: importedSettings.companyColors || {},
                devSettings: {
                    stagingRegex: importedSettings.devSettings.stagingRegex || DEFAULT_STAGING_REGEX,
                    stagingColor: importedSettings.devSettings.stagingColor || DEFAULT_STAGING_COLOR,
                    productionColor: importedSettings.devSettings.productionColor || DEFAULT_PRODUCTION_COLOR,
                    subRibbonColor: importedSettings.devSettings.subRibbonColor || DEFAULT_SUB_RIBBON_COLOR,
                    cidOverride: CID_OVERRIDE_REGEX.test(importedSettings.devSettings.cidOverride || '') ? (importedSettings.devSettings.cidOverride || DEFAULT_CID_OVERRIDE) : DEFAULT_CID_OVERRIDE,
                    disabledUrlRegex: (() => {
                        const v = importedSettings.devSettings.disabledUrlRegex;
                        if (typeof v !== 'string') return DEFAULT_DISABLED_URL_REGEX;
                        if (v === '') return '';
                        try { new RegExp(v, 'i'); return v; } catch (e) { return DEFAULT_DISABLED_URL_REGEX; }
                    })()
                }
            };
            chrome.storage.local.set(settingsToSave, () => {
                if (chrome.runtime.lastError) { console.error("Error saving imported settings:", chrome.runtime.lastError.message); if(ioStatus) { ioStatus.textContent = `インポート失敗: ${chrome.runtime.lastError.message}`; ioStatus.style.color = 'red'; } }
                else {
                    console.log("Settings imported and saved successfully.");
                    if(ioStatus) { ioStatus.textContent = '設定がインポートされ、自動的に保存されました。'; ioStatus.style.color = 'green'; }
                    restoreOptions(); // 画面に反映
                    setTimeout(() => { if(ioStatus) { ioStatus.textContent = ''; ioStatus.style.color = 'green'; } }, 3000);
                }
            });
        } catch (error) {
            console.error("Error parsing or validating import file:", error);
            if(ioStatus) { ioStatus.textContent = `インポートエラー: ${error.message}`; ioStatus.style.color = 'red'; }
            setTimeout(() => { if(ioStatus) { ioStatus.textContent = ''; ioStatus.style.color = 'green'; } }, 3000);
        }
    };
    reader.onerror = (event) => {
        console.error("Error reading file:", event.target.error);
        if(ioStatus) { ioStatus.textContent = 'ファイルの読み込みに失敗しました。'; ioStatus.style.color = 'red'; }
        setTimeout(() => { if(ioStatus) { ioStatus.textContent = ''; ioStatus.style.color = 'green'; } }, 3000);
    };
    reader.readAsText(file);
}

// ★★★ インポートボタンクリック時の処理 ★★★
function triggerImport() {
    // console.log("Import button clicked."); // ログ削減
    const fileInput = document.getElementById('importFile');
    if (fileInput) { fileInput.click(); }
}

// --- イベントリスナー登録 ---
function initializeOptionsPage() {
    // console.log("options.js: Initializing options page...");
    try {
        restoreOptions();
        // 保存ボタン
        const saveButton = document.getElementById('save');
        if (saveButton) { saveButton.addEventListener('click', saveOptions); } else { console.error("options.js: Save button not found!"); }
        // 不透明度スライダー
        const ribbonOpacityInput = document.getElementById('ribbonOpacity');
        const ribbonOpacityValueSpan = document.getElementById('ribbonOpacityValue');
        if (ribbonOpacityInput && ribbonOpacityValueSpan) { ribbonOpacityInput.addEventListener('input', (e) => { ribbonOpacityValueSpan.textContent = e.target.value; }); } else { console.error("options.js: Ribbon opacity elements not found!"); }
        // マッピング追加ボタン
        const addMappingButton = document.getElementById('addMapping');
        if (addMappingButton) { addMappingButton.addEventListener('click', () => { addMappingRow('', DEFAULT_ROW_COLOR, ''); }); } else { console.error("options.js: Add Mapping button not found!"); }
        // Dev color sync listeners
        const stagingColorText = document.getElementById('stagingColorText');
        const stagingColor = document.getElementById('stagingColor');
        const productionColorText = document.getElementById('productionColorText');
        const productionColor = document.getElementById('productionColor');
        const subRibbonColorText = document.getElementById('subRibbonColorText');
        const subRibbonColor = document.getElementById('subRibbonColor');
        if (stagingColorText && stagingColor) { stagingColorText.addEventListener('input', (e) => { stagingColor.value = normalizeColorToHex(e.target.value); }); stagingColor.addEventListener('input', (e) => { stagingColorText.value = e.target.value; }); } else { console.error("options.js: Staging color elements not found!"); }
        if (productionColorText && productionColor) { productionColorText.addEventListener('input', (e) => { productionColor.value = normalizeColorToHex(e.target.value); }); productionColor.addEventListener('input', (e) => { productionColorText.value = e.target.value; }); } else { console.error("options.js: Production color elements not found!"); }
        if (subRibbonColorText && subRibbonColor) { subRibbonColorText.addEventListener('input', (e) => { subRibbonColor.value = normalizeColorToHex(e.target.value); }); subRibbonColor.addEventListener('input', (e) => { subRibbonColorText.value = e.target.value; }); } else { console.error("options.js: Sub ribbon color elements not found!"); }
        // インポート/エクスポートボタンのリスナー
        const exportButton = document.getElementById('exportSettings');
        if (exportButton) { exportButton.addEventListener('click', exportSettings); } else { console.error("options.js: Export button not found!"); }
        const importButton = document.getElementById('importSettings');
        if (importButton) { importButton.addEventListener('click', triggerImport); } else { console.error("options.js: Import button not found!"); }
        const fileInput = document.getElementById('importFile');
        if (fileInput) { fileInput.addEventListener('change', (event) => { const file = event.target.files[0]; if (file) { importSettings(file); } event.target.value = null; }); } else { console.error("options.js: File input not found!"); }
    } catch (error) { console.error("options.js: Error during initialization:", error); }
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initializeOptionsPage); }
else { initializeOptionsPage(); }
// console.log("options.js: Script execution finished.");
