import * as THREE from 'three';

export class UIManager {
    constructor(floorManager, agvGridManager, raycaster, mouse, camera, scene) {
        this.floorManager = floorManager;
        this.agvGridManager = agvGridManager;
        this.raycaster = raycaster;
        this.mouse = mouse;
        this.camera = camera;
        this.scene = scene; // Scene 참조 추가
        
        // UI 요소 참조
        this.coordinateInfo = document.getElementById('coordinate-info');
        this.messagesElement = document.getElementById('messages');
        this.tooltipElement = document.getElementById('tooltip');
        
        // 좌표 패널 요소 참조
        this.clickPositionWorldElement = document.getElementById('click-position-world');
        this.clickPositionGridElement = document.getElementById('click-position-grid');
        this.clickPositionPixelElement = document.getElementById('click-position-pixel');
        
        // 도면 모드 체크박스 참조
        this.blueprintModeInput = document.getElementById('blueprint-mode');
        
        // DOM 요소 존재 확인
        if (!this.clickPositionWorldElement || !this.clickPositionGridElement || !this.clickPositionPixelElement) {
            console.error("좌표 패널 요소를 찾을 수 없습니다! DOM이 완전히 로드되었는지 확인하세요.");
        }
        
        // 마우스 위치 저장
        this.mouseX = 0;
        this.mouseY = 0;
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        // 바닥면 업데이트 버튼 클릭 이벤트
        this.floorUpdateButton = document.getElementById('floor-update');
        if (this.floorUpdateButton) {
            this.floorUpdateButton.addEventListener('click', () => {
                this.updateFloor();
            });
        }
        
        // 바닥면 그리드 표시 여부 변경 이벤트
        this.floorGridVisibleInput = document.getElementById('floor-grid-visible');
        if (this.floorGridVisibleInput) {
            this.floorGridVisibleInput.addEventListener('change', () => {
                // 그리드 표시 여부만 변경 (도면 모드는 변경하지 않음)
                this.floorManager.config.gridVisible = this.floorGridVisibleInput.checked;
                this.floorManager.createFloor();
            });
        }
        
        // 도면 모드 변경 이벤트
        if (this.blueprintModeInput) {
            this.blueprintModeInput.addEventListener('change', () => {
                this.toggleBlueprintMode(this.blueprintModeInput.checked);
            });
        }
        
        // AGV 그리드 업데이트 버튼 클릭 이벤트
        this.agvUpdateButton = document.getElementById('agv-update');
        if (this.agvUpdateButton) {
            this.agvUpdateButton.addEventListener('click', () => {
                this.updateAGVGrid();
            });
        }
        
        // AGV 그리드 표시 여부 변경 이벤트
        this.agvGridVisibleInput = document.getElementById('agv-grid-visible');
        if (this.agvGridVisibleInput) {
            this.agvGridVisibleInput.addEventListener('change', () => {
                // 그리드 표시 여부만 변경 (도면 모드는 변경하지 않음)
                this.agvGridManager.config.gridVisible = this.agvGridVisibleInput.checked;
                this.agvGridManager.createAGVGrid();
            });
        }
    }
    
    // 도면 모드 토글
    toggleBlueprintMode(enabled) {
        console.log("도면 모드 변경:", enabled);
        
        // 바닥면 설정에 도면 모드 상태 저장
        this.floorManager.config.blueprintMode = enabled;
        
        // body 클래스 변경으로 스타일 전환
        if (enabled) {
            document.body.classList.add('blueprint-mode');
        } else {
            document.body.classList.remove('blueprint-mode');
        }
        
        // 바닥면 도면 모드 업데이트 (그리드 표시 상태는 변경하지 않음)
        this.floorManager.createFloor();
        
        // AGV 그리드 도면 업데이트 (그리드 표시 상태는 변경하지 않음)
        if (this.agvGridManager.config.gridVisible) {
            this.agvGridManager.createAGVGrid();
        }
        
        // 도면 모드 상태가 변경되었을 때 현재 선택된 모델의 치수 화살표 업데이트
        const modelManager = this.floorManager.sceneManager.scene.userData.modelManager;
        if (modelManager) {
            const selectedModelId = modelManager.getSelectedModelId();
            if (selectedModelId !== null) {
                if (enabled) {
                    // 도면 모드 활성화 시 치수 화살표 표시
                    modelManager.showModelVertexDistances(selectedModelId);
                } else {
                    // 도면 모드 비활성화 시 치수 화살표 제거
                    modelManager.hideModelVertexDistances();
                }
            }
        }
        
        // 도면 모드일 때는 상세한 그리드 정보를 표시
        if (enabled) {
            this.showMessage("도면 모드가 활성화되었습니다. 치수 정보가 표시됩니다.");
        } else {
            this.showMessage("도면 모드가 비활성화되었습니다.");
        }
    }
    
    // 바닥면 업데이트
    updateFloor() {
        this.floorWidthInput = document.getElementById('floor-width');
        this.floorDepthInput = document.getElementById('floor-depth');
        this.floorCellWidthInput = document.getElementById('floor-cell-width');
        this.floorCellHeightInput = document.getElementById('floor-cell-height');
        this.floorScaleInput = document.getElementById('floor-scale');
        this.floorGridVisibleInput = document.getElementById('floor-grid-visible');
        this.blueprintModeInput = document.getElementById('blueprint-mode');
        
        if (!this.floorWidthInput || !this.floorDepthInput || !this.floorCellWidthInput || !this.floorCellHeightInput) {
            console.error("바닥면 설정 입력 요소를 찾을 수 없습니다!");
            return;
        }
        
        const floorConfig = {
            scale: parseFloat(this.floorScaleInput.value),
            width: parseFloat(this.floorWidthInput.value),
            depth: parseFloat(this.floorDepthInput.value),
            cellWidth: parseFloat(this.floorCellWidthInput.value),
            cellHeight: parseFloat(this.floorCellHeightInput.value),
            gridVisible: this.floorGridVisibleInput.checked,
            blueprintMode: this.blueprintModeInput.checked
        };
        
        console.log("바닥면 설정 업데이트:", floorConfig);
        
        // 바닥면 생성
        this.floorManager.createFloor(floorConfig);
        
        // 카메라 위치 업데이트 - main.js의 updateCameraPositionBasedOnFloor 호출
        if (window.app) {
            window.app.updateCameraPositionBasedOnFloor();
        }
        
        // AGV 그리드가 있으면 재생성
        const agvGridConfig = this.agvGridManager.getConfig();
        if (agvGridConfig.gridVisible) {
            this.agvGridManager.createAGVGrid();
        }
    }
    
    // AGV 그리드 업데이트
    updateAGVGrid() {
        this.agvScaleInput = document.getElementById('agv-scale');
        this.agvCellWidthInput = document.getElementById('agv-cell-width');
        this.agvCellHeightInput = document.getElementById('agv-cell-height');
        this.agvWidthCellsInput = document.getElementById('agv-width-cells');
        this.agvHeightCellsInput = document.getElementById('agv-height-cells');
        this.agvOriginXInput = document.getElementById('agv-origin-x');
        this.agvOriginYInput = document.getElementById('agv-origin-y');
        this.agvGridVisibleInput = document.getElementById('agv-grid-visible');
        
        if (!this.agvCellWidthInput || !this.agvCellHeightInput) {
            console.error("AGV 그리드 설정 입력 요소를 찾을 수 없습니다!");
            return;
        }
        
        const agvGridConfig = {
            scale: parseFloat(this.agvScaleInput.value),
            cellWidth: parseFloat(this.agvCellWidthInput.value),
            cellHeight: parseFloat(this.agvCellHeightInput.value),
            widthCells: parseInt(this.agvWidthCellsInput.value),
            heightCells: parseInt(this.agvHeightCellsInput.value),
            originX: parseFloat(this.agvOriginXInput.value),
            originY: parseFloat(this.agvOriginYInput.value),
            gridVisible: this.agvGridVisibleInput.checked
        };
        
        console.log("AGV 그리드 설정 업데이트:", agvGridConfig);
        
        // AGV 그리드 생성
        const success = this.agvGridManager.createAGVGrid(agvGridConfig);
        
        if (!success) {
            // 경고 메시지는 AGVGridManager에서 처리
        }
    }
    
    // 클릭 이벤트 처리
    handleClick(mouse) {
        // 마우스 좌표로 레이캐스팅
        this.raycaster.setFromCamera(mouse, this.camera);
        
        console.log("handleClick 실행됨, scene:", this.scene ? "있음" : "없음");
        
        // 씬이 없으면 SceneManager에서 그룹 가져오기
        let objectsToCheck = [];
        if (this.scene) {
            // 씬 전체 객체 사용
            objectsToCheck = this.scene.children;
            console.log("씬에서 직접 객체 가져옴:", objectsToCheck.length);
        } else {
            // floorManager와 agvGridManager를 통해 객체 가져오기
            const floorGroup = this.floorManager.sceneManager.getGroup('floor');
            const agvGroup = this.agvGridManager.sceneManager.getGroup('agvGrid');
            if (floorGroup) objectsToCheck.push(floorGroup);
            if (agvGroup) objectsToCheck.push(agvGroup);
            console.log("매니저에서 그룹 가져옴:", objectsToCheck.length);
        }
        
        // 모든 객체와의 교차점 계산
        const intersects = this.raycaster.intersectObjects(objectsToCheck, true);
        
        console.log("교차점 개수:", intersects.length);
        
        if (intersects.length > 0) {
            const intersection = intersects[0];
            console.log("교차 객체:", intersection.object);
            
            // 바닥면과 교차점 검사 (부모 객체 확인)
            let foundFloorIntersection = false;
            
            // 바닥면 메쉬인지 확인 (바닥면 객체는 PlaneGeometry를 사용함)
            if (intersection.object.geometry instanceof THREE.PlaneGeometry) {
                console.log("바닥면 형태(Plane)의 객체 감지됨");
                this.handleFloorClick(intersection);
                foundFloorIntersection = true;
            }
            // userData 확인
            else if (intersection.object.userData) {
                console.log("교차 객체 userData:", intersection.object.userData);
                
                // 바닥면 클릭 처리
                if (intersection.object.userData.type === 'floor') {
                    this.handleFloorClick(intersection);
                    foundFloorIntersection = true;
                }
                // AGV 노드 클릭 처리
                else if (intersection.object.userData.type === 'agvNode') {
                    this.handleAgvNodeClick(intersection);
                    foundFloorIntersection = true;
                }
                else if (intersection.object.userData.type === 'tooltip') {
                    console.log("툴팁 객체 클릭됨");
                    foundFloorIntersection = true;
                }
                else {
                    console.log("인식할 수 없는 객체 타입:", intersection.object.userData.type);
                }
            } 
            
            // 여전히 교차점이 찾아지지 않았으면 바닥면까지 레이 확장
            if (!foundFloorIntersection) {
                console.log("바닥면과의 교차점 계산 시도");
                // y=0 평면(바닥면)과의 교차점 계산
                const ray = this.raycaster.ray;
                if (ray.direction.y < 0) { // 아래쪽을 향하는 레이만 처리
                    // y=0 평면과의 교차점 계산
                    const t = -ray.origin.y / ray.direction.y;
                    const point = new THREE.Vector3();
                    point.copy(ray.origin).addScaledVector(ray.direction, t);
                    
                    console.log("바닥면과 교차점:", point);
                    
                    // 바닥면 경계 내에 있는지 확인
                    const floorDimensions = this.floorManager.getDimensions();
                    if (point.x >= 0 && point.x <= floorDimensions.width &&
                        point.z >= 0 && point.z <= floorDimensions.depth) {
                        
                        // 가상 교차점 생성
                        const virtualIntersection = {
                            point: point
                        };
                        
                        this.handleFloorClick(virtualIntersection);
                    }
                }
            }
        } else {
            console.log("클릭했지만 교차점이 없음");
        }
    }
    
    // 바닥면 클릭 처리
    handleFloorClick(intersection) {
        console.log("바닥면 클릭 처리");
        const coordinate = this.floorManager.getCoordinateAtPoint(intersection);
        if (coordinate) {
            this.showCoordinateInfo(`바닥면 좌표: ${coordinate.xMeters}m, ${coordinate.zMeters}m (${coordinate.xPixels}px, ${coordinate.zPixels}px)`);
            
            // 패널에 좌표 정보 표시
            this.updatePositionPanel(
                `${coordinate.xMeters}m, ${coordinate.zMeters}m`,
                this.getGridCoordinatesFromWorld(coordinate.x, coordinate.z),
                `${coordinate.xPixels}px, ${coordinate.zPixels}px`
            );
        }
    }
    
    // AGV 노드 클릭 처리
    handleAgvNodeClick(intersection) {
        console.log("AGV 노드 클릭 처리");
        const node = this.agvGridManager.getNodeAtPoint(intersection);
        if (node) {
            this.showCoordinateInfo(`AGV 그리드 노드: (${node.gridX}, ${node.gridY})`);
            
            // 노드의 월드 좌표 계산
            const worldX = this.agvGridManager.config.originX + node.gridX * this.agvGridManager.config.cellWidth;
            const worldZ = this.agvGridManager.config.originY + node.gridY * this.agvGridManager.config.cellHeight;
            
            // 패널에 좌표 정보 표시
            this.updatePositionPanel(
                `${worldX.toFixed(2)}m, ${worldZ.toFixed(2)}m`,
                `${node.gridX}, ${node.gridY} (AGV 그리드)`,
                `${Math.round(worldX / this.floorManager.config.scale)}px, ${Math.round(worldZ / this.floorManager.config.scale)}px`
            );
        }
    }
    
    // 마우스 위치 업데이트
    updateMousePosition(mouse) {
        // 마우스 실제 화면 좌표 저장
        this.mouseX = (mouse.x + 1) / 2 * window.innerWidth;
        this.mouseY = (-mouse.y + 1) / 2 * window.innerHeight;
        
        // 마우스 좌표로 레이캐스팅
        this.raycaster.setFromCamera(mouse, this.camera);
        
        // 씬의 모든 객체와의 교차점 계산
        let objectsToCheck = [];
        if (this.scene) {
            objectsToCheck = this.scene.children;
        } else {
            const floorGroup = this.floorManager.sceneManager.getGroup('floor');
            const agvGroup = this.agvGridManager.sceneManager.getGroup('agvGrid');
            if (floorGroup) objectsToCheck.push(floorGroup);
            if (agvGroup) objectsToCheck.push(agvGroup);
        }
        
        const intersects = this.raycaster.intersectObjects(objectsToCheck, true);
        
        if (intersects.length > 0) {
            const intersection = intersects[0];
            
            // 바닥면 위에 있는 경우
            if (intersection.object.userData && intersection.object.userData.type === 'floor') {
                const coordinate = this.floorManager.getCoordinateAtPoint(intersection);
                if (coordinate) {
                    this.updateCoordinateInfo(`바닥면 좌표: ${coordinate.xMeters}m, ${coordinate.zMeters}m (${coordinate.xPixels}px, ${coordinate.zPixels}px)`);
                }
            }
            
            // AGV 노드 위에 있는 경우
            else if (intersection.object.userData && intersection.object.userData.type === 'agvNode') {
                const node = this.agvGridManager.getNodeAtPoint(intersection);
                if (node) {
                    this.updateCoordinateInfo(`AGV 그리드 노드: (${node.gridX}, ${node.gridY})`);
                }
            }
            
            // 툴팁 객체 위에 있는 경우
            else if (intersection.object.userData && intersection.object.userData.type === 'tooltip') {
                this.showTooltip(intersection.object.userData.value);
            } else {
                this.hideTooltip();
            }
        } else {
            this.hideTooltip();
        }
    }
    
    // 바닥 좌표를 그리드 좌표로 변환
    getGridCoordinatesFromWorld(worldX, worldZ) {
        const floorConfig = this.floorManager.getConfig();
        
        // 바닥 그리드 좌표 계산
        const gridX = Math.floor(worldX / floorConfig.cellWidth);
        const gridZ = Math.floor(worldZ / floorConfig.cellHeight);
        
        // AGV 그리드 내부인지 확인
        const agvConfig = this.agvGridManager.getConfig();
        const agvDimensions = this.agvGridManager.getDimensions();
        
        if (worldX >= agvConfig.originX && worldX <= (agvConfig.originX + agvDimensions.width) &&
            worldZ >= agvConfig.originY && worldZ <= (agvConfig.originY + agvDimensions.depth)) {
            // AGV 그리드 내부일 경우
            const agvGridX = Math.floor((worldX - agvConfig.originX) / agvConfig.cellWidth);
            const agvGridZ = Math.floor((worldZ - agvConfig.originY) / agvConfig.cellHeight);
            
            return `${gridX}, ${gridZ} (바닥) / ${agvGridX}, ${agvGridZ} (AGV)`;
        }
        
        return `${gridX}, ${gridZ} (바닥)`;
    }
    
    // 좌표 정보 표시 (클릭 시)
    showCoordinateInfo(text) {
        if (this.coordinateInfo) {
            this.coordinateInfo.textContent = text;
            this.coordinateInfo.style.backgroundColor = 'rgba(0, 0, 255, 0.7)';
            
            // 3초 후 원래 색상으로 복귀
            setTimeout(() => {
                this.coordinateInfo.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            }, 3000);
        }
    }
    
    // 좌표 정보 업데이트 (마우스 움직임 시)
    updateCoordinateInfo(text) {
        if (this.coordinateInfo) {
            this.coordinateInfo.textContent = text;
        }
    }
    
    // 패널에 좌표 정보 업데이트
    updatePositionPanel(worldCoords, gridCoords, pixelCoords) {
        console.log("좌표 패널 업데이트:", worldCoords, gridCoords, pixelCoords);
        
        if (!this.clickPositionWorldElement || !this.clickPositionGridElement || !this.clickPositionPixelElement) {
            console.error("좌표 패널 요소를 찾을 수 없습니다!");
            return;
        }
        
        this.clickPositionWorldElement.textContent = `월드 좌표: ${worldCoords}`;
        this.clickPositionGridElement.textContent = `그리드 좌표: ${gridCoords}`;
        this.clickPositionPixelElement.textContent = `픽셀 좌표: ${pixelCoords}`;
    }
    
    // 툴팁 표시
    showTooltip(text) {
        if (this.tooltipElement) {
            this.tooltipElement.textContent = text;
            this.tooltipElement.style.display = 'block';
            this.tooltipElement.style.left = (this.mouseX + 10) + 'px';
            this.tooltipElement.style.top = (this.mouseY + 10) + 'px';
        }
    }
    
    // 툴팁 숨기기
    hideTooltip() {
        if (this.tooltipElement) {
            this.tooltipElement.style.display = 'none';
        }
    }
    
    // 경고 메시지 표시
    showWarning(message) {
        if (this.messagesElement) {
            this.messagesElement.textContent = message;
            this.messagesElement.style.display = 'block';
            this.messagesElement.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
            
            // 3초 후 메시지 숨기기
            setTimeout(() => {
                this.messagesElement.style.display = 'none';
            }, 3000);
        }
    }
    
    // 일반 메시지 표시
    showMessage(message) {
        if (this.messagesElement) {
            this.messagesElement.textContent = message;
            this.messagesElement.style.display = 'block';
            this.messagesElement.style.backgroundColor = 'rgba(0, 128, 0, 0.7)';
            
            // 3초 후 메시지 숨기기
            setTimeout(() => {
                this.messagesElement.style.display = 'none';
            }, 3000);
        }
    }
}