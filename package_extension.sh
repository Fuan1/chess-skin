#!/bin/bash

# 크롬 익스텐션 패키징 스크립트
# 사용법: ./package_extension.sh [출력파일명]

# 현재 날짜를 가져옵니다 (YYYY-MM-DD 형식)
CURRENT_DATE=$(date +"%Y-%m-%d")

# 출력 파일명 설정
if [ -z "$1" ]; then
  OUTPUT_FILE="chess-skin-extension-${CURRENT_DATE}.zip"
else
  OUTPUT_FILE="$1"
fi

# 필수 파일 및 디렉토리 목록
REQUIRED_FILES=(
  "background.js" 
  "content.js"
  "manifest.json"
  "popup.html"
  "popup.js"
)

REQUIRED_DIRS=(
  "icons"
  "skins"
)

# 임시 디렉토리 생성
TEMP_DIR="temp_package"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

echo "크롬 익스텐션 패키징을 시작합니다..."

# 필수 파일 존재 여부 확인
MISSING=false

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ 오류: 필수 파일 '$file'이 없습니다."
    MISSING=true
  else
    echo "✅ 필수 파일 '$file' 확인"
    cp "$file" "$TEMP_DIR/"
  fi
done

for dir in "${REQUIRED_DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    echo "❌ 오류: 필수 디렉토리 '$dir'이 없습니다."
    MISSING=true
  else
    echo "✅ 필수 디렉토리 '$dir' 확인"
    cp -r "$dir" "$TEMP_DIR/"
  fi
done

# 필수 파일이 없으면 종료
if [ "$MISSING" = true ]; then
  echo "필수 파일 또는 디렉토리가 없어 패키징을 중단합니다."
  rm -rf "$TEMP_DIR"
  exit 1
fi

# ZIP 파일 생성
echo "ZIP 파일 생성 중: $OUTPUT_FILE"
cd "$TEMP_DIR" && zip -r "../$OUTPUT_FILE" * > /dev/null

# 임시 디렉토리 삭제
cd .. && rm -rf "$TEMP_DIR"

# 파일 크기 확인
SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)

echo "✅ 패키징 완료!"
echo "📦 파일명: $OUTPUT_FILE"
echo "📊 파일 크기: $SIZE"
echo "다음 파일 및 디렉토리가 포함되었습니다:"

for file in "${REQUIRED_FILES[@]}"; do
  echo " - $file"
done

for dir in "${REQUIRED_DIRS[@]}"; do
  echo " - $dir/"
done 