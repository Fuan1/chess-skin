const STORAGE_KEY_PREFIX = "skinFiles_";

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
      [storageKey]: skinFilesData,
    });

    console.log(`스킨 '${skinId}'의 ${filesData.length}개 파일이 저장됨`);
    return true;
  } catch (error) {
    console.error("스킨 파일 저장 오류:", error);
    return false;
  }
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  // 커스텀 스킨 파일 업로드 요청
  if (request.action === "uploadSkinFiles") {
    handleUploadSkinFilesRequest(request, sendResponse);
    return true; // 비동기 응답을 위해 true 반환
  }
});

/**
 * 커스텀 스킨 파일 업로드 요청 처리
 * @param {Object} request - 요청 객체
 * @param {Function} sendResponse - 응답 콜백
 */
function handleUploadSkinFilesRequest(request, sendResponse) {
  console.log(
    `스킨 파일 업로드 요청: ${request.skinId}, ${request.filesData.length}개 파일`
  );

  saveCustomSkinFiles(request.skinId, request.filesData)
    .then((success) => sendResponse({ success: success }))
    .catch((error) => {
      console.error("스킨 파일 업로드 오류:", error);
      sendResponse({ success: false, error: error.message });
    });
}
