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
    const soundTypes = ["promote", "move-self"];
    const audioFormats = ["mp3", "ogg", "webm", "wav"];

    if (!isCustomSkin(config.skinTheme)) {
      soundTypes.forEach((type) => {
        audioFormats.forEach((format) => {
          cssVariables.push(`
          --theme-sound-set-${format}-${type}: url('chrome-extension://${chrome.runtime.id}/skins/${config.skinTheme}/sounds/${type}.${format}') !important;
          --fallback-theme-sound-set-${format}-${type}: url('chrome-extension://${chrome.runtime.id}/skins/${config.skinTheme}/sounds/${type}.${format}') !important;
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
    const skinFiles = result[`skinFiles_${config.skinTheme}`];

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

// CSS 적용 함수
function applyCustomCSS(css) {
  console.log("CSS 적용 시작");

  // 기존 스타일 시트 제거
  const existingStyle = document.getElementById("chess-custom-style");
  if (existingStyle) {
    existingStyle.remove();
  }

  // CSS가 비어있으면 스타일을 추가하지 않음
  if (!css) {
    console.log("적용할 CSS 없음");
    return;
  }

  // 새로운 스타일 시트 추가 (highest priority)
  const style = document.createElement("style");
  style.id = "chess-custom-style";
  style.setAttribute("data-priority", "highest");
  style.textContent = css;

  // 항상 마지막 스타일 시트로 추가하여 우선순위 보장
  if (document.head.lastChild) {
    document.head.appendChild(style);
  } else {
    document.head.insertBefore(style, null);
  }

  console.log("CSS 적용 완료 및 DOM 감시 시작");
}

// 설정 변경 시 CSS 업데이트
async function updateCustomStyle(config) {
  console.log("스타일 업데이트 시작", config);
  const css = await generateCustomCSS(config);
  applyCustomCSS(css);
}

// 초기 CSS 적용 (DOM 로드 완료 후)
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(
    [
      "selectedSkin",
      "skinEnabled",
      "mapEnabled",
      "soundEnabled",
      "customSkins",
    ],
    function (data) {
      console.log("DOM 로드 후 초기화:", data);
      const config = {
        skinTheme: data.selectedSkin || defaultConfig.skinTheme,
        skinEnabled: data.skinEnabled ?? defaultConfig.skinEnabled,
        mapEnabled: data.mapEnabled ?? defaultConfig.mapEnabled,
        soundEnabled: data.soundEnabled ?? defaultConfig.soundEnabled,
        customSkins: data.customSkins || defaultConfig.customSkins,
      };
      updateCustomStyle(config);
    }
  );
});

// 빠른 초기 CSS 적용 (DOM 로드 전)
chrome.storage.sync.get(
  ["selectedSkin", "skinEnabled", "mapEnabled", "soundEnabled", "customSkins"],
  (data) => {
    console.log("초기 스토리지 데이터:", data);
    const config = {
      skinTheme: data.selectedSkin || defaultConfig.skinTheme,
      skinEnabled: data.skinEnabled ?? defaultConfig.skinEnabled,
      mapEnabled: data.mapEnabled ?? defaultConfig.mapEnabled,
      soundEnabled: data.soundEnabled ?? defaultConfig.soundEnabled,
      customSkins: data.customSkins || defaultConfig.customSkins,
    };
    updateCustomStyle(config);
  }
);
