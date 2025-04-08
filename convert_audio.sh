#!/bin/bash

# 오디오 파일을 여러 포맷으로 변환하는 스크립트
# 사용법: ./convert_audio.sh 입력파일.확장자 [출력디렉토리]

# 입력 확인
if [ $# -eq 0 ]; then
    echo "사용법: $0 입력파일.확장자 [출력디렉토리]"
    echo "출력디렉토리가 지정되지 않으면 현재 디렉토리에 저장됩니다."
    exit 1
fi

INPUT_FILE="$1"
FILENAME=$(basename -- "$INPUT_FILE")
FILENAME_NOEXT="${FILENAME%.*}"

# 출력 디렉토리 설정
OUTPUT_DIR="."
if [ $# -ge 2 ]; then
    OUTPUT_DIR="$2"
    # 디렉토리가 없으면 생성
    if [ ! -d "$OUTPUT_DIR" ]; then
        echo "출력 디렉토리 '$OUTPUT_DIR'가 존재하지 않습니다. 생성합니다..."
        mkdir -p "$OUTPUT_DIR"
    fi
fi

# 파일 존재 확인
if [ ! -f "$INPUT_FILE" ]; then
    echo "오류: 파일 '$INPUT_FILE'을 찾을 수 없습니다."
    exit 1
fi

echo "파일 '$INPUT_FILE'을 여러 포맷으로 변환합니다..."
echo "출력 위치: $OUTPUT_DIR"

# OGG 변환
echo "OGG 포맷으로 변환 중..."
ffmpeg -i "$INPUT_FILE" -c:a libvorbis -q:a 4 "${OUTPUT_DIR}/${FILENAME_NOEXT}.ogg" -y

# WAV 변환
echo "WAV 포맷으로 변환 중..."
ffmpeg -i "$INPUT_FILE" -c:a pcm_s16le "${OUTPUT_DIR}/${FILENAME_NOEXT}.wav" -y

# WEBM 변환
echo "WEBM 포맷으로 변환 중..."
ffmpeg -i "$INPUT_FILE" -c:a libopus -b:a 128k "${OUTPUT_DIR}/${FILENAME_NOEXT}.webm" -y

# MP3 변환
echo "MP3 포맷으로 변환 중..."
ffmpeg -i "$INPUT_FILE" -c:a libmp3lame -q:a 2 "${OUTPUT_DIR}/${FILENAME_NOEXT}.mp3" -y

echo "변환 완료! 생성된 파일:"
echo "${OUTPUT_DIR}/${FILENAME_NOEXT}.ogg"
echo "${OUTPUT_DIR}/${FILENAME_NOEXT}.wav"
echo "${OUTPUT_DIR}/${FILENAME_NOEXT}.webm"
echo "${OUTPUT_DIR}/${FILENAME_NOEXT}.mp3" 