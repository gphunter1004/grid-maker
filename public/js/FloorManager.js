import * as THREE from 'three';

export class FloorManager {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.config = {
            scale: 0.05,         // m/px
            width: 20,           // 바닥면 가로 크기 (m)
            depth: 15,           // 바닥면 세로 크기 (m)
            cellWidth: 1,        // 가로 셀 크기 (m)
            cellHeight: 1,       // 세로 셀 크기 (m)
            gridVisible: true,   // 그리드 표시 여부 (기본값 true - 사용함)
            blueprintMode: false // 도면 모드 여부
        };
        
        this.dimensions = {
            width: this.config.width,  // 실제 가로 길이(m)
            depth: this.config.depth   // 실제 세로 길이(m)
        };
        
        // 바닥면 그룹 이름
        this.groupName = 'floor';
    }
    
    // 바닥면 생성
    createFloor(config = null) {
        // 설정 업데이트
        if (config) {
            this.updateConfig(config);
        }
        
        // 기존 바닥면 삭제
        this.sceneManager.clearGroup(this.groupName);
        
        // 전체 크기 설정 (직접 입력받은 값으로)
        this.dimensions.width = this.config.width;
        this.dimensions.depth = this.config.depth;
        
        // 바닥면 생성 (전체 크기 기준)
        this.createFloorPlane();
        
        // 그리드 생성 (바닥면 위에 별도로) - 그리드 표시 설정에 따라
        if (this.config.gridVisible) {
            this.createFloorGrid();
        }
        
        // 도면 모드일 때만 치수 표시 화살표 생성 - 도면 모드 설정에 따라
        if (this.config.blueprintMode) {
            this.createDimensionArrows();
        }
        
        return this.dimensions;
    }
    
    // 설정 업데이트
    updateConfig(config) {
        Object.assign(this.config, config);
    }
    
    // 바닥면 플레인 생성
    createFloorPlane() {
        const width = this.dimensions.width;
        const depth = this.dimensions.depth;
        
        // 바닥면 지오메트리 및 머티리얼
        const planeGeometry = new THREE.PlaneGeometry(width, depth);
        const planeMaterial = new THREE.MeshStandardMaterial({
            color: 0xE0E0E0, // 더 밝은 색상으로 변경
            side: THREE.DoubleSide,
            roughness: 0.8
        });
        
        // 바닥면 메쉬 생성 - XZ 평면에 생성 (Y축이 위쪽)
        const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
        planeMesh.rotation.x = -Math.PI / 2; // x축으로 -90도 회전 (바닥이 되도록)
        planeMesh.position.set(width / 2, 0, depth / 2); // 위치 조정(왼쪽 상단이 0,0이 되도록)
        planeMesh.receiveShadow = true;
        planeMesh.userData.type = 'floor';
        
        // 왼쪽 상단에 원점 표시
        const originMarker = this.createOriginMarker();
        originMarker.position.set(0, 0.01, 0); // 바닥보다 살짝 위에 배치
        
        // 장면에 추가
        this.sceneManager.addToGroup(this.groupName, planeMesh);
        this.sceneManager.addToGroup(this.groupName, originMarker);
    }
    
    // 원점 마커 생성
    createOriginMarker() {
        const markerGroup = new THREE.Group();
        
        // 원점에 작은 구체 생성
        const sphereGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        markerGroup.add(sphere);
        
        // X축 방향 화살표 (빨간색)
        const xArrowGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0.5, 0, 0)
        ]);
        const xArrowMaterial = new THREE.LineBasicMaterial({ color: 0xFF0000 });
        const xArrow = new THREE.Line(xArrowGeometry, xArrowMaterial);
        markerGroup.add(xArrow);
        
        // Z축 방향 화살표 (파란색)
        const zArrowGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, 0.5)
        ]);
        const zArrowMaterial = new THREE.LineBasicMaterial({ color: 0x0000FF });
        const zArrow = new THREE.Line(zArrowGeometry, zArrowMaterial);
        markerGroup.add(zArrow);
        
        // Y축 방향 화살표 (녹색)
        const yArrowGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0.5, 0)
        ]);
        const yArrowMaterial = new THREE.LineBasicMaterial({ color: 0x00FF00 });
        const yArrow = new THREE.Line(yArrowGeometry, yArrowMaterial);
        markerGroup.add(yArrow);
        
        // 원점 라벨은 제거함
        
        return markerGroup;
    }
    
    // 바닥면 그리드 생성
    createFloorGrid() {
        const width = this.dimensions.width;
        const depth = this.dimensions.depth;
        const cellWidth = this.config.cellWidth;
        const cellHeight = this.config.cellHeight;
        
        // 그리드 라인 생성
        const gridHelper = new THREE.Group();
        
        // 가로 라인 수량 계산 (전체 크기를 셀 크기로 나누어 구함)
        const horizontalLines = Math.ceil(depth / cellHeight);
        
        // 가로 라인 (Z축 방향)
        for (let i = 0; i <= horizontalLines; i++) {
            const y = i * cellHeight;
            
            // 바닥 경계를 넘어가면 중단
            if (y > depth) continue;
            
            const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0.005, y),
                new THREE.Vector3(width, 0.005, y)
            ]);
            const lineMaterial = new THREE.LineBasicMaterial({ 
                color: i % 5 === 0 ? 0x444444 : 0x888888,
                linewidth: i % 5 === 0 ? 2 : 1
            });
            const line = new THREE.Line(lineGeometry, lineMaterial);
            gridHelper.add(line);
        }
        
        // 세로 라인 수량 계산 (전체 크기를 셀 크기로 나누어 구함)
        const verticalLines = Math.ceil(width / cellWidth);
        
        // 세로 라인 (X축 방향)
        for (let i = 0; i <= verticalLines; i++) {
            const x = i * cellWidth;
            
            // 바닥 경계를 넘어가면 중단
            if (x > width) continue;
            
            const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(x, 0.005, 0),
                new THREE.Vector3(x, 0.005, depth)
            ]);
            const lineMaterial = new THREE.LineBasicMaterial({ 
                color: i % 5 === 0 ? 0x444444 : 0x888888,
                linewidth: i % 5 === 0 ? 2 : 1
            });
            const line = new THREE.Line(lineGeometry, lineMaterial);
            gridHelper.add(line);
        }
        
        // 장면에 추가
        this.sceneManager.addToGroup(this.groupName, gridHelper);
    }
    
    // 그리드 좌표 텍스트 추가
    addGridCoordinateText(x, z, xIdx, zIdx, parentGroup) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 32;
        
        // 배경 그리기
        context.fillStyle = 'rgba(255, 255, 255, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // 텍스트 그리기
        context.font = 'bold 16px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = '#000000';
        context.fillText(`(${xIdx},${zIdx})`, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        const labelGeometry = new THREE.PlaneGeometry(0.5, 0.25);
        const labelMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        const label = new THREE.Mesh(labelGeometry, labelMaterial);
        label.position.set(x, 0.01, z);
        label.rotation.x = -Math.PI / 2; // 텍스트가 위를 향하도록 회전
        
        parentGroup.add(label);
        
        // 툴팁 속성 추가
        label.userData = {
            type: 'tooltip',
            value: `셀 좌표: (${xIdx}, ${zIdx})`
        };
    }
    
    // 치수 표시 화살표 생성
    createDimensionArrows() {
        const width = this.dimensions.width;
        const depth = this.dimensions.depth;
        
        // 상단 화살표 (가로 방향 - 전체 길이) - 바닥면 위쪽에 표시
        this.createArrow(
            new THREE.Vector3(0, 0.1, -0.5),
            new THREE.Vector3(width, 0.1, -0.5),
            `${width.toFixed(1)}m`,
            0x0000FF
        );
        
        // 좌측 화살표 (세로 방향 - 전체 길이) - 바닥면 왼쪽에 표시
        this.createArrow(
            new THREE.Vector3(-0.5, 0.1, 0),
            new THREE.Vector3(-0.5, 0.1, depth),
            `${depth.toFixed(1)}m`,
            0x00FF00,
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
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
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
        sprite.scale.set(2, 1, 1); // 스프라이트 크기 증가
        
        // 위치 계산 - 화살표 중앙에서 약간 떨어진 위치
        const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        sprite.position.copy(midPoint);
        
        // 수직 또는 수평 화살표에 따라 스프라이트 위치 조정
        if (isVertical) {
            sprite.position.x -= 1.2; // 왼쪽으로 더 멀리 이동
        } else {
            sprite.position.z -= 1.2; // 위쪽으로 더 멀리 이동
        }
        
        // 높이 조정 - 바닥보다 더 높게
        sprite.position.y = 0.2; // 기존보다 더 높게 설정
        
        // 툴팁 속성 추가
        sprite.userData = {
            type: 'tooltip',
            value: label
        };
        
        // 장면에 추가
        this.sceneManager.addToGroup(this.groupName, sprite);
    }
    
    // 클릭한 지점의 좌표 가져오기
    getCoordinateAtPoint(intersection) {
        if (!intersection || !intersection.point) {
            console.error("인식할 수 없는 교차점:", intersection);
            return null;
        }
        
        // 바닥면 좌표 계산
        const x = intersection.point.x;
        const z = intersection.point.z;
        
        return {
            x: x,
            z: z,
            xMeters: x.toFixed(2),
            zMeters: z.toFixed(2),
            xPixels: Math.round(x / this.config.scale),
            zPixels: Math.round(z / this.config.scale)
        };
    }
    
    // 바닥면 치수 가져오기
    getDimensions() {
        return this.dimensions;
    }
    
    // 설정 가져오기
    getConfig() {
        return this.config;
    }
    
    // 그리드 표시 여부 설정
    setGridVisible(visible) {
        this.config.gridVisible = visible;
        this.createFloor();
    }
}