const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = './public'; // public 디렉토리 설정

// MIME 타입 매핑
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// HTTP 서버 생성
const server = http.createServer((request, response) => {
    console.log(`요청: ${request.url}`);
    
    // URL에서 파일 경로 추출 (public 디렉토리 기준)
    let filePath = PUBLIC_DIR + request.url;
    if (request.url === '/') {
        filePath = path.join(PUBLIC_DIR, 'index.html');
    }
    
    // 파일 확장자 추출
    const extname = String(path.extname(filePath)).toLowerCase();
    
    // 기본 콘텐츠 타입
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    // 파일 읽기
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // 파일을 찾을 수 없음
                fs.readFile(path.join(PUBLIC_DIR, '404.html'), (err, content) => {
                    if (err) {
                        // 404 페이지도 없는 경우
                        response.writeHead(404);
                        response.end('File not found: ' + filePath);
                    } else {
                        response.writeHead(404, { 'Content-Type': 'text/html' });
                        response.end(content, 'utf-8');
                    }
                });
            } else {
                // 서버 오류
                response.writeHead(500);
                response.end(`서버 오류: ${error.code}`);
                console.error(`서버 오류: ${error.code} - ${filePath}`);
            }
        } else {
            // 성공적으로 파일을 읽음
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
        }
    });
});

// 서버 시작 전에 public 디렉토리 존재 여부 확인
fs.access(PUBLIC_DIR, fs.constants.F_OK, (err) => {
    if (err) {
        console.error(`'${PUBLIC_DIR}' 디렉토리가 존재하지 않습니다. 디렉토리를 생성합니다.`);
        fs.mkdir(PUBLIC_DIR, { recursive: true }, (err) => {
            if (err) {
                console.error(`디렉토리 생성 실패: ${err.message}`);
                process.exit(1);
            } else {
                console.log(`'${PUBLIC_DIR}' 디렉토리가 생성되었습니다.`);
                startServer();
            }
        });
    } else {
        startServer();
    }
});

// 서버 시작 함수
function startServer() {
    server.listen(PORT, () => {
        console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
        console.log(`http://localhost:${PORT}에서 접속하세요.`);
        console.log(`정적 파일은 '${PUBLIC_DIR}' 디렉토리에서 제공됩니다.`);
    });
}