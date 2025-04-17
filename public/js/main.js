import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SceneManager } from './SceneManager.js';
import { FloorManager } from './FloorManager.js';
import { AGVGridManager } from './AGVGridManager.js';
import { UIManager } from './UIManager.js';
import { CollisionManager } from './CollisionManager.js';
import { ModelManager } from './ModelManager.js';
import { ModelUIManager } from './ModelUIManager.js';

class App {
    constructor() {
        // 전역 참조 설정 - UI에서 사용
        window.app = this;
        
        // 입력 상태 관리
        this.inputState = {
            isMouseDown: false,
            isDragging: false,
            isControlPressed: false,
            isShiftPressed: false, // 시프트 키 상태 추가
            keyboardMoveEnabled: true
        };
        
        this.initScene();
        this.initManagers();
        this.initEventListeners();
        
        // 애니메이션 타이밍을 위한 시계 객체 생성
        this.clock = new THREE.Clock();
        
        this.animate();
    }

    initScene() {
        // Create the scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xF5F5F5); // 약간 더 밝은 배경색

        // Create the renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        // Create the camera - 직교 카메라로 변경
        const floorWidth = 20; // 초기 바닥 가로 길이(m)
        const floorHeight = 15; // 초기 바닥 세로 길이(m)
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = Math.max(floorWidth, floorHeight) * 1.2; // 바닥보다 약간 더 넓게 보이도록
        
        this.camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2, // left
            frustumSize * aspect / 2,  // right
            frustumSize / 2,           // top
            frustumSize / -2,          // bottom
            0.1,                        // near
            1000                        // far
        );
        
        // 카메라 위치 설정 - 수직으로 내려다보는 시점
        this.camera.position.set(floorWidth / 2, 20, floorHeight / 2);
        this.camera.lookAt(floorWidth / 2, 0, floorHeight / 2);
        this.camera.up.set(0, 0, -1); // z축이 위쪽 방향이 아니라 아래쪽 방향으로 설정

        // 2D 카메라 컨트롤 설정 - 패닝만 가능하도록
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableRotate = false; // 회전 비활성화
        this.controls.enableZoom = true;    // 줌은 활성화
        this.controls.screenSpacePanning = true; // 스크린 공간 패닝 활성화
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.25;

        // Setup lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(0, 20, 0);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // Raycaster for object interaction
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    initManagers() {
        // Initialize scene manager
        this.sceneManager = new SceneManager(this.scene);
        
        // Initialize floor manager
        this.floorManager = new FloorManager(this.sceneManager);
        
        // Initialize AGV grid manager
        this.agvGridManager = new AGVGridManager(this.sceneManager, this.floorManager);
        
        // Initialize collision manager
        this.collisionManager = new CollisionManager();
        this.collisionManager.setCollisionCallback(this.handleCollisionChange.bind(this));
        
        // Initialize model manager
        this.modelManager = new ModelManager(this.scene, this.collisionManager);
        
        // 그리드 경계 설정
        this.setGridBoundaryToModels();
        
        // Initialize model UI manager
        this.modelUIManager = new ModelUIManager(this.modelManager);
        
        // Initialize UI manager
        this.uiManager = new UIManager(
            this.floorManager, 
            this.agvGridManager, 
            this.raycaster, 
            this.mouse, 
            this.camera,
            this.scene
        );

        // Create initial floor
        this.floorManager.createFloor();
        
        // 바닥 생성 후 카메라 위치 조정
        this.updateCameraPositionBasedOnFloor();
        
        // 충돌 발생 시에도 선택된 객체는 이동 가능하도록 설정
        this.modelManager.setMoveConstraints({
            allowCollisionMove: true,
            moveSpeed: 0.2,
            gridSnap: false,
            gridSize: 0.5
        });
    }
    
    // 바닥 크기에 따라 카메라 위치 조정
    updateCameraPositionBasedOnFloor() {
        const floorDimensions = this.floorManager.getDimensions();
        
        // 카메라 위치 - 바닥 중앙 위에 위치
        this.camera.position.set(
            floorDimensions.width / 2, // 바닥 가로 중앙
            20, // 높이는 고정
            floorDimensions.depth / 2 // 바닥 세로 중앙
        );
        
        // 카메라가 바닥 중앙을 바라보도록 설정 (y축 아래 방향)
        this.camera.lookAt(
            floorDimensions.width / 2,
            0,
            floorDimensions.depth / 2
        );
        
        // 직교 카메라 frustum 크기 조정
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = Math.max(floorDimensions.width, floorDimensions.depth) * 1.2;
        
        this.camera.left = frustumSize * aspect / -2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = frustumSize / -2;
        this.camera.updateProjectionMatrix();
        
        // 컨트롤 센터를 바닥 중앙으로 설정
        this.controls.target.set(floorDimensions.width / 2, 0, floorDimensions.depth / 2);
        this.controls.update();
        
        // 모델 관리자에 그리드 경계 업데이트
        this.setGridBoundaryToModels();
    }
    
    // 모델 관리자에 그리드 경계 설정
    setGridBoundaryToModels() {
        if (this.modelManager) {
            const floorDimensions = this.floorManager.getDimensions();
            const gridBoundary = new THREE.Box3(
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(floorDimensions.width, 0, floorDimensions.depth)
            );
            this.modelManager.setGridBoundary(gridBoundary);
        }
    }
    
    // 충돌 상태 변경 처리
    handleCollisionChange(hasCollision) {
        const collisionElement = document.getElementById('collision-message');
        if (collisionElement) {
            collisionElement.style.display = hasCollision ? 'block' : 'none';
        }
    }

    initEventListeners() {
        // 기본 이벤트 리스너
        document.addEventListener('click', (event) => this.onClick(event), false);
        document.addEventListener('mousemove', (event) => this.onMouseMove(event), false);
        
        // 마우스 드래그 및 선택 관련 이벤트
        document.addEventListener('mousedown', (event) => this.onMouseDown(event), false);
        document.addEventListener('mouseup', (event) => this.onMouseUp(event), false);
        
        // 키보드 이벤트
        document.addEventListener('keydown', (event) => this.onKeyDown(event), false);
        document.addEventListener('keyup', (event) => this.onKeyUp(event), false);
        
        // 3D 모델 관점 버튼
        const view3DButton = document.getElementById('view-3d-mode');
        if (view3DButton) {
            view3DButton.addEventListener('click', () => this.toggle3DView());
        }
        
        // 2D 도면 관점 버튼
        const view2DButton = document.getElementById('view-2d-mode');
        if (view2DButton) {
            view2DButton.addEventListener('click', () => this.toggle2DView());
        }
        
        // 그리드 스냅 토글 체크박스
        const gridSnapToggle = document.getElementById('grid-snap-toggle');
        if (gridSnapToggle) {
            gridSnapToggle.addEventListener('change', (e) => {
                this.modelManager.toggleGridSnap(e.target.checked);
                this.uiManager.showMessage(`그리드 스냅: ${e.target.checked ? '활성화됨' : '비활성화됨'}`);
            });
        }
    }
    
    // 마우스 다운 핸들러 - 드래그 시작
    onMouseDown(event) {
        // 마우스 왼쪽 버튼인 경우만 처리
        if (event.button !== 0) return;
        
        this.inputState.isMouseDown = true;
        
        // 마우스 위치 업데이트
        this.updateMouseCoordinates(event);
        
        // 선택된 모델이 있는 경우
        if (this.modelManager.getSelectedModelId() !== null) {
            // 드래그 시작
            if (this.modelManager.startDrag(this.raycaster, this.mouse)) {
                this.inputState.isDragging = true;
                
                // OrbitControls 비활성화
                this.controls.enabled = false;
                
                // 이벤트 전파 중단
                event.preventDefault();
                event.stopPropagation();
            }
        }
    }
    
    // 마우스 이동 핸들러 - 드래그 업데이트
    onMouseMove(event) {
        // 마우스 좌표 업데이트
        this.updateMouseCoordinates(event);
        
        // UI 매니저에 마우스 위치 전달 (툴팁, 좌표 표시 등)
        this.uiManager.updateMousePosition(this.mouse);
        
        // 드래그 중인 경우 모델 이동
        if (this.inputState.isDragging && this.inputState.isMouseDown) {
            this.modelManager.updateDrag(this.raycaster, this.mouse);
            
            // 이벤트 전파 중단
            event.preventDefault();
            event.stopPropagation();
        }
    }
    
    // 마우스 업 핸들러 - 드래그 종료
    onMouseUp(event) {
        // 마우스 왼쪽 버튼인 경우만 처리
        if (event.button !== 0) return;
        
        this.inputState.isMouseDown = false;
        
        // 드래그 중이었다면 종료
        if (this.inputState.isDragging) {
            this.modelManager.endDrag();
            this.inputState.isDragging = false;
            
            // OrbitControls 다시 활성화
            this.controls.enabled = true;
            
            // 이벤트 전파 중단
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        
        // 기본 클릭 처리는 onClick에서 수행
    }
    
    // 키보드 다운 핸들러
    onKeyDown(event) {
        // 시프트 키 상태 업데이트
        if (event.key === 'Shift') {
            this.inputState.isShiftPressed = true;
        }
        
        // 컨트롤 키 상태 업데이트
        if (event.key === 'Control') {
            this.inputState.isControlPressed = true;
        }
        
        // 방향키로 모델 이동
        if (this.inputState.keyboardMoveEnabled && this.modelManager.getSelectedModelId() !== null) {
            // 기본 또는 정밀 이동 속도 설정
            const moveSpeed = this.inputState.isShiftPressed 
                ? this.floorManager.config.scale // 시프트 키가 눌리면 1픽셀 단위로 이동
                : this.modelManager.moveConstraints.moveSpeed;
            
            switch (event.key) {
                case 'ArrowLeft':
                    this.modelManager.moveSelectedModelByDelta(-moveSpeed, 0);
                    event.preventDefault();
                    break;
                case 'ArrowRight':
                    this.modelManager.moveSelectedModelByDelta(moveSpeed, 0);
                    event.preventDefault();
                    break;
                case 'ArrowUp':
                    this.modelManager.moveSelectedModelByDelta(0, -moveSpeed);
                    event.preventDefault();
                    break;
                case 'ArrowDown':
                    this.modelManager.moveSelectedModelByDelta(0, moveSpeed);
                    event.preventDefault();
                    break;
                case ' ': // 스페이스바 - 회전
                    this.modelManager.rotateModel(this.modelManager.getSelectedModelId(), 15);
                    event.preventDefault();
                    break;
                case 'Delete':
                    // 선택된 모델 삭제
                    const modelId = this.modelManager.getSelectedModelId();
                    if (modelId !== null) {
                        this.modelManager.removeModel(modelId);
                        this.uiManager.showMessage(`모델 ${modelId} 삭제됨`);
                    }
                    event.preventDefault();
                    break;
                case 'Escape':
                    // 선택 해제
                    this.modelManager.clearSelection();
                    this.uiManager.showMessage('선택 해제됨');
                    event.preventDefault();
                    break;
            }
            
            // Ctrl + 방향키: 회전
            if (this.inputState.isControlPressed) {
                switch (event.key) {
                    case 'ArrowLeft':
                        this.modelManager.rotateModel(this.modelManager.getSelectedModelId(), -15);
                        event.preventDefault();
                        break;
                    case 'ArrowRight':
                        this.modelManager.rotateModel(this.modelManager.getSelectedModelId(), 15);
                        event.preventDefault();
                        break;
                }
            }
        }
    }
    
    // 키보드 업 핸들러
    onKeyUp(event) {
        if (event.key === 'Control') {
            this.inputState.isControlPressed = false;
        }
        
        if (event.key === 'Shift') {
            this.inputState.isShiftPressed = false;
        }
    }
    
    // 마우스 좌표 업데이트 (정규화된 디바이스 좌표계)
    updateMouseCoordinates(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // 레이캐스터 업데이트
        this.raycaster.setFromCamera(this.mouse, this.camera);
    }
    
    onClick(event) {
        // 드래그 중인 경우 클릭 이벤트 무시
        if (this.inputState.isDragging) return;
        
        // 마우스 위치 업데이트
        this.updateMouseCoordinates(event);
        
        // 모델 선택 처리
        const models = this.modelManager.getAllModels();
        const selectionMeshes = models.map(model => model.selectionMesh);
        const allMeshes = [];
        
        models.forEach(model => {
            model.originalModel.traverse(node => {
                if (node.isMesh) {
                    allMeshes.push(node);
                }
            });
        });
        
        // 모든 가능한 객체를 대상으로 레이캐스트
        const targetObjects = [...selectionMeshes, ...allMeshes];
        const modelIntersects = this.raycaster.intersectObjects(targetObjects);
        
        if (modelIntersects.length > 0) {
            // 교차 객체의 모델 ID 찾기
            const hitObject = modelIntersects[0].object;
            
            // 직접 모델 ID 있는지 확인
            if (hitObject.userData && hitObject.userData.modelId !== undefined) {
                this.modelManager.selectModel(hitObject.userData.modelId);
                return;
            }
            
            // 부모에 모델 ID 있는지 확인
            let parent = hitObject.parent;
            while (parent) {
                if (parent.userData && parent.userData.modelId !== undefined) {
                    this.modelManager.selectModel(parent.userData.modelId);
                    return;
                }
                parent = parent.parent;
            }
        } else {
            // 모델 없으면 선택 해제하고 바닥 처리
            this.modelManager.clearSelection();
            
            // Let UI manager handle the click for floor
            this.uiManager.handleClick(this.mouse);
        }
    }

    // 3D 관점으로 전환
    toggle3DView() {
        // 카메라 타입 확인
        if (this.camera instanceof THREE.OrthographicCamera) {
            // 직교 카메라에서 원근 카메라로 변경
            const floorDimensions = this.floorManager.getDimensions();
            const aspect = window.innerWidth / window.innerHeight;
            
            // 원근 카메라 생성
            this.camera = new THREE.PerspectiveCamera(
                60, // FOV
                aspect,
                0.1,
                1000
            );
            
            // 카메라 위치 설정 - 비스듬히 내려다보는 시점
            this.camera.position.set(
                floorDimensions.width / 2 - 10, // 바닥 가로 중앙에서 약간 옆으로
                15, // 높이
                floorDimensions.depth / 2 + 10 // 바닥 세로 중앙에서 약간 뒤로
            );
            
            // 카메라가 바닥 중앙을 바라보도록 설정
            this.camera.lookAt(
                floorDimensions.width / 2,
                0,
                floorDimensions.depth / 2
            );
            
            // 컨트롤 업데이트
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            this.controls.target.set(floorDimensions.width / 2, 0, floorDimensions.depth / 2);
            this.controls.enableRotate = true; // 회전 활성화
            this.controls.enableZoom = true;
            this.controls.enablePan = true;
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.25;
            
            // 최소 높이 제한 (바닥 아래로 내려가지 않도록)
            this.controls.minPolarAngle = 0; // 맨 위에서 볼 수 있음
            this.controls.maxPolarAngle = Math.PI / 2 - 0.1; // 약간 위에서 보도록 제한
            
            // UI 메시지 표시
            this.uiManager.showMessage('3D 관점으로 전환되었습니다');
        }
    }
    
    // 2D 관점으로 전환
    toggle2DView() {
        // 카메라 타입 확인
        if (this.camera instanceof THREE.PerspectiveCamera) {
            // 원근 카메라에서 직교 카메라로 변경
            const floorDimensions = this.floorManager.getDimensions();
            const aspect = window.innerWidth / window.innerHeight;
            const frustumSize = Math.max(floorDimensions.width, floorDimensions.depth) * 1.2;
            
            // 직교 카메라 생성
            this.camera = new THREE.OrthographicCamera(
                frustumSize * aspect / -2, // left
                frustumSize * aspect / 2,  // right
                frustumSize / 2,           // top
                frustumSize / -2,          // bottom
                0.1,                        // near
                1000                        // far
            );
            
            // 카메라 위치 설정 - 수직으로 내려다보는 시점
            this.camera.position.set(
                floorDimensions.width / 2,
                20,
                floorDimensions.depth / 2
            );
            
            this.camera.lookAt(floorDimensions.width / 2, 0, floorDimensions.depth / 2);
            this.camera.up.set(0, 0, -1); // z축이 위쪽 방향이 아니라 아래쪽 방향으로 설정
            
            // 컨트롤 업데이트
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            this.controls.target.set(floorDimensions.width / 2, 0, floorDimensions.depth / 2);
            
            // 회전 완전히 비활성화 (2D 모드에서는 회전 불가능하게)
            this.controls.enableRotate = false;
            
            // 카메라 고정을 위한 추가 설정
            this.controls.minPolarAngle = Math.PI/2; // 90도 각도 고정
            this.controls.maxPolarAngle = Math.PI/2; // 90도 각도 고정
            this.controls.minAzimuthAngle = 0; // 방위각 고정
            this.controls.maxAzimuthAngle = 0; // 방위각 고정
            
            this.controls.enableZoom = true;
            this.controls.screenSpacePanning = true;
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.25;
            
            // UI 메시지 표시
            this.uiManager.showMessage('2D 도면 관점으로 전환되었습니다');
        }
    }

    onWindowResize() {
        const aspect = window.innerWidth / window.innerHeight;
        
        // 카메라 타입에 따라 처리
        if (this.camera instanceof THREE.OrthographicCamera) {
            // 직교 카메라 리사이징 처리
            const frustumSize = Math.max(
                this.floorManager.getDimensions().width, 
                this.floorManager.getDimensions().depth
            ) * 1.2;
            
            this.camera.left = frustumSize * aspect / -2;
            this.camera.right = frustumSize * aspect / 2;
            this.camera.top = frustumSize / 2;
            this.camera.bottom = frustumSize / -2;
        } else if (this.camera instanceof THREE.PerspectiveCamera) {
            // 원근 카메라 리사이징 처리
            this.camera.aspect = aspect;
        }
        
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // 델타 타임 계산 (for 애니메이션)
        const delta = this.clock ? this.clock.getDelta() : 0.016;
        
        // 컨트롤 업데이트
        this.controls.update();
        
        // 모델 애니메이션 업데이트
        if (this.modelManager) {
            this.modelManager.update(delta);
        }
        
        // 렌더링
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});