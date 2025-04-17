import * as THREE from 'three';

/**
 * 모델 변환 관리 클래스
 * 모델의 위치, 회전, 크기 변환을 관리
 */
export class ModelTransformManager {
    constructor(modelManager, collisionManager) {
        this.modelManager = modelManager;
        this.collisionManager = collisionManager;
        this.gridBoundary = null;
        
        // 이동 제약 설정
        this.moveConstraints = {
            allowCollisionMove: true, // 충돌 중에도 이동 허용
            moveSpeed: 0.2,          // 키보드 이동 속도 (미터/이벤트)
            gridSnap: false,         // 그리드 스냅 활성화 여부
            gridSize: 0.5            // 그리드 스냅 크기
        };
    }
    
    /**
     * 이동 제약 조건 설정
     * @param {Object} constraints - 제약 조건 객체
     */
    setMoveConstraints(constraints) {
        if (constraints) {
            Object.assign(this.moveConstraints, constraints);
        }
    }
    
    /**
     * 그리드 경계 설정
     * @param {THREE.Box3} boundary - 그리드 경계 박스
     */
    setGridBoundary(boundary) {
        this.gridBoundary = boundary;
    }
    
    /**
     * 모델 위치 업데이트 (단일 축)
     * @param {number} modelId - 모델 ID
     * @param {string} axis - 업데이트할 축 ('x', 'y', 'z')
     * @param {number} value - 새 위치 값
     * @returns {boolean} - 성공 여부
     */
    updateModelPosition(modelId, axis, value) {
        const model = this.modelManager.getModel(modelId);
        if (!model) return false;

        // 이전 위치 저장
        const previousPosition = model.root.position.clone();

        // 새 위치 계산
        const newPosition = model.root.position.clone();
        newPosition[axis] = parseFloat(value);
        
        // 그리드 경계 확인 (경계가 설정된 경우)
        if (this.gridBoundary) {
            const buffer = Math.max(model.size.x, model.size.z) / 2 * model.root.scale.x;
            
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
        
        // 그리드 스냅 적용 (활성화된 경우)
        if (this.moveConstraints.gridSnap) {
            const gridSize = this.moveConstraints.gridSize;
            if (axis === 'x' || axis === 'z') {
                newPosition[axis] = Math.round(newPosition[axis] / gridSize) * gridSize;
            }
        }
        
        // 충돌 검사 : 충돌 중 이동 허용 설정과 초기 충돌 상태 고려
        const constraints = {
            allowCollisionMove: this.moveConstraints.allowCollisionMove,
            respectInitialCollision: this.moveConstraints.respectInitialCollision
        };
        
        const canMove = this.collisionManager.checkMoveCollision(model, newPosition, previousPosition, constraints);
        if (!canMove) {
            return false;
        }
        
        return true;
    }

    /**
     * 모델의 X, Z 위치를 동시에 업데이트
     * @param {number} modelId - 모델 ID
     * @param {number} x - 새 X 위치
     * @param {number} z - 새 Z 위치
     * @returns {boolean} - 성공 여부
     */
    updateModelXZPosition(modelId, x, z) {
        const model = this.modelManager.getModel(modelId);
        if (!model) return false;

        // 이전 위치 저장
        const previousPosition = model.root.position.clone();

        // 새 위치 계산
        const newPosition = previousPosition.clone();
        newPosition.x = x;
        newPosition.z = z;
        newPosition.y = 0; // Y축은 항상 0

        // 그리드 경계 확인인
        if (this.gridBoundary) {
            const buffer = Math.max(model.size.x, model.size.z) / 2 * model.root.scale.x;
            
            // 경계 초과 확인 및 조정
            if (newPosition.x < this.gridBoundary.min.x + buffer) {
                newPosition.x = this.gridBoundary.min.x + buffer;
            } else if (newPosition.x > this.gridBoundary.max.x - buffer) {
                newPosition.x = this.gridBoundary.max.x - buffer;
            }
            
            if (newPosition.z < this.gridBoundary.min.z + buffer) {
                newPosition.z = this.gridBoundary.min.z + buffer;
            } else if (newPosition.z > this.gridBoundary.max.z - buffer) {
                newPosition.z = this.gridBoundary.max.z - buffer;
            }
        }

        // 그리드 스냅 적용 (활성화된 경우)
        if (this.moveConstraints.gridSnap) {
            const gridSize = this.moveConstraints.gridSize;
            newPosition.x = Math.round(newPosition.x / gridSize) * gridSize;
            newPosition.z = Math.round(newPosition.z / gridSize) * gridSize;
        }

        // 충돌 검사 : 충돌 중 이동 허용 설정과 초기 충돌 상태 고려
        const constraints = {
            allowCollisionMove: this.moveConstraints.allowCollisionMove,
            respectInitialCollision: this.moveConstraints.respectInitialCollision
        };
        
        const canMove = this.collisionManager.checkMoveCollision(model, newPosition, previousPosition, constraints);
        if (!canMove) {
            return false;
        }

        return true;
    }
    
    /**
     * 선택된 모델을 상대적으로 이동
     * @param {number} deltaX - X축 이동량
     * @param {number} deltaZ - Z축 이동량
     * @returns {boolean} - 성공 여부
     */
    moveSelectedModelByDelta(deltaX, deltaZ) {
        const modelId = this.modelManager.getSelectedModelId();
        if (modelId === null) return false;
        
        const model = this.modelManager.getModel(modelId);
        if (!model) return false;
        
        // 이전 위치
        const previousPosition = model.root.position.clone();
        
        // 새 위치 계산
        const newPosition = previousPosition.clone();
        newPosition.x += deltaX;
        newPosition.z += deltaZ;
        
        // 위치 업데이트 함수 호출
        return this.updateModelXZPosition(model.id, newPosition.x, newPosition.z);
    }
    
    /**
     * 모델 회전 (Y축 기준)
     * @param {number} modelId - 모델 ID
     * @param {number} angle - 회전 각도 (도 단위)
     * @returns {boolean} - 성공 여부
     */
    rotateModel(modelId, angle) {
        const model = this.modelManager.getModel(modelId);
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
        
        if (collisionDetected && model.isColliding && !this.moveConstraints.allowCollisionMove) {
            model.root.rotation.copy(previousRotation);
            this.collisionManager.updateModelBoundingBox(model);
            this.collisionManager.checkAllCollisions();
            return false;
        }
        
        return true;
    }
    
    /**
     * 모델 스케일 설정
     * @param {number} modelId - 모델 ID
     * @param {number} scale - 스케일 값 (모든 축에 동일하게 적용)
     * @returns {boolean} - 성공 여부
     */
    setModelScale(modelId, scale) {
        const model = this.modelManager.getModel(modelId);
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
        
        // 충돌이 있고 이 모델이 충돌 중이면 이전 스케일로 복원 (충돌 중 이동 비활성 상태일 때)
        if (collisionDetected && model.isColliding && !this.moveConstraints.allowCollisionMove) {
            model.root.scale.copy(previousScale);
            this.collisionManager.updateModelBoundingBox(model);
            this.collisionManager.checkAllCollisions();
            return false;
        }
        
        return true;
    }
}