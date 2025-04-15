import * as THREE from 'three';

export class ModelUIManager {
    constructor(modelManager) {
        this.modelManager = modelManager;
        
        // UI 요소 참조
        this.modelFileInput = document.getElementById('model-file');
        this.modelIdInput = document.getElementById('model-id');
        this.modelPosXInput = document.getElementById('model-pos-x');
        this.modelPosYInput = document.getElementById('model-pos-y');
        this.modelPosZInput = document.getElementById('model-pos-z');
        this.modelRotXInput = document.getElementById('model-rot-x');
        this.modelRotYInput = document.getElementById('model-rot-y');
        this.modelRotZInput = document.getElementById('model-rot-z');
        this.modelScaleInput = document.getElementById('model-scale');
        
        this.loadModelButton = document.getElementById('load-model');
        this.updateModelTransformButton = document.getElementById('update-model-transform');
        this.removeModelButton = document.getElementById('remove-model');
        this.removeAllModelsButton = document.getElementById('remove-all-models');
        
        // 애니메이션 UI 요소
        this.animationModelSelect = document.getElementById('animation-model');
        this.animationNameSelect = document.getElementById('animation-name');
        this.animationLoopCheckbox = document.getElementById('animation-loop');
        this.playAnimationButton = document.getElementById('play-animation');
        this.stopAnimationButton = document.getElementById('stop-animation');
        this.stopAllAnimationsButton = document.getElementById('stop-all-animations');
        
        // 예시 모델 버튼
        this.exampleForkliftButton = document.getElementById('example-model-forklift');
        this.exampleAgvButton = document.getElementById('example-model-agv');
        this.exampleRobotButton = document.getElementById('example-model-robot');
        
        // URL의 '/models/' 경로에 있다고 가정한 예시 모델 정의
        this.exampleModels = {
            forklift: {
                path: '/models/forklift.glb',
                position: { x: 5, y: 0, z: 5 },
                rotation: { x: 0, y: 0, z: 0 },
                scale: 1.0
            },
            agv: {
                path: '/models/agv.glb',
                position: { x: 10, y: 0, z: 5 },
                rotation: { x: 0, y: 90, z: 0 },
                scale: 1.0
            },
            robot: {
                path: '/models/robot.glb',
                position: { x: 15, y: 0, z: 5 },
                rotation: { x: 0, y: 0, z: 0 },
                scale: 1.0
            }
        };
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        // 모델 파일 선택 시 모델 ID 자동 생성
        if (this.modelFileInput) {
            this.modelFileInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (file) {
                    // 파일명에서 확장자 제거하여 ID 생성
                    const filename = file.name.replace(/\.[^/.]+$/, "");
                    this.modelIdInput.value = filename;
                    
                    // 기본 위치 및 회전 설정
                    this.modelPosXInput.value = 5;
                    this.modelPosYInput.value = 0;
                    this.modelPosZInput.value = 5;
                    this.modelRotXInput.value = 0;
                    this.modelRotYInput.value = 0;
                    this.modelRotZInput.value = 0;
                    this.modelScaleInput.value = 1.0;
                }
            });
        }
        
        // 모델 로드 버튼
        if (this.loadModelButton) {
            this.loadModelButton.addEventListener('click', () => {
                this.loadModelFromInput();
            });
        }
        
        // 모델 변환 업데이트 버튼
        if (this.updateModelTransformButton) {
            this.updateModelTransformButton.addEventListener('click', () => {
                this.updateModelTransform();
            });
        }
        
        // 모델 제거 버튼
        if (this.removeModelButton) {
            this.removeModelButton.addEventListener('click', () => {
                const modelId = this.modelIdInput.value;
                if (modelId) {
                    this.modelManager.removeModel(modelId);
                    this.updateAnimationModelList();
                } else {
                    this.showWarning('삭제할 모델 ID를 입력하세요');
                }
            });
        }
        
        // 모든 모델 제거 버튼
        if (this.removeAllModelsButton) {
            this.removeAllModelsButton.addEventListener('click', () => {
                this.modelManager.removeAllModels();
                this.updateAnimationModelList();
            });
        }
        
        // 애니메이션 모델 선택 변경 시
        if (this.animationModelSelect) {
            this.animationModelSelect.addEventListener('change', () => {
                this.updateAnimationList();
            });
        }
        
        // 애니메이션 재생 버튼
        if (this.playAnimationButton) {
            this.playAnimationButton.addEventListener('click', () => {
                const modelId = this.animationModelSelect.value;
                const animationName = this.animationNameSelect.value;
                const loop = this.animationLoopCheckbox.checked;
                
                if (modelId && animationName) {
                    this.modelManager.playAnimation(modelId, animationName, loop);
                } else {
                    this.showWarning('모델과 애니메이션을 선택하세요');
                }
            });
        }
        
        // 애니메이션 중지 버튼
        if (this.stopAnimationButton) {
            this.stopAnimationButton.addEventListener('click', () => {
                const modelId = this.animationModelSelect.value;
                const animationName = this.animationNameSelect.value;
                
                if (modelId && animationName) {
                    this.modelManager.stopAnimation(modelId, animationName);
                } else {
                    this.showWarning('모델과 애니메이션을 선택하세요');
                }
            });
        }
        
        // 모든 애니메이션 중지 버튼
        if (this.stopAllAnimationsButton) {
            this.stopAllAnimationsButton.addEventListener('click', () => {
                const modelId = this.animationModelSelect.value;
                
                if (modelId) {
                    this.modelManager.stopAllAnimations(modelId);
                } else {
                    this.showWarning('모델을 선택하세요');
                }
            });
        }
        
        // 예시 모델 버튼들
        if (this.exampleForkliftButton) {
            this.exampleForkliftButton.addEventListener('click', () => {
                this.loadExampleModel('forklift');
            });
        }
        
        if (this.exampleAgvButton) {
            this.exampleAgvButton.addEventListener('click', () => {
                this.loadExampleModel('agv');
            });
        }
        
        if (this.exampleRobotButton) {
            this.exampleRobotButton.addEventListener('click', () => {
                this.loadExampleModel('robot');
            });
        }
    }
    
    loadModelFromInput() {
        const fileInput = this.modelFileInput;
        const modelId = this.modelIdInput.value;
        
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            this.showWarning('GLB 파일을 선택하세요');
            return;
        }
        
        if (!modelId) {
            this.showWarning('모델 ID를 입력하세요');
            return;
        }
        
        const file = fileInput.files[0];
        const fileURL = URL.createObjectURL(file);
        
        // 위치, 회전, 스케일 값 가져오기
        const posX = parseFloat(this.modelPosXInput.value) || 0;
        const posY = parseFloat(this.modelPosYInput.value) || 0;
        const posZ = parseFloat(this.modelPosZInput.value) || 0;
        const rotX = parseFloat(this.modelRotXInput.value) || 0;
        const rotY = parseFloat(this.modelRotYInput.value) || 0;
        const rotZ = parseFloat(this.modelRotZInput.value) || 0;
        const scale = parseFloat(this.modelScaleInput.value) || 1.0;
        
        // 모델 로드
        this.modelManager.loadModel(
            modelId,
            fileURL,
            { x: posX, y: posY, z: posZ },
            scale,
            { x: rotX, y: rotY, z: rotZ }
        ).then(() => {
            // 애니메이션 모델 리스트 업데이트
            this.updateAnimationModelList();
        }).catch(error => {
            console.error('모델 로드 오류:', error);
        });
    }
    
    loadExampleModel(modelType) {
        if (!this.exampleModels[modelType]) {
            this.showWarning(`지원되지 않는 모델 타입: ${modelType}`);
            return;
        }
        
        const modelInfo = this.exampleModels[modelType];
        const modelId = `example-${modelType}`;
        
        // UI 폼에 값 설정
        this.modelIdInput.value = modelId;
        this.modelPosXInput.value = modelInfo.position.x;
        this.modelPosYInput.value = modelInfo.position.y;
        this.modelPosZInput.value = modelInfo.position.z;
        this.modelRotXInput.value = modelInfo.rotation.x;
        this.modelRotYInput.value = modelInfo.rotation.y;
        this.modelRotZInput.value = modelInfo.rotation.z;
        this.modelScaleInput.value = modelInfo.scale;
        
        // 모델 로드
        this.modelManager.loadModel(
            modelId,
            modelInfo.path,
            modelInfo.position,
            modelInfo.scale,
            modelInfo.rotation
        ).then(() => {
            // 애니메이션 모델 리스트 업데이트
            this.updateAnimationModelList();
        }).catch(error => {
            console.error('예시 모델 로드 오류:', error);
        });
    }
    
    updateModelTransform() {
        const modelId = this.modelIdInput.value;
        
        if (!modelId) {
            this.showWarning('업데이트할 모델 ID를 입력하세요');
            return;
        }
        
        // 위치, 회전, 스케일 값 가져오기
        const posX = parseFloat(this.modelPosXInput.value) || 0;
        const posY = parseFloat(this.modelPosYInput.value) || 0;
        const posZ = parseFloat(this.modelPosZInput.value) || 0;
        const rotX = parseFloat(this.modelRotXInput.value) || 0;
        const rotY = parseFloat(this.modelRotYInput.value) || 0;
        const rotZ = parseFloat(this.modelRotZInput.value) || 0;
        const scale = parseFloat(this.modelScaleInput.value) || 1.0;
        
        // 모델 변환 업데이트
        const success = this.modelManager.setModelPosition(modelId, posX, posY, posZ) &&
                        this.modelManager.setModelRotation(modelId, rotX, rotY, rotZ) &&
                        this.modelManager.setModelScale(modelId, scale);
        
        if (success) {
            this.showMessage(`모델 변환 업데이트됨: ${modelId}`);
        } else {
            this.showWarning(`모델을 찾을 수 없음: ${modelId}`);
        }
    }
    
    // 애니메이션 모델 리스트 업데이트
    updateAnimationModelList() {
        if (!this.animationModelSelect) return;
        
        // 기존 옵션 삭제
        while (this.animationModelSelect.firstChild) {
            this.animationModelSelect.removeChild(this.animationModelSelect.firstChild);
        }
        
        // 기본 옵션 추가
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '모델 선택';
        this.animationModelSelect.appendChild(defaultOption);
        
        // 모델 맵에서 모델 ID 가져오기
        const modelIds = Array.from(this.modelManager.models.keys());
        
        // 각 모델에 대한 옵션 추가
        modelIds.forEach(modelId => {
            const option = document.createElement('option');
            option.value = modelId;
            option.textContent = modelId;
            this.animationModelSelect.appendChild(option);
        });
        
        // 애니메이션 리스트 업데이트
        this.updateAnimationList();
    }
    
    // 애니메이션 리스트 업데이트
    updateAnimationList() {
        if (!this.animationNameSelect) return;
        
        // 기존 옵션 삭제
        while (this.animationNameSelect.firstChild) {
            this.animationNameSelect.removeChild(this.animationNameSelect.firstChild);
        }
        
        // 기본 옵션 추가
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '애니메이션 선택';
        this.animationNameSelect.appendChild(defaultOption);
        
        // 선택된 모델 ID 가져오기
        const modelId = this.animationModelSelect.value;
        
        if (!modelId) return;
        
        // 선택된 모델의 애니메이션 목록 가져오기
        const animationNames = this.modelManager.getAnimationNames(modelId);
        
        // 각 애니메이션에 대한 옵션 추가
        animationNames.forEach(animationName => {
            const option = document.createElement('option');
            option.value = animationName;
            option.textContent = animationName;
            this.animationNameSelect.appendChild(option);
        });
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
}