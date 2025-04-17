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
     * @returns {boolean} - 이동 가능 여부 (충돌 없음)
     */
    checkMoveCollision(model, newPosition, previousPosition) {
        if (!this.enabled) return true;
        
        // 이전 위치 저장
        const originalPosition = model.root.position.clone();
        
        // 새 위치로 이동
        model.root.position.copy(newPosition);
        
        // 바운딩 박스 업데이트 및 충돌 체크
        this.updateModelBoundingBox(model);
        const collisionDetected = this.checkAllCollisions();
        
        // 충돌이 있고 이 모델이 충돌 중이면 이전 위치로 복원
        if (collisionDetected && model.isColliding) {
            model.root.position.copy(previousPosition);
            this.updateModelBoundingBox(model);
            this.checkAllCollisions();
            return false;
        }
        
        return true;
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