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
    {
      id: "horror",
      name: "Horror",
    },
    {
      id: "frankenstein-dracula",
      name: "Frankenstein vs Dracula",
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

  // Every file a skin folder may provide: 12 pieces plus optional board images
  const SKIN_FILE_NAMES = [
    ...PIECE_CODES.ALL.map((code) => `${code}.png`),
    "grid.png",
    "bright.png",
    "dark.png",
  ];

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
    skinCounter: document.getElementById("skin-counter"),
    skinStatus: document.getElementById("skin-status"),
    version: document.getElementById("version"),
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
    folderLabel: document.querySelector(".custom-file-upload"),
    requiredFiles: document.getElementById("required-files"),
    optionalFiles: document.getElementById("optional-files"),
    requiredCount: document.getElementById("required-count"),
    uploadMessage: document.getElementById("upload-message"),
  };

  // Cache existence checks so re-rendering the preview doesn't refetch files
  const imageExistsCache = {};

  function isImageExists(path) {
    if (!(path in imageExistsCache)) {
      imageExistsCache[path] = fetch(path)
        .then((response) => response.ok)
        .catch(() => false);
    }
    return imageExistsCache[path];
  }

  // Incremented on every render; a render that finishes after a newer one
  // started is discarded instead of appending to the board.
  const renderIds = { board: 0, pieces: 0 };

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
    const renderId = ++renderIds.board;
    const currentSkinId = getCurrentSkinId();

    // Load every image URL up front, in parallel
    const [lightURL, darkURL] = state.mapEnabled
      ? await Promise.all([
          getBoardImageURL(currentSkinId, true),
          getBoardImageURL(currentSkinId, false),
        ])
      : [null, null];
    const pieceURLs = await Promise.all(
      BOARD_SETUP.flat().map((pieceCode) =>
        getPieceImageURL(currentSkinId, pieceCode).catch((error) => {
          console.error(`Error loading piece image: ${pieceCode}`, error);
          return null;
        })
      )
    );

    // A newer render started while we were loading
    if (renderId !== renderIds.board) {
      return;
    }

    // Create 4x4 chessboard
    const fragment = document.createDocumentFragment();
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const square = document.createElement("div");
        const isLightSquare = (row + col) % 2 === 0;
        square.className = `chess-square ${
          isLightSquare ? "light-square" : "dark-square"
        }`;

        // If map is enabled, set background image
        const backgroundURL = isLightSquare ? lightURL : darkURL;
        if (backgroundURL) {
          const styles = {
            "background-image": `url('${backgroundURL}')`,
            "background-size": "100% 100%",
            "background-repeat": "no-repeat",
            "background-position": "center",
          };

          square.setAttribute("style", stylesToString(styles));
        }

        // Place chess pieces
        const imageURL = pieceURLs[row * 4 + col];
        if (imageURL) {
          const pieceImg = document.createElement("img");
          pieceImg.className = "chess-piece";
          pieceImg.alt = "";
          pieceImg.draggable = false;
          pieceImg.src = imageURL;
          square.appendChild(pieceImg);
        }

        fragment.appendChild(square);
      }
    }

    elements.board.replaceChildren(fragment);
  }

  async function initializePieceSelection() {
    const renderId = ++renderIds.pieces;
    const currentSkinId = getCurrentSkinId();

    // Piece name mapping
    const pieceNames = {
      wk: "King",
      wq: "Queen",
      wr: "Rook",
      wn: "Knight",
      wb: "Bishop",
    };

    const pieceURLs = await Promise.all(
      PIECE_CODES.SELECTION.map((pieceCode) =>
        getPieceImageURL(currentSkinId, pieceCode).catch((error) => {
          console.error(
            `Error loading piece selection image: ${pieceCode}`,
            error
          );
          return null;
        })
      )
    );

    if (renderId !== renderIds.pieces) {
      return;
    }

    const fragment = document.createDocumentFragment();
    PIECE_CODES.SELECTION.forEach((pieceCode, index) => {
      if (!pieceURLs[index]) {
        return;
      }

      const pieceContainer = document.createElement("div");
      pieceContainer.className = "piece-container";

      const pieceImg = document.createElement("img");
      pieceImg.className = "chess-piece";
      pieceImg.alt = "";
      pieceImg.draggable = false;
      pieceImg.src = pieceURLs[index];
      pieceContainer.appendChild(pieceImg);

      const pieceName = document.createElement("div");
      pieceName.className = "piece-name";
      pieceName.textContent = pieceNames[pieceCode];
      pieceContainer.appendChild(pieceName);

      fragment.appendChild(pieceContainer);
    });

    elements.pieceSelection.replaceChildren(fragment);
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
      deleteButton.setAttribute("aria-label", "Delete this skin");
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
      const dot = document.createElement("button");
      dot.className = `dot ${index === state.currentSkinIndex ? "active" : ""}`;
      dot.setAttribute("aria-label", skin.name);
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
    elements.skinCounter.textContent = `${state.currentSkinIndex + 1} / ${
      skins.length
    }`;
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
    reloadChessTab();
  }

  function updateApplyButtonState() {
    // Disable Apply button if skin is disabled
    elements.applyButton.disabled = !state.skinEnabled;
    elements.skinStatus.textContent = state.skinEnabled ? "On" : "Off";
    document.body.classList.toggle("skin-off", !state.skinEnabled);
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
    if (files.length === 0) {
      return {
        valid: false,
        message: "Choose a skin folder.",
      };
    }

    if (!skinName) {
      return {
        valid: false,
        message: "Enter a skin name.",
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
        message: `Missing ${missingFiles.length} required ${
          missingFiles.length === 1 ? "file" : "files"
        } (marked in red).`,
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
  // Only keep files the extension actually uses; a picked folder may
  // contain anything, and every byte counts against storage.local.
  function getUsableFiles(files) {
    return Array.from(files).filter((file) =>
      SKIN_FILE_NAMES.includes(file.name)
    );
  }

  function getFolderName(files) {
    const relativePath = files[0] && files[0].webkitRelativePath;
    return relativePath ? relativePath.split("/")[0] : "";
  }

  function setUploadMessage(text, type) {
    elements.uploadMessage.textContent = text;
    elements.uploadMessage.className = `upload-message ${type || ""}`;
  }

  function createFileChips() {
    const createChip = (fileName, required) => {
      const chip = document.createElement("span");
      chip.className = "file-chip";
      chip.dataset.file = fileName;
      chip.dataset.required = required;
      chip.textContent = fileName;
      return chip;
    };

    PIECE_CODES.ALL.forEach((code) =>
      elements.requiredFiles.appendChild(createChip(`${code}.png`, true))
    );
    SKIN_FILE_NAMES.filter(
      (fileName) => !PIECE_CODES.ALL.includes(fileName.replace(".png", ""))
    ).forEach((fileName) =>
      elements.optionalFiles.appendChild(createChip(fileName, false))
    );
  }

  /**
   * Reflect the picked folder in the checklist and enable Upload when valid
   */
  function updateUploadState() {
    const files = elements.folderUpload.files;
    const hasFiles = files.length > 0;
    const fileNames = Array.from(files).map((file) => file.name);

    elements.uploadModal
      .querySelectorAll(".file-chip")
      .forEach((chip) => {
        const found = fileNames.includes(chip.dataset.file);
        chip.classList.toggle("found", found);
        chip.classList.toggle(
          "missing",
          hasFiles && !found && chip.dataset.required === "true"
        );
      });

    const requiredFound = PIECE_CODES.ALL.filter((code) =>
      fileNames.includes(`${code}.png`)
    ).length;
    elements.requiredCount.textContent = hasFiles
      ? `· ${requiredFound} / ${PIECE_CODES.ALL.length} found`
      : `· ${PIECE_CODES.ALL.length} piece images`;

    elements.folderLabel.classList.toggle("has-files", hasFiles);
    elements.fileUploadStatus.textContent = hasFiles
      ? `${getFolderName(files)} · ${getUsableFiles(files).length} usable files`
      : "PNG files named like wk.png, bq.png";

    const validation = validateSkinUpload(
      elements.skinNameInput.value.trim(),
      files
    );
    elements.submitUpload.disabled = !validation.valid;

    if (!hasFiles) {
      setUploadMessage("");
    } else if (validation.valid) {
      setUploadMessage("Ready to upload.", "ok");
    } else {
      setUploadMessage(validation.message, "error");
    }
  }

  function openUploadModal() {
    elements.uploadModal.style.display = "block";
    updateUploadState();
  }

  function closeUploadModal() {
    elements.uploadModal.style.display = "none";
  }

  function resetUploadForm() {
    elements.skinNameInput.value = "";
    elements.folderUpload.value = "";
    updateUploadState();
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
      setUploadMessage(validation.message, "error");
      return;
    }

    elements.submitUpload.disabled = true;
    setUploadMessage("Uploading…");

    try {
      // Read file data
      const filesData = await Promise.all(
        getUsableFiles(files).map(readFileAsDataURL)
      );

      // Send file data to background script
      chrome.runtime.sendMessage(
        {
          action: "uploadSkinFiles",
          skinId: validation.skinId,
          filesData: filesData,
        },
        function (response) {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
          }

          if (response && response.success) {
            // Create new skin object
            const newSkin = {
              id: validation.skinId,
              name: skinName,
              isCustom: true,
            };

            // Add to skin list and show it in the preview
            skins.push(newSkin);
            state.currentSkinIndex = skins.length - 1;

            closeUploadModal();
            resetUploadForm();

            saveSkinSettings();
            initializePagination();
            updateCurrentSkin();
          } else {
            console.error("Failed to upload skin files");
            elements.submitUpload.disabled = false;
            setUploadMessage(
              "Couldn't save the skin. Please try again.",
              "error"
            );
          }
        }
      );
    } catch (error) {
      console.error("Error processing skin upload:", error);
      elements.submitUpload.disabled = false;
      setUploadMessage(error.message, "error");
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

    // Sound toggle switch (sounds are picked up on page load, so reload)
    elements.soundToggle.addEventListener("change", function () {
      state.soundEnabled = this.checked;
      saveSkinSettings();
      reloadChessTab();
    });

    // Upload-related events
    setupUploadEvents();
  }

  /**
   * Set up upload-related events
   */
  function setupUploadEvents() {
    createFileChips();

    elements.uploadButton.addEventListener("click", openUploadModal);
    elements.closeModal.addEventListener("click", closeUploadModal);

    // Close modal if clicked outside
    window.addEventListener("click", function (event) {
      if (event.target === elements.uploadModal) {
        closeUploadModal();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (
        event.key === "Escape" &&
        elements.uploadModal.style.display === "block"
      ) {
        closeUploadModal();
      }
    });

    // Keyboard access for the folder picker
    elements.folderLabel.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        elements.folderUpload.click();
      }
    });

    // Fill in the name from the folder and refresh the checklist
    elements.folderUpload.addEventListener("change", function () {
      if (!elements.skinNameInput.value.trim()) {
        elements.skinNameInput.value = getFolderName(this.files);
      }
      updateUploadState();
    });

    elements.skinNameInput.addEventListener("input", updateUploadState);
    elements.skinNameInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !elements.submitUpload.disabled) {
        handleSkinUpload();
      }
    });

    elements.submitUpload.addEventListener("click", handleSkinUpload);
  }

  function initialize() {
    elements.version.textContent = `v${chrome.runtime.getManifest().version}`;
    initializePagination();
    setupEventListeners();
    loadSettings();
  }

  // Reload the active tab, but only if it is a Chess.com page.
  // tab.url is only exposed for hosts listed in host_permissions.
  function reloadChessTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];
      if (!tab || !tab.url) {
        return;
      }

      const { hostname } = new URL(tab.url);
      if (hostname === "chess.com" || hostname.endsWith(".chess.com")) {
        chrome.tabs.reload(tab.id);
      }
    });
  }

  initialize();
});
