#!/usr/bin/env node

/**
 * Node.js script to generate an 8x8 grid image from two 200x200 PNG files
 * Usage: node generate_grid.js <image1Path> <image2Path> [outputPath]
 */

const { createGridImageNode } = require('./grid_generator.js');
const path = require('path');

// 명령줄 인수 처리
const args = process.argv.slice(2);

if (args.length < 2) {
    console.error('사용법: node generate_grid.js <image1Path> <image2Path> [outputPath]');
    console.error('예시: node generate_grid.js light_square.png dark_square.png chess_board.png');
    process.exit(1);
}

const image1Path = path.resolve(args[0]);
const image2Path = path.resolve(args[1]);
const outputPath = args[2] ? path.resolve(args[2]) : 'grid_8x8.png';

// canvas 패키지 확인
try {
    require('canvas');
} catch (error) {
    console.error('Error: canvas 패키지가 설치되어 있지 않습니다.');
    console.error('다음 명령어로 설치하세요: npm install canvas');
    process.exit(1);
}

// 격자 이미지 생성
console.log('격자 이미지 생성 중...');
console.log(`이미지 1: ${image1Path}`);
console.log(`이미지 2: ${image2Path}`);
console.log(`출력 파일: ${outputPath}`);

createGridImageNode(image1Path, image2Path, outputPath)
    .then(filePath => {
        console.log('격자 이미지가 성공적으로 생성되었습니다:', filePath);
    })
    .catch(error => {
        console.error('격자 이미지 생성 중 오류 발생:', error);
        process.exit(1);
    }); 