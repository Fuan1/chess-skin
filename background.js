
// 현재 활성화된 규칙 ID 저장
let currentRuleIds = [];
// 스킨 활성화 상태
let skinEnabled = true;
// 현재 선택된 스킨 ID
let currentSkinId = 'classic';

function isImageExists(path) {
    return fetch(path)
        .then(response => response.ok) // response.ok가 true면 이미지가 존재함
        .catch(() => false);
}

// 스킨 ID로부터 규칙 객체 생성
async function generateRules(skinId) {
    const pieceCodes = ['bb', 'bk', 'bn', 'bp', 'bq', 'br', 'wb', 'wk', 'wn', 'wp', 'wq', 'wr'];
    const rules = [];
    
    // 각 체스 피스에 대한 규칙 생성
    for (let i = 0; i < pieceCodes.length; i++) {
        const code = pieceCodes[i];
        rules.push({
            id: i + 1,  // 규칙 ID는 1부터 시작
            priority: 1,
            action: {
                type: "redirect",
                redirect: {
                    transform: {
                        scheme: "chrome-extension",
                        host: chrome.runtime.id,
                        path: `/skins/${skinId}/${code}.png`
                    }
                }
            },
            condition: {
                urlFilter: `*/150/${code}.png`,
                resourceTypes: ["image"]
            }
        });
    }

    const gridExists = await isImageExists(`/skins/${skinId}/grid.png`);
    if (gridExists) {
        rules.push({
            id: pieceCodes.length + 1,
            priority: 1,
            action: {
                type: "redirect",
                redirect: {
                    transform: {
                        scheme: "chrome-extension",
                        host: chrome.runtime.id,
                        path: `/skins/${skinId}/grid.png`
                    }
                }
            },
            condition: {
                urlFilter: `*/200.png`,
                resourceTypes: ["image"]
            }
        });
    }
    
    return rules;
}

// 현재 활성화된 모든 규칙 가져오기
async function getCurrentRules() {
    try {
        return await chrome.declarativeNetRequest.getDynamicRules();
    } catch (error) {
        console.error('현재 규칙 가져오기 오류:', error);
        return [];
    }
}

// 규칙 활성화/비활성화
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
        return await updateRules(currentSkinId);
    } catch (error) {
        console.error('규칙 토글 오류:', error);
        return false;
    }
}

// 규칙 업데이트
async function updateRules(skinId) {
    // 스킨이 비활성화 상태면 아무 작업도 하지 않음
    if (!skinEnabled) {
        console.log('스킨이 비활성화 상태입니다. 규칙 업데이트를 건너뜁니다.');
        return true;
    }
    
    try {
        console.log(`'${skinId}' 스킨으로 규칙 업데이트 시작...`);
        
        // 현재 스킨 ID 업데이트
        currentSkinId = skinId;
        
        // 먼저 현재 브라우저에 있는 모든 동적 규칙 가져오기
        const existingRules = await getCurrentRules();
        const existingRuleIds = existingRules.map(rule => rule.id);
        
        console.log(`기존 규칙 ID: ${JSON.stringify(existingRuleIds)}`);
        
        // 새 규칙 생성
        const newRules = await generateRules(skinId);
        console.log(`${newRules.length}개의 새 규칙 생성됨`);
        
        // 모든 규칙 제거 후 새 규칙 추가 (원자적 작업으로 수행)
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingRuleIds,
            addRules: newRules
        });
        
        // 현재 규칙 ID 업데이트
        currentRuleIds = newRules.map(rule => rule.id);
        console.log(`'${skinId}' 스킨 적용 완료, ${newRules.length}개 규칙 추가됨`);
        return true;
    } catch (error) {
        console.error('규칙 업데이트 오류:', error);
        console.error('오류 상세 정보:', error.message);
        return false;
    }
}

// 설정 불러오기
async function loadSettings() {
    return new Promise(resolve => {
        chrome.storage.sync.get(['selectedSkin', 'skinEnabled'], function(data) {
            // 스킨 ID 설정
            if (data.selectedSkin) {
                currentSkinId = data.selectedSkin;
            }
            
            // 스킨 활성화 상태 설정
            if (data.skinEnabled !== undefined) {
                skinEnabled = data.skinEnabled;
            }
            
            resolve({
                skinId: currentSkinId,
                enabled: skinEnabled
            });
        });
    });
}

// 확장 프로그램 설치/업데이트 시 초기화
chrome.runtime.onInstalled.addListener(async () => {
    console.log('체스 스킨 확장 프로그램이 설치/업데이트 되었습니다.');
    
    // 저장된 스킨 설정 확인
    const settings = await loadSettings();
    console.log(`초기 스킨 설정: ${settings.skinId}, 활성화 상태: ${settings.enabled}`);
    
    // 스킨이 활성화되어 있으면 규칙 적용
    if (settings.enabled) {
        await updateRules(settings.skinId);
    }
});

// 메시지 리스너 - 팝업에서 스킨 변경 요청 처리
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    // 스킨 변경 및 적용 요청
    if (request.action === 'applySkin') {
        console.log(`스킨 적용 요청: ${request.skin}, 활성화 상태: ${request.enabled}`);
        
        // 활성화 상태 업데이트
        skinEnabled = request.enabled;
        
        // 활성화 상태에 따라 규칙 적용 또는 제거
        if (skinEnabled) {
            updateRules(request.skin)
                .then(success => {
                    sendResponse({success: success});
                })
                .catch(error => {
                    console.error('스킨 적용 오류:', error);
                    sendResponse({success: false, error: error.message});
                });
        } else {
            toggleRules(false)
                .then(success => {
                    sendResponse({success: success});
                })
                .catch(error => {
                    console.error('스킨 비활성화 오류:', error);
                    sendResponse({success: false, error: error.message});
                });
        }
        
        return true; // 비동기 응답을 위해 true 반환
    }
    
    // 이전 메시지 리스너 호환성을 위해 유지
    if (request.action === 'changeSkin') {
        console.log(`스킨 변경 요청: ${request.skin}`);
        updateRules(request.skin).then(success => {
            sendResponse({success: success});
        }).catch(error => {
            console.error('스킨 변경 중 오류:', error);
            sendResponse({success: false, error: error.message});
        });
        return true; // 비동기 응답을 위해 true 반환
    }
}); 