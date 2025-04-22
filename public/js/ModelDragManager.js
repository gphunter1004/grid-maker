import * as THREE from 'three';

/**
 * 모델 드래그 관리 클래스
 * 마우스를 이용한 모델 드래그 동작을 처리
 */
export class ModelDragManager {
    constructor(modelManager, collisionManager) {
        this.modelManager = modelManager;
        this.collisionManager = collisionManager;
        
        // 드래그 관련 상태
        this.isDragging = false;
        this.dragOffset = new THREE.Vector3();
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0)); // XZ 평면
    }
    
    /**
     * 드래그 시작
     * @param {THREE.Raycaster} raycaster - 레이캐스터
     * @param {THREE.Vector2} mouse - 마우스 위치 (정규화된 좌표)
     * @returns {boolean} - 드래그 시작 성공 여부
     */
    startDrag(raycaster, mouse) {
        const modelId = this.modelManager.getSelectedModelId();
        if (modelId === null) return false;
        
        const model = this.modelManager.getModel(modelId);
        if (!model || !model.isDraggable) return false;
        
        // 레이캐스터가 선택된 모델과 교차하는지 확인
        const isHoveringSelectedModel = this.isRayIntersectingModel(raycaster, modelId);
        if (!isHoveringSelectedModel) return false;
        
        // 현재 모델 위치에서 드래그 평면 생성
        this.dragPlane.constant = -model.root.position.y;
        
        // 레이와 평면의 교차점 계산
        const intersectPoint = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(this.dragPlane, intersectPoint)) {
            this.isDragging = true;
            
            // 모델 위치와 마우스 교차점 사이의 오프셋 계산
            this.dragOffset.copy(model.root.position).sub(intersectPoint);
            
            return true;
        }
        
        return false;
    }
    
    /**
     * 레이캐스터가 특정 모델과 교차하는지 확인
     * @param {THREE.Raycaster} raycaster - 레이캐스터
     * @param {number} modelId - 확인할 모델의 ID
     * @returns {boolean} - 교차 여부
     */
    isRayIntersectingModel(raycaster, modelId) {
        const model = this.modelManager.getModel(modelId);
        if (!model) return false;
        
        // 모델의 선택 메시 및 모든 하위 메시를 대상으로 레이캐스트 확인
        const targetObjects = [model.selectionMesh];
        model.originalModel.traverse(node => {
            if (node.isMesh) {
                targetObjects.push(node);
            }
        });
        
        const intersects = raycaster.intersectObjects(targetObjects);
        return intersects.length > 0;
    }
    
    /**
     * 드래그 업데이트
     * @param {THREE.Raycaster} raycaster - 레이캐스터
     * @param {THREE.Vector2} mouse - 마우스 위치 (정규화된 좌표)
     * @returns {boolean} - 업데이트 성공 여부
     */
    updateDrag(raycaster, mouse) {
        if (!this.isDragging) return false;
        
        const modelId = this.modelManager.getSelectedModelId();
        if (modelId === null) return false;
        
        const model = this.modelManager.getModel(modelId);
        if (!model) return false;
        
        // 레이와 평면의 교차점 계산
        const intersectPoint = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(this.dragPlane, intersectPoint)) {
            // 새 위치 계산 (오프셋 적용)
            const newPosition = intersectPoint.clone().add(this.dragOffset);
            
            // 모델 위치 업데이트 (TransformManager에게 위임)
            const success = this.modelManager.updateModelXZPosition(model.id, newPosition.x, newPosition.z);
            
            // 도면 모드에서 드래그 성공 시 치수 화살표 업데이트
            if (success && 
                this.modelManager.floorManager && 
                this.modelManager.floorManager.config.blueprintMode) {
                
                // 효율성을 위해 10프레임마다 한 번 업데이트
                const now = Date.now();
                if (!this.lastArrowUpdate || now - this.lastArrowUpdate > 100) {
                    this.modelManager.showModelVertexDistances(modelId);
                    this.lastArrowUpdate = now;
                }
            }
            
            return success;
        }
        
        return false;
    }

    /**
     * 드래그 종료
     * @returns {boolean} - 성공 여부
     */
    endDrag() {
        this.isDragging = false;
        
        // 드래그 종료 시 도면 모드에서 최종 화살표 업데이트
        if (this.modelManager.floorManager && 
            this.modelManager.floorManager.config.blueprintMode &&
            this.modelManager.getSelectedModelId() !== null) {
            
            const modelId = this.modelManager.getSelectedModelId();
            this.modelManager.showModelVertexDistances(modelId);
        }
        
        return true;
    }
    
    /**
     * 드래그 중인지 여부 확인
     * @returns {boolean} - 드래그 상태
     */
    isDraggingActive() {
        return this.isDragging;
    }
    
    /**
     * 모델이 드래그 가능한지 설정
     * @param {number} modelId - 모델 ID
     * @param {boolean} draggable - 드래그 가능 여부
     * @returns {boolean} - 성공 여부
     */
    setModelDraggable(modelId, draggable) {
        const model = this.modelManager.getModel(modelId);
        if (!model) return false;
        
        model.isDraggable = draggable;
        return true;
    }
}