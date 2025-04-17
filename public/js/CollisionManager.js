import * as THREE from 'three';

/**
 * 충돌 관리자 클래스
 * 모델 간의 충돌을 감지하고 관리합니다.
 */
export class CollisionManager {
    constructor() {
        this.enabled = true;         // 충돌 감지 활성화 여부
        this.collisionOccurred = false; // 현재 충돌 상태
        this.collisionCallback = null;  // 충돌 발생 시 호출할 콜백 함수
        this.models = [];            // 관리할 모델 목록
        this.initialCollisionPairs = new Set(); // 초기 충돌 페어 저장 (new)
    }

    /**
     * 충돌 감지 활성화/비활성화 설정
     * @param {boolean} enabled - 활성화 여부
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        this.checkAllCollisions();
    }

    /**
     * 모델 목록 설정
     * @param {Array} models - 모델 배열
     */
    setModels(models) {
        this.models = models;
        
        // 모델 목록이 변경되면 초기 충돌 페어도 업데이트 (new)
        this.updateInitialCollisionPairs();
    }
    
    /**
     * 초기 충돌 페어 업데이트 (new)
     */
    updateInitialCollisionPairs() {
        this.initialCollisionPairs.clear();
        
        // 모든 모델 쌍에 대해 초기 충돌 상태 확인
        for (let i = 0; i < this.models.length; i++) {
            for (let j = i + 1; j < this.models.length; j++) {
                const model1 = this.models[i];
                const model2 = this.models[j];
                
                // 두 모델 모두 초기 충돌 상태라면 페어로 등록
                if (model1.initialCollisionState && model2.initialCollisionState) {
                    // 충돌 발생 여부 확인
                    if (model1.boundingBox.intersectsBox(model2.boundingBox)) {
                        const pairKey = this.getCollisionPairKey(model1.id, model2.id);
                        this.initialCollisionPairs.add(pairKey);
                    }
                }
            }
        }
    }
    
    /**
     * 충돌 페어 키 생성 (new)
     * 항상 작은 ID가 먼저 오도록 생성
     * @param {number} id1 - 첫 번째 모델 ID
     * @param {number} id2 - 두 번째 모델 ID
     * @returns {string} - 충돌 페어 키
     */
    getCollisionPairKey(id1, id2) {
        return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
    }
    
    /**
     * 두 모델이 초기 충돌 상태인지 확인 (new)
     * @param {Object} model1 - 첫 번째 모델
     * @param {Object} model2 - 두 번째 모델
     * @returns {boolean} - 초기 충돌 상태 여부
     */
    isInitialCollisionPair(model1, model2) {
        const pairKey = this.getCollisionPairKey(model1.id, model2.id);
        return this.initialCollisionPairs.has(pairKey);
    }

    /**
     * 충돌 발생 시 호출할 콜백 함수 설정
     * @param {Function} callback - 콜백 함수
     */
    setCollisionCallback(callback) {
        this.collisionCallback = callback;
    }

    /**
     * 모든 모델의 바운딩 박스 업데이트
     */
    updateAllBoundingBoxes() {
        this.models.forEach(model => {
            this.updateModelBoundingBox(model);
        });
    }

    /**
     * 특정 모델의 바운딩 박스 업데이트
     * @param {Object} model - 업데이트할 모델 객체
     */
    updateModelBoundingBox(model) {
        if (!model || !model.root) return;
        
        // 바운딩 박스 계산 (모델 위치 고려)
        model.boundingBox.setFromObject(model.root);
    }

    /**
     * 모든 모델 간의 충돌 검사
     * @returns {boolean} - 충돌 여부
     */
    checkAllCollisions() {
        if (!this.enabled) {
            // 충돌 표시 초기화
            this.models.forEach(model => {
                this.setModelCollisionState(model, false);
            });
            
            // 충돌 상태 업데이트
            this.collisionOccurred = false;
            if (this.collisionCallback) {
                this.collisionCallback(false);
            }
            return false;
        }
        
        // 모든 바운딩 박스 업데이트
        this.updateAllBoundingBoxes();
        
        // 충돌 감지 초기화
        let anyCollision = false;
        this.models.forEach(model => {
            model.isColliding = false;
        });
        
        // 모델 간 충돌 검사
        for (let i = 0; i < this.models.length; i++) {
            for (let j = i + 1; j < this.models.length; j++) {
                if (this.models[i].boundingBox.intersectsBox(this.models[j].boundingBox)) {
                    // 충돌 발생
                    this.models[i].isColliding = true;
                    this.models[j].isColliding = true;
                    anyCollision = true;
                }
            }
        }
        
        // 충돌 상태 시각화
        this.models.forEach(model => {
            this.setModelCollisionState(model, model.isColliding);
        });
        
        // 충돌 상태 업데이트
        this.collisionOccurred = anyCollision;
        if (this.collisionCallback) {
            this.collisionCallback(anyCollision);
        }
        
        return anyCollision;
    }

    /**
     * 모델의 충돌 상태 설정
     * @param {Object} model - 대상 모델
     * @param {boolean} isColliding - 충돌 상태
     */
    setModelCollisionState(model, isColliding) {
        if (!model || !model.collisionMesh) return;
        
        // 충돌 메시 상태 업데이트 (시각적 표시)
        model.collisionMesh.material.opacity = isColliding ? 0.3 : 0.0;
        
        // UI 요소가 있다면 업데이트
        const modelElement = document.querySelector(`.model-item[data-model-id="${model.id}"]`);
        if (modelElement) {
            if (isColliding) {
                modelElement.classList.add('collision');
            } else {
                modelElement.classList.remove('collision');
            }
        }
    }

    /**
     * 모델 이동 시 충돌 확인 및 롤백
     * @param {Object} model - 이동할 모델
     * @param {THREE.Vector3} newPosition - 새 위치
     * @param {THREE.Vector3} previousPosition - 이전 위치
     * @param {Object} constraints - 이동 제약 조건 객체
     * @returns {boolean} - 이동 가능 여부 (충돌 없음)
     */
    checkMoveCollision(model, newPosition, previousPosition, constraints = {}) {
        if (!this.enabled) return true;
        
        // 이전 위치 저장
        const originalPosition = model.root.position.clone();
        
        // 새 위치로 이동
        model.root.position.copy(newPosition);
        
        // 이동 전 충돌 상태 저장
        const wasColliding = model.isColliding;
        const previousCollidingModels = this.getCollidingModels(model);
        
        // 바운딩 박스 업데이트 및 충돌 체크
        this.updateModelBoundingBox(model);
        const collisionDetected = this.checkAllCollisions();
        
        // 충돌이 있고 이 모델이 충돌 중이면
        if (collisionDetected && model.isColliding) {
            // 초기 충돌 상태 존중 여부 확인
            const respectInitial = constraints.respectInitialCollision !== undefined ? 
                                 constraints.respectInitialCollision : true;
            
            // 새로운 충돌이 발생했는지 확인
            const currentCollidingModels = this.getCollidingModels(model);
            const hasNewCollision = this.hasNewCollision(previousCollidingModels, currentCollidingModels, model);
            
            // 초기 충돌 상태와 새 충돌 여부에 따라 이동 결정
            if (respectInitial && model.initialCollisionState && !hasNewCollision) {
                // 초기 충돌 상태에서 새로운 충돌이 없으면 이동 허용
                return true;
            }
            
            // 이동 제약 조건에 따라 충돌 중 이동 허용 여부 결정
            if (!constraints.allowCollisionMove) {
                // 이전 위치로 복원
                model.root.position.copy(previousPosition);
                this.updateModelBoundingBox(model);
                this.checkAllCollisions();
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 특정 모델과 충돌 중인 모델 목록 가져오기 (new)
     * @param {Object} model - 대상 모델
     * @returns {Array} - 충돌 중인 모델 ID 배열
     */
    getCollidingModels(model) {
        const collidingModels = [];
        
        for (const otherModel of this.models) {
            if (otherModel.id === model.id) continue; // 자기 자신 제외
            
            if (model.boundingBox.intersectsBox(otherModel.boundingBox)) {
                collidingModels.push(otherModel.id);
            }
        }
        
        return collidingModels;
    }
    
    /**
     * 새로운 충돌이 발생했는지 확인 (new)
     * @param {Array} previousCollisions - 이전 충돌 모델 ID 배열
     * @param {Array} currentCollisions - 현재 충돌 모델 ID 배열
     * @param {Object} model - 대상 모델
     * @returns {boolean} - 새로운 충돌 발생 여부
     */
    hasNewCollision(previousCollisions, currentCollisions, model) {
        for (const currentId of currentCollisions) {
            // 이전에 없던 충돌이 새로 발생했는지 확인
            if (!previousCollisions.includes(currentId)) {
                // 새 충돌 대상 모델
                const otherModel = this.models.find(m => m.id === currentId);
                if (!otherModel) continue;
                
                // 초기 충돌 페어인지 확인
                if (!this.isInitialCollisionPair(model, otherModel)) {
                    return true; // 새로운 충돌 감지
                }
            }
        }
        
        return false;
    }

    /**
     * 충돌 디버그 시각화 초기화
     * @param {Object} model - 대상 모델
     * @param {THREE.Box3} boundingBox - 바운딩 박스
     * @returns {THREE.Mesh} - 생성된 충돌 메시
     */
    createCollisionDebugMesh(model, boundingBox) {
        const size = boundingBox.getSize(new THREE.Vector3());
        
        // 충돌 디버그 메시 생성
        const collisionGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const collisionMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.0,  // 기본적으로 투명
            wireframe: true
        });
        
        const collisionMesh = new THREE.Mesh(collisionGeometry, collisionMaterial);
        collisionMesh.userData.modelId = model.id;
        collisionMesh.userData.isCollisionMesh = true;
        
        return collisionMesh;
    }
}