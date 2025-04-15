import * as THREE from 'three';

export class AGVGridManager {
    constructor(sceneManager, floorManager) {
        this.sceneManager = sceneManager;
        this.floorManager = floorManager;
        this.config = {
            scale: 0.05,         // m/px
            cellWidth: 1,        // 가로 셀 크기 (m)
            cellHeight: 1,       // 세로 셀 크기 (m)
            widthCells: 10,      // 가로 셀 수량
            heightCells: 10,     // 세로 셀 수량
            originX: 3,          // 원점 X 위치 (좌측변 기준, m)
            originY: 3.5,        // 원점 Y 위치 (상단변 기준, m)
            gridVisible: false   // 그리드 표시 여부 (기본값 false)
        };
        
        this.dimensions = {
            width: 0,  // 실제 가로 길이(m)
            depth: 0   // 실제 세로 길이(m)
        };
        
        this.nodes = []; // Grid 노드 저장
        
        // AGV 그리드 그룹 이름
        this.groupName = 'agvGrid';
    }
    
    // AGV 그리드 생성
    createAGVGrid(config = null) {
        // 설정 업데이트
        if (config) {
            this.updateConfig(config);
        }
        
        // 기존 AGV 그리드 삭제
        this.sceneManager.clearGroup(this.groupName);
        this.nodes = [];
        
        // 그리드가 꺼져 있으면 여기서 중단
        if (!this.config.gridVisible) {
            return true;
        }
        
        // 치수 계산
        this.dimensions.width = this.config.widthCells * this.config.cellWidth;
        this.dimensions.depth = this.config.heightCells * this.config.cellHeight;
        
        // 바닥면 치수 가져오기
        const floorDimensions = this.floorManager.getDimensions();
        
        // AGV 그리드가 바닥면을 벗어나는지 확인
        if (this.config.originX + this.dimensions.width > floorDimensions.width ||
            this.config.originY + this.dimensions.depth > floorDimensions.depth) {
            this.showWarning("AGV 그리드가 바닥면을 벗어납니다.");
            return false;
        }
        
        // AGV 그리드 생성
        this.createGrid();
        
        // 도면 모드일 때만 치수 표시 화살표 생성 (그리드가 표시된 경우에만)
        if (this.floorManager.config.blueprintMode && this.config.gridVisible) {
            this.createDimensionArrows();
        }
        
        // 노드 생성
        this.createNodes();
        
        return true;
    }
    
    // 설정 업데이트
    updateConfig(config) {
        Object.assign(this.config, config);
    }
    
    // AGV 그리드 그리드 생성
    createGrid() {
        const width = this.dimensions.width;
        const depth = this.dimensions.depth;
        const cellWidth = this.config.cellWidth;
        const cellHeight = this.config.cellHeight;
        const originX = this.config.originX;
        const originY = this.config.originY;
        
        // 그리드 라인 생성
        const gridHelper = new THREE.Group();
        
        // 가로 라인 (Z축 방향)
        for (let i = 0; i <= this.config.heightCells; i++) {
            const y = i * cellHeight;
            const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(originX, 0.02, originY + y),
                new THREE.Vector3(originX + width, 0.02, originY + y)
            ]);
            const lineMaterial = new THREE.LineBasicMaterial({ 
                color: i % 5 === 0 ? 0xCC0000 : 0xFF3333,
                linewidth: i % 5 === 0 ? 2 : 1
            });
            const line = new THREE.Line(lineGeometry, lineMaterial);
            gridHelper.add(line);
        }
        
        // 세로 라인 (X축 방향)
        for (let i = 0; i <= this.config.widthCells; i++) {
            const x = i * cellWidth;
            const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(originX + x, 0.02, originY),
                new THREE.Vector3(originX + x, 0.02, originY + depth)
            ]);
            const lineMaterial = new THREE.LineBasicMaterial({ 
                color: i % 5 === 0 ? 0xCC0000 : 0xFF3333,
                linewidth: i % 5 === 0 ? 2 : 1
            });
            const line = new THREE.Line(lineGeometry, lineMaterial);
            gridHelper.add(line);
        }
        
        // 장면에 추가
        this.sceneManager.addToGroup(this.groupName, gridHelper);
    }
    
    // 그리드 좌표 텍스트 추가
    addGridCoordinateText(x, z, xIndex, zIndex, parent) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 32;
        
        // 배경 그리기
        context.fillStyle = 'rgba(255, 230, 230, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // 텍스트 그리기
        context.font = 'bold 16px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = '#CC0000';
        context.fillText(`(${xIndex},${zIndex})`, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        const labelGeometry = new THREE.PlaneGeometry(0.5, 0.25);
        const labelMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        const label = new THREE.Mesh(labelGeometry, labelMaterial);
        label.position.set(x, 0.025, z);
        label.rotation.x = -Math.PI / 2; // 텍스트가 위를 향하도록 회전
        
        parent.add(label);
        
        // 툴팁 속성 추가
        label.userData = {
            type: 'tooltip',
            value: `AGV 그리드 좌표: (${xIndex}, ${zIndex})`
        };
    }
    
    // 노드 생성
    createNodes() {
        const cellWidth = this.config.cellWidth;
        const cellHeight = this.config.cellHeight;
        const originX = this.config.originX;
        const originY = this.config.originY;
        
        // 노드 그룹
        const nodesGroup = new THREE.Group();
        
        // 각 그리드 교차점에 노드 생성
        for (let row = 0; row <= this.config.heightCells; row++) {
            for (let col = 0; col <= this.config.widthCells; col++) {
                const x = originX + col * cellWidth;
                const z = originY + row * cellHeight;
                
                // 노드 지오메트리 및 머티리얼
                const nodeGeometry = new THREE.SphereGeometry(0.08, 16, 16);
                // 5개 간격마다 더 큰 노드로 표시
                if (row % 5 === 0 && col % 5 === 0) {
                    nodeGeometry.scale(1.5, 1.5, 1.5);
                }
                
                const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0x0000FF });
                
                // 노드 메쉬 생성
                const nodeMesh = new THREE.Mesh(nodeGeometry, nodeMaterial);
                nodeMesh.position.set(x, 0.03, z);
                nodeMesh.userData = {
                    type: 'agvNode',
                    gridX: col,
                    gridY: row
                };
                
                // 노드 저장
                this.nodes.push({
                    mesh: nodeMesh,
                    gridX: col,
                    gridY: row,
                    worldX: x,
                    worldZ: z
                });
                
                // 그룹에 추가
                nodesGroup.add(nodeMesh);
            }
        }
        
        // 장면에 추가
        this.sceneManager.addToGroup(this.groupName, nodesGroup);
    }
    
    // 치수 표시 화살표 생성
    createDimensionArrows() {
        const originX = this.config.originX;
        const originY = this.config.originY;
        const width = this.dimensions.width;
        const depth = this.dimensions.depth;
        
        // X 방향 화살표 (바닥면 기준으로부터 거리) - 바닥면 위에 표시
        this.createArrow(
            new THREE.Vector3(originX, 0.15, 0),
            new THREE.Vector3(originX, 0.15, originY),
            `${originY.toFixed(1)}m`,
            0xFF0000,
            true
        );
        
        // Z 방향 화살표 (바닥면 기준으로부터 거리) - 바닥면 위에 표시
        this.createArrow(
            new THREE.Vector3(0, 0.15, originY),
            new THREE.Vector3(originX, 0.15, originY),
            `${originX.toFixed(1)}m`,
            0xFF0000
        );
        
        // 그리드 가로 길이 화살표 - 그리드 상단에 표시
        this.createArrow(
            new THREE.Vector3(originX, 0.17, originY - 0.5),
            new THREE.Vector3(originX + width, 0.17, originY - 0.5),
            `${width.toFixed(1)}m`,
            0xFFAA00
        );
        
        // 그리드 세로 길이 화살표 - 그리드 왼쪽에 표시
        this.createArrow(
            new THREE.Vector3(originX - 0.5, 0.17, originY),
            new THREE.Vector3(originX - 0.5, 0.17, originY + depth),
            `${depth.toFixed(1)}m`,
            0xFFAA00,
            true
        );
    }
    
    // 화살표 생성 헬퍼 함수
    createArrow(start, end, label, color, isVertical = false) {
        // 화살표 방향 계산
        const direction = new THREE.Vector3().subVectors(end, start).normalize();
        const length = start.distanceTo(end);
        
        // 화살표 헤드 크기
        const headLength = length * 0.05;
        const headWidth = headLength * 0.5;
        
        // 화살표 지오메트리 생성
        const arrowHelper = new THREE.ArrowHelper(
            direction,
            start,
            length,
            color,
            headLength,
            headWidth
        );
        
        // 장면에 추가
        this.sceneManager.addToGroup(this.groupName, arrowHelper);
        
        // 스프라이트로 라벨 생성 (카메라를 향하는 평면)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;
        
        // 배경 그리기
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 테두리 그리기
        ctx.strokeStyle = '#' + color.toString(16).padStart(6, '0');
        ctx.lineWidth = 8;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
        
        // 텍스트 그리기
        ctx.font = 'bold 60px Arial';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, canvas.width/2, canvas.height/2);
        
        const spriteMap = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: spriteMap,
            transparent: true
        });
        
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(1.5, 0.75, 1);
        
        // 위치 계산 - 화살표 중앙에서 약간 떨어진 위치
        const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        sprite.position.copy(midPoint);
        
        // 수직 또는 수평 화살표에 따라 스프라이트 위치 조정
        if (isVertical) {
            sprite.position.x -= 0.75; // 왼쪽으로 이동
        } else {
            sprite.position.z -= 0.75; // 위쪽으로 이동
        }
        
        // 툴팁 속성 추가
        sprite.userData = {
            type: 'tooltip',
            value: label
        };
        
        // 장면에 추가
        this.sceneManager.addToGroup(this.groupName, sprite);
    }
    
    // 클릭한 노드의 좌표 가져오기
    getNodeAtPoint(intersection) {
        if (!intersection || !intersection.object || !intersection.object.userData || 
            intersection.object.userData.type !== 'agvNode') {
            return null;
        }
        
        const userData = intersection.object.userData;
        return {
            gridX: userData.gridX,
            gridY: userData.gridY
        };
    }
    
    // AGV 그리드 치수 가져오기
    getDimensions() {
        return this.dimensions;
    }
    
    // 설정 가져오기
    getConfig() {
        return this.config;
    }
    
    // 그리드 표시 여부 설정 - 이제 사용하지 않음(직접 config 변경 후 createAGVGrid 호출)
    setGridVisible(visible) {
        this.config.gridVisible = visible;
        this.createAGVGrid();
    }
    
    // 경고 메시지 표시
    showWarning(message) {
        const messageElement = document.getElementById('messages');
        messageElement.textContent = message;
        messageElement.style.display = 'block';
        
        // 3초 후 메시지 숨기기
        setTimeout(() => {
            messageElement.style.display = 'none';
        }, 3000);
    }
}