import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class ModelManager {
    constructor(scene, collisionManager) {
        this.scene = scene;
        this.collisionManager = collisionManager;
        this.models = [];
        this.nextModelId = 0;
        this.selectedModelId = null;
        this.selectedObject = null;
        
        // 선택 상자
        this.selectionBox = new THREE.BoxHelper(new THREE.Object3D(), 0xffff00);
        this.selectionBox.visible = false;
        this.scene.add(this.selectionBox);
        
        // 이벤트 리스너들을 위한 참조 저장
        this.onModelLoaded = null;
        this.onModelSelect = null;
        this.onModelsChanged = null;
        
        // 그리드 경계 참조
        this.gridBoundary = null;
        
        // 모델 그룹 이름
        this.groupName = 'models';
        
        // 로더 초기화
        this.loader = new GLTFLoader();
    }

    // 콜백 설정
    setCallbacks(onModelLoaded, onModelSelect, onModelsChanged) {
        this.onModelLoaded = onModelLoaded;
        this.onModelSelect = onModelSelect;
        this.onModelsChanged = onModelsChanged;
    }

    // 그리드 경계 설정
    setGridBoundary(boundary) {
        this.gridBoundary = boundary;
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
                    size: boxSize.clone()  // 모델 크기 저장
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
                
                // 콜백 호출
                if (this.onModelLoaded) {
                    this.onModelLoaded(modelData);
                }
                
                // 새 모델 선택
                this.selectModel(modelId);
                
                // 충돌 감지
                this.collisionManager.checkAllCollisions();
                
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

    // 모델 선택
    selectModel(modelId) {
        // 이전 선택 지우기
        this.selectedObject = null;
        this.selectedModelId = null;
        this.selectionBox.visible = false;

        // 새 모델 찾기
        const model = this.models.find(m => m.id === modelId);
        if (!model) return false;

        // 선택 설정
        this.selectedObject = model.root;
        this.selectedModelId = modelId;

        // 모델을 포함하는 경계 박스 표시
        this.selectionBox.setFromObject(model.root);
        this.selectionBox.visible = true;
        
        // 콜백 호출
        if (this.onModelSelect) {
            this.onModelSelect(modelId);
        }
        
        return true;
    }

    // 선택 해제
    clearSelection() {
        this.selectedObject = null;
        this.selectedModelId = null;
        this.selectionBox.visible = false;
        
        // 콜백 호출
        if (this.onModelSelect) {
            this.onModelSelect(null);
        }
    }

    // 모델 위치 업데이트
    updateModelPosition(modelId, axis, value) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) return false;

        // 이전 위치 저장
        const previousPosition = model.root.position.clone();

        // 새 위치 계산
        const newPosition = model.root.position.clone();
        newPosition[axis] = parseFloat(value);
        
        // 그리드 경계 확인 (경계가 설정된 경우)
        if (this.gridBoundary) {
            const buffer = Math.max(model.size.x, model.size.z) / 2;
            
            // Y축은 항상 0으로 고정
            if (axis === 'y') {
                newPosition.y = 0;
                model.root.position.y = 0;
                return true;
            }
            
            // 경계 초과 확인
            if (axis === 'x') {
                if (newPosition.x < this.gridBoundary.min.x + buffer || 
                    newPosition.x > this.gridBoundary.max.x - buffer) {
                    return false; // 경계 초과 시 이동 불가
                }
            } else if (axis === 'z') {
                if (newPosition.z < this.gridBoundary.min.z + buffer || 
                    newPosition.z > this.gridBoundary.max.z - buffer) {
                    return false; // 경계 초과 시 이동 불가
                }
            }
        } else {
            // 경계가 없더라도 Y축은 항상 0으로 고정
            if (axis === 'y') {
                newPosition.y = 0;
                model.root.position.y = 0;
                return true;
            }
        }
        
        // 충돌 검사
        const canMove = this.collisionManager.checkMoveCollision(model, newPosition, previousPosition);
        
        if (!canMove) {
            return false;
        }
        
        // 선택 상자 업데이트
        if (this.selectedModelId === modelId && this.selectionBox.visible) {
            this.selectionBox.update();
        }
        
        return true;
    }

    // 드래그 이동 처리
    moveSelectedModel(newPosition, previousPosition) {
        if (!this.selectedObject || this.selectedModelId === null) return false;
        
        const model = this.models.find(m => m.id === this.selectedModelId);
        if (!model) return false;
        
        // 새 위치 적용 (Y값은 0으로 고정)
        newPosition.y = 0;
        
        // 그리드 경계 확인 (경계가 설정된 경우)
        if (this.gridBoundary) {
            const buffer = Math.max(model.size.x, model.size.z) / 2;
            
            // X 경계 검사
            if (newPosition.x < this.gridBoundary.min.x + buffer) {
                newPosition.x = this.gridBoundary.min.x + buffer;
            } else if (newPosition.x > this.gridBoundary.max.x - buffer) {
                newPosition.x = this.gridBoundary.max.x - buffer;
            }
            
            // Z 경계 검사
            if (newPosition.z < this.gridBoundary.min.z + buffer) {
                newPosition.z = this.gridBoundary.min.z + buffer;
            } else if (newPosition.z > this.gridBoundary.max.z - buffer) {
                newPosition.z = this.gridBoundary.max.z - buffer;
            }
        }
        
        // 충돌 검사
        const canMove = this.collisionManager.checkMoveCollision(model, newPosition, previousPosition);
        
        if (canMove) {
            // 선택 상자 업데이트
            if (this.selectionBox.visible) {
                this.selectionBox.update();
            }
            
            return true;
        }
        
        return false;
    }

    // 모든 모델 지우기
    clearAllModels() {
        this.models.forEach(model => {
            this.scene.remove(model.root);
        });
        this.models = [];
        this.collisionManager.setModels(this.models);
        
        // 선택 해제
        this.clearSelection();
        
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
        if (this.selectedModelId === modelId) {
            this.clearSelection();
        }

        // 콜백 호출
        if (this.onModelsChanged) {
            this.onModelsChanged();
        }

        // 충돌 감지 업데이트
        this.collisionManager.checkAllCollisions();
        
        return true;
    }

    // 모델 회전 처리
    rotateModel(modelId, angle) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) return false;

        // 이전 회전 값 저장
        const previousRotation = model.root.rotation.clone();
        
        // 새 회전 값 계산 (Y축 기준 회전)
        const newRotation = model.root.rotation.clone();
        newRotation.y += angle * (Math.PI / 180); // 각도를 라디안으로 변환
        
        // 회전 적용
        model.root.rotation.copy(newRotation);
        
        // 충돌 검사 (회전 후 충돌 발생시 이전 상태로 복원)
        this.collisionManager.updateModelBoundingBox(model);
        const collisionDetected = this.collisionManager.checkAllCollisions();
        
        if (collisionDetected && model.isColliding) {
            model.root.rotation.copy(previousRotation);
            this.collisionManager.updateModelBoundingBox(model);
            this.collisionManager.checkAllCollisions();
            return false;
        }
        
        // 선택 상자 업데이트
        if (this.selectedModelId === modelId && this.selectionBox.visible) {
            this.selectionBox.update();
        }
        
        return true;
    }

    // 모델 스케일 설정
    setModelScale(modelId, scale) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) return false;
        
        // 스케일 값이 유효한지 확인 (0보다 커야 함)
        if (scale <= 0) return false;
        
        // 이전 스케일 저장
        const previousScale = model.root.scale.clone();
        
        // 새 스케일 적용
        model.root.scale.set(scale, scale, scale);
        
        // 바운딩 박스 업데이트 및 충돌 검사
        this.collisionManager.updateModelBoundingBox(model);
        
        // 그리드 경계 검사 (경계가 설정된 경우)
        if (this.gridBoundary) {
            // 스케일이 변경되면 새로운 크기 계산
            const newSize = model.size.clone().multiplyScalar(scale);
            const buffer = Math.max(newSize.x, newSize.z) / 2;
            
            // 현재 위치가 새 크기로 그리드 경계를 벗어나는지 확인
            const position = model.root.position;
            if (position.x - buffer < this.gridBoundary.min.x || 
                position.x + buffer > this.gridBoundary.max.x ||
                position.z - buffer < this.gridBoundary.min.z ||
                position.z + buffer > this.gridBoundary.max.z) {
                
                // 이전 스케일로 복원
                model.root.scale.copy(previousScale);
                this.collisionManager.updateModelBoundingBox(model);
                return false;
            }
        }
        
        const collisionDetected = this.collisionManager.checkAllCollisions();
        
        // 충돌이 있고 이 모델이 충돌 중이면 이전 스케일로 복원
        if (collisionDetected && model.isColliding) {
            model.root.scale.copy(previousScale);
            this.collisionManager.updateModelBoundingBox(model);
            this.collisionManager.checkAllCollisions();
            return false;
        }
        
        // 선택 상자 업데이트
        if (this.selectedModelId === modelId && this.selectionBox.visible) {
            this.selectionBox.update();
        }
        
        return true;
    }

    // 애니메이션 재생
    playAnimation(modelId, animIndex) {
        const model = this.models.find(m => m.id === modelId);
        if (!model || !model.mixer || !model.animations || model.animations.length === 0) return false;

        // 이전 애니메이션 정지
        if (model.currentAction) {
            model.currentAction.stop();
        }

        // 새 애니메이션 설정 및 재생
        const animation = model.animations[animIndex];
        if (animation) {
            model.currentAction = model.mixer.clipAction(animation);
            model.currentAction.reset();
            model.currentAction.play();
            return true;
        }
        
        return false;
    }

    // 애니메이션 토글
    toggleAnimation(modelId, play) {
        const model = this.models.find(m => m.id === modelId);
        if (!model || !model.currentAction) return false;

        if (play) {
            model.currentAction.paused = false;
            model.currentAction.play();
        } else {
            model.currentAction.paused = true;
        }
        
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
    
    // 선택된 모델 ID 가져오기
    getSelectedModelId() {
        return this.selectedModelId;
    }
    
    // 선택된 모델 객체 가져오기
    getSelectedObject() {
        return this.selectedObject;
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
        // 애니메이션 믹서 업데이트
        this.models.forEach(model => {
            if (model.mixer) {
                model.mixer.update(delta);
            }
        });
        
        // 선택 박스 업데이트
        if (this.selectionBox.visible) {
            this.selectionBox.update();
        }
    }
}