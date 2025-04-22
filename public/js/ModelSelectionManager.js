import * as THREE from 'three';

/**
 * 모델 선택 관리 클래스
 * 모델의 선택 상태와 시각적 선택 표시를 관리
 */
export class ModelSelectionManager {
    constructor(modelManager, scene) {
        this.modelManager = modelManager;
        this.scene = scene;
        this.selectedModelId = null;
        this.selectedObject = null;
        
        // 선택 상자 (BoxHelper)
        this.selectionBox = new THREE.BoxHelper(new THREE.Object3D(), 0xffff00);
        this.selectionBox.visible = false;
        this.scene.add(this.selectionBox);
        
        // 콜백 함수
        this.onModelSelect = null;
    }
    
    /**
     * 모델 선택
     * @param {number} modelId - 선택할 모델 ID
     * @returns {boolean} - 성공 여부
     */
    selectModel(modelId) {
        // 이전 선택 지우기
        this.selectedObject = null;
        this.selectedModelId = null;
        this.selectionBox.visible = false;
        
        // 모델 선택이 변경될 때 이전 꼭지점 거리 표시 제거
        if (this.modelManager.hideModelVertexDistances) {
            this.modelManager.hideModelVertexDistances();
        }

        // 새 모델 찾기
        const model = this.modelManager.getModel(modelId);
        if (!model) return false;

        // 선택 설정
        this.selectedObject = model.root;
        this.selectedModelId = modelId;

        // 모델을 포함하는 경계 박스 표시
        this.selectionBox.setFromObject(model.root);
        this.selectionBox.visible = true;
        
        // 도면 모드인 경우 모델 꼭지점 거리 표시
        if (this.modelManager.floorManager && 
            this.modelManager.floorManager.config.blueprintMode) {
            // 디버깅 메시지 추가
            console.log("도면 모드 활성화됨 - 꼭지점 거리 표시 시작");
            setTimeout(() => {
                this.modelManager.showModelVertexDistances(modelId);
            }, 100); // 약간의 지연을 두어 렌더링 이슈 방지
        } else {
            console.log("도면 모드 비활성화됨 또는 floorManager 참조 없음");
        }
        
        // 콜백 호출
        if (this.onModelSelect) {
            this.onModelSelect(modelId);
        }
        
        return true;
    }
    
    /**
     * 선택 해제
     * @returns {boolean} - 성공 여부
     */
    clearSelection() {
        this.selectedObject = null;
        this.selectedModelId = null;
        this.selectionBox.visible = false;
        
        // 콜백 호출
        if (this.onModelSelect) {
            this.onModelSelect(null);
        }
        
        return true;
    }
    
    /**
     * 선택된 모델 ID 가져오기
     * @returns {number|null} - 선택된 모델 ID 또는 null
     */
    getSelectedModelId() {
        return this.selectedModelId;
    }
    
    /**
     * 선택된 모델 객체 가져오기
     * @returns {THREE.Object3D|null} - 선택된 모델 객체 또는 null
     */
    getSelectedObject() {
        return this.selectedObject;
    }
    
    /**
     * 모델이 선택되어 있는지 확인
     * @returns {boolean} - 모델 선택 여부
     */
    hasSelection() {
        return this.selectedModelId !== null && this.selectedObject !== null;
    }
    
    /**
     * 선택 상자 업데이트
     * 애니메이션 루프에서 호출됨
     */
    update() {
        if (this.selectionBox.visible && this.selectedObject) {
            this.selectionBox.update();
        }
    }
    
    /**
     * 인터랙션 레이에 대한 모델의 교차 여부 확인
     * @param {THREE.Raycaster} raycaster - 레이캐스터
     * @returns {number|null} - 교차된 모델의 ID 또는 null
     */
    checkModelIntersection(raycaster) {
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
        const intersects = raycaster.intersectObjects(targetObjects);
        
        if (intersects.length > 0) {
            // 교차 객체의 모델 ID 찾기
            const hitObject = intersects[0].object;
            
            // 직접 모델 ID 있는지 확인
            if (hitObject.userData && hitObject.userData.modelId !== undefined) {
                return hitObject.userData.modelId;
            }
            
            // 부모에 모델 ID 있는지 확인
            let parent = hitObject.parent;
            while (parent) {
                if (parent.userData && parent.userData.modelId !== undefined) {
                    return parent.userData.modelId;
                }
                parent = parent.parent;
            }
        }
        
        return null;
    }
}