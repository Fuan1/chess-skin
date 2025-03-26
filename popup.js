/**
 * Chess Skin Chrome Extension - Popup Script
 * 체스 스킨 확장 프로그램의 팝업 UI 관리
 */
document.addEventListener('DOMContentLoaded', function() {
    //==============================
    // 상태 및 설정 변수
    //==============================
    const state = {
        currentSkinIndex: 0,   // 현재 선택된 스킨 인덱스
        skinEnabled: true,     // 스킨 활성화 상태
        mapEnabled: true,      // 맵(체스판 배경) 활성화 상태
        customSkinImages: {}   // 커스텀 스킨 이미지 캐시
    };

    //==============================
    // 상수 정의
    //==============================
    // 기본 제공 스킨 목록
    const DEFAULT_SKINS = [
        {
            id: 'animal',
            name: 'Animal Skin',
            description: 'Animal chess piece design'
        },
        {
            id: 'casino',
            name: 'Casino Skin',
            description: 'Casino chess piece design'
        },
        
        {
            id: 'allWhite',
            name: 'All White',
            description: 'All White chess pieces'
        },
        {
            id: 'allBlack',
            name: 'All Black',
            description: 'All Black chess pieces'
        }
    ];
    
    // 커스텀 스킨 접두사
    const CUSTOM_SKIN_PREFIX = 'custom_';
    
    // 체스 기물 코드
    const PIECE_CODES = {
        ALL: ['bb', 'bk', 'bn', 'bp', 'bq', 'br', 'wb', 'wk', 'wn', 'wp', 'wq', 'wr'],
        SELECTION: ['wk', 'wq', 'wr', 'wn', 'wb'] // 미리보기에 표시할 기물
    };
    
    // 체스판 배치 (4x4 미리보기)
    const BOARD_SETUP = [
        ['br', 'bn', 'bb', 'bq'], // 1행: 룩, 나이트, 비숍, 퀸 (흑색 말)
        ['bp', 'bp', 'bp', 'bp'], // 2행: 폰, 폰, 폰, 폰
        ['wp', 'wp', 'wp', 'wp'], // 3행: 폰, 폰, 폰, 폰 (백색 말)
        ['wk', 'wn', 'wb', 'wr']  // 4행: 킹, 나이트, 비숍, 룩 (백색 말)
    ];
    
    // 사용 가능한 스킨 목록 (기본 + 사용자 추가)
    let skins = [...DEFAULT_SKINS];

    //==============================
    // DOM 요소 참조
    //==============================
    const elements = {
        board: document.getElementById('preview-board'),
        skinTitle: document.getElementById('current-skin-title'),
        skinToggle: document.getElementById('skin-toggle'),
        mapToggle: document.getElementById('map-toggle'),
        prevButton: document.getElementById('prev-skin'),
        nextButton: document.getElementById('next-skin'),
        applyButton: document.getElementById('apply-skin'),
        pagination: document.getElementById('skin-pagination'),
        pieceSelection: document.getElementById('piece-selection'),
        
        // 업로드 관련 요소
        uploadButton: document.getElementById('upload-skin'),
        uploadModal: document.getElementById('upload-modal'),
        closeModal: document.querySelector('.close'),
        submitUpload: document.getElementById('submit-upload'),
        folderUpload: document.getElementById('folder-upload'),
        skinNameInput: document.getElementById('skin-name'),
        fileUploadStatus: document.getElementById('file-upload-status')
    };

    //==============================
    // 유틸리티 함수
    //==============================
    
    /**
     * 이미지가 존재하는지 확인
     * @param {string} path - 이미지 경로
     * @returns {Promise<boolean>} 이미지 존재 여부
     */
    async function isImageExists(path) {
        try {
            const response = await fetch(path);
            return response.ok;
        } catch (error) {
            console.log(`이미지를 찾을 수 없음: ${path}`);
            return false;
        }
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
     * 현재 선택된 스킨 ID 반환
     * @returns {string} 현재 스킨 ID
     */
    function getCurrentSkinId() {
        return skins[state.currentSkinIndex].id;
    }

    /**
     * 스타일 객체를 CSS 문자열로 변환
     * @param {Object} styleObj - 스타일 객체
     * @returns {string} CSS 스타일 문자열
     */
    function stylesToString(styleObj) {
        return Object.entries(styleObj)
            .map(([key, value]) => `${key}: ${value};`)
            .join(' ');
    }

    //==============================
    // 커스텀 스킨 관리
    //==============================
    
    /**
     * 커스텀 스킨 이미지 URL 가져오기
     * @param {string} skinId - 스킨 ID
     * @param {string} fileName - 파일명
     * @returns {Promise<string|null>} 이미지 데이터 URL 또는 null
     */
    async function getCustomSkinImageURL(skinId, fileName) {
        // 이미 캐시에 있으면 반환
        const cacheKey = `${skinId}_${fileName}`;
        if (state.customSkinImages[cacheKey]) {
            return state.customSkinImages[cacheKey];
        }
        
        // chrome.storage.local에서 스킨 데이터 가져오기
        try {
            const result = await new Promise(resolve => {
                chrome.storage.local.get([`skinFiles_${skinId}`], resolve);
            });
            
            const skinFiles = result[`skinFiles_${skinId}`];
            if (skinFiles && skinFiles[fileName]) {
                // 캐시에 추가
                state.customSkinImages[cacheKey] = skinFiles[fileName];
                return skinFiles[fileName];
            }
        } catch (error) {
            console.error('커스텀 스킨 이미지 가져오기 오류:', error);
        }
        
        return null;
    }

    /**
     * 기물 이미지 URL 가져오기 (커스텀 또는 기본 스킨)
     * @param {string} skinId - 스킨 ID
     * @param {string} pieceCode - 기물 코드 (bp, wk 등)
     * @returns {Promise<string>} 이미지 URL
     */
    async function getPieceImageURL(skinId, pieceCode) {
        const fileName = `${pieceCode}.png`;
        
        if (isCustomSkin(skinId)) {
            // 커스텀 스킨인 경우
            const dataURL = await getCustomSkinImageURL(skinId, fileName);
            if (dataURL) {
                return dataURL;
            }
        }
        
        // 기본 스킨이거나 커스텀 스킨 이미지를 찾지 못한 경우
        return `skins/${skinId}/${fileName}`;
    }

    /**
     * 체스판 배경 이미지 URL 가져오기
     * @param {string} skinId - 스킨 ID
     * @param {boolean} isLightSquare - 밝은 칸 여부
     * @returns {Promise<string|null>} 이미지 URL 또는 null
     */
    async function getBoardImageURL(skinId, isLightSquare) {
        const mapFileName = isLightSquare ? 'bright.png' : 'dark.png';
        
        if (isCustomSkin(skinId)) {
            // 커스텀 스킨인 경우
            return await getCustomSkinImageURL(skinId, mapFileName);
        } else {
            // 기본 스킨인 경우 - 파일 존재 여부 확인
            const mapPath = `skins/${skinId}/${mapFileName}`;
            const exists = await isImageExists(mapPath);
            return exists ? mapPath : null;
        }
    }

    //==============================
    // UI 렌더링 함수
    //==============================
    
    /**
     * 체스판 초기화 및 렌더링
     * @returns {Promise<void>}
     */
    async function initializeChessboard() {
        // 체스판 비우기
        elements.board.innerHTML = '';
        
        const currentSkinId = getCurrentSkinId();
        
        // 4x4 체스판 생성
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const square = document.createElement('div');
                const isLightSquare = (row + col) % 2 === 0;
                square.className = `chess-square ${isLightSquare ? 'light-square' : 'dark-square'}`;
                
                // 맵이 활성화된 경우 배경 이미지 설정
                if (state.mapEnabled) {
                    const backgroundURL = await getBoardImageURL(currentSkinId, isLightSquare);
                    
                    if (backgroundURL) {
                        const styles = {
                            'background-image': `url('${backgroundURL}')`,
                            'background-size': '100% 100%',
                            'background-repeat': 'no-repeat',
                            'background-position': 'center'
                        };
                        
                        square.setAttribute('style', stylesToString(styles));
                    }
                }
                
                // 체스 말 배치
                const pieceCode = BOARD_SETUP[row][col];
                if (pieceCode) {
                    const pieceImg = document.createElement('img');
                    pieceImg.className = 'chess-piece';
                    
                    try {
                        const imageURL = await getPieceImageURL(currentSkinId, pieceCode);
                        pieceImg.src = imageURL;
                        
                        // 이미지 로드 오류 시 대체 이미지 사용
                        pieceImg.onerror = () => { 
                            pieceImg.src = `images/${pieceCode}.png`; 
                        };
                        
                        square.appendChild(pieceImg);
                    } catch (error) {
                        console.error(`기물 이미지 로드 오류: ${pieceCode}`, error);
                    }
                }
                
                elements.board.appendChild(square);
            }
        }
    }
    
    /**
     * 하단 체스 말 선택 영역 초기화
     * @returns {Promise<void>}
     */
    async function initializePieceSelection() {
        elements.pieceSelection.innerHTML = '';
        
        const currentSkinId = getCurrentSkinId();
        
        // 기물 이름 매핑
        const pieceNames = {
            'wk': 'King',
            'wq': 'Queen',
            'wr': 'Rook',
            'wn': 'Knight',
            'wb': 'Bishop'
        };
        
        for (const pieceCode of PIECE_CODES.SELECTION) {
            const pieceContainer = document.createElement('div');
            pieceContainer.className = 'piece-container';
            
            const pieceImg = document.createElement('img');
            pieceImg.className = 'chess-piece';
            
            try {
                const imageURL = await getPieceImageURL(currentSkinId, pieceCode);
                pieceImg.src = imageURL;
                
                // 이미지 로드 오류 시 대체 이미지 사용
                pieceImg.onerror = () => { 
                    pieceImg.src = `images/${pieceCode}.png`; 
                };
                
                pieceContainer.appendChild(pieceImg);
                
                // 기물 이름 추가
                const pieceName = document.createElement('div');
                pieceName.className = 'piece-name';
                pieceName.textContent = pieceNames[pieceCode];
                pieceContainer.appendChild(pieceName);
                
                elements.pieceSelection.appendChild(pieceContainer);
            } catch (error) {
                console.error(`기물 선택 이미지 로드 오류: ${pieceCode}`, error);
            }
        }
    }

    /**
     * 현재 선택된 스킨 UI 업데이트
     */
    function updateCurrentSkin() {
        const currentSkin = skins[state.currentSkinIndex];
        elements.skinTitle.textContent = currentSkin.name;
        
        // 삭제 버튼이 있다면 제거
        const existingDeleteButton = document.querySelector('.delete-button');
        if (existingDeleteButton) {
            existingDeleteButton.remove();
        }
        
        // 커스텀 스킨인 경우에만 삭제 버튼 추가
        if (isCustomSkin(currentSkin.id)) {
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            deleteButton.innerHTML = '✕';
            deleteButton.title = '이 스킨 삭제하기';
            deleteButton.addEventListener('click', () => deleteCustomSkin(currentSkin.id));
            elements.skinTitle.appendChild(deleteButton);
        }
        
        // 페이지네이션 업데이트
        updatePagination();
        
        // 체스판 및 기물 선택 영역 업데이트
        initializeChessboard();
        initializePieceSelection();
    }

    /**
     * 커스텀 스킨 삭제
     * @param {string} skinId - 삭제할 스킨 ID
     */
    function deleteCustomSkin(skinId) {
        if (!isCustomSkin(skinId)) {
            console.error('기본 스킨은 삭제할 수 없습니다.');
            return;
        }
        
        if (confirm('이 스킨을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            // 스킨 목록에서 삭제
            const skinIndex = skins.findIndex(skin => skin.id === skinId);
            if (skinIndex !== -1) {
                skins.splice(skinIndex, 1);
                
                // 현재 인덱스 조정
                if (state.currentSkinIndex >= skinIndex) {
                    state.currentSkinIndex = Math.max(0, state.currentSkinIndex - 1);
                }
                
                // 로컬 스토리지에서 스킨 파일 삭제
                chrome.storage.local.remove([`skinFiles_${skinId}`], function() {
                    console.log(`로컬 스토리지에서 스킨 파일 삭제: ${skinId}`);
                });
                
                // 설정 다시 저장 (현재 선택된 스킨이 삭제된 스킨이면 다른 스킨으로 변경)
                chrome.storage.sync.get(['selectedSkin'], function(data) {
                    if (data.selectedSkin === skinId) {
                        // 기본 스킨(classic)으로 변경
                        const defaultSkinIndex = skins.findIndex(skin => skin.id === 'classic');
                        if (defaultSkinIndex !== -1) {
                            state.currentSkinIndex = defaultSkinIndex;
                        }
                    }
                    
                    // 설정 저장 및 UI 업데이트
                    saveSkinSettings();
                    initializePagination();
                    updateCurrentSkin();
                    
                    // 현재 적용된 스킨이 삭제된 스킨이면 기본 스킨 적용
                    applySkin();
                });
            }
        }
    }

    /**
     * 페이지네이션 초기화
     */
    function initializePagination() {
        // 페이지네이션 비우기
        elements.pagination.innerHTML = '';
        
        // 스킨 개수만큼 닷 추가
        skins.forEach((skin, index) => {
            const dot = document.createElement('span');
            dot.className = `dot ${index === state.currentSkinIndex ? 'active' : ''}`;
            dot.addEventListener('click', () => {
                state.currentSkinIndex = index;
                updateCurrentSkin();
            });
            elements.pagination.appendChild(dot);
        });
    }

    /**
     * 페이지네이션 활성 상태 업데이트
     */
    function updatePagination() {
        const dots = elements.pagination.querySelectorAll('.dot');
        dots.forEach((dot, index) => {
            dot.className = `dot ${index === state.currentSkinIndex ? 'active' : ''}`;
        });
    }

    //==============================
    // 데이터 관리 함수
    //==============================
    
    /**
     * 스킨 설정 저장
     */
    function saveSkinSettings() {
        chrome.storage.sync.set({
            selectedSkin: getCurrentSkinId(),
            skinEnabled: state.skinEnabled,
            mapEnabled: state.mapEnabled,
            customSkins: skins.filter(skin => skin.isCustom) // 커스텀 스킨만 저장
        });
    }

    /**
     * 스킨 적용
     */
    function applySkin() {
        // 현재 선택된 스킨 저장
        saveSkinSettings();
        
        // background.js에 메시지 전송
        chrome.runtime.sendMessage({
            action: 'applySkin',
            skin: getCurrentSkinId(),
            enabled: state.skinEnabled,
            mapEnabled: state.mapEnabled
        }, function(response) {
            if (response && response.success) {
                console.log('스킨이 성공적으로 적용되었습니다.');
                // 활성화된 탭 새로고침
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    if (tabs && tabs[0]) {
                        chrome.tabs.reload(tabs[0].id);
                    }
                });
            } else {
                console.error('스킨 적용 실패');
            }
        });
    }

    /**
     * 저장된 설정 불러오기
     */
    function loadSettings() {
        chrome.storage.sync.get(['selectedSkin', 'skinEnabled', 'mapEnabled', 'customSkins'], function(data) {
            // 저장된 스킨 ID가 있으면 해당 스킨으로 설정
            if (data.selectedSkin) {
                const skinIndex = skins.findIndex(skin => skin.id === data.selectedSkin);
                if (skinIndex !== -1) {
                    state.currentSkinIndex = skinIndex;
                }
            }
            
            // 스킨 활성화 설정
            if (data.skinEnabled !== undefined) {
                state.skinEnabled = data.skinEnabled;
                elements.skinToggle.checked = state.skinEnabled;
            } else {
                state.skinEnabled = true;
                elements.skinToggle.checked = true;
            }
            
            // 맵 활성화 설정
            if (data.mapEnabled !== undefined) {
                state.mapEnabled = data.mapEnabled;
                elements.mapToggle.checked = state.mapEnabled;
            } else {
                state.mapEnabled = true;
                elements.mapToggle.checked = true;
            }
            
            // 커스텀 스킨 로드
            if (data.customSkins && Array.isArray(data.customSkins)) {
                // 기존 스킨 유지하면서 커스텀 스킨 추가
                data.customSkins.forEach(customSkin => {
                    // 이미 같은 ID가 있는지 확인
                    if (!skins.some(skin => skin.id === customSkin.id)) {
                        skins.push(customSkin);
                    }
                });
                
                // 페이지네이션 초기화
                initializePagination();
            }
            
            // UI 업데이트
            updateCurrentSkin();
        });
    }

    //==============================
    // 커스텀 스킨 업로드 관련 함수
    //==============================
    
    /**
     * 커스텀 스킨 유효성 검사
     * @param {string} skinName - 스킨 이름
     * @param {FileList} files - 업로드된 파일 목록
     * @returns {Object} 유효성 검사 결과 {valid, message, skinId}
     */
    function validateSkinUpload(skinName, files) {
        if (!skinName) {
            return { 
                valid: false, 
                message: '스킨 이름을 입력해주세요.'
            };
        }
        
        if (files.length === 0) {
            return { 
                valid: false, 
                message: '스킨 파일을 선택해주세요.'
            };
        }
        
        // 고유한 ID 생성 (이름에서 공백 제거하고 소문자로 변환)
        const skinId = CUSTOM_SKIN_PREFIX + skinName.toLowerCase().replace(/\s+/g, '_');
        
        // 필수 파일 확인
        const fileNames = Array.from(files).map(file => file.name);
        const missingFiles = PIECE_CODES.ALL.map(code => `${code}.png`)
                                      .filter(file => !fileNames.includes(file));
        
        if (missingFiles.length > 0) {
            return { 
                valid: false, 
                message: `다음 필수 파일이 누락되었습니다: ${missingFiles.join(', ')}`
            };
        }
        
        return { 
            valid: true, 
            skinId: skinId
        };
    }

    /**
     * 파일을 데이터 URL로 읽기
     * @param {File} file - 읽을 파일
     * @returns {Promise<Object>} 파일 정보 객체 {name, data}
     */
    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = e => {
                resolve({
                    name: file.name,
                    data: e.target.result
                });
            };
            
            reader.onerror = () => {
                reject(new Error(`파일 '${file.name}'을 읽는 중 오류가 발생했습니다.`));
            };
            
            reader.readAsDataURL(file);
        });
    }

    /**
     * 커스텀 스킨 파일 업로드 처리
     */
    async function handleSkinUpload() {
        const skinName = elements.skinNameInput.value.trim();
        const files = elements.folderUpload.files;
        
        // 유효성 검사
        const validation = validateSkinUpload(skinName, files);
        if (!validation.valid) {
            alert(validation.message);
            return;
        }
        
        try {
            // 파일 데이터 읽기
            const filesData = [];
            for (const file of files) {
                try {
                    const fileData = await readFileAsDataURL(file);
                    filesData.push(fileData);
                } catch (error) {
                    console.error('파일 읽기 오류:', error);
                    alert(error.message);
                    return;
                }
            }
            
            // 새 스킨 객체 생성
            const newSkin = {
                id: validation.skinId,
                name: skinName,
                description: '커스텀 스킨',
                isCustom: true
            };
            
            // 스킨 목록에 추가
            skins.push(newSkin);
            
            // 현재 스킨 인덱스 업데이트
            state.currentSkinIndex = skins.length - 1;
            
            // 모달 닫기
            elements.uploadModal.style.display = 'none';
            
            // 설정 저장
            saveSkinSettings();
            
            // 페이지네이션 업데이트
            initializePagination();
            updateCurrentSkin();
            
            // 업로드 폼 초기화
            elements.skinNameInput.value = '';
            elements.folderUpload.value = '';
            elements.fileUploadStatus.textContent = '선택된 파일 없음';
            
            // 배경 스크립트에 파일 데이터 전송
            chrome.runtime.sendMessage({
                action: 'uploadSkinFiles',
                skinId: validation.skinId,
                filesData: filesData
            }, function(response) {
                if (response && response.success) {
                    console.log('스킨 파일 업로드 성공');
                    alert('스킨이 성공적으로 업로드되었습니다.');
                } else {
                    console.error('스킨 파일 업로드 실패');
                    alert('스킨 파일 업로드에 실패했습니다.');
                }
            });
        } catch (error) {
            console.error('스킨 업로드 처리 오류:', error);
            alert('스킨 업로드 중 오류가 발생했습니다.');
        }
    }

    //==============================
    // 이벤트 핸들러
    //==============================
    
    /**
     * 이벤트 리스너 설정
     */
    function setupEventListeners() {
        // 이전 스킨 버튼
        elements.prevButton.addEventListener('click', function() {
            state.currentSkinIndex = (state.currentSkinIndex - 1 + skins.length) % skins.length;
            updateCurrentSkin();
        });
        
        // 다음 스킨 버튼
        elements.nextButton.addEventListener('click', function() {
            state.currentSkinIndex = (state.currentSkinIndex + 1) % skins.length;
            updateCurrentSkin();
        });
        
        // 적용 버튼
        elements.applyButton.addEventListener('click', applySkin);
        
        // 스킨 토글 스위치
        elements.skinToggle.addEventListener('change', function() {
            state.skinEnabled = this.checked;
            applySkin();
        });
        
        // 맵 토글 스위치
        elements.mapToggle.addEventListener('change', function() {
            state.mapEnabled = this.checked;
            
            // 체스판 다시 그리기
            initializeChessboard();
            
            // 설정 저장
            saveSkinSettings();
        });
        
        // 업로드 관련 이벤트
        setupUploadEvents();
    }
    
    /**
     * 업로드 관련 이벤트 설정
     */
    function setupUploadEvents() {
        // 업로드 버튼 클릭
        elements.uploadButton.addEventListener('click', function() {
            elements.uploadModal.style.display = 'block';
        });
        
        // 모달 닫기 버튼
        elements.closeModal.addEventListener('click', function() {
            elements.uploadModal.style.display = 'none';
        });
        
        // 모달 외부 클릭 시 닫기
        window.addEventListener('click', function(event) {
            if (event.target === elements.uploadModal) {
                elements.uploadModal.style.display = 'none';
            }
        });
        
        // 파일 선택 상태 표시
        elements.folderUpload.addEventListener('change', function() {
            if (this.files.length > 0) {
                elements.fileUploadStatus.textContent = `${this.files.length}개 파일 선택됨`;
            } else {
                elements.fileUploadStatus.textContent = '선택된 파일 없음';
            }
        });
        
        // 업로드 제출 버튼
        elements.submitUpload.addEventListener('click', handleSkinUpload);
    }

    //==============================
    // 초기화 및 실행
    //==============================
    
    /**
     * 앱 초기화
     */
    function initialize() {
        initializePagination();
        setupEventListeners();
        loadSettings();
    }

    // 앱 초기화 실행
    initialize();
});