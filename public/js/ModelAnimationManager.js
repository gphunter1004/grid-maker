import * as THREE from 'three';

/**
 * 모델 애니메이션 관리 클래스
 * 모델의 애니메이션 재생 및 제어 담당
 */
export class ModelAnimationManager {
    constructor(modelManager) {
        this.modelManager = modelManager;
    }
    
    /**
     * 애니메이션 재생
     * @param {number} modelId - 모델 ID
     * @param {number} animIndex - 애니메이션 인덱스
     * @returns {boolean} - 성공 여부
     */
    playAnimation(modelId, animIndex) {
        const model = this.modelManager.getModel(modelId);
        if (!model || !model.mixer || !model.animations || model.animations.length === 0) {
            return false;
        }

        // 이전 애니메이션 정지
        if (model.currentAction) {
            model.currentAction.stop();
        }

        // 애니메이션 인덱스 유효성 확인
        if (animIndex < 0 || animIndex >= model.animations.length) {
            return false;
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
    
    /**
     * 애니메이션 토글 (재생/정지)
     * @param {number} modelId - 모델 ID
     * @param {boolean} play - 재생 여부
     * @returns {boolean} - 성공 여부
     */
    toggleAnimation(modelId, play) {
        const model = this.modelManager.getModel(modelId);
        if (!model || !model.currentAction) {
            return false;
        }

        if (play) {
            model.currentAction.paused = false;
            model.currentAction.play();
        } else {
            model.currentAction.paused = true;
        }
        
        return true;
    }
    
    /**
     * 특정 모델의 모든 애니메이션 정지
     * @param {number} modelId - 모델 ID
     * @returns {boolean} - 성공 여부
     */
    stopAllAnimations(modelId) {
        const model = this.modelManager.getModel(modelId);
        if (!model || !model.mixer) {
            return false;
        }
        
        // 믹서의 모든 액션 정지
        model.mixer.stopAllAction();
        model.currentAction = null;
        
        return true;
    }
    
    /**
     * 애니메이션 속도 설정
     * @param {number} modelId - 모델 ID
     * @param {number} speed - 애니메이션 속도 (1.0이 기본 속도)
     * @returns {boolean} - 성공 여부
     */
    setAnimationSpeed(modelId, speed) {
        const model = this.modelManager.getModel(modelId);
        if (!model || !model.currentAction) {
            return false;
        }
        
        // 속도 유효성 검사
        if (speed <= 0) {
            return false;
        }
        
        // 애니메이션 속도 설정
        model.currentAction.timeScale = speed;
        
        return true;
    }
    
    /**
     * 모델이 가진 애니메이션 목록 가져오기
     * @param {number} modelId - 모델 ID
     * @returns {Array|null} - 애니메이션 목록 또는 null
     */
    getAnimations(modelId) {
        const model = this.modelManager.getModel(modelId);
        if (!model || !model.animations) {
            return null;
        }
        
        return model.animations.map((anim, index) => ({
            index: index,
            name: anim.name || `Animation ${index + 1}`,
            duration: anim.duration
        }));
    }
    
    /**
     * 현재 재생 중인 애니메이션 인덱스 가져오기
     * @param {number} modelId - 모델 ID
     * @returns {number} - 현재 애니메이션 인덱스 또는 -1
     */
    getCurrentAnimationIndex(modelId) {
        const model = this.modelManager.getModel(modelId);
        if (!model || !model.currentAction || !model.animations) {
            return -1;
        }
        
        // 현재 액션의 클립 가져오기
        const currentClip = model.currentAction.getClip();
        
        // 일치하는 애니메이션 인덱스 찾기
        for (let i = 0; i < model.animations.length; i++) {
            if (model.animations[i] === currentClip) {
                return i;
            }
        }
        
        return -1;
    }
    
    /**
     * 애니메이션 업데이트 (메인 애니메이션 루프에서 호출)
     * @param {number} delta - 델타 시간 (초)
     */
    update(delta) {
        // 모든 모델의 애니메이션 믹서 업데이트
        this.modelManager.models.forEach(model => {
            if (model.mixer) {
                model.mixer.update(delta);
            }
        });
    }
}