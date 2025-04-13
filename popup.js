document.addEventListener("DOMContentLoaded", function () {
  const state = {
    currentSkinIndex: 0,
    skinEnabled: true,
    mapEnabled: true,
    soundEnabled: true,
    customSkinImages: {},
  };

  const DEFAULT_SKINS = [
    {
      id: "animal",
      name: "Animal",
    },
    {
      id: "casino",
      name: "Casino",
    },
    {
      id: "machine",
      name: "Machine",
    },
  ];

  let skins = [...DEFAULT_SKINS];

  const CUSTOM_SKIN_PREFIX = "custom_";

  const PIECE_CODES = {
    ALL: [
      "bb",
      "bk",
      "bn",
      "bp",
      "bq",
      "br",
      "wb",
      "wk",
      "wn",
      "wp",
      "wq",
      "wr",
    ],
    SELECTION: ["wk", "wq", "wr", "wn", "wb"], // Pieces to display in preview
  };

  const BOARD_SETUP = [
    ["br", "bn", "bb", "bq"],
    ["bp", "bp", "bp", "bp"],
    ["wp", "wp", "wp", "wp"],
    ["wk", "wn", "wb", "wr"],
  ];

  //==============================
  // DOM Elements References
  //==============================
  const elements = {
    board: document.getElementById("preview-board"),
    skinTitle: document.getElementById("current-skin-title"),
    skinToggle: document.getElementById("skin-toggle"),
    mapToggle: document.getElementById("map-toggle"),
    soundToggle: document.getElementById("sound-toggle"),
    prevButton: document.getElementById("prev-skin"),
    nextButton: document.getElementById("next-skin"),
    applyButton: document.getElementById("apply-skin"),
    pagination: document.getElementById("skin-pagination"),
    pieceSelection: document.getElementById("piece-selection"),

    // Upload-related elements
    uploadButton: document.getElementById("upload-skin"),
    uploadModal: document.getElementById("upload-modal"),
    closeModal: document.querySelector(".close"),
    submitUpload: document.getElementById("submit-upload"),
    folderUpload: document.getElementById("folder-upload"),
    skinNameInput: document.getElementById("skin-name"),
    fileUploadStatus: document.getElementById("file-upload-status"),
  };

  async function isImageExists(path) {
    try {
      const response = await fetch(path);
      return response.ok;
    } catch (error) {
      console.log(`Image not found: ${path}`);
      return false;
    }
  }

  function isCustomSkin(skinId) {
    return skinId.startsWith(CUSTOM_SKIN_PREFIX);
  }

  function getCurrentSkinId() {
    return skins[state.currentSkinIndex].id;
  }

  function stylesToString(styleObj) {
    return Object.entries(styleObj)
      .map(([key, value]) => `${key}: ${value};`)
      .join(" ");
  }

  async function getCustomSkinImageURL(skinId, fileName) {
    // If already cached, return the cached image
    const cacheKey = `${skinId}_${fileName}`;
    if (state.customSkinImages[cacheKey]) {
      return state.customSkinImages[cacheKey];
    }

    // Get skin data from chrome.storage.local
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get([`skinFiles_${skinId}`], resolve);
      });

      const skinFiles = result[`skinFiles_${skinId}`];
      if (skinFiles && skinFiles[fileName]) {
        // Cache the image
        state.customSkinImages[cacheKey] = skinFiles[fileName];
        return skinFiles[fileName];
      }
    } catch (error) {
      console.error("Error getting custom skin image:", error);
    }

    return null;
  }

  async function getPieceImageURL(skinTheme, pieceCode) {
    const fileName = `${pieceCode}.png`;

    if (isCustomSkin(skinTheme)) {
      const dataURL = await getCustomSkinImageURL(skinTheme, fileName);
      if (dataURL) {
        return dataURL;
      }
    }

    return `skins/${skinTheme}/${fileName}`;
  }

  async function getBoardImageURL(skinTheme, isLightSquare) {
    const mapFileName = isLightSquare ? "bright.png" : "dark.png";

    if (isCustomSkin(skinTheme)) {
      // If it's a custom skin
      return await getCustomSkinImageURL(skinTheme, mapFileName);
    } else {
      // For default skins, check if the file exists
      const mapPath = `skins/${skinTheme}/${mapFileName}`;
      const exists = await isImageExists(mapPath);
      return exists ? mapPath : null;
    }
  }

  async function initializeChessboard() {
    // Clear chessboard
    elements.board.innerHTML = "";

    const currentSkinId = getCurrentSkinId();

    // Create 4x4 chessboard
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const square = document.createElement("div");
        const isLightSquare = (row + col) % 2 === 0;
        square.className = `chess-square ${
          isLightSquare ? "light-square" : "dark-square"
        }`;

        // If map is enabled, set background image
        if (state.mapEnabled) {
          const backgroundURL = await getBoardImageURL(
            currentSkinId,
            isLightSquare
          );

          if (backgroundURL) {
            const styles = {
              "background-image": `url('${backgroundURL}')`,
              "background-size": "100% 100%",
              "background-repeat": "no-repeat",
              "background-position": "center",
            };

            square.setAttribute("style", stylesToString(styles));
          }
        }

        // Place chess pieces
        const pieceCode = BOARD_SETUP[row][col];
        if (pieceCode) {
          const pieceImg = document.createElement("img");
          pieceImg.className = "chess-piece";

          try {
            const imageURL = await getPieceImageURL(currentSkinId, pieceCode);
            console.log("Piece image loaded:", imageURL);

            pieceImg.src = imageURL;

            // Use alternative image on error
            pieceImg.onerror = () => {
              pieceImg.src = `images/${pieceCode}.png`;
            };

            square.appendChild(pieceImg);
          } catch (error) {
            console.error(`Error loading piece image: ${pieceCode}`, error);
          }
        }

        elements.board.appendChild(square);
      }
    }
  }

  async function initializePieceSelection() {
    elements.pieceSelection.innerHTML = "";

    const currentSkinId = getCurrentSkinId();

    // Piece name mapping
    const pieceNames = {
      wk: "King",
      wq: "Queen",
      wr: "Rook",
      wn: "Knight",
      wb: "Bishop",
    };

    for (const pieceCode of PIECE_CODES.SELECTION) {
      const pieceContainer = document.createElement("div");
      pieceContainer.className = "piece-container";

      const pieceImg = document.createElement("img");
      pieceImg.className = "chess-piece";

      try {
        const imageURL = await getPieceImageURL(currentSkinId, pieceCode);
        pieceImg.src = imageURL;

        pieceImg.onerror = () => {
          pieceImg.src = `images/${pieceCode}.png`;
        };

        pieceContainer.appendChild(pieceImg);

        const pieceName = document.createElement("div");
        pieceName.className = "piece-name";
        pieceName.textContent = pieceNames[pieceCode];
        pieceContainer.appendChild(pieceName);

        elements.pieceSelection.appendChild(pieceContainer);
      } catch (error) {
        console.error(
          `Error loading piece selection image: ${pieceCode}`,
          error
        );
      }
    }
  }

  function updateCurrentSkin() {
    const currentSkin = skins[state.currentSkinIndex];
    elements.skinTitle.textContent = currentSkin.name;

    // If delete button exists, remove it
    const existingDeleteButton = document.querySelector(".delete-button");
    if (existingDeleteButton) {
      existingDeleteButton.remove();
    }

    // Add delete button if it's a custom skin
    if (isCustomSkin(currentSkin.id)) {
      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-button";
      deleteButton.innerHTML = "✕";
      deleteButton.title = "Delete this skin";
      deleteButton.addEventListener("click", () =>
        deleteCustomSkin(currentSkin.id)
      );
      elements.skinTitle.appendChild(deleteButton);
    }

    // Update pagination
    updatePagination();

    // Update chessboard and piece selection area
    initializeChessboard();
    initializePieceSelection();
  }

  function deleteCustomSkin(skinId) {
    if (!isCustomSkin(skinId)) {
      console.error("Cannot delete default skins.");
      return;
    }

    if (
      confirm(
        "Are you sure you want to delete this skin? This action cannot be undone."
      )
    ) {
      // Remove from skin list
      const skinIndex = skins.findIndex((skin) => skin.id === skinId);
      if (skinIndex !== -1) {
        skins.splice(skinIndex, 1);

        // Adjust current index if the deleted skin was selected
        if (state.currentSkinIndex >= skinIndex) {
          state.currentSkinIndex = Math.max(0, state.currentSkinIndex - 1);
        }

        // Delete skin files from local storage
        chrome.storage.local.remove([`skinFiles_${skinId}`], function () {
          console.log(`Deleted skin files from local storage: ${skinId}`);
        });

        // Save settings again (if the deleted skin was selected, change to default skin)
        chrome.storage.sync.get(["selectedSkin"], function (data) {
          if (data.selectedSkin === skinId) {
            // Change to default skin (classic)
            const defaultSkinIndex = skins.findIndex(
              (skin) => skin.id === "classic"
            );
            if (defaultSkinIndex !== -1) {
              state.currentSkinIndex = defaultSkinIndex;
            }
          }

          // Save settings and update UI
          saveSkinSettings();
          initializePagination();
          updateCurrentSkin();

          // If the currently applied skin is deleted, apply default skin
          applySkin();
        });
      }
    }
  }

  function initializePagination() {
    // Clear pagination
    elements.pagination.innerHTML = "";

    // Add dots for each skin
    skins.forEach((skin, index) => {
      const dot = document.createElement("span");
      dot.className = `dot ${index === state.currentSkinIndex ? "active" : ""}`;
      dot.addEventListener("click", () => {
        state.currentSkinIndex = index;
        updateCurrentSkin();
      });
      elements.pagination.appendChild(dot);
    });
  }

  function updatePagination() {
    const dots = elements.pagination.querySelectorAll(".dot");
    dots.forEach((dot, index) => {
      dot.className = `dot ${index === state.currentSkinIndex ? "active" : ""}`;
    });
  }

  function saveSkinSettings() {
    const currentSkinId = getCurrentSkinId();
    chrome.storage.sync.set({
      selectedSkin: currentSkinId,
      skinEnabled: state.skinEnabled,
      mapEnabled: state.mapEnabled,
      soundEnabled: state.soundEnabled,
      customSkins: skins.filter((skin) => skin.isCustom),
    });
  }

  function applySkin() {
    updateApplyButtonState();
    saveSkinSettings();
    reloadCurrentTab();
  }

  function updateApplyButtonState() {
    // Disable Apply button if skin is disabled
    elements.applyButton.disabled = !state.skinEnabled;
    elements.applyButton.style.opacity = state.skinEnabled ? "1" : "0.5";
    elements.applyButton.style.cursor = state.skinEnabled
      ? "pointer"
      : "not-allowed";
  }

  function loadSettings() {
    chrome.storage.sync.get(
      [
        "selectedSkin",
        "skinEnabled",
        "mapEnabled",
        "soundEnabled",
        "customSkins",
      ],
      function (data) {
        // Skin enabled setting
        if (data.skinEnabled !== undefined) {
          state.skinEnabled = data.skinEnabled;
          elements.skinToggle.checked = state.skinEnabled;
        } else {
          state.skinEnabled = false;
          elements.skinToggle.checked = false;
        }

        // Map enabled setting
        if (data.mapEnabled !== undefined) {
          state.mapEnabled = data.mapEnabled;
          elements.mapToggle.checked = state.mapEnabled;
        } else {
          state.mapEnabled = true;
          elements.mapToggle.checked = true;
        }

        // Sound enabled setting
        if (data.soundEnabled !== undefined) {
          state.soundEnabled = data.soundEnabled;
          elements.soundToggle.checked = state.soundEnabled;
        } else {
          state.soundEnabled = true;
          elements.soundToggle.checked = true;
        }

        // Load custom skins
        if (data.customSkins && Array.isArray(data.customSkins)) {
          // Add custom skins to existing skins
          data.customSkins.forEach((customSkin) => {
            // Check if already exists
            if (!skins.some((skin) => skin.id === customSkin.id)) {
              skins.push(customSkin);
            }
          });

          // If saved skin ID exists, set it
          if (data.selectedSkin) {
            const skinIndex = skins.findIndex(
              (skin) => skin.id === data.selectedSkin
            );
            if (skinIndex !== -1) {
              state.currentSkinIndex = skinIndex;
            }
          }

          // Initialize pagination
          initializePagination();
        }

        // UI update
        updateApplyButtonState();
        updateCurrentSkin();
      }
    );
  }

  function validateSkinUpload(skinName, files) {
    if (!skinName) {
      return {
        valid: false,
        message: "Please enter a skin name.",
      };
    }

    if (files.length === 0) {
      return {
        valid: false,
        message: "Please select skin files.",
      };
    }

    // Create unique ID (remove spaces from name and convert to lowercase)
    const skinId =
      CUSTOM_SKIN_PREFIX + skinName.toLowerCase().replace(/\s+/g, "_");

    // Check if a skin with the same name exists
    const existingSkin = skins.find(
      (skin) =>
        skin.name.toLowerCase() === skinName.toLowerCase() || skin.id === skinId
    );

    if (existingSkin) {
      return {
        valid: false,
        message: "A skin with this name already exists.",
      };
    }

    // Check required files
    const fileNames = Array.from(files).map((file) => file.name);
    const missingFiles = PIECE_CODES.ALL.map((code) => `${code}.png`).filter(
      (file) => !fileNames.includes(file)
    );

    if (missingFiles.length > 0) {
      return {
        valid: false,
        message: `Missing required files: ${missingFiles.join(", ")}`,
      };
    }

    return {
      valid: true,
      skinId: skinId,
    };
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        resolve({
          name: file.name,
          data: e.target.result,
        });
      };

      reader.onerror = () => {
        reject(new Error(`Error reading file '${file.name}'.`));
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * Handle custom skin file upload
   */
  async function handleSkinUpload() {
    const skinName = elements.skinNameInput.value.trim();
    const files = elements.folderUpload.files;

    // Validate
    const validation = validateSkinUpload(skinName, files);
    if (!validation.valid) {
      alert(validation.message);
      return;
    }

    try {
      // Read file data
      const filesData = [];
      for (const file of files) {
        try {
          const fileData = await readFileAsDataURL(file);
          filesData.push(fileData);
        } catch (error) {
          console.error("Error reading file:", error);
          alert(error.message);
          return;
        }
      }

      // Send file data to background script
      chrome.runtime.sendMessage(
        {
          action: "uploadSkinFiles",
          skinId: validation.skinId,
          filesData: filesData,
        },
        function (response) {
          if (response && response.success) {
            console.log("Skin files uploaded successfully");
            alert("Skin has been uploaded successfully.");

            // Create new skin object
            const newSkin = {
              id: validation.skinId,
              name: skinName,
              isCustom: true,
            };

            // Add to skin list
            skins.push(newSkin);

            // Update current skin index
            state.currentSkinIndex = skins.length - 1;

            // Close modal
            elements.uploadModal.style.display = "none";

            // Save settings
            saveSkinSettings();
            // Update pagination
            initializePagination();
            updateCurrentSkin();

            // Reset upload form
            elements.skinNameInput.value = "";
            elements.folderUpload.value = "";
            elements.fileUploadStatus.textContent = "No files selected";
          } else {
            console.error("Failed to upload skin files");
            alert("Failed to upload skin files.");
          }
        }
      );
    } catch (error) {
      console.error("Error processing skin upload:", error);
      alert("An error occurred while uploading the skin.");
    }
  }

  function setupEventListeners() {
    // Previous skin button
    elements.prevButton.addEventListener("click", function () {
      state.currentSkinIndex =
        (state.currentSkinIndex - 1 + skins.length) % skins.length;
      updateCurrentSkin();
    });

    // Next skin button
    elements.nextButton.addEventListener("click", function () {
      state.currentSkinIndex = (state.currentSkinIndex + 1) % skins.length;
      updateCurrentSkin();
    });

    // Apply button
    elements.applyButton.addEventListener("click", applySkin);

    // Skin toggle switch
    elements.skinToggle.addEventListener("change", function () {
      state.skinEnabled = this.checked;
      applySkin();
    });

    // Map toggle switch
    elements.mapToggle.addEventListener("change", function () {
      state.mapEnabled = this.checked;

      // Recreate chessboard
      initializeChessboard();

      // Save settings
      saveSkinSettings();
    });

    // Sound toggle switch
    elements.soundToggle.addEventListener("change", function () {
      state.soundEnabled = this.checked;
      saveSkinSettings();
    });

    // Upload-related events
    setupUploadEvents();
  }

  /**
   * Set up upload-related events
   */
  function setupUploadEvents() {
    elements.uploadButton.addEventListener("click", function () {
      elements.uploadModal.style.display = "block";
    });

    elements.closeModal.addEventListener("click", function () {
      elements.uploadModal.style.display = "none";
    });

    // Close modal if clicked outside
    window.addEventListener("click", function (event) {
      if (event.target === elements.uploadModal) {
        elements.uploadModal.style.display = "none";
      }
    });

    // Display file selection status
    elements.folderUpload.addEventListener("change", function () {
      if (this.files.length > 0) {
        elements.fileUploadStatus.textContent = `${this.files.length} files selected`;
      } else {
        elements.fileUploadStatus.textContent = "No files selected";
      }
    });

    elements.submitUpload.addEventListener("click", handleSkinUpload);
  }

  function initialize() {
    initializePagination();
    setupEventListeners();
    loadSettings();
  }

  // Reload current tab function
  function reloadCurrentTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  }

  initialize();
});
