import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class ModelManager {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.models = new Map(); // 모델 저장소
        this.animations = new Map(); // 애니메이션 저장소
        this.mixer = null; // 애니메이션 믹서
        this.activeAnimations = new Map(); // 활성화된 애니메이션 액션 저장소
        this.clock = new THREE.Clock(); // 애니메이션 시간 측정용 클럭
        
        // 모델 그룹 이름
        this.groupName = 'models';
        
        // 로더 초기화
        this.loader = new GLTFLoader();
    }
    
    // GLB 파일 로드
    loadModel(modelId, filePath, position = { x: 0, y: 0, z: 0 }, scale = 1.0, rotation = { x: 0, y: 0, z: 0 }) {
        return new Promise((resolve, reject) => {
            // 로딩 상태 표시
            this.showLoadingInfo(`모델 로딩 중: ${filePath}`);
            
            this.loader.load(
                filePath,
                (gltf) => {
                    const model = gltf.scene;
                    
                    // 위치, 스케일, 회전 설정
                    model.position.set(position.x, position.y, position.z);
                    model.scale.set(scale, scale, scale);
                    model.rotation.set(
                        THREE.MathUtils.degToRad(rotation.x),
                        THREE.MathUtils.degToRad(rotation.y),
                        THREE.MathUtils.degToRad(rotation.z)
                    );
                    
                    // 그림자 설정
                    model.traverse((node) => {
                        if (node.isMesh) {
                            node.castShadow = true;
                            node.receiveShadow = true;
                        }
                    });
                    
                    // 모델 저장
                    this.models.set(modelId, model);
                    
                    // 애니메이션 처리
                    if (gltf.animations && gltf.animations.length > 0) {
                        // 애니메이션 믹서가 없으면 생성
                        if (!this.mixer) {
                            this.mixer = new THREE.AnimationMixer(model);
                        }
                        
                        // 애니메이션 저장
                        const animations = {};
                        gltf.animations.forEach((clip) => {
                            animations[clip.name] = clip;
                        });
                        
                        this.animations.set(modelId, animations);
                    }
                    
                    // 씬에 추가
                    this.sceneManager.addToGroup(this.groupName, model);
                    
                    // 로딩 완료 메시지
                    this.showMessage(`모델 로드 완료: ${modelId}`);
                    
                    resolve({
                        model,
                        animations: gltf.animations
                    });
                },
                (xhr) => {
                    // 로딩 진행 상태 표시
                    const progress = Math.round((xhr.loaded / xhr.total) * 100);
                    this.showLoadingInfo(`모델 로딩 중: ${progress}%`);
                },
                (error) => {
                    // 오류 처리
                    this.showWarning(`모델 로드 실패: ${error.message}`);
                    reject(error);
                }
            );
        });
    }
    
    // 모델 제거
    removeModel(modelId) {
        if (this.models.has(modelId)) {
            const model = this.models.get(modelId);
            
            // 모델이 활성화된 애니메이션을 가지고 있으면 중지
            if (this.activeAnimations.has(modelId)) {
                const actions = this.activeAnimations.get(modelId);
                for (const action of Object.values(actions)) {
                    action.stop();
                }
                this.activeAnimations.delete(modelId);
            }
            
            // 그룹에서 제거
            this.sceneManager.getGroup(this.groupName).remove(model);
            
            // 모델 맵에서 제거
            this.models.delete(modelId);
            
            // 애니메이션 맵에서 제거
            this.animations.delete(modelId);
            
            this.showMessage(`모델 제거됨: ${modelId}`);
            return true;
        }
        
        this.showWarning(`모델을 찾을 수 없음: ${modelId}`);
        return false;
    }
    
    // 모든 모델 제거
    removeAllModels() {
        const modelIds = [...this.models.keys()];
        
        modelIds.forEach(modelId => {
            this.removeModel(modelId);
        });
        
        // 그룹 비우기
        this.sceneManager.clearGroup(this.groupName);
        
        // 믹서 초기화
        this.mixer = null;
        
        this.showMessage('모든 모델이 제거되었습니다');
    }
    
    // 모델 위치 설정
    setModelPosition(modelId, x, y, z) {
        if (this.models.has(modelId)) {
            const model = this.models.get(modelId);
            model.position.set(x, y, z);
            return true;
        }
        
        this.showWarning(`모델을 찾을 수 없음: ${modelId}`);
        return false;
    }
    
    // 모델 회전 설정
    setModelRotation(modelId, x, y, z) {
        if (this.models.has(modelId)) {
            const model = this.models.get(modelId);
            model.rotation.set(
                THREE.MathUtils.degToRad(x),
                THREE.MathUtils.degToRad(y),
                THREE.MathUtils.degToRad(z)
            );
            return true;
        }
        
        this.showWarning(`모델을 찾을 수 없음: ${modelId}`);
        return false;
    }
    
    // 모델 스케일 설정
    setModelScale(modelId, scale) {
        if (this.models.has(modelId)) {
            const model = this.models.get(modelId);
            model.scale.set(scale, scale, scale);
            return true;
        }
        
        this.showWarning(`모델을 찾을 수 없음: ${modelId}`);
        return false;
    }
    
    // 애니메이션 시작
    playAnimation(modelId, animationName, loop = true) {
        if (!this.models.has(modelId)) {
            this.showWarning(`모델을 찾을 수 없음: ${modelId}`);
            return false;
        }
        
        if (!this.animations.has(modelId)) {
            this.showWarning(`애니메이션을 찾을 수 없음: ${modelId}`);
            return false;
        }
        
        const animations = this.animations.get(modelId);
        
        if (!animations[animationName]) {
            this.showWarning(`애니메이션을 찾을 수 없음: ${animationName}`);
            return false;
        }
        
        // 믹서가 없으면 생성
        if (!this.mixer) {
            this.mixer = new THREE.AnimationMixer(this.models.get(modelId));
        }
        
        // 액션 생성
        const action = this.mixer.clipAction(animations[animationName]);
        
        // 액션 설정
        if (loop) {
            action.loop = THREE.LoopRepeat;
        } else {
            action.loop = THREE.LoopOnce;
            action.clampWhenFinished = true;
        }
        
        // 액션 저장
        if (!this.activeAnimations.has(modelId)) {
            this.activeAnimations.set(modelId, {});
        }
        
        const modelAnimations = this.activeAnimations.get(modelId);
        
        // 이미 실행 중인 애니메이션이 있으면 정지
        if (modelAnimations[animationName]) {
            modelAnimations[animationName].stop();
        }
        
        // 새 액션 저장
        modelAnimations[animationName] = action;
        
        // 액션 시작
        action.play();
        
        this.showMessage(`애니메이션 시작: ${modelId} - ${animationName}`);
        return true;
    }
    
    // 애니메이션 정지
    stopAnimation(modelId, animationName) {
        if (!this.activeAnimations.has(modelId)) {
            this.showWarning(`활성화된 애니메이션이 없음: ${modelId}`);
            return false;
        }
        
        const modelAnimations = this.activeAnimations.get(modelId);
        
        if (!modelAnimations[animationName]) {
            this.showWarning(`활성화된 애니메이션이 없음: ${animationName}`);
            return false;
        }
        
        // 액션 정지
        modelAnimations[animationName].stop();
        delete modelAnimations[animationName];
        
        this.showMessage(`애니메이션 정지: ${modelId} - ${animationName}`);
        return true;
    }
    
    // 모델의 모든 애니메이션 정지
    stopAllAnimations(modelId) {
        if (!this.activeAnimations.has(modelId)) {
            this.showWarning(`활성화된 애니메이션이 없음: ${modelId}`);
            return false;
        }
        
        const modelAnimations = this.activeAnimations.get(modelId);
        
        // 모든 액션 정지
        for (const action of Object.values(modelAnimations)) {
            action.stop();
        }
        
        // 액션 맵 비우기
        this.activeAnimations.delete(modelId);
        
        this.showMessage(`모든 애니메이션 정지: ${modelId}`);
        return true;
    }
    
    // 모델 가져오기
    getModel(modelId) {
        return this.models.get(modelId);
    }
    
    // 애니메이션 목록 가져오기
    getAnimationNames(modelId) {
        if (!this.animations.has(modelId)) {
            return [];
        }
        
        return Object.keys(this.animations.get(modelId));
    }
    
    // 로딩 상태 표시
    showLoadingInfo(message) {
        const messagesElement = document.getElementById('messages');
        if (messagesElement) {
            messagesElement.textContent = message;
            messagesElement.style.display = 'block';
            messagesElement.style.backgroundColor = 'rgba(0, 0, 255, 0.7)';
        }
    }
    
    // 메시지 표시
    showMessage(message) {
        const messagesElement = document.getElementById('messages');
        if (messagesElement) {
            messagesElement.textContent = message;
            messagesElement.style.display = 'block';
            messagesElement.style.backgroundColor = 'rgba(0, 128, 0, 0.7)';
            
            // 3초 후 메시지 숨기기
            setTimeout(() => {
                messagesElement.style.display = 'none';
            }, 3000);
        }
    }
    
    // 경고 메시지 표시
    showWarning(message) {
        const messagesElement = document.getElementById('messages');
        if (messagesElement) {
            messagesElement.textContent = message;
            messagesElement.style.display = 'block';
            messagesElement.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
            
            // 3초 후 메시지 숨기기
            setTimeout(() => {
                messagesElement.style.display = 'none';
            }, 3000);
        }
    }
    
    // 애니메이션 업데이트 (메인 애니메이션 루프에서 호출)
    update() {
        if (this.mixer) {
            const delta = this.clock.getDelta();
            this.mixer.update(delta);
        }
    }
}