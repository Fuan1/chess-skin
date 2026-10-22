const syncData = {};

// 기본 설정
const defaultConfig = {
  skinTheme: "animal",
  skinEnabled: false, // 초기 설치시 비활성화
  mapEnabled: true, // 초기 설치시 활성화
  soundEnabled: true, // 사운드 기본값 추가
  customSkins: [],
};

const STORAGE_KEY_PREFIX = "skinFiles_";

async function isImageExists(path) {
  try {
    const response = await fetch(path);
    return response.ok;
  } catch (error) {
    console.log(`이미지를 찾을 수 없음: ${path}`);
    return false;
  }
}

function isCustomSkin(skinId) {
  return skinId.startsWith("custom_");
}

async function getCustomSkinImageURL(skinId) {
  try {
    const result = await new Promise((resolve) => {
      chrome.storage.local.get([`skinFiles_${skinId}`], resolve);
    });

    return result;
  } catch (error) {
    console.error("커스텀 스킨 이미지 가져오기 오류:", error);
  }

  return null;
}

async function generateCustomCSS(config) {
  console.log("generateCustomCSS", config);

  if (!config.skinEnabled) {
    console.log("스킨 비활성화 상태");
    return "";
  }

  const cssVariables = [];

  // 사운드 변수 생성 - 사운드 활성화 상태에 따라 처리
  if (config.soundEnabled) {
    const soundTypes = [
      "move-self",
      "capture",
      "illegal",
      "castle",
      "move-opponent",
    ];
    const audioFormats = ["mp3", "ogg", "webm", "wav"];
    const soundBaseUrl = `chrome-extension://${chrome.runtime.id}/skins/${config.skinTheme}/sounds`;

    // 사운드 파일이 없는 스킨은 Chess.com 기본 사운드를 그대로 사용
    const hasSounds =
      !isCustomSkin(config.skinTheme) &&
      (await isImageExists(`${soundBaseUrl}/move-self.mp3`));

    if (hasSounds) {
      soundTypes.forEach((type) => {
        audioFormats.forEach((format) => {
          cssVariables.push(`
          --theme-sound-set-${format}-${type}: url('${soundBaseUrl}/${type}.${format}') !important;
          --fallback-theme-sound-set-${format}-${type}: url('${soundBaseUrl}/${type}.${format}') !important;
        `);
        });
      });
    }
  }

  // 체스 기물 변수 생성
  const pieces = ["p", "n", "b", "r", "q", "k"];
  const colors = ["w", "b"];

  if (isCustomSkin(config.skinTheme)) {
    const result = await getCustomSkinImageURL(config.skinTheme);
    const skinFiles = result?.[`${STORAGE_KEY_PREFIX}${config.skinTheme}`];

    if (skinFiles) {
      colors.forEach((color) => {
        pieces.forEach(async (piece) => {
          const pieceId = `${color}${piece}`;
          const url = skinFiles[`${pieceId}.png`];
          cssVariables.push(`
          --theme-piece-set-${pieceId}: url('${url}') !important;
          --fallback-theme-piece-set-${pieceId}: url('${url}') !important;
        `);
        });
      });

      if (config.mapEnabled) {
        if (skinFiles["grid.png"]) {
          const mapImageUrl = skinFiles["grid.png"];
          cssVariables.push(`
            --theme-board-style-image: url('${mapImageUrl}') !important;
            --fallback-theme-board-style-image: url('${mapImageUrl}') !important;
          `);
        }
      }
    }
  } else {
    colors.forEach((color) => {
      pieces.forEach(async (piece) => {
        const pieceId = `${color}${piece}`;

        cssVariables.push(`
        --theme-piece-set-${pieceId}: url('chrome-extension://${chrome.runtime.id}/skins/${config.skinTheme}/${pieceId}.png') !important;
        --fallback-theme-piece-set-${pieceId}: url('chrome-extension://${chrome.runtime.id}/skins/${config.skinTheme}/${pieceId}.png') !important;
      `);
      });
    });

    if (config.mapEnabled) {
      const mapImageUrl = `chrome-extension://${chrome.runtime.id}/skins/${config.skinTheme}/grid.png`;
      const mapExists = await isImageExists(mapImageUrl);

      if (mapExists) {
        cssVariables.push(`
        --theme-board-style-image: url('${mapImageUrl}') !important;
        --fallback-theme-board-style-image: url('${mapImageUrl}') !important;
      `);
      }
    }
  }

  // 최종 CSS 생성 - 선택자 우선순위 강화
  const css = `
    /* 글로벌 스타일 */
    :root,
    html[data-theme],
    body {
      ${cssVariables.join("\n")}
    }
  `;

  //console.log("css", css);

  return css;
}

const STYLE_ID = "chess-custom-style";
const CONFIG_KEYS = [
  "selectedSkin",
  "skinEnabled",
  "mapEnabled",
  "soundEnabled",
  "customSkins",
];

// CSS 적용 함수
function applyCustomCSS(css) {
  let style = document.getElementById(STYLE_ID);

  // CSS가 비어있으면 기존 스타일만 제거
  if (!css) {
    if (style) {
      style.remove();
    }
    return;
  }

  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    style.setAttribute("data-priority", "highest");
  }
  style.textContent = css;

  // document_start 시점에는 <head>가 아직 없을 수 있으므로 <html>에 먼저 붙임
  (document.head || document.documentElement).appendChild(style);
}

// 마지막 요청만 반영되도록 하는 카운터 (비동기 생성 순서 역전 방지)
let latestUpdateId = 0;

// 설정 변경 시 CSS 업데이트
async function updateCustomStyle(config) {
  const updateId = ++latestUpdateId;
  const css = await generateCustomCSS(config);
  if (updateId !== latestUpdateId) {
    return;
  }
  applyCustomCSS(css);
}

function loadConfigAndApply() {
  chrome.storage.sync.get(CONFIG_KEYS, (data) => {
    const config = {
      skinTheme: data.selectedSkin || defaultConfig.skinTheme,
      skinEnabled: data.skinEnabled ?? defaultConfig.skinEnabled,
      mapEnabled: data.mapEnabled ?? defaultConfig.mapEnabled,
      soundEnabled: data.soundEnabled ?? defaultConfig.soundEnabled,
      customSkins: data.customSkins || defaultConfig.customSkins,
    };
    updateCustomStyle(config);
  });
}

// 빠른 초기 CSS 적용 (DOM 로드 전)
loadConfigAndApply();

// DOM 로드 후 스타일을 <head>의 마지막으로 옮겨 우선순위 보장
document.addEventListener("DOMContentLoaded", () => {
  const style = document.getElementById(STYLE_ID);
  if (style) {
    document.head.appendChild(style);
  }
});

// 팝업에서 설정이 바뀌면 새로고침 없이 바로 반영
chrome.storage.onChanged.addListener((changes, areaName) => {
  const configChanged =
    areaName === "sync" && CONFIG_KEYS.some((key) => key in changes);
  const skinFilesChanged =
    areaName === "local" &&
    Object.keys(changes).some((key) => key.startsWith(STORAGE_KEY_PREFIX));

  if (configChanged || skinFilesChanged) {
    loadConfigAndApply();
  }
});
