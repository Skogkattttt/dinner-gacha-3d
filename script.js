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

// ============== 全域變數 ==============
let options = [];
let editingIndex = -1;
let isAnimating = false;

// Three.js
let scene, camera, renderer;
let capsuleMeshes = [];
let droppedCapsule = null;
let selectedResult = null;

// Cannon.js
let world;
let capsuleBodies = [];
let droppedCapsuleBody = null;
let groundBody, bowlBody;

// ============== 初始化 ==============
document.addEventListener('DOMContentLoaded', () => {
    try {
        loadOptions();
        initThree();
        initCannon();
        createScene();
        fillCapsules();
        setupUI();
        animate();
        console.log('初始化完成');
    } catch (e) {
        console.error('初始化錯誤:', e);
        alert('載入錯誤: ' + e.message);
    }
});

// ============== Three.js 初始化 ==============
function initThree() {
    const container = document.getElementById('canvas-container');
    
    // 場景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    
    // 相機
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 2, 0);
    
    // 渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    
    // 燈光
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);
    
    // 視窗調整
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // 點擊事件
    renderer.domElement.addEventListener('click', onCanvasClick);
}

// ============== Cannon.js 初始化 ==============
function initCannon() {
    world = new CANNON.World();
    world.gravity.set(0, -20, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 10;
    
    // 預設材質
    const defaultMaterial = new CANNON.Material('default');
    const contactMaterial = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
        friction: 0.4,
        restitution: 0.3
    });
    world.addContactMaterial(contactMaterial);
    world.defaultContactMaterial = contactMaterial;
}

// ============== 創建場景 ==============
function createScene() {
    // === 地面 ===
    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(new CANNON.Plane());
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(groundBody);
    
    // === 扭蛋機 ===
    const machineGroup = new THREE.Group();
    
    // 底座
    const baseGeo = new THREE.CylinderGeometry(2, 2.2, 1, 32);
    const redMat = new THREE.MeshStandardMaterial({ color: 0xc0392b });
    const base = new THREE.Mesh(baseGeo, redMat);
    base.position.y = 0.5;
    base.castShadow = true;
    machineGroup.add(base);
    
    // 機身
    const bodyGeo = new THREE.CylinderGeometry(1.8, 1.9, 1.2, 32);
    const body = new THREE.Mesh(bodyGeo, redMat);
    body.position.y = 1.6;
    body.castShadow = true;
    machineGroup.add(body);
    
    // 玻璃球罩
    const domeGeo = new THREE.SphereGeometry(1.8, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const domeMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.25,
        roughness: 0,
        metalness: 0.1,
        side: THREE.DoubleSide
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 3.2;
    dome.rotation.x = Math.PI;
    machineGroup.add(dome);
    
    // 球罩邊框
    const ringGeo = new THREE.TorusGeometry(1.8, 0.1, 16, 32);
    const ring = new THREE.Mesh(ringGeo, redMat);
    ring.position.y = 2.2;
    ring.rotation.x = Math.PI / 2;
    machineGroup.add(ring);
    
    // 出口斜坡
    const rampGeo = new THREE.BoxGeometry(1.2, 0.15, 2);
    const darkRedMat = new THREE.MeshStandardMaterial({ color: 0x922b21 });
    const ramp = new THREE.Mesh(rampGeo, darkRedMat);
    ramp.position.set(0, 0.8, 2);
    ramp.rotation.x = 0.25;
    machineGroup.add(ramp);
    
    // 出口洞口視覺
    const holeGeo = new THREE.CircleGeometry(0.45, 32);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x111122 });
    const hole = new THREE.Mesh(holeGeo, holeMat);
    hole.position.set(0, 1.05, 1.02);
    hole.rotation.x = -0.1;
    machineGroup.add(hole);
    
    // 按鈕裝飾
    const btnGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.15, 32);
    const btnMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f });
    const btn = new THREE.Mesh(btnGeo, btnMat);
    btn.position.set(0, 1.7, 1.85);
    btn.rotation.x = Math.PI / 2;
    machineGroup.add(btn);
    
    scene.add(machineGroup);
    
    // === 物理碗 (容納扭蛋) ===
    // 碗底
    const bowlFloor = new CANNON.Body({ mass: 0 });
    bowlFloor.addShape(new CANNON.Box(new CANNON.Vec3(1.5, 0.1, 1.5)));
    bowlFloor.position.set(0, 2.25, 0);
    world.addBody(bowlFloor);
    
    // 碗壁 (圓形排列)
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const wallBody = new CANNON.Body({ mass: 0 });
        wallBody.addShape(new CANNON.Box(new CANNON.Vec3(0.5, 0.8, 0.1)));
        wallBody.position.set(Math.cos(angle) * 1.5, 3.0, Math.sin(angle) * 1.5);
        wallBody.quaternion.setFromEuler(0, -angle, 0);
        world.addBody(wallBody);
    }
    
    // 斜坡物理
    const rampBody = new CANNON.Body({ mass: 0 });
    rampBody.addShape(new CANNON.Box(new CANNON.Vec3(0.6, 0.08, 1)));
    rampBody.position.set(0, 0.75, 2);
    rampBody.quaternion.setFromEuler(0.25, 0, 0);
    world.addBody(rampBody);
}

// ============== 創建扭蛋 ==============
function createCapsule(x, y, z, colorIndex) {
    const color = CAPSULE_COLORS[colorIndex % CAPSULE_COLORS.length];
    
    // Three.js 視覺
    const group = new THREE.Group();
    
    // 上半球 (彩色)
    const topGeo = new THREE.SphereGeometry(0.28, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const topMat = new THREE.MeshStandardMaterial({ color: color });
    const top = new THREE.Mesh(topGeo, topMat);
    top.rotation.x = Math.PI;
    top.position.y = 0.03;
    group.add(top);
    
    // 下半球 (白色)
    const botGeo = new THREE.SphereGeometry(0.28, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const botMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0 });
    const bot = new THREE.Mesh(botGeo, botMat);
    bot.position.y = -0.03;
    group.add(bot);
    
    // 中間線
    const lineGeo = new THREE.TorusGeometry(0.28, 0.025, 8, 32);
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.x = Math.PI / 2;
    group.add(line);
    
    group.position.set(x, y, z);
    group.castShadow = true;
    group.userData = { colorIndex, color };
    scene.add(group);
    
    // Cannon.js 物理
    const body = new CANNON.Body({
        mass: 1,
        shape: new CANNON.Sphere(0.28),
        position: new CANNON.Vec3(x, y, z),
        linearDamping: 0.3,
        angularDamping: 0.5
    });
    world.addBody(body);
    
    return { mesh: group, body };
}

// ============== 填充扭蛋 ==============
function fillCapsules() {
    // 清除舊的
    capsuleMeshes.forEach(m => scene.remove(m));
    capsuleBodies.forEach(b => world.removeBody(b));
    capsuleMeshes = [];
    capsuleBodies = [];
    
    // 新增扭蛋
    const count = Math.min(options.length, 12);
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.8;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const y = 3.5 + i * 0.6;
        
        const { mesh, body } = createCapsule(x, y, z, i);
        capsuleMeshes.push(mesh);
        capsuleBodies.push(body);
    }
    
    updateHint();
}

// ============== 扭蛋動作 ==============
function pullGacha() {
    if (isAnimating) return;
    
    if (capsuleMeshes.length === 0) {
        document.getElementById('hint').textContent = '扭蛋機空了！請點設定補充';
        return;
    }
    
    if (options.length === 0) {
        document.getElementById('settingsPanel').classList.add('show');
        return;
    }
    
    isAnimating = true;
    document.getElementById('gachaBtn').disabled = true;
    document.getElementById('hint').textContent = '扭蛋中...';
    
    // 搖晃所有扭蛋
    capsuleBodies.forEach(b => {
        b.applyImpulse(
            new CANNON.Vec3((Math.random() - 0.5) * 8, 5, (Math.random() - 0.5) * 8),
            b.position
        );
    });
    
    // 選一顆扭蛋
    setTimeout(() => {
        const idx = Math.floor(Math.random() * capsuleMeshes.length);
        const mesh = capsuleMeshes.splice(idx, 1)[0];
        const body = capsuleBodies.splice(idx, 1)[0];
        
        // 決定結果
        const optIdx = mesh.userData.colorIndex % options.length;
        selectedResult = options[optIdx];
        
        // 移除物理並重新創建在出口
        world.removeBody(body);
        
        droppedCapsuleBody = new CANNON.Body({
            mass: 1,
            shape: new CANNON.Sphere(0.28),
            position: new CANNON.Vec3(0, 1.3, 1.5),
            linearDamping: 0.4,
            angularDamping: 0.5
        });
        droppedCapsuleBody.velocity.set((Math.random() - 0.5) * 2, -1, 4);
        world.addBody(droppedCapsuleBody);
        
        droppedCapsule = mesh;
        droppedCapsule.userData.clickable = false;
        droppedCapsule.userData.result = selectedResult;
        
        // 等扭蛋落地穩定
        setTimeout(() => {
            droppedCapsule.userData.clickable = true;
            document.getElementById('hint').textContent = '👆 點擊扭蛋打開！';
            isAnimating = false;
            document.getElementById('gachaBtn').disabled = false;
        }, 2000);
        
    }, 600);
}

// ============== 點擊處理 ==============
function onCanvasClick(event) {
    if (!droppedCapsule || !droppedCapsule.userData.clickable) return;
    
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    const intersects = raycaster.intersectObject(droppedCapsule, true);
    if (intersects.length > 0) {
        openCapsule();
    }
}

function openCapsule() {
    if (!droppedCapsule) return;
    droppedCapsule.userData.clickable = false;
    
    // 打開動畫 - 上蓋飛起
    const topHalf = droppedCapsule.children[0];
    let frame = 0;
    
    function animateOpen() {
        frame++;
        topHalf.position.y += 0.03;
        topHalf.rotation.x += 0.05;
        topHalf.rotation.z += 0.02;
        
        if (frame < 30) {
            requestAnimationFrame(animateOpen);
        } else {
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
    
    if (droppedCapsule) {
        scene.remove(droppedCapsule);
        droppedCapsule = null;
    }
    if (droppedCapsuleBody) {
        world.removeBody(droppedCapsuleBody);
        droppedCapsuleBody = null;
    }
    
    updateHint();
}

function updateHint() {
    const hint = document.getElementById('hint');
    if (capsuleMeshes.length === 0) {
        hint.textContent = '扭蛋機空了！點右上角 ⚙️ 補充';
    } else {
        hint.textContent = `剩餘 ${capsuleMeshes.length} 顆`;
    }
}

// ============== 動畫循環 ==============
function animate() {
    requestAnimationFrame(animate);
    
    // 物理更新
    world.step(1 / 60);
    
    // 同步 Three.js 與 Cannon.js
    for (let i = 0; i < capsuleMeshes.length; i++) {
        if (capsuleBodies[i]) {
            capsuleMeshes[i].position.copy(capsuleBodies[i].position);
            capsuleMeshes[i].quaternion.copy(capsuleBodies[i].quaternion);
        }
    }
    
    if (droppedCapsule && droppedCapsuleBody) {
        droppedCapsule.position.copy(droppedCapsuleBody.position);
        droppedCapsule.quaternion.copy(droppedCapsuleBody.quaternion);
    }
    
    renderer.render(scene, camera);
}

// ============== 選項管理 ==============
function loadOptions() {
    const saved = localStorage.getItem('dinnerOptions3D');
    options = saved ? JSON.parse(saved) : [...DEFAULT_OPTIONS];
    saveOptions();
}

function saveOptions() {
    localStorage.setItem('dinnerOptions3D', JSON.stringify(options));
}

function renderOptionsList() {
    const list = document.getElementById('optionsList');
    if (options.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="emoji">🍽️</div><p>沒有選項</p></div>';
        return;
    }
    list.innerHTML = options.map((opt, i) => `
        <li>
            <span class="option-text">${opt}</span>
            <div class="option-actions">
                <button class="edit-btn" data-index="${i}">✏️</button>
                <button class="delete-btn" data-index="${i}">🗑️</button>
            </div>
        </li>
    `).join('');
}

function addOption() {
    const input = document.getElementById('newOption');
    const val = input.value.trim();
    if (!val) return;
    if (options.includes(val)) { alert('已存在！'); return; }
    options.push(val);
    saveOptions();
    renderOptionsList();
    input.value = '';
}

function deleteOption(i) {
    if (confirm(`刪除「${options[i]}」？`)) {
        options.splice(i, 1);
        saveOptions();
        renderOptionsList();
    }
}

function openEditModal(i) {
    editingIndex = i;
    document.getElementById('editInput').value = options[i];
    document.getElementById('editModal').classList.add('show');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
    editingIndex = -1;
}

function saveEdit() {
    const val = document.getElementById('editInput').value.trim();
    if (!val) return;
    options[editingIndex] = val;
    saveOptions();
    renderOptionsList();
    closeEditModal();
}

function loadDefaults() {
    if (confirm('載入預設選項？')) {
        options = [...DEFAULT_OPTIONS];
        saveOptions();
        renderOptionsList();
    }
}

// ============== UI 設定 ==============
function setupUI() {
    renderOptionsList();
    
    document.getElementById('gachaBtn').addEventListener('click', pullGacha);
    
    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.getElementById('settingsPanel').classList.add('show');
    });
    
    document.getElementById('closeSettings').addEventListener('click', () => {
        document.getElementById('settingsPanel').classList.remove('show');
    });
    
    document.getElementById('addOptionBtn').addEventListener('click', addOption);
    document.getElementById('newOption').addEventListener('keypress', e => {
        if (e.key === 'Enter') addOption();
    });
    
    document.getElementById('optionsList').addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const i = parseInt(btn.dataset.index);
        if (btn.classList.contains('edit-btn')) openEditModal(i);
        if (btn.classList.contains('delete-btn')) deleteOption(i);
    });
    
    document.getElementById('saveEdit').addEventListener('click', saveEdit);
    document.getElementById('cancelEdit').addEventListener('click', closeEditModal);
    document.getElementById('editInput').addEventListener('keypress', e => {
        if (e.key === 'Enter') saveEdit();
    });
    
    document.getElementById('loadDefaults').addEventListener('click', loadDefaults);
    document.getElementById('refillMachine').addEventListener('click', fillCapsules);
    
    document.getElementById('closeResult').addEventListener('click', closeResult);
    document.getElementById('resultModal').addEventListener('click', e => {
        if (e.target.id === 'resultModal') closeResult();
    });
}
