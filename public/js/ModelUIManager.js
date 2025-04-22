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
        
        // 모델 목록 UI 요소
        this.modelsList = document.getElementById('models-list');
        
        // 충돌 감지 토글
        this.collisionToggle = document.getElementById('collision-toggle');
        
        // 애니메이션 제어 UI 요소
        this.animationInfo = document.getElementById('animation-info');
        this.animationSelect = document.getElementById('animation-select');
        this.animationPlayButton = document.getElementById('animation-play');
        this.animationPauseButton = document.getElementById('animation-pause');
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        // 모델 파일 선택 시 모델 ID 자동 생성 및 자동 로드
        if (this.modelFileInput) {
            this.modelFileInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (file) {
                    // 파일명에서 확장자 제거하여 ID 생성
                    const filename = file.name.replace(/\.[^/.]+$/, "");
                    this.modelIdInput.value = filename;
                    
                    // 기본 위치 및 회전 설정
                    this.modelPosXInput.value = 0;
                    this.modelPosYInput.value = 0;
                    this.modelPosZInput.value = 0;
                    this.modelRotXInput.value = 0;
                    this.modelRotYInput.value = 0;
                    this.modelRotZInput.value = 0;
                    this.modelScaleInput.value = 1.0;
                    
                    // 파일 선택 시 자동으로 모델 로드
                    this.loadModelFromInput();
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
                const modelId = parseInt(this.modelIdInput.value);
                if (!isNaN(modelId)) {
                    this.modelManager.removeModel(modelId);
                    this.updateModelList();
                    this.updateAnimationControls(null); // 애니메이션 컨트롤 초기화
                } else {
                    this.showWarning('삭제할 모델 ID를 입력하세요');
                }
            });
        }
        
        // 모든 모델 제거 버튼
        if (this.removeAllModelsButton) {
            this.removeAllModelsButton.addEventListener('click', () => {
                this.modelManager.clearAllModels();
                this.updateModelList();
                this.updateAnimationControls(null); // 애니메이션 컨트롤 초기화
            });
        }
        
        // 충돌 감지 토글
        if (this.collisionToggle) {
            this.collisionToggle.addEventListener('change', (event) => {
                this.modelManager.collisionManager.setEnabled(event.target.checked);
            });
        }
        
        // 애니메이션 선택 변경 이벤트
        if (this.animationSelect) {
            this.animationSelect.addEventListener('change', () => {
                const modelId = this.modelManager.getSelectedModelId();
                if (modelId !== null) {
                    const animIndex = parseInt(this.animationSelect.value);
                    if (animIndex >= 0) {
                        this.modelManager.playAnimation(modelId, animIndex);
                        this.animationPlayButton.disabled = false;
                        this.animationPauseButton.disabled = false;
                    } else {
                        // 애니메이션 없음 선택 시 버튼 비활성화
                        this.animationPlayButton.disabled = true;
                        this.animationPauseButton.disabled = true;
                    }
                }
            });
        }
        
        // 애니메이션 재생 버튼
        if (this.animationPlayButton) {
            this.animationPlayButton.addEventListener('click', () => {
                const modelId = this.modelManager.getSelectedModelId();
                if (modelId !== null) {
                    this.modelManager.toggleAnimation(modelId, true); // true = 재생
                }
            });
        }
        
        // 애니메이션 일시정지 버튼
        if (this.animationPauseButton) {
            this.animationPauseButton.addEventListener('click', () => {
                const modelId = this.modelManager.getSelectedModelId();
                if (modelId !== null) {
                    this.modelManager.toggleAnimation(modelId, false); // false = 일시정지
                }
            });
        }
        
        // 왼쪽으로 90도 회전 버튼
        this.rotateLeft90Button = document.getElementById('rotate-left-90');
        if (this.rotateLeft90Button) {
            this.rotateLeft90Button.addEventListener('click', () => {
                const modelId = this.modelManager.getSelectedModelId();
                if (modelId !== null) {
                    // 현재 모델 참조 저장
                    const model = this.modelManager.getModel(modelId);
                    if (!model) return;
                    
                    // 회전 전 선택 참조 저장
                    const selectedId = this.modelManager.getSelectedModelId();
                    
                    // 왼쪽으로 90도 회전 (-90도)
                    model.root.rotation.y -= Math.PI / 2; // 라디안으로 직접 회전
                    
                    // 회전 후 Y축 값 업데이트
                    this.modelRotYInput.value = THREE.MathUtils.radToDeg(model.root.rotation.y).toFixed(0);
                    
                    // 바운딩 박스 및 충돌 박스 업데이트
                    if (this.modelManager.collisionManager) {
                        this.modelManager.collisionManager.updateModelBoundingBox(model);
                        this.modelManager.collisionManager.checkAllCollisions();
                    }
                    
                    // 선택 상태 강제 유지 (타이밍 이슈 방지를 위해 setTimeout 사용)
                    setTimeout(() => {
                        if (this.modelManager.getSelectedModelId() !== selectedId) {
                            this.modelManager.selectModel(selectedId);
                        }
                        this.updateModelSelection(selectedId);
                    }, 10);
                    
                    this.showMessage(`모델 ${modelId}를 왼쪽으로 90° 회전했습니다`);
                } else {
                    this.showWarning('회전할 모델을 먼저 선택하세요');
                }
            });
        }


        // 오른쪽으로 90도 회전 버튼
        this.rotateRight90Button = document.getElementById('rotate-right-90');
        if (this.rotateRight90Button) {
            this.rotateRight90Button.addEventListener('click', () => {
                const modelId = this.modelManager.getSelectedModelId();
                if (modelId !== null) {
                    // 현재 모델 참조 저장
                    const model = this.modelManager.getModel(modelId);
                    if (!model) return;
                    
                    // 회전 전 선택 참조 저장
                    const selectedId = this.modelManager.getSelectedModelId();
                    
                    // 오른쪽으로 90도 회전 (90도)
                    model.root.rotation.y += Math.PI / 2; // 라디안으로 직접 회전
                    
                    // 회전 후 Y축 값 업데이트
                    this.modelRotYInput.value = THREE.MathUtils.radToDeg(model.root.rotation.y).toFixed(0);
                    
                    // 바운딩 박스 및 충돌 박스 업데이트
                    if (this.modelManager.collisionManager) {
                        this.modelManager.collisionManager.updateModelBoundingBox(model);
                        this.modelManager.collisionManager.checkAllCollisions();
                    }
                    
                    // 선택 상태 강제 유지 (타이밍 이슈 방지를 위해 setTimeout 사용)
                    setTimeout(() => {
                        if (this.modelManager.getSelectedModelId() !== selectedId) {
                            this.modelManager.selectModel(selectedId);
                        }
                        this.updateModelSelection(selectedId);
                    }, 10);
                    
                    this.showMessage(`모델 ${modelId}를 오른쪽으로 90° 회전했습니다`);
                } else {
                    this.showWarning('회전할 모델을 먼저 선택하세요');
                }
            });
        }
         
        // 모델 선택 콜백 설정
        this.modelManager.setCallbacks(
            (model) => this.handleModelLoaded(model),
            (modelId) => this.handleModelSelected(modelId),
            () => this.updateModelList()
        );
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
        this.modelManager.loadModel(fileURL, modelId);
    }
    
    updateModelTransform() {
        const modelId = parseInt(this.modelIdInput.value);
        if (isNaN(modelId)) {
            this.showWarning('업데이트할 모델 ID를 입력하세요');
            return;
        }
        
        const model = this.modelManager.getModel(modelId);
        if (!model) {
            this.showWarning(`모델 ID ${modelId}를 찾을 수 없습니다`);
            return;
        }
        
        // 위치, 회전, 스케일 값 가져오기
        const posX = parseFloat(this.modelPosXInput.value);
        const posY = parseFloat(this.modelPosYInput.value);
        const posZ = parseFloat(this.modelPosZInput.value);
        const rotX = parseFloat(this.modelRotXInput.value);
        const rotY = parseFloat(this.modelRotYInput.value);
        const rotZ = parseFloat(this.modelRotZInput.value);
        const scale = parseFloat(this.modelScaleInput.value);
        
        // 위치 업데이트
        if (!isNaN(posX)) {
            this.modelManager.updateModelPosition(modelId, 'x', posX);
        }
        
        if (!isNaN(posZ)) {
            this.modelManager.updateModelPosition(modelId, 'z', posZ);
        }
        
        // Y 위치는 항상 0으로 설정 (바닥 위에 놓음)
        this.modelManager.updateModelPosition(modelId, 'y', 0);
        
        // 회전 업데이트
        if (!isNaN(rotY)) {
            // Y축 회전만 적용 (바닥 평면에서는 Y축 회전만 의미가 있음)
            model.root.rotation.y = THREE.MathUtils.degToRad(rotY);
        }
        
        // 스케일 업데이트
        if (!isNaN(scale) && scale > 0) {
            this.modelManager.setModelScale(modelId, scale);
        }
        
        // 바운딩 박스 업데이트
        this.modelManager.collisionManager.updateModelBoundingBox(model);
        
        // 충돌 체크
        this.modelManager.collisionManager.checkAllCollisions();
        
        // 선택 상자 업데이트
        if (this.modelManager.selectedModelId === modelId && this.modelManager.selectionBox.visible) {
            this.modelManager.selectionBox.update();
        }
        
        this.showMessage(`모델 ${modelId} 변환이 업데이트되었습니다`);
    }
    
    handleModelLoaded(model) {
        this.updateModelList();
        
        // 모델에 애니메이션이 있는지 확인
        if (model.animations && model.animations.length > 0) {
            this.showMessage(`모델 ${model.id}에 ${model.animations.length}개의 애니메이션이 있습니다`);
        }
    }
    
    handleModelSelected(modelId) {
        this.updateModelSelection(modelId);
        
        if (modelId !== null) {
            const model = this.modelManager.getModel(modelId);
            if (model) {
                // UI 필드 업데이트
                this.modelIdInput.value = model.id;
                this.modelPosXInput.value = model.root.position.x.toFixed(2);
                this.modelPosYInput.value = model.root.position.y.toFixed(2);
                this.modelPosZInput.value = model.root.position.z.toFixed(2);
                
                // 회전값은 라디안에서 각도로 변환
                this.modelRotXInput.value = THREE.MathUtils.radToDeg(model.root.rotation.x).toFixed(0);
                this.modelRotYInput.value = THREE.MathUtils.radToDeg(model.root.rotation.y).toFixed(0);
                this.modelRotZInput.value = THREE.MathUtils.radToDeg(model.root.rotation.z).toFixed(0);
                
                this.modelScaleInput.value = model.root.scale.x.toFixed(2);
                
                // 애니메이션 컨트롤 업데이트
                this.updateAnimationControls(model);
            }
        } else {
            // 선택 해제 시 애니메이션 컨트롤 초기화
            this.updateAnimationControls(null);
        }
    }
    
    // 애니메이션 컨트롤 업데이트
    updateAnimationControls(model) {
        // 애니메이션 선택 드롭다운 초기화
        if (this.animationSelect) {
            this.animationSelect.innerHTML = '<option value="-1">애니메이션 없음</option>';
            this.animationSelect.disabled = true;
        }
        
        // 애니메이션 정보 패널 업데이트
        if (this.animationInfo) {
            this.animationInfo.textContent = '선택된 모델 없음';
        }
        
        // 애니메이션 버튼 비활성화
        if (this.animationPlayButton) {
            this.animationPlayButton.disabled = true;
        }
        
        if (this.animationPauseButton) {
            this.animationPauseButton.disabled = true;
        }
        
        // 모델이 선택된 경우 애니메이션 컨트롤 업데이트
        if (model) {
            // 애니메이션 정보 업데이트
            if (this.animationInfo) {
                if (model.animations && model.animations.length > 0) {
                    this.animationInfo.textContent = `모델 ${model.id}: ${model.animations.length}개의 애니메이션 있음`;
                } else {
                    this.animationInfo.textContent = `모델 ${model.id}: 애니메이션 없음`;
                }
            }
            
            // 애니메이션이 있는 경우 드롭다운 활성화 및 옵션 추가
            if (model.animations && model.animations.length > 0 && this.animationSelect) {
                this.animationSelect.disabled = false;
                
                // 애니메이션 옵션 추가
                model.animations.forEach((anim, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = anim.name || `애니메이션 ${index + 1}`;
                    this.animationSelect.appendChild(option);
                });
                
                // 현재 실행 중인 애니메이션이 있으면 선택
                if (model.currentAction) {
                    // 현재 액션의 인덱스 찾기
                    const currentAnimIndex = model.animations.findIndex(
                        anim => model.currentAction.getClip().name === anim.name
                    );
                    
                    if (currentAnimIndex >= 0) {
                        this.animationSelect.value = currentAnimIndex;
                        this.animationPlayButton.disabled = false;
                        this.animationPauseButton.disabled = false;
                    }
                }
            }
        }
    }
    
    updateModelList() {
        const models = this.modelManager.getAllModels();
        const selectedModelId = this.modelManager.getSelectedModelId();
        
        if (!this.modelsList) return;
        
        this.modelsList.innerHTML = '';
        
        if (models.length === 0) {
            this.modelsList.innerHTML = '<p>로드된 모델이 없습니다.</p>';
            return;
        }
        
        models.forEach(model => {
            const modelElement = document.createElement('div');
            modelElement.className = 'model-item';
            
            if (selectedModelId === model.id) {
                modelElement.classList.add('selected');
            }
            
            if (model.isColliding) {
                modelElement.classList.add('collision');
            }
            
            modelElement.setAttribute('data-model-id', model.id);
            modelElement.addEventListener('click', () => {
                this.modelManager.selectModel(model.id);
            });
            
            // 모델 정보
            const modelInfo = document.createElement('div');
            modelInfo.className = 'model-info';
            modelInfo.innerHTML = `
                <div><strong>ID:</strong> ${model.id}</div>
                <div><strong>이름:</strong> ${model.name}</div>
                <div><strong>위치:</strong> X=${model.root.position.x.toFixed(2)}, 
                                  Z=${model.root.position.z.toFixed(2)}</div>
                <div><strong>크기:</strong> ${model.root.scale.x.toFixed(2)}x</div>
            `;
            
            // 애니메이션 정보 추가
            if (model.animations && model.animations.length > 0) {
                const animInfo = document.createElement('div');
                animInfo.innerHTML = `<strong>애니메이션:</strong> ${model.animations.length}개`;
                modelInfo.appendChild(animInfo);
            }
            
            modelElement.appendChild(modelInfo);
            
            // 버튼 컨테이너
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'button-container';
            
            // 모델 삭제 버튼
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '삭제';
            removeBtn.className = 'inline-button';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 버블링 방지
                this.modelManager.removeModel(model.id);
                this.updateModelList();
            });
            
            // 선택 버튼
            const selectBtn = document.createElement('button');
            selectBtn.textContent = '선택';
            selectBtn.className = 'inline-button';
            selectBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 버블링 방지
                this.modelManager.selectModel(model.id);
            });
            
            buttonContainer.appendChild(selectBtn);
            buttonContainer.appendChild(removeBtn);
            
            // 애니메이션 버튼 추가 (모델에 애니메이션이 있는 경우)
            if (model.animations && model.animations.length > 0) {
                // 애니메이션 재생 버튼
                const playBtn = document.createElement('button');
                playBtn.textContent = '▶';
                playBtn.className = 'inline-button';
                playBtn.title = '애니메이션 재생';
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.modelManager.toggleAnimation(model.id, true);
                });
                
                // 애니메이션 일시정지 버튼
                const pauseBtn = document.createElement('button');
                pauseBtn.textContent = '❚❚';
                pauseBtn.className = 'inline-button';
                pauseBtn.title = '애니메이션 일시정지';
                pauseBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.modelManager.toggleAnimation(model.id, false);
                });
                
                buttonContainer.appendChild(playBtn);
                buttonContainer.appendChild(pauseBtn);
            }
            
            modelElement.appendChild(buttonContainer);
            this.modelsList.appendChild(modelElement);
        });
    }
    
    updateModelSelection(modelId) {
        document.querySelectorAll('.model-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        if (modelId !== null) {
            const modelElement = document.querySelector(`.model-item[data-model-id="${modelId}"]`);
            if (modelElement) {
                modelElement.classList.add('selected');
                modelElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }
    
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