document.addEventListener('DOMContentLoaded', function() {
    // 전역 변수
    let currentSkinIndex = 0;
    let skinEnabled = true;

    // 사용 가능한 스킨 정보
    const skins = [
        {
            id: 'pixel',
            name: 'Pixel Perl',
            description: 'Pixel art style chess pieces'
        },
        {
            id: 'classic',
            name: 'Classic Skin',
            description: 'Default chess piece design'
        },
        {
            id: 'modern',
            name: 'Modern Skin',
            description: 'Modern design chess pieces'
        }
    ];

    // DOM 요소
    const boardElement = document.getElementById('preview-board');
    const skinTitleElement = document.getElementById('current-skin-title');
    const skinToggle = document.getElementById('skin-toggle');
    const prevButton = document.getElementById('prev-skin');
    const nextButton = document.getElementById('next-skin');
    const applyButton = document.getElementById('apply-skin');
    const paginationElement = document.getElementById('skin-pagination');

    // 체스판 초기화
    function initializeChessboard() {
        // 체스판 비우기
        boardElement.innerHTML = '';
        
        // 4x4 체스판에 대한 말 배치 정의
        const setup = [
            // 1행: 룩, 나이트, 비숍, 퀸 (흑색 말)
            ['br', 'bn', 'bb', 'bq'],
            // 2행: 폰, 폰, 폰, 폰
            ['bp', 'bp', 'bp', 'bp'],
            // 3행: 폰, 폰, 폰, 폰 (백색 말)
            ['wp', 'wp', 'wp', 'wp'],
            // 4행: 킹, 나이트, 비숍, 룩 (백색 말)
            ['wk', 'wn', 'wb', 'wr']
        ];
        
        // 4x4 체스판 생성
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const square = document.createElement('div');
                square.className = `chess-square ${(row + col) % 2 === 0 ? 'light-square' : 'dark-square'}`;
                
                // 체스 말 배치
                const piece = setup[row][col];
                if (piece) {
                    const pieceImg = document.createElement('img');
                    pieceImg.className = 'chess-piece';
                    pieceImg.src = `skins/${skins[currentSkinIndex].id}/${piece}.png`;
                    pieceImg.onerror = () => { pieceImg.src = `images/${piece}.png`; }; // 대체 이미지
                    square.appendChild(pieceImg);
                }
                
                boardElement.appendChild(square);
            }
        }
    }
    
    // 하단 체스 말 선택 영역 초기화
    function initializePieceSelection() {
        const pieceSelection = document.getElementById('piece-selection');
        pieceSelection.innerHTML = '';
        
        // Add 5 chess pieces (King, Queen, Rook, Knight, Bishop)
        const pieces = ['wk', 'wq', 'wr', 'wn', 'wb'];
        
        pieces.forEach((piece) => {
            const pieceContainer = document.createElement('div');
            pieceContainer.className = 'piece-container';
            
            const pieceImg = document.createElement('img');
            pieceImg.className = 'chess-piece';
            pieceImg.src = `skins/${skins[currentSkinIndex].id}/${piece}.png`;
            pieceImg.onerror = () => { pieceImg.src = `images/${piece}.png`; }; // Fallback image
            
            pieceContainer.appendChild(pieceImg);
            pieceSelection.appendChild(pieceContainer);
        });
    }

    // 현재 선택된 스킨 표시
    function updateCurrentSkin() {
        const currentSkin = skins[currentSkinIndex];
        skinTitleElement.textContent = currentSkin.name;
        
        // 페이지네이션 업데이트
        updatePagination();
        
        // 체스판 업데이트
        initializeChessboard();
        // 체스 말 선택 영역 업데이트
        initializePieceSelection();
    }

    // 페이지네이션 초기화
    function initializePagination() {
        // 페이지네이션 비우기
        paginationElement.innerHTML = '';
        
        // 스킨 개수만큼 닷 추가
        skins.forEach((skin, index) => {
            const dot = document.createElement('span');
            dot.className = `dot ${index === currentSkinIndex ? 'active' : ''}`;
            dot.addEventListener('click', () => {
                currentSkinIndex = index;
                updateCurrentSkin();
            });
            paginationElement.appendChild(dot);
        });
    }

    // 페이지네이션 업데이트
    function updatePagination() {
        const dots = paginationElement.querySelectorAll('.dot');
        dots.forEach((dot, index) => {
            dot.className = `dot ${index === currentSkinIndex ? 'active' : ''}`;
        });
    }

    // 스킨 저장 함수
    function saveSkinSettings() {
        chrome.storage.sync.set({
            selectedSkin: skins[currentSkinIndex].id,
            skinEnabled: skinEnabled
        });
    }

    // 스킨 적용 함수
    function applySkin() {
        // 현재 선택된 스킨 저장
        saveSkinSettings();
        
        // background.js에 메시지 전송
        chrome.runtime.sendMessage({
            action: 'applySkin',
            skin: skins[currentSkinIndex].id,
            enabled: skinEnabled
        }, function(response) {
            if (response && response.success) {
                console.log('Skin applied successfully');
                // 활성화된 탭 새로고침
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    if (tabs && tabs[0]) {
                        chrome.tabs.reload(tabs[0].id);
                    }
                });
            } else {
                console.error('Failed to apply skin');
            }
        });
    }

    // 현재 설정 가져오기
    function loadSettings() {
        chrome.storage.sync.get(['selectedSkin', 'skinEnabled'], function(data) {
            // 저장된 스킨 ID가 있으면 해당 스킨으로 설정
            if (data.selectedSkin) {
                const skinIndex = skins.findIndex(skin => skin.id === data.selectedSkin);
                if (skinIndex !== -1) {
                    currentSkinIndex = skinIndex;
                }
            }
            
            // 스킨 활성화 설정
            if (data.skinEnabled !== undefined) {
                skinEnabled = data.skinEnabled;
                skinToggle.checked = skinEnabled;
            } else {
                skinEnabled = true;
                skinToggle.checked = true;
            }
            
            // UI 업데이트
            updateCurrentSkin();
        });
    }

    // 이벤트 리스너 설정
    function setupEventListeners() {
        // 이전 스킨 버튼
        prevButton.addEventListener('click', function() {
            currentSkinIndex = (currentSkinIndex - 1 + skins.length) % skins.length;
            updateCurrentSkin();
        });
        
        // 다음 스킨 버튼
        nextButton.addEventListener('click', function() {
            currentSkinIndex = (currentSkinIndex + 1) % skins.length;
            updateCurrentSkin();
        });
        
        // 적용 버튼
        applyButton.addEventListener('click', function() {
            applySkin();
        });
        
        // 토글 스위치
        skinToggle.addEventListener('change', function() {
            skinEnabled = this.checked;
            applySkin();
        });
    }

    // 초기화
    function initialize() {
        initializePagination();
        initializePieceSelection();
        setupEventListeners();
        loadSettings();
    }

    // 앱 초기화
    initialize();
});