/**
 * Chess Skin Chrome Extension - Background Script
 * 체스 웹사이트의 기물 이미지를 커스텀 스킨으로 대체하는 확장 프로그램
 */

//==============================
// 상수 정의
//==============================
const PIECE_CODES = ['bb', 'bk', 'bn', 'bp', 'bq', 'br', 'wb', 'wk', 'wn', 'wp', 'wq', 'wr'];
const MAP_FILES = ['dark.png', 'bright.png', 'grid.png'];
const CUSTOM_SKIN_PREFIX = 'custom_';
const STORAGE_KEY_PREFIX = 'skinFiles_';

//==============================
// 상태 변수
//==============================
let state = {
    currentRuleIds: [],          // 현재 활성화된 규칙 ID 목록
    skinEnabled: true,           // 스킨 활성화 상태
    mapEnabled: true,            // 맵(체스판 배경) 활성화 상태
    currentSkinId: 'classic',    // 현재 선택된 스킨 ID
    dataURLCache: {}             // 데이터 URL 캐시
};

//==============================
// 유틸리티 함수
//==============================

/**
 * 이미지가 존재하는지 확인
 * @param {string} path - 이미지 경로
 * @returns {Promise<boolean>} 이미지 존재 여부
 */
function isImageExists(path) {
    return fetch(path)
        .then(response => response.ok)
        .catch(() => {
            console.log(`이미지를 찾을 수 없음: ${path}`);
            return false;
        });
}

/**
 * 스킨이 커스텀 스킨인지 확인
 * @param {string} skinId - 스킨 ID
 * @returns {boolean} 커스텀 스킨 여부
 */
function isCustomSkin(skinId) {
    return skinId.startsWith(CUSTOM_SKIN_PREFIX);
}

/**
 * 캐시에서 Data URL 가져오기 또는 저장
 * @param {string} dataURL - Data URL
 * @param {string} cacheKey - 캐시 키
 * @returns {string|null} 캐시된 Data URL
 */
function getCachedDataURL(dataURL, cacheKey) {
    // 이미 캐시에 있다면 반환
    if (state.dataURLCache[cacheKey]) {
        return state.dataURLCache[cacheKey];
    }
    
    try {
        // 캐시에 저장
        state.dataURLCache[cacheKey] = dataURL;
        return dataURL;
    } catch (error) {
        console.error('Data URL 처리 오류:', error);
        return null;
    }
}

/**
 * 캐시 메모리 정리
 */
function clearCache() {
    state.dataURLCache = {};
    console.log('URL 캐시 정리 완료');
}

//==============================
// 스킨 데이터 관리
//==============================

/**
 * 저장된 커스텀 스킨 데이터 불러오기
 * @param {string} skinId - 스킨 ID
 * @returns {Promise<Object>} 스킨 파일 데이터
 */
async function loadCustomSkinData(skinId) {
    return new Promise((resolve) => {
        const storageKey = `${STORAGE_KEY_PREFIX}${skinId}`;
        chrome.storage.local.get([storageKey], function(result) {
            const skinData = result[storageKey] || {};
            console.log(`${skinId} 스킨 데이터 로드: ${Object.keys(skinData).length}개 파일`);
            resolve(skinData);
        });
    });
}

/**
 * 커스텀 스킨 파일 저장
 * @param {string} skinId - 스킨 ID
 * @param {Array} filesData - 파일 데이터 배열
 * @returns {Promise<boolean>} 저장 성공 여부
 */
async function saveCustomSkinFiles(skinId, filesData) {
    try {
        const skinFilesData = {};
        
        // 각 파일 데이터 저장
        for (const fileData of filesData) {
            skinFilesData[fileData.name] = fileData.data;
        }
        
        // 로컬 스토리지에 저장
        const storageKey = `${STORAGE_KEY_PREFIX}${skinId}`;
        await chrome.storage.local.set({
            [storageKey]: skinFilesData
        });
        
        console.log(`스킨 '${skinId}'의 ${filesData.length}개 파일이 저장됨`);
        return true;
    } catch (error) {
        console.error('스킨 파일 저장 오류:', error);
        return false;
    }
}

/**
 * 사용자 설정 불러오기
 * @returns {Promise<Object>} 사용자 설정
 */
async function loadSettings() {
    return new Promise(resolve => {
        chrome.storage.sync.get(['selectedSkin', 'skinEnabled', 'mapEnabled'], function(data) {
            // 설정 값 적용
            if (data.selectedSkin) {
                state.currentSkinId = data.selectedSkin;
            }
            
            if (data.skinEnabled !== undefined) {
                state.skinEnabled = data.skinEnabled;
            }
            
            if (data.mapEnabled !== undefined) {
                state.mapEnabled = data.mapEnabled;
            }
            
            resolve({
                skinId: state.currentSkinId,
                enabled: state.skinEnabled,
                mapEnabled: state.mapEnabled
            });
        });
    });
}

//==============================
// 리다이렉션 규칙 관리
//==============================

/**
 * 스킨 ID로부터 리다이렉션 규칙 객체 생성
 * @param {string} skinId - 스킨 ID
 * @returns {Promise<Array>} 생성된 규칙 배열
 */
async function generateRules(skinId) {
    const rules = [];
    
    // 커스텀 스킨인지 확인
    const isCustom = isCustomSkin(skinId);
    let customSkinData = {};
    
    // 커스텀 스킨인 경우 데이터 로드
    if (isCustom) {
        customSkinData = await loadCustomSkinData(skinId);
    }
    
    // 1. 체스 기물에 대한 규칙 생성
    for (let i = 0; i < PIECE_CODES.length; i++) {
        const code = PIECE_CODES[i];
        const fileName = `${code}.png`;
        
        // 기물 이미지에 대한 리다이렉션 규칙 생성
        if (isCustom && customSkinData[fileName]) {
            // 커스텀 스킨인 경우
            const dataURL = getCachedDataURL(customSkinData[fileName], `${skinId}_${fileName}`);
            
            if (dataURL) {
                rules.push(createDataURLRedirectRule(i + 1, dataURL, `*/150/${code}.png`));
            }
        } else {
            // 기본 스킨인 경우
            rules.push(createExtensionRedirectRule(i + 1, `/skins/${skinId}/${code}.png`, `*/150/${code}.png`));
        }
    }

    // 2. 맵이 활성화된 경우 그리드 규칙 추가
    if (state.mapEnabled) {
        if (isCustom) {
            // 커스텀 스킨의 그리드 파일 처리
            if (customSkinData['grid.png']) {
                const dataURL = getCachedDataURL(customSkinData['grid.png'], `${skinId}_grid.png`);
                
                if (dataURL) {
                    rules.push(createDataURLRedirectRule(PIECE_CODES.length + 1, dataURL, '*/200.png'));
                }
            }
        } else {
            // 기본 스킨의 그리드 파일 처리
            const gridExists = await isImageExists(`/skins/${skinId}/grid.png`);
            
            if (gridExists) {
                rules.push(createExtensionRedirectRule(PIECE_CODES.length + 1, `/skins/${skinId}/grid.png`, '*/200.png'));
            }
        }
    }
    
    return rules;
}

/**
 * Data URL을 사용하는 리다이렉션 규칙 생성
 * @param {number} id - 규칙 ID
 * @param {string} dataURL - 데이터 URL
 * @param {string} urlFilter - URL 필터 패턴
 * @returns {Object} 생성된 규칙 객체
 */
function createDataURLRedirectRule(id, dataURL, urlFilter) {
    return {
        id: id,
        priority: 1,
        action: {
            type: "redirect",
            redirect: { url: dataURL }
        },
        condition: {
            urlFilter: urlFilter,
            resourceTypes: ["image"]
        }
    };
}

/**
 * 확장 프로그램 내부 경로를 사용하는 리다이렉션 규칙 생성
 * @param {number} id - 규칙 ID
 * @param {string} path - 확장 프로그램 내 경로
 * @param {string} urlFilter - URL 필터 패턴
 * @returns {Object} 생성된 규칙 객체
 */
function createExtensionRedirectRule(id, path, urlFilter) {
    return {
        id: id,
        priority: 1,
        action: {
            type: "redirect",
            redirect: {
                transform: {
                    scheme: "chrome-extension",
                    host: chrome.runtime.id,
                    path: path
                }
            }
        },
        condition: {
            urlFilter: urlFilter,
            resourceTypes: ["image"]
        }
    };
}

/**
 * 현재 활성화된 모든 규칙 가져오기
 * @returns {Promise<Array>} 현재 활성화된 규칙 배열
 */
async function getCurrentRules() {
    try {
        return await chrome.declarativeNetRequest.getDynamicRules();
    } catch (error) {
        console.error('현재 규칙 가져오기 오류:', error);
        return [];
    }
}

/**
 * 규칙 활성화/비활성화 토글
 * @param {boolean} enabled - 활성화 상태
 * @returns {Promise<boolean>} 작업 성공 여부
 */
async function toggleRules(enabled) {
    try {
        // 비활성화 상태면 모든 규칙 제거
        if (!enabled) {
            const existingRules = await getCurrentRules();
            const existingRuleIds = existingRules.map(rule => rule.id);
            
            if (existingRuleIds.length > 0) {
                await chrome.declarativeNetRequest.updateDynamicRules({
                    removeRuleIds: existingRuleIds
                });
                console.log('모든 규칙 비활성화 완료');
            }
            
            return true;
        }
        
        // 활성화 상태면 현재 선택된 스킨으로 규칙 다시 적용
        return await updateRules(state.currentSkinId);
    } catch (error) {
        console.error('규칙 토글 오류:', error);
        return false;
    }
}

/**
 * 규칙 업데이트
 * @param {string} skinId - 스킨 ID
 * @returns {Promise<boolean>} 업데이트 성공 여부
 */
async function updateRules(skinId) {
    // 스킨이 비활성화 상태면 아무 작업도 하지 않음
    if (!state.skinEnabled) {
        console.log('스킨이 비활성화 상태입니다. 규칙 업데이트를 건너뜁니다.');
        return true;
    }
    
    try {
        console.log(`'${skinId}' 스킨으로 규칙 업데이트 시작...`);
        
        // 현재 스킨 ID 업데이트
        state.currentSkinId = skinId;
        
        // 기존 규칙 가져오기
        const existingRules = await getCurrentRules();
        const existingRuleIds = existingRules.map(rule => rule.id);
        
        // 새 규칙 생성
        const newRules = await generateRules(skinId);
        console.log(`${newRules.length}개의 새 규칙 생성됨`);
        
        // 모든 규칙 제거 후 새 규칙 추가 (원자적 작업으로 수행)
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingRuleIds,
            addRules: newRules
        });
        
        // 현재 규칙 ID 업데이트
        state.currentRuleIds = newRules.map(rule => rule.id);
        console.log(`'${skinId}' 스킨 적용 완료, ${newRules.length}개 규칙 추가됨`);
        return true;
    } catch (error) {
        console.error('규칙 업데이트 오류:', error);
        console.error('오류 상세 정보:', error.message);
        return false;
    }
}

//==============================
// 이벤트 핸들러
//==============================

/**
 * 확장 프로그램 설치/업데이트 시 초기화
 */
chrome.runtime.onInstalled.addListener(async () => {
    console.log('체스 스킨 확장 프로그램이 설치/업데이트 되었습니다.');
    
    // 저장된 스킨 설정 확인
    const settings = await loadSettings();
    console.log(`초기 스킨 설정: ${settings.skinId}, 활성화 상태: ${settings.enabled}, 맵 활성화 상태: ${settings.mapEnabled}`);
    
    // 스킨이 활성화되어 있으면 규칙 적용
    if (settings.enabled) {
        await updateRules(settings.skinId);
    }
});

/**
 * 확장 프로그램 언로드 시 정리
 */
chrome.runtime.onSuspend.addListener(() => {
    clearCache();
});

/**
 * 메시지 핸들러 - 팝업과 통신
 */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    // 스킨 변경 및 적용 요청
    if (request.action === 'applySkin') {
        handleApplySkinRequest(request, sendResponse);
        return true; // 비동기 응답을 위해 true 반환
    }
    
    // 커스텀 스킨 파일 업로드 요청
    if (request.action === 'uploadSkinFiles') {
        handleUploadSkinFilesRequest(request, sendResponse);
        return true; // 비동기 응답을 위해 true 반환
    }
    
    // 이전 메시지 리스너 호환성을 위해 유지
    if (request.action === 'changeSkin') {
        handleChangeSkinRequest(request, sendResponse);
        return true; // 비동기 응답을 위해 true 반환
    }
});

/**
 * 스킨 적용 요청 처리
 * @param {Object} request - 요청 객체
 * @param {Function} sendResponse - 응답 콜백
 */
function handleApplySkinRequest(request, sendResponse) {
    console.log(`스킨 적용 요청: ${request.skin}, 활성화 상태: ${request.enabled}, 맵 활성화 상태: ${request.mapEnabled}`);
    
    // 이전 URL 정리
    clearCache();
    
    // 상태 업데이트
    state.skinEnabled = request.enabled;
    
    if (request.mapEnabled !== undefined) {
        state.mapEnabled = request.mapEnabled;
    }
    
    // 활성화 상태에 따라 규칙 적용 또는 제거
    if (state.skinEnabled) {
        updateRules(request.skin)
            .then(success => sendResponse({success: success}))
            .catch(error => {
                console.error('스킨 적용 오류:', error);
                sendResponse({success: false, error: error.message});
            });
    } else {
        toggleRules(false)
            .then(success => sendResponse({success: success}))
            .catch(error => {
                console.error('스킨 비활성화 오류:', error);
                sendResponse({success: false, error: error.message});
            });
    }
}

/**
 * 커스텀 스킨 파일 업로드 요청 처리
 * @param {Object} request - 요청 객체
 * @param {Function} sendResponse - 응답 콜백
 */
function handleUploadSkinFilesRequest(request, sendResponse) {
    console.log(`스킨 파일 업로드 요청: ${request.skinId}, ${request.filesData.length}개 파일`);
    
    saveCustomSkinFiles(request.skinId, request.filesData)
        .then(success => sendResponse({success: success}))
        .catch(error => {
            console.error('스킨 파일 업로드 오류:', error);
            sendResponse({success: false, error: error.message});
        });
}

/**
 * 스킨 변경 요청 처리 (레거시 지원)
 * @param {Object} request - 요청 객체
 * @param {Function} sendResponse - 응답 콜백
 */
function handleChangeSkinRequest(request, sendResponse) {
    console.log(`스킨 변경 요청: ${request.skin}`);
    
    // 이전 URL 정리
    clearCache();
    
    updateRules(request.skin)
        .then(success => sendResponse({success: success}))
        .catch(error => {
            console.error('스킨 변경 중 오류:', error);
            sendResponse({success: false, error: error.message});
        });
} 