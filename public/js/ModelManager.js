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
     * 모델 치수 및 경계 거리 표시 (모델과 겹치지 않게 표시)
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
        
        // 모델의 바운딩 박스 계산
        const boundingBox = new THREE.Box3().setFromObject(model.root);
        
        // 모델의 크기 계산
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        
        // 모델의 회전 각도 가져오기
        const rotation = model.root.rotation.y;
        
        // 회전 행렬 생성
        const rotMatrix = new THREE.Matrix4().makeRotationY(rotation);
        
        // 바운딩 박스의 중심점 계산
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        center.y = 0; // y좌표는 바닥 높이로 설정
        
        // 모델 크기의 절반 (각 방향으로)
        const halfWidth = size.x / 2;
        const halfDepth = size.z / 2;
        
        // 회전을 고려한 모델 모서리 계산
        const topLeftOffset = new THREE.Vector3(-halfWidth, 0, -halfDepth).applyMatrix4(rotMatrix);
        const topRightOffset = new THREE.Vector3(halfWidth, 0, -halfDepth).applyMatrix4(rotMatrix);
        const bottomLeftOffset = new THREE.Vector3(-halfWidth, 0, halfDepth).applyMatrix4(rotMatrix);
        const bottomRightOffset = new THREE.Vector3(halfWidth, 0, halfDepth).applyMatrix4(rotMatrix);
        
        // 월드 좌표계에서의 모서리 위치
        const corners = {
            topLeft: {
                pos: new THREE.Vector3().addVectors(center, topLeftOffset),
                desc: "좌측 상단"
            },
            topRight: {
                pos: new THREE.Vector3().addVectors(center, topRightOffset),
                desc: "우측 상단"
            },
            bottomLeft: {
                pos: new THREE.Vector3().addVectors(center, bottomLeftOffset),
                desc: "좌측 하단"
            },
            bottomRight: {
                pos: new THREE.Vector3().addVectors(center, bottomRightOffset),
                desc: "우측 하단"
            }
        };
        
        // 모서리 위치를 조금 올려서 바닥면과 겹치지 않도록 함
        for (const key in corners) {
            corners[key].pos.y += 0.05;
        }
        
        // 바닥면 경계선 정의
        const edges = {
            top: {
                start: new THREE.Vector3(0, 0, 0),
                end: new THREE.Vector3(floorDimensions.width, 0, 0),
                description: "상단 경계선",
                color: 0xFF2222 // 빨간색
            },
            bottom: {
                start: new THREE.Vector3(0, 0, floorDimensions.depth),
                end: new THREE.Vector3(floorDimensions.width, 0, floorDimensions.depth),
                description: "하단 경계선",
                color: 0xFF9900 // 주황색
            },
            left: {
                start: new THREE.Vector3(0, 0, 0),
                end: new THREE.Vector3(0, 0, floorDimensions.depth),
                description: "좌측 경계선",
                color: 0x22FF22 // 녹색
            },
            right: {
                start: new THREE.Vector3(floorDimensions.width, 0, 0),
                end: new THREE.Vector3(floorDimensions.width, 0, floorDimensions.depth),
                description: "우측 경계선", 
                color: 0x2288FF // 파란색
            }
        };
        
        // 1. 모델 치수 화살표 생성 (윗부분, 왼쪽부분) - 모델과 겹치지 않도록 떨어뜨려 표시
        
        // 화살표를 모델에서 얼마나 떨어뜨릴지 설정
        const arrowOffset = 0.5; // 미터 단위
        
        // 윗부분(너비) 화살표의 위치 계산 - 모델 위쪽으로 이동
        const topStart = corners.topLeft.pos.clone();
        const topEnd = corners.topRight.pos.clone();
        
        // 화살표의 방향 벡터 계산 (왼쪽->오른쪽)
        const topDir = new THREE.Vector3().subVectors(topEnd, topStart).normalize();
        // 방향 벡터를 90도 회전하여 위쪽으로 향하게 함
        const topOffsetDir = new THREE.Vector3(-topDir.z, 0, -topDir.x);
        
        // 시작점과 끝점을 위쪽으로 이동
        topStart.add(topOffsetDir.clone().multiplyScalar(arrowOffset));
        topEnd.add(topOffsetDir.clone().multiplyScalar(arrowOffset));
        
        // 윗부분(너비) 치수 화살표 생성
        this.createDimensionArrow(
            topStart,
            topEnd,
            this.vertexDistanceGroup,
            0xFF2222, // 빨간색
            `${size.x.toFixed(2)}m`, // 너비 표시
            "width",
            0.3 // 라벨 y 오프셋
        );
        
        // 왼쪽부분(깊이) 화살표의 위치 계산 - 모델 왼쪽으로 이동
        const leftStart = corners.topLeft.pos.clone();
        const leftEnd = corners.bottomLeft.pos.clone();
        
        // 화살표의 방향 벡터 계산 (위->아래)
        const leftDir = new THREE.Vector3().subVectors(leftEnd, leftStart).normalize();
        // 방향 벡터를 90도 회전하여 왼쪽으로 향하게 함
        const leftOffsetDir = new THREE.Vector3(-leftDir.z, 0, leftDir.x);
        
        // 시작점과 끝점을 왼쪽으로 이동
        leftStart.add(leftOffsetDir.clone().multiplyScalar(arrowOffset));
        leftEnd.add(leftOffsetDir.clone().multiplyScalar(arrowOffset));
        
        // 왼쪽부분(깊이) 치수 화살표 생성
        this.createDimensionArrow(
            leftStart,
            leftEnd,
            this.vertexDistanceGroup,
            0x22FF22, // 녹색
            `${size.z.toFixed(2)}m`, // 깊이 표시
            "depth",
            0.3 // 라벨 y 오프셋
        );
        
        // 2. 모델 모서리에서 바닥면 경계까지의 거리 화살표 생성
        
        // 특정 꼭지점과 경계선 연결 정의
        const connections = [
            // 우측 상단 꼭지점
            { corner: corners.topRight, edge: edges.top, key: "우측 상단 > 상단 경계선" },
            { corner: corners.topRight, edge: edges.right, key: "우측 상단 > 우측 경계선" },
            
            // 좌측 상단 꼭지점
            { corner: corners.topLeft, edge: edges.top, key: "좌측 상단 > 상단 경계선" },
            { corner: corners.topLeft, edge: edges.left, key: "좌측 상단 > 좌측 경계선" },
            
            // 우측 하단 꼭지점
            { corner: corners.bottomRight, edge: edges.bottom, key: "우측 하단 > 하단 경계선" },
            { corner: corners.bottomRight, edge: edges.right, key: "우측 하단 > 우측 경계선" },
            
            // 좌측 하단 꼭지점
            { corner: corners.bottomLeft, edge: edges.bottom, key: "좌측 하단 > 하단 경계선" },
            { corner: corners.bottomLeft, edge: edges.left, key: "좌측 하단 > 좌측 경계선" }
        ];
        
        // 각 연결에 대해 투영된 점 찾고 화살표 생성
        for (const connection of connections) {
            const corner = connection.corner;
            const edge = connection.edge;
            const key = connection.key;
            
            // 투영점 계산
            let projectedPoint;
            
            // 상하단 경계선인 경우 (Z 좌표만 변경)
            if (edge === edges.top || edge === edges.bottom) {
                projectedPoint = new THREE.Vector3(
                    corner.pos.x,   // X 좌표는 그대로
                    0,              // Y 좌표는 0
                    edge.start.z    // Z 좌표는 경계선의 Z 좌표
                );
            }
            // 좌우측 경계선인 경우 (X 좌표만 변경)
            else {
                projectedPoint = new THREE.Vector3(
                    edge.start.x,   // X 좌표는 경계선의 X 좌표
                    0,              // Y 좌표는 0
                    corner.pos.z    // Z 좌표는 그대로
                );
            }
            
            // 거리 계산
            const distance = new THREE.Vector2(corner.pos.x, corner.pos.z)
                .distanceTo(new THREE.Vector2(projectedPoint.x, projectedPoint.z));
            
            // 화살표 생성
            this.floorManager.createDistanceArrow(
                corner.pos.clone(),
                projectedPoint,
                this.vertexDistanceGroup,
                edge.color,
                `${key}: ${distance.toFixed(2)}m`
            );
        }
        
        console.log("모델 치수 및 경계 거리 화살표 생성 완료");
    }

    /**
     * 치수 화살표 생성 - 모델과 겹치지 않게 표시
     * @param {THREE.Vector3} start - 시작점
     * @param {THREE.Vector3} end - 끝점
     * @param {THREE.Group} group - 부모 그룹
     * @param {number} color - 화살표 색상
     * @param {string} label - 치수 라벨
     * @param {string} direction - 방향 ('width' 또는 'depth')
     * @param {number} labelYOffset - 라벨의 Y축 오프셋
     */
    createDimensionArrow(start, end, group, color, label, direction, labelYOffset = 0.2) {
        // 두 점 사이의 방향 벡터
        const dirVector = new THREE.Vector3().subVectors(end, start);
        
        // 선 길이
        const length = dirVector.length();
        
        // 양방향 화살표를 위한 지오메트리와 머티리얼
        const arrowHeadSize = 0.2; // 화살표 머리 크기
        
        // 시작점과 끝점 사이의 선 생성
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        const lineMaterial = new THREE.LineBasicMaterial({ color: color, linewidth: 3 });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        
        // 화살표 머리를 위한 방향 벡터 정규화
        const normalizedDir = dirVector.clone().normalize();
        
        // 시작점에서의 화살표 머리
        const startArrowDir = normalizedDir.clone().negate(); // 반대 방향
        const startArrowHelper = new THREE.ArrowHelper(
            startArrowDir,
            start.clone().addScaledVector(normalizedDir, arrowHeadSize), // 약간 시작점에서 떨어진 위치
            arrowHeadSize,
            color,
            arrowHeadSize * 0.8,
            arrowHeadSize * 0.5
        );
        
        // 끝점에서의 화살표 머리
        const endArrowHelper = new THREE.ArrowHelper(
            normalizedDir,
            end.clone().addScaledVector(normalizedDir, -arrowHeadSize), // 약간 끝점에서 떨어진 위치
            arrowHeadSize,
            color,
            arrowHeadSize * 0.8,
            arrowHeadSize * 0.5
        );
        
        // 라벨 위치 계산 (중간점 위에)
        const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        
        // 라벨이 항상 위를 향하도록 offset 지정
        midPoint.y += labelYOffset;
        
        // 치수 텍스트 라벨 생성
        const labelCanvas = document.createElement('canvas');
        const ctx = labelCanvas.getContext('2d');
        labelCanvas.width = 128;
        labelCanvas.height = 64;
        
        // 라벨 배경
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
        
        // 라벨 테두리
        ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, labelCanvas.width, labelCanvas.height);
        
        // 라벨 텍스트
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, labelCanvas.width/2, labelCanvas.height/2);
        
        // 스프라이트 생성
        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const labelMaterial = new THREE.SpriteMaterial({
            map: labelTexture,
            transparent: true
        });
        
        const labelSprite = new THREE.Sprite(labelMaterial);
        labelSprite.position.copy(midPoint);
        labelSprite.scale.set(1.2, 0.6, 1);
        
        // 렌더링 순서 설정
        line.renderOrder = 998;
        startArrowHelper.renderOrder = 999;
        endArrowHelper.renderOrder = 999;
        labelSprite.renderOrder = 1000;
        
        // 부모 그룹에 추가
        group.add(line);
        group.add(startArrowHelper);
        group.add(endArrowHelper);
        group.add(labelSprite);
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