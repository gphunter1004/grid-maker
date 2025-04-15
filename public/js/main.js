import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SceneManager } from './SceneManager.js';
import { FloorManager } from './FloorManager.js';
import { AGVGridManager } from './AGVGridManager.js';
import { UIManager } from './UIManager.js';
import { ModelManager } from './ModelManager.js';
import { ModelUIManager } from './ModelUIManager.js';

class App {
    constructor() {
        // 전역 참조 설정 - UI에서 사용
        window.app = this;
        
        this.initScene();
        this.initManagers();
        this.initEventListeners();
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
        this.controls.enableRotate = true; // 회전 활성화 (3D 모델 확인을 위해 변경)
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
        
        // Initialize UI manager - scene 참조 추가
        this.uiManager = new UIManager(
            this.floorManager, 
            this.agvGridManager, 
            this.raycaster, 
            this.camera,
            this.scene
        );
        
        // Initialize model manager
        this.modelManager = new ModelManager(this.sceneManager);
        
        // Initialize model UI manager
        this.modelUIManager = new ModelUIManager(this.modelManager);

        // Create initial floor
        this.floorManager.createFloor();
        
        // 바닥 생성 후 카메라 위치 조정
        this.updateCameraPositionBasedOnFloor();
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
    }

    initEventListeners() {
        // Listen for mouse click
        document.addEventListener('click', (event) => this.onClick(event), false);
        
        // Listen for mouse move to update coordinate display
        document.addEventListener('mousemove', (event) => this.onMouseMove(event), false);
        
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
            this.controls.enableRotate = false; // 회전 비활성화
            this.controls.enableZoom = true;
            this.controls.screenSpacePanning = true;
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.25;
            
            // UI 메시지 표시
            this.uiManager.showMessage('2D 도면 관점으로 전환되었습니다');
        }
    }

    onClick(event) {
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Update the raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Let UI manager handle the click
        this.uiManager.handleClick(this.mouse);
    }

    onMouseMove(event) {
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Update the UI manager with mouse position for coordinate display and tooltips
        this.uiManager.updateMousePosition(this.mouse);
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
        
        // 컨트롤 업데이트
        this.controls.update();
        
        // 애니메이션 업데이트
        if (this.modelManager) {
            this.modelManager.update();
        }
        
        // 렌더링
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});