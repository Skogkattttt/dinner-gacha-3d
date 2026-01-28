// ============== 設定 ==============
const CAPSULE_COLORS = [
    0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3,
    0xf38181, 0xaa96da, 0xfcbad3, 0xa8d8ea,
    0xff9a9e, 0xfad0c4, 0xa18cd1, 0xfbc2eb
];

const DEFAULT_OPTIONS = [
    '火鍋', '壽司', '拉麵', '滷肉飯', '牛排',
    '義大利麵', '披薩', '炒飯', '咖哩', '便當',
    '漢堡', '鹹酥雞', '水餃', '麻辣燙', '燒烤'
];

// ============== 狀態 ==============
let options = [];
let editingIndex = -1;
let isAnimating = false;
let capsuleBodies = [];
let capsuleMeshes = [];
let droppedCapsule = null;
let droppedCapsuleBody = null;
let selectedResult = null;

// ============== Three.js ==============
let scene, camera, renderer, controls;
let machine, glassDome;

// ============== Cannon.js ==============
let world;
let machineBodies = [];

// ============== 初始化 ==============
function init() {
    loadOptions();
    setupThree();
    setupCannon();
    createMachine();
    createGround();
    fillCapsules();
    setupEventListeners();
    renderOptionsList();
    animate();
}

// ============== Three.js 設定 ==============
function setupThree() {
    const container = document.getElementById('canvas-container');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 3, 8);
    camera.lookAt(0, 1, 0);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    
    // 燈光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    const pointLight = new THREE.PointLight(0xffe66d, 0.5, 20);
    pointLight.position.set(-3, 5, 3);
    scene.add(pointLight);
    
    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============== Cannon.js 設定 ==============
function setupCannon() {
    world = new CANNON.World();
    world.gravity.set(0, -15, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 10;
    
    // 材質
    world.defaultContactMaterial.friction = 0.3;
    world.defaultContactMaterial.restitution = 0.4;
}

// ============== 創建扭蛋機 ==============
function createMachine() {
    machine = new THREE.Group();
    
    // 玻璃球罩 (透明)
    const domeGeometry = new THREE.SphereGeometry(1.8, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
        roughness: 0,
        metalness: 0,
        side: THREE.DoubleSide
    });
    glassDome = new THREE.Mesh(domeGeometry, domeMaterial);
    glassDome.position.y = 2.5;
    glassDome.rotation.x = Math.PI;
    machine.add(glassDome);
    
    // 球罩底座
    const baseRingGeometry = new THREE.TorusGeometry(1.8, 0.15, 16, 32);
    const redMaterial = new THREE.MeshStandardMaterial({ color: 0xc0392b });
    const baseRing = new THREE.Mesh(baseRingGeometry, redMaterial);
    baseRing.position.y = 2.5;
    baseRing.rotation.x = Math.PI / 2;
    machine.add(baseRing);
    
    // 機身
    const bodyGeometry = new THREE.CylinderGeometry(1.9, 2.1, 1.5, 32);
    const body = new THREE.Mesh(bodyGeometry, redMaterial);
    body.position.y = 1.5;
    body.castShadow = true;
    machine.add(body);
    
    // 出口斜坡
    const rampGeometry = new THREE.BoxGeometry(1, 0.1, 1.5);
    const rampMaterial = new THREE.MeshStandardMaterial({ color: 0x922b21 });
    const ramp = new THREE.Mesh(rampGeometry, rampMaterial);
    ramp.position.set(0, 0.6, 1.8);
    ramp.rotation.x = 0.3;
    machine.add(ramp);
    
    // 出口洞
    const holeGeometry = new THREE.CircleGeometry(0.5, 32);
    const holeMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a2e });
    const hole = new THREE.Mesh(holeGeometry, holeMaterial);
    hole.position.set(0, 0.75, 1.05);
    hole.rotation.x = -Math.PI / 2 + 0.1;
    machine.add(hole);
    
    // 底座
    const platformGeometry = new THREE.CylinderGeometry(2.3, 2.5, 0.8, 32);
    const platform = new THREE.Mesh(platformGeometry, redMaterial);
    platform.position.y = 0.4;
    platform.castShadow = true;
    machine.add(platform);
    
    // 按鈕
    const buttonGeometry = new THREE.CylinderGeometry(0.4, 0.45, 0.2, 32);
    const buttonMaterial = new THREE.MeshStandardMaterial({ color: 0xf1c40f });
    const button = new THREE.Mesh(buttonGeometry, buttonMaterial);
    button.position.set(0, 1.6, 1.95);
    button.rotation.x = Math.PI / 2;
    machine.add(button);
    
    scene.add(machine);
    
    // 物理碗形容器
    createMachinePhysics();
}

function createMachinePhysics() {
    // 碗底
    const bowlBottom = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Sphere(0.3),
        position: new CANNON.Vec3(0, 2.6, 0)
    });
    world.addBody(bowlBottom);
    machineBodies.push(bowlBottom);
    
    // 碗壁 (用多個平面模擬)
    const wallCount = 16;
    for (let i = 0; i < wallCount; i++) {
        const angle = (i / wallCount) * Math.PI * 2;
        const x = Math.cos(angle) * 1.6;
        const z = Math.sin(angle) * 1.6;
        
        const wall = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Box(new CANNON.Vec3(0.4, 1, 0.05)),
            position: new CANNON.Vec3(x, 3.2, z)
        });
        wall.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -angle);
        world.addBody(wall);
        machineBodies.push(wall);
    }
    
    // 底板 (有洞)
    const floorShape = new CANNON.Box(new CANNON.Vec3(1.8, 0.1, 1.8));
    const floor = new CANNON.Body({
        mass: 0,
        shape: floorShape,
        position: new CANNON.Vec3(0, 2.45, 0)
    });
    world.addBody(floor);
    machineBodies.push(floor);
}

// ============== 創建地面 ==============
function createGround() {
    // 視覺地面
    const groundGeometry = new THREE.PlaneGeometry(30, 30);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2c3e50,
        roughness: 0.8
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // 物理地面
    const groundBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Plane()
    });
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(groundBody);
    
    // 斜坡物理
    const rampBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.05, 0.75))
    });
    rampBody.position.set(0, 0.6, 1.8);
    rampBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), 0.3);
    world.addBody(rampBody);
}

// ============== 創建扭蛋 ==============
function createCapsule(x, y, z, colorIndex) {
    const color = CAPSULE_COLORS[colorIndex % CAPSULE_COLORS.length];
    
    // 視覺 - 扭蛋 (兩個半球)
    const capsuleGroup = new THREE.Group();
    
    const topGeometry = new THREE.SphereGeometry(0.25, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const topMaterial = new THREE.MeshStandardMaterial({ color: color });
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.rotation.x = Math.PI;
    top.position.y = 0.02;
    capsuleGroup.add(top);
    
    const bottomGeometry = new THREE.SphereGeometry(0.25, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const bottomMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f5f5 });
    const bottom = new THREE.Mesh(bottomGeometry, bottomMaterial);
    bottom.position.y = -0.02;
    capsuleGroup.add(bottom);
    
    // 中間線
    const ringGeometry = new THREE.TorusGeometry(0.25, 0.02, 8, 32);
    const ringMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    capsuleGroup.add(ring);
    
    capsuleGroup.position.set(x, y, z);
    capsuleGroup.castShadow = true;
    capsuleGroup.userData = { colorIndex: colorIndex };
    scene.add(capsuleGroup);
    
    // 物理
    const capsuleBody = new CANNON.Body({
        mass: 1,
        shape: new CANNON.Sphere(0.25),
        position: new CANNON.Vec3(x, y, z),
        linearDamping: 0.3,
        angularDamping: 0.3
    });
    world.addBody(capsuleBody);
    
    return { mesh: capsuleGroup, body: capsuleBody };
}

// ============== 填充扭蛋 ==============
function fillCapsules() {
    // 清除現有扭蛋
    capsuleMeshes.forEach(mesh => scene.remove(mesh));
    capsuleBodies.forEach(body => world.removeBody(body));
    capsuleMeshes = [];
    capsuleBodies = [];
    
    // 填充新扭蛋
    const count = Math.min(options.length, 15);
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 1.2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = 3.5 + Math.random() * 1.5;
        
        const { mesh, body } = createCapsule(x, y, z, i);
        capsuleMeshes.push(mesh);
        capsuleBodies.push(body);
    }
    
    updateHint();
}

// ============== 扭蛋！ ==============
function pullGacha() {
    if (isAnimating || capsuleMeshes.length === 0) {
        if (capsuleMeshes.length === 0) {
            document.getElementById('hint').textContent = '扭蛋機空了！請補充扭蛋';
        }
        return;
    }
    
    if (options.length === 0) {
        alert('請先新增一些選項！');
        document.getElementById('settingsPanel').classList.add('show');
        return;
    }
    
    isAnimating = true;
    document.getElementById('gachaBtn').disabled = true;
    document.getElementById('hint').textContent = '扭蛋中...';
    
    // 隨機選一顆扭蛋
    const randomIndex = Math.floor(Math.random() * capsuleMeshes.length);
    const selectedMesh = capsuleMeshes[randomIndex];
    const selectedBody = capsuleBodies[randomIndex];
    
    // 記錄結果
    const optionIndex = selectedMesh.userData.colorIndex % options.length;
    selectedResult = options[optionIndex];
    
    // 從陣列移除
    capsuleMeshes.splice(randomIndex, 1);
    capsuleBodies.splice(randomIndex, 1);
    
    // 搖晃其他扭蛋
    capsuleBodies.forEach(body => {
        body.applyImpulse(
            new CANNON.Vec3((Math.random() - 0.5) * 5, 3, (Math.random() - 0.5) * 5),
            body.position
        );
    });
    
    // 把選中的扭蛋移到出口
    setTimeout(() => {
        // 移除物理約束，讓它掉出來
        world.removeBody(selectedBody);
        
        // 創建新的物理體在出口位置
        droppedCapsuleBody = new CANNON.Body({
            mass: 1,
            shape: new CANNON.Sphere(0.25),
            position: new CANNON.Vec3(0, 1.2, 1.5),
            linearDamping: 0.4,
            angularDamping: 0.4
        });
        droppedCapsuleBody.velocity.set(0, -2, 3);
        world.addBody(droppedCapsuleBody);
        
        droppedCapsule = selectedMesh;
        droppedCapsule.userData.clickable = true;
        droppedCapsule.userData.result = selectedResult;
        
        document.getElementById('hint').textContent = '點擊扭蛋打開！';
        
        // 等扭蛋停止後啟用點擊
        setTimeout(() => {
            isAnimating = false;
            document.getElementById('gachaBtn').disabled = false;
        }, 2000);
        
    }, 800);
}

// ============== 點擊扭蛋 ==============
function onCapsuleClick(event) {
    if (!droppedCapsule) return;
    
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    const intersects = raycaster.intersectObject(droppedCapsule, true);
    
    if (intersects.length > 0 && droppedCapsule.userData.clickable) {
        openCapsule();
    }
}

function openCapsule() {
    if (!droppedCapsule) return;
    
    droppedCapsule.userData.clickable = false;
    
    // 打開動畫
    const top = droppedCapsule.children[0];
    const duration = 500;
    const startTime = Date.now();
    
    function animateOpen() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        top.position.y = 0.02 + progress * 0.5;
        top.rotation.z = progress * Math.PI * 0.3;
        
        if (progress < 1) {
            requestAnimationFrame(animateOpen);
        } else {
            // 顯示結果
            showResult(droppedCapsule.userData.result);
        }
    }
    
    animateOpen();
}

function showResult(result) {
    document.getElementById('resultText').textContent = result;
    document.getElementById('resultModal').classList.add('show');
}

function closeResult() {
    document.getElementById('resultModal').classList.remove('show');
    
    // 移除掉落的扭蛋
    if (droppedCapsule) {
        scene.remove(droppedCapsule);
        if (droppedCapsuleBody) {
            world.removeBody(droppedCapsuleBody);
        }
        droppedCapsule = null;
        droppedCapsuleBody = null;
    }
    
    updateHint();
}

function updateHint() {
    const hint = document.getElementById('hint');
    if (capsuleMeshes.length === 0) {
        hint.textContent = '扭蛋機空了！請補充扭蛋';
    } else {
        hint.textContent = `剩餘 ${capsuleMeshes.length} 顆扭蛋`;
    }
}

// ============== 動畫循環 ==============
function animate() {
    requestAnimationFrame(animate);
    
    // 更新物理
    world.step(1/60);
    
    // 同步視覺與物理
    for (let i = 0; i < capsuleMeshes.length; i++) {
        capsuleMeshes[i].position.copy(capsuleBodies[i].position);
        capsuleMeshes[i].quaternion.copy(capsuleBodies[i].quaternion);
    }
    
    // 同步掉落的扭蛋
    if (droppedCapsule && droppedCapsuleBody) {
        droppedCapsule.position.copy(droppedCapsuleBody.position);
        droppedCapsule.quaternion.copy(droppedCapsuleBody.quaternion);
    }
    
    renderer.render(scene, camera);
}

// ============== 選項管理 ==============
function loadOptions() {
    const saved = localStorage.getItem('dinnerOptions3D');
    if (saved) {
        options = JSON.parse(saved);
    } else {
        options = [...DEFAULT_OPTIONS];
        saveOptions();
    }
}

function saveOptions() {
    localStorage.setItem('dinnerOptions3D', JSON.stringify(options));
}

function renderOptionsList() {
    const list = document.getElementById('optionsList');
    
    if (options.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="emoji">🍽️</div>
                <p>還沒有任何選項</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = options.map((opt, index) => `
        <li>
            <span class="option-text">${escapeHtml(opt)}</span>
            <div class="option-actions">
                <button class="edit-btn" data-index="${index}">✏️</button>
                <button class="delete-btn" data-index="${index}">🗑️</button>
            </div>
        </li>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function addOption() {
    const input = document.getElementById('newOption');
    const value = input.value.trim();
    
    if (!value) return;
    if (options.includes(value)) {
        alert('這個選項已經存在了！');
        return;
    }
    
    options.push(value);
    saveOptions();
    renderOptionsList();
    input.value = '';
}

function deleteOption(index) {
    if (confirm(`確定要刪除「${options[index]}」嗎？`)) {
        options.splice(index, 1);
        saveOptions();
        renderOptionsList();
    }
}

function openEditModal(index) {
    editingIndex = index;
    document.getElementById('editInput').value = options[index];
    document.getElementById('editModal').classList.add('show');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
    editingIndex = -1;
}

function saveEdit() {
    const value = document.getElementById('editInput').value.trim();
    if (!value) return;
    
    if (options.includes(value) && options[editingIndex] !== value) {
        alert('這個選項已經存在了！');
        return;
    }
    
    options[editingIndex] = value;
    saveOptions();
    renderOptionsList();
    closeEditModal();
}

function loadDefaults() {
    if (confirm('這會清除目前所有選項並載入預設值，確定嗎？')) {
        options = [...DEFAULT_OPTIONS];
        saveOptions();
        renderOptionsList();
    }
}

// ============== 事件監聽 ==============
function setupEventListeners() {
    // 扭蛋按鈕
    document.getElementById('gachaBtn').addEventListener('click', pullGacha);
    
    // 設定面板
    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.getElementById('settingsPanel').classList.add('show');
    });
    document.getElementById('closeSettings').addEventListener('click', () => {
        document.getElementById('settingsPanel').classList.remove('show');
    });
    
    // 新增選項
    document.getElementById('addOptionBtn').addEventListener('click', addOption);
    document.getElementById('newOption').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addOption();
    });
    
    // 選項列表事件委派
    document.getElementById('optionsList').addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const index = parseInt(btn.dataset.index);
        if (btn.classList.contains('edit-btn')) openEditModal(index);
        if (btn.classList.contains('delete-btn')) deleteOption(index);
    });
    
    // 編輯對話框
    document.getElementById('saveEdit').addEventListener('click', saveEdit);
    document.getElementById('cancelEdit').addEventListener('click', closeEditModal);
    document.getElementById('editInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveEdit();
    });
    
    // 預設/補充
    document.getElementById('loadDefaults').addEventListener('click', loadDefaults);
    document.getElementById('refillMachine').addEventListener('click', fillCapsules);
    
    // 結果
    document.getElementById('closeResult').addEventListener('click', closeResult);
    document.getElementById('resultModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('resultModal')) closeResult();
    });
    
    // 點擊扭蛋
    renderer.domElement.addEventListener('click', onCapsuleClick);
}

// ============== 啟動 ==============
init();
