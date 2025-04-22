import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ModelSelectionManager } from './ModelSelectionManager.js';
import { ModelTransformManager } from './ModelTransformManager.js';
import { ModelAnimationManager } from './ModelAnimationManager.js';
import { ModelDragManager } from './ModelDragManager.js';

/**
 * 모델 관리 클래스
 * 3D 모델의 기본적인 관리와 다른 모델 관련 매니저 클래스들의 조정을 담당
 */
export class ModelManager {
    constructor(scene, collisionManager) {
        this.scene = scene;
        this.collisionManager = collisionManager;
        this.models = [];
        this.nextModelId = 0;
        
        // 그리드 경계 참조
        this.gridBoundary = null;
        
        // 모델 그룹 이름
        this.groupName = 'models';
        
        // 꼭지점 거리 표시 그룹
        this.vertexDistanceGroup = new THREE.Group();
        // 그룹을 항상 앞에 표시하도록 설정
        this.vertexDistanceGroup.renderOrder = 999;
        scene.add(this.vertexDistanceGroup);

        // 로더 초기화
        this.loader = new GLTFLoader();
        
        // 이동 제약 설정
        this.moveConstraints = {
            allowCollisionMove: false, // 기본적으로 충돌 시 이동 제한
            moveSpeed: 0.2,          // 키보드 이동 속도 (미터/이벤트)
            gridSnap: false,         // 그리드 스냅 활성화 여부
            gridSize: 0.5,           // 그리드 스냅 크기
            respectInitialCollision: true // 초기 충돌 상태 존중 추가
        };
        
        // 서브 매니저 초기화
        this.selectionManager = new ModelSelectionManager(this, scene);
        this.transformManager = new ModelTransformManager(this, collisionManager);
        this.animationManager = new ModelAnimationManager(this);
        this.dragManager = new ModelDragManager(this, collisionManager);
        
        // 이벤트 리스너들을 위한 참조 저장
        this.onModelLoaded = null;
        this.onModelSelect = null;
        this.onModelsChanged = null;
    }

    // 콜백 설정
    setCallbacks(onModelLoaded, onModelSelect, onModelsChanged) {
        this.onModelLoaded = onModelLoaded;
        this.onModelSelect = onModelSelect;
        this.onModelsChanged = onModelsChanged;
        
        // 선택 매니저의 콜백 설정
        this.selectionManager.onModelSelect = onModelSelect;
    }

    // 그리드 경계 설정
    setGridBoundary(boundary) {
        this.gridBoundary = boundary;
        this.transformManager.setGridBoundary(boundary);
    }

    // 모델 로드
    loadModel(fileURL, modelName) {
        const modelId = this.nextModelId++;
        const loadingElement = document.getElementById('loading');
        loadingElement.style.display = 'block';
        
        this.loader.load(
            fileURL,
            (gltf) => {
                // 바운딩 박스 계산
                const boundingBox = new THREE.Box3().setFromObject(gltf.scene);
                const boxSize = boundingBox.getSize(new THREE.Vector3());
                const boxCenter = boundingBox.getCenter(new THREE.Vector3());
                
                // 바운딩 박스보다 약간 큰 투명한 선택용 메시 생성
                const selectionGeometry = new THREE.BoxGeometry(
                    boxSize.x * 1.05, 
                    boxSize.y * 1.05, 
                    boxSize.z * 1.05
                );
                const selectionMaterial = new THREE.MeshBasicMaterial({
                    transparent: true,
                    opacity: 0.1, // 약간 보이게 설정 (디버깅용)
                    depthWrite: false
                });
                const selectionMesh = new THREE.Mesh(selectionGeometry, selectionMaterial);
                
                // 선택용 메시에 모델 ID 할당
                selectionMesh.userData.modelId = modelId;
                selectionMesh.userData.isSelectionProxy = true;
                
                // 메인 그룹 생성
                const modelRoot = new THREE.Group();
                modelRoot.name = `model-${modelId}`;
                
                // 모델 씬의 위치를 조정 (바운딩 박스 중심을 원점으로)
                gltf.scene.position.sub(boxCenter);
                
                // 충돌 감지용 메시 생성 및 추가
                const collisionMesh = this.collisionManager.createCollisionDebugMesh({ id: modelId }, boundingBox);
                
                // 씬과 선택용 메시, 충돌 메시를 그룹에 추가
                modelRoot.add(gltf.scene);
                modelRoot.add(selectionMesh);
                modelRoot.add(collisionMesh);
                
                // 모델 데이터 객체 생성
                const modelData = {
                    id: modelId,
                    name: modelName,
                    root: modelRoot,
                    selectionMesh: selectionMesh,
                    collisionMesh: collisionMesh,
                    boundingBox: new THREE.Box3(),
                    originalModel: gltf.scene,
                    animations: gltf.animations,
                    mixer: null,
                    currentAction: null,
                    isColliding: false,
                    size: boxSize.clone(),  // 모델 크기 저장
                    isDraggable: true,      // 드래그 가능 여부
                    initialCollisionState: false, // 초기 충돌 상태 추가
                    hasMovedSinceCollision: false // 충돌 이후 이동 여부 추가
                };
                
                // 모든 하위 객체에 모델 ID 설정
                gltf.scene.traverse((node) => {
                    node.userData.modelId = modelId;
                    node.userData.modelName = modelName;
                    
                    // 개별 메시 설정
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                        
                        // 재질 설정 개선
                        if (node.material) {
                            // 단일 재질인 경우
                            this.enhanceMaterial(node.material);
                        } else if (node.materials && Array.isArray(node.materials)) {
                            // 다중 재질인 경우
                            node.materials.forEach(material => this.enhanceMaterial(material));
                        }
                    }
                });
                
                // 그룹 자체에도 모델 ID 설정
                modelRoot.userData.modelId = modelId;
                modelRoot.userData.modelName = modelName;
                modelRoot.userData.isModelRoot = true;
                
                // 초기 위치 설정 (그리드 영역 내로 제한)
                let initialPosition = new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    0,
                    (Math.random() - 0.5) * 10
                );
                
                // 그리드 경계 내로 조정 (경계가 설정된 경우)
                if (this.gridBoundary) {
                    const buffer = Math.max(boxSize.x, boxSize.z) / 2;
                    
                    // 범위 내 위치로 조정
                    initialPosition.x = Math.min(Math.max(initialPosition.x, this.gridBoundary.min.x + buffer), this.gridBoundary.max.x - buffer);
                    initialPosition.z = Math.min(Math.max(initialPosition.z, this.gridBoundary.min.z + buffer), this.gridBoundary.max.z - buffer);
                }
                
                modelRoot.position.copy(initialPosition);
                
                // 초기 스케일 설정
                modelRoot.scale.set(1, 1, 1);
                
                // 애니메이션 설정
                if (gltf.animations && gltf.animations.length > 0) {
                    modelData.mixer = new THREE.AnimationMixer(gltf.scene);
                    modelData.currentAction = modelData.mixer.clipAction(gltf.animations[0]);
                    modelData.currentAction.play();
                }
                
                // 씬에 추가
                this.scene.add(modelRoot);
                
                // 모델 목록에 추가
                this.models.push(modelData);
                
                // 충돌 관리자에 모델 목록 업데이트
                this.collisionManager.setModels(this.models);
                
                // 바운딩 박스 초기화
                this.collisionManager.updateModelBoundingBox(modelData);
                
                // 로딩 숨기기
                loadingElement.style.display = 'none';
                
                // 충돌 감지
                this.collisionManager.checkAllCollisions();
                
                // 초기 충돌 상태 저장
                modelData.initialCollisionState = modelData.isColliding;
                console.log(`모델 ${modelId} 로드됨. 초기 충돌 상태: ${modelData.initialCollisionState}`);
                
                // 콜백 호출
                if (this.onModelLoaded) {
                    this.onModelLoaded(modelData);
                }
                
                // 새 모델 선택
                this.selectionManager.selectModel(modelId);
                
                return modelId;
            },
            (xhr) => {
                // 로딩 진행률
                const percentComplete = (xhr.loaded / xhr.total) * 100;
                loadingElement.textContent = `로딩 중... ${Math.round(percentComplete)}%`;
            },
            (error) => {
                console.error('모델 로드 중 오류 발생:', error);
                loadingElement.textContent = '모델 로드 중 오류가 발생했습니다.';
                setTimeout(() => {
                    loadingElement.style.display = 'none';
                }, 3000);
            }
        );
        
        return modelId;
    }

    // 모든 모델 지우기
    clearAllModels() {
        this.models.forEach(model => {
            this.scene.remove(model.root);
        });
        this.models = [];
        this.collisionManager.setModels(this.models);
        
        // 선택 해제
        this.selectionManager.clearSelection();
        
        // 콜백 호출
        if (this.onModelsChanged) {
            this.onModelsChanged();
        }
    }

    // 모델 제거
    removeModel(modelId) {
        const modelIndex = this.models.findIndex(m => m.id === modelId);
        if (modelIndex === -1) return false;

        const model = this.models[modelIndex];
        this.scene.remove(model.root);

        // 모델 배열에서 제거
        this.models.splice(modelIndex, 1);

        // 충돌 관리자에 모델 목록 업데이트
        this.collisionManager.setModels(this.models);

        // 선택된 모델 제거 시 선택 해제
        if (this.selectionManager.selectedModelId === modelId) {
            this.selectionManager.clearSelection();
        }

        // 콜백 호출
        if (this.onModelsChanged) {
            this.onModelsChanged();
        }

        // 충돌 감지 업데이트
        this.collisionManager.checkAllCollisions();
        
        return true;
    }

    // 모델 가져오기
    getModel(modelId) {
        return this.models.find(m => m.id === modelId);
    }

    // 모든 모델 가져오기
    getAllModels() {
        return this.models;
    }
    
    // 선택된 모델 ID 가져오기 (위임)
    getSelectedModelId() {
        return this.selectionManager.getSelectedModelId();
    }
    
    // 선택된 모델 객체 가져오기 (위임)
    getSelectedObject() {
        return this.selectionManager.getSelectedObject();
    }
    
    // 모델 선택 (위임)
    selectModel(modelId) {
        return this.selectionManager.selectModel(modelId);
    }
    
    // 선택 해제 (위임)
    clearSelection() {
        // 모델 꼭지점 거리 표시 제거
        this.hideModelVertexDistances();
        
        return this.selectionManager.clearSelection();
    }
    
    // 모델 위치 업데이트 (위임)
    updateModelPosition(modelId, axis, value) {
        return this.transformManager.updateModelPosition(modelId, axis, value);
    }
    
    // 모델 XZ 위치 동시 업데이트 (위임)
    updateModelXZPosition(modelId, x, z) {
        return this.transformManager.updateModelXZPosition(modelId, x, z);
    }
    
    // 선택된 모델 이동 (위임)
    moveSelectedModelByDelta(deltaX, deltaZ) {
        return this.transformManager.moveSelectedModelByDelta(deltaX, deltaZ);
    }
    
    // 모델 회전 (위임)
    rotateModel(modelId, angle) {
        return this.transformManager.rotateModel(modelId, angle);
    }
    
    // 모델 스케일 설정 (위임)
    setModelScale(modelId, scale) {
        return this.transformManager.setModelScale(modelId, scale);
    }
    
    // 드래그 시작 (위임)
    startDrag(raycaster, mouse) {
        return this.dragManager.startDrag(raycaster, mouse);
    }
    
    // 드래그 업데이트 (위임)
    updateDrag(raycaster, mouse) {
        return this.dragManager.updateDrag(raycaster, mouse);
    }
    
    // 드래그 종료 (위임)
    endDrag() {
        return this.dragManager.endDrag();
    }
    
    // 애니메이션 재생 (위임)
    playAnimation(modelId, animIndex) {
        return this.animationManager.playAnimation(modelId, animIndex);
    }
    
    // 애니메이션 토글 (위임)
    toggleAnimation(modelId, play) {
        return this.animationManager.toggleAnimation(modelId, play);
    }
    
    // 재질 개선
    enhanceMaterial(material) {
        if (!material) return;
        
        // 양면 렌더링 활성화
        material.side = THREE.DoubleSide;
        
        // 발광 속성 설정 (더 잘 보이게)
        material.emissive = material.emissive || new THREE.Color(0x222222);
        
        // 투명도 설정 개선
        if (material.transparent) {
            // 최소 투명도 보장
            material.opacity = Math.max(0.8, material.opacity);
        }
        
        // 기타 품질 향상 설정
        material.dithering = true;
        
        // 텍스처가 있는 경우 필터링 품질 향상
        if (material.map) {
            material.map.anisotropy = 16;
            material.map.minFilter = THREE.LinearMipmapLinearFilter;
            material.map.magFilter = THREE.LinearFilter;
        }
    }
    
    // 애니메이션 업데이트 (메인 애니메이션 루프에서 호출)
    update(delta) {
        // 애니메이션 업데이트 위임
        this.animationManager.update(delta);
        
        // 선택 상자 업데이트
        this.selectionManager.update();
    }
    
    // 이동 제약 조건 설정
    setMoveConstraints(constraints) {
        if (constraints) {
            Object.assign(this.moveConstraints, constraints);
            this.transformManager.setMoveConstraints(constraints);
        }
    }
    
    // 그리드 스냅 토글
    toggleGridSnap(enabled, gridSize = 0.5) {
        this.moveConstraints.gridSnap = enabled;
        if (gridSize > 0) {
            this.moveConstraints.gridSize = gridSize;
        }
        this.transformManager.setMoveConstraints(this.moveConstraints);
    }

    /**
     * 모델 꼭지점 거리 표시 (수평 거리만 표시)
     * @param {number} modelId - 모델 ID
     */
    showModelVertexDistances(modelId) {
        // 기존 거리 표시 제거
        this.hideModelVertexDistances();
        
        // 모델과 FloorManager 참조 확인
        const model = this.getModel(modelId);
        if (!model || !this.floorManager) {
            console.error("모델 또는 floorManager가 없음");
            return;
        }
        
        // 바닥면 치수 가져오기
        const floorDimensions = this.floorManager.getDimensions();
        
        // 바닥면 모서리 정의 (더 자세한 설명과 함께)
        const floorEdges = [
            {
                start: new THREE.Vector3(0, 0, 0),
                end: new THREE.Vector3(floorDimensions.width, 0, 0),
                description: "상단 경계선"
            },
            {
                start: new THREE.Vector3(0, 0, floorDimensions.depth),
                end: new THREE.Vector3(floorDimensions.width, 0, floorDimensions.depth),
                description: "하단 경계선"
            },
            {
                start: new THREE.Vector3(0, 0, 0),
                end: new THREE.Vector3(0, 0, floorDimensions.depth),
                description: "좌측 경계선"
            },
            {
                start: new THREE.Vector3(floorDimensions.width, 0, 0),
                end: new THREE.Vector3(floorDimensions.width, 0, floorDimensions.depth),
                description: "우측 경계선"
            }
        ];
        
        console.log("바닥면 치수:", floorDimensions);
        
        // 모델의 바운딩 박스 계산
        const boundingBox = new THREE.Box3().setFromObject(model.root);
        console.log("모델 바운딩 박스:", {min: boundingBox.min, max: boundingBox.max});
        
        // 모델의 바닥 부분 모서리 좌표 (y=0 높이에서의 모서리)
        const modelBottomCorners = [
            {pos: new THREE.Vector3(boundingBox.min.x, 0, boundingBox.min.z), desc: "좌측 상단"},
            {pos: new THREE.Vector3(boundingBox.min.x, 0, boundingBox.max.z), desc: "좌측 하단"},
            {pos: new THREE.Vector3(boundingBox.max.x, 0, boundingBox.min.z), desc: "우측 상단"},
            {pos: new THREE.Vector3(boundingBox.max.x, 0, boundingBox.max.z), desc: "우측 하단"}
        ];
        
        console.log("모델 바닥 모서리 좌표:", modelBottomCorners.map(c => c.desc));
        
        // 각 모델 바닥 모서리에 대해 가장 가까운 바닥면 모서리와의 최단 거리 계산
        for (const modelCorner of modelBottomCorners) {
            // 각 모서리별 최단 거리 저장
            let shortestDistance = Infinity;
            let closestEdge = null;
            let closestPoint = null;
            
            // 모델 모서리에서 각 바닥면 모서리까지의 최단 거리 계산
            for (const edge of floorEdges) {
                const edgeStart = edge.start;
                const edgeEnd = edge.end;
                
                // 모서리 선분의 방향 벡터 계산
                const edgeVector = new THREE.Vector3().subVectors(edgeEnd, edgeStart);
                const edgeLength = edgeVector.length();
                const edgeDir = edgeVector.clone().normalize();
                
                // 모델 모서리에서 바닥면 모서리 시작점까지의 벡터
                const cornerToEdgeStart = new THREE.Vector3().subVectors(modelCorner.pos, edgeStart);
                
                // 이 벡터를 모서리 방향으로 투영
                const projection = cornerToEdgeStart.dot(edgeDir);
                
                // 투영된 지점 계산
                let projectedPoint;
                
                if (projection <= 0) {
                    // 투영이 선분 시작점 이전이면 시작점이 최단 거리
                    projectedPoint = edgeStart.clone();
                } else if (projection >= edgeLength) {
                    // 투영이 선분 끝점 이후이면 끝점이 최단 거리
                    projectedPoint = edgeEnd.clone();
                } else {
                    // 투영된 지점이 선분 위에 있는 경우
                    projectedPoint = edgeStart.clone().add(edgeDir.clone().multiplyScalar(projection));
                }
                
                // 모델 모서리와 투영된 지점 사이의 거리 계산
                const distance = modelCorner.pos.distanceTo(projectedPoint);
                
                // 최단 거리 업데이트
                if (distance < shortestDistance) {
                    shortestDistance = distance;
                    closestEdge = edge;
                    closestPoint = projectedPoint;
                }
            }
            
            // 최단 거리가 있으면 화살표 표시
            if (closestPoint && shortestDistance > 0.1) {
                console.log(`${modelCorner.desc} 모서리에서 ${closestEdge.description}까지 거리: ${shortestDistance.toFixed(2)}m`);
                
                // 거리 화살표 생성
                this.floorManager.createDistanceArrow(
                    modelCorner.pos,
                    closestPoint,
                    this.vertexDistanceGroup,
                    0x00AAFF,
                    `${modelCorner.desc}→${closestEdge.description}`
                );
            }
        }
    }

    /**
     * 모델 꼭지점 거리 표시 제거
     */
    hideModelVertexDistances() {
        // 그룹 내 모든 객체 제거
        while (this.vertexDistanceGroup.children.length > 0) {
            const object = this.vertexDistanceGroup.children[0];
            
            // 매테리얼과 지오메트리 정리
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
            
            if (object.geometry) {
                object.geometry.dispose();
            }
            
            this.vertexDistanceGroup.remove(object);
        }
    } 
}