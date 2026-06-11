// ==========================================================
// TACTICAL ENTRY - LIGHTWEIGHT Q-LEARNING NEURAL NET PATCH
// ==========================================================
console.log("Reinforcement Learning AI Engine Activated!");

// --- 1. LIGHTWEIGHT NEURAL NETWORK ENGINE (Q-LEARNING) ---
class QNetwork {
    constructor(inputSize, hiddenSize, outputSize) {
        this.inputSize = inputSize;
        this.hiddenSize = hiddenSize;
        this.outputSize = outputSize;
        
        // Xavier Weight Initialization to prevent early gradient saturation
        this.w1 = Array.from({length: inputSize}, () => 
            Array.from({length: hiddenSize}, () => (Math.random() - 0.5) * Math.sqrt(2 / inputSize))
        );
        this.b1 = new Array(hiddenSize).fill(0);
        
        this.w2 = Array.from({length: hiddenSize}, () => 
            Array.from({length: outputSize}, () => (Math.random() - 0.5) * Math.sqrt(2 / hiddenSize))
        );
        this.b2 = new Array(outputSize).fill(0);
        
        this.learningRate = 0.02; 
        this.gamma = 0.90; // Temporal Discount Factor
    }
    
    forward(inputs) {
        // Hidden Layer with Tanh Activation
        let h = new Array(this.hiddenSize).fill(0);
        for (let j = 0; j < this.hiddenSize; j++) {
            let sum = this.b1[j];
            for (let i = 0; i < this.inputSize; i++) {
                sum += inputs[i] * this.w1[i][j];
            }
            h[j] = Math.tanh(sum);
        }
        
        // Output Layer (Q-values for each action)
        let out = new Array(this.outputSize).fill(0);
        for (let k = 0; k < this.outputSize; k++) {
            let sum = this.b2[k];
            for (let j = 0; j < this.hiddenSize; j++) {
                sum += h[j] * this.w2[j][k];
            }
            out[k] = sum;
        }
        return { h, out };
    }
    
    backward(inputs, action, targetQ) {
        let { h, out } = this.forward(inputs);
        let predictedQ = out[action];
        let error = predictedQ - targetQ; // Mean Squared Error Derivative
        
        // Output Layer Gradients
        let dW2 = Array.from({length: this.hiddenSize}, () => new Array(this.outputSize).fill(0));
        let dB2 = new Array(this.outputSize).fill(0);
        dB2[action] = error;
        for (let j = 0; j < this.hiddenSize; j++) {
            dW2[j][action] = error * h[j];
        }
        
        // Backpropagate Error to Hidden layer
        let dH = new Array(this.hiddenSize).fill(0);
        for (let j = 0; j < this.hiddenSize; j++) {
            dH[j] = error * this.w2[j][action] * (1.0 - h[j] * h[j]); // Derivative of Tanh
        }
        
        // Input Layer Gradients
        let dW1 = Array.from({length: this.inputSize}, () => new Array(this.hiddenSize).fill(0));
        let dB1 = new Array(this.hiddenSize).fill(0);
        for (let j = 0; j < this.hiddenSize; j++) {
            dB1[j] = dH[j];
            for (let i = 0; i < this.inputSize; i++) {
                dW1[i][j] = dH[j] * inputs[i];
            }
        }
        
        // Gradient Descent Updates
        for (let j = 0; j < this.hiddenSize; j++) {
            this.b2[action] -= this.learningRate * dB2[action];
            this.w2[j][action] -= this.learningRate * dW2[j][action];
        }
        for (let i = 0; i < this.inputSize; i++) {
            for (let j = 0; j < this.hiddenSize; j++) {
                this.w1[i][j] -= this.learningRate * dW1[i][j];
            }
        }
        for (let j = 0; j < this.hiddenSize; j++) {
            this.b1[j] -= this.learningRate * dB1[j];
        }
    }
}

// --- 2. NEW GLOBALS & STATE ---
var enemies = [];
var enemyHitboxes = [];
var currentWeapon = null;
var isAiming = false;
var isFiring = false;
var playerHP = 100;
var recoilKick = { x: 0, y: 0, z: 0 };
var sway = { x: 0, y: 0 };
var lastPatchTime = performance.now();
var visualParticles = [];

// --- WEAPONS ---
const WEAPONS = {
    pistol: {
        name: "Glock 19",
        damage: 25,
        magSize: 15,
        ammo: 15,
        fireRate: 200, 
        isAuto: false,
        recoilAmt: 0.04,
        reloadTime: 1200,
        hipOffset: new THREE.Vector3(0.2, -0.25, -0.5),
        aimOffset: new THREE.Vector3(0, -0.11, -0.4),
        lastFire: 0,
        isReloading: false
    },
    m4a3: {
        name: "M4A3 Tactical",
        damage: 34, 
        magSize: 30,
        ammo: 30,
        fireRate: 90, 
        isAuto: true,
        recoilAmt: 0.02,
        reloadTime: 2000,
        hipOffset: new THREE.Vector3(0.3, -0.3, -0.6),
        aimOffset: new THREE.Vector3(0, -0.165, -0.3), 
        lastFire: 0,
        isReloading: false
    }
};
let activeWeaponKey = 'm4a3';

// --- 3. UI INJECTION ---
function setupTacticalUI() {
    const uiContainer = document.getElementById('ui');

    const hudInfo = document.createElement('div');
    hudInfo.id = 'hud-info';
    hudInfo.style.cssText = "position:absolute; bottom:20px; left:20px; color:white; font-size:24px; text-shadow: 2px 2px #000; font-family:'Courier New'; font-weight:bold;";
    uiContainer.appendChild(hudInfo);

    const dmgOverlay = document.createElement('div');
    dmgOverlay.id = 'dmg-overlay';
    dmgOverlay.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; background:red; opacity:0; pointer-events:none; transition: opacity 0.2s; z-index:5;";
    uiContainer.appendChild(dmgOverlay);

    if (isMobile) {
        const swapBtn = document.createElement('div');
        swapBtn.innerText = "SWITCH";
        swapBtn.style.cssText = "position:absolute; top:20px; right:20px; width:80px; height:50px; background:rgba(200,200,200,0.3); border:2px solid white; display:flex; justify-content:center; align-items:center; color:white; font-weight:bold; pointer-events:auto; z-index:100;";
        swapBtn.addEventListener('touchstart', (e) => { e.preventDefault(); toggleWeapon(); });
        uiContainer.appendChild(swapBtn);

        const fireBtn = document.createElement('div');
        fireBtn.style.cssText = "position:absolute; bottom:40px; right:40px; width:90px; height:90px; border-radius:50%; background:rgba(255,50,50,0.4); border:3px solid #ff3333; pointer-events:auto; z-index:100;";
        fireBtn.addEventListener('touchstart', (e) => { e.preventDefault(); isFiring = true; });
        fireBtn.addEventListener('touchend', (e) => { e.preventDefault(); isFiring = false; });
        uiContainer.appendChild(fireBtn);

        const aimBtn = document.createElement('div');
        aimBtn.style.cssText = "position:absolute; bottom:150px; right:60px; width:70px; height:70px; border-radius:50%; background:rgba(255,255,255,0.3); border:2px solid white; pointer-events:auto; z-index:100;";
        aimBtn.addEventListener('touchstart', (e) => { e.preventDefault(); isAiming = !isAiming; });
        uiContainer.appendChild(aimBtn);

        const reloadBtn = document.createElement('div');
        reloadBtn.innerText = "RELOAD";
        reloadBtn.style.cssText = "position:absolute; bottom:40px; left:40px; width:80px; height:80px; border-radius:50%; background:rgba(100,100,100,0.4); border:2px solid #aaa; color:white; display:flex; justify-content:center; align-items:center; font-weight:bold; pointer-events:auto; z-index:100;";
        reloadBtn.addEventListener('touchstart', (e) => { e.preventDefault(); reloadWeapon(); });
        uiContainer.appendChild(reloadBtn);
    } else {
        document.addEventListener('mousedown', (e) => {
            if (document.pointerLockElement !== document.body) return;
            if (e.button === 0) isFiring = true;
            if (e.button === 2) isAiming = true;
        });
        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) isFiring = false;
            if (e.button === 2) isAiming = false;
        });
        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'r') reloadWeapon();
            if (e.key === '1') { activeWeaponKey = 'm4a3'; equipWeapon(); }
            if (e.key === '2') { activeWeaponKey = 'pistol'; equipWeapon(); }
        });
    }
}

function updateHUD() {
    const w = WEAPONS[activeWeaponKey];
    let ammoText = w.isReloading ? "RELOADING..." : `${w.ammo} / ${w.magSize}`;
    document.getElementById('hud-info').innerText = `+${playerHP} HP | ${w.name}: ${ammoText}`;
    document.getElementById('crosshair').style.display = isAiming ? 'none' : 'block';
}

// --- 4. PROCEDURAL GUN BUILDER ---
const gunMatDark = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.8, metalness: 0.1 });
const gunMatMetal = new THREE.MeshStandardMaterial({ color: 0x242528, roughness: 0.5, metalness: 0.8 });
const redDotMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

function buildM4A3() {
    const group = new THREE.Group();
    const rec = new THREE.Mesh(geoLibrary.box, gunMatDark);
    rec.scale.set(0.06, 0.1, 0.32); group.add(rec);
    
    const handguard = new THREE.Mesh(geoLibrary.box, gunMatMetal);
    handguard.scale.set(0.055, 0.075, 0.24); handguard.position.set(0, 0.01, -0.22); group.add(handguard);
    
    const barrel = new THREE.Mesh(geoLibrary.cylinder, gunMatMetal);
    barrel.scale.set(0.015, 0.45, 0.015); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.02, -0.45); group.add(barrel);
    
    const mag = new THREE.Mesh(geoLibrary.box, gunMatDark);
    mag.scale.set(0.05, 0.15, 0.08); mag.position.set(0, -0.1, -0.05); mag.rotation.x = -0.15; group.add(mag);
    
    const stock = new THREE.Mesh(geoLibrary.box, gunMatDark);
    stock.scale.set(0.05, 0.11, 0.18); stock.position.set(0, -0.03, 0.32); group.add(stock);

    const sightBase = new THREE.Mesh(geoLibrary.box, gunMatDark);
    sightBase.scale.set(0.055, 0.04, 0.08); sightBase.position.set(0, 0.07, -0.05); group.add(sightBase);
    
    const glass = new THREE.Mesh(geoLibrary.plane, new THREE.MeshBasicMaterial({color:0x33ffaa, transparent:true, opacity:0.3}));
    glass.scale.set(0.045, 0.045, 1); glass.position.set(0, 0.095, -0.05); group.add(glass);
    
    const dot = new THREE.Mesh(geoLibrary.plane, redDotMat);
    dot.scale.set(0.004, 0.004, 1); dot.position.set(0, 0.095, -0.051); group.add(dot);

    const flashGroup = new THREE.Group();
    flashGroup.position.set(0, 0.02, -0.72);
    flashGroup.name = "muzzleFlash";
    flashGroup.visible = false;
    
    const flashCore = new THREE.Mesh(geoLibrary.cone, new THREE.MeshBasicMaterial({color: 0xffaa44, transparent: true, opacity: 0.9}));
    flashCore.scale.set(0.08, 0.15, 0.08); flashCore.rotation.x = -Math.PI / 2; flashCore.position.set(0, 0, -0.07);
    flashGroup.add(flashCore);
    group.add(flashGroup);

    return group;
}

function buildPistol() {
    const group = new THREE.Group();
    const slide = new THREE.Mesh(geoLibrary.box, gunMatMetal);
    slide.scale.set(0.04, 0.045, 0.22); group.add(slide);
    
    const frame = new THREE.Mesh(geoLibrary.box, gunMatDark);
    frame.scale.set(0.042, 0.04, 0.21); frame.position.set(0, -0.025, 0.005); group.add(frame);
    
    const grip = new THREE.Mesh(geoLibrary.box, gunMatDark);
    grip.scale.set(0.036, 0.12, 0.062); grip.position.set(0, -0.08, 0.05); grip.rotation.x = 0.2; group.add(grip);

    const flashGroup = new THREE.Group();
    flashGroup.position.set(0, 0.01, -0.12);
    flashGroup.name = "muzzleFlash";
    flashGroup.visible = false;
    
    const flashCore = new THREE.Mesh(geoLibrary.cone, new THREE.MeshBasicMaterial({color: 0xffaa44, transparent: true, opacity: 0.9}));
    flashCore.scale.set(0.06, 0.1, 0.06); flashCore.rotation.x = -Math.PI / 2; flashCore.position.set(0, 0, -0.05);
    flashGroup.add(flashCore);
    group.add(flashGroup);

    return group;
}

const m4Model = buildM4A3();
const pistolModel = buildPistol();
m4Model.castShadow = true;
pistolModel.castShadow = true;
camera.add(m4Model);
camera.add(pistolModel);

function equipWeapon() {
    currentWeapon = WEAPONS[activeWeaponKey];
    m4Model.visible = (activeWeaponKey === 'm4a3');
    pistolModel.visible = (activeWeaponKey === 'pistol');
    isAiming = false;
    isFiring = false;
    updateHUD();
}
function toggleWeapon() {
    activeWeaponKey = activeWeaponKey === 'm4a3' ? 'pistol' : 'm4a3';
    equipWeapon();
}

// --- 5. SHOOTING MECHANICS ---
const bulletRaycaster = new THREE.Raycaster();

function emitGunshotSound(origin, volumeRadius) {
    let alertedCount = 0; 
    let shuffledEnemies = enemies.sort(() => 0.5 - Math.random());
    shuffledEnemies.forEach(e => {
        if (e.isDead || e.state === 'alert' || alertedCount >= 3) return;
        let dist = e.group.position.distanceTo(origin);
        if (dist < volumeRadius) {
            e.investigate(origin.clone());
            alertedCount++;
        }
    });
}

function reloadWeapon() {
    const w = WEAPONS[activeWeaponKey];
    if (w.isReloading || w.ammo === w.magSize) return;
    w.isReloading = true;
    updateHUD();
    
    recoilKick.y = -0.5; recoilKick.x = 0.5;
    setTimeout(() => {
        w.ammo = w.magSize; w.isReloading = false; updateHUD();
    }, w.reloadTime);
}

function fireWeapon() {
    if (!currentWeapon || currentWeapon.isReloading || currentWeapon.ammo <= 0) {
        if(currentWeapon && currentWeapon.ammo <= 0 && isFiring && !currentWeapon.isAuto) reloadWeapon(); 
        isFiring = false; 
        return;
    }

    const now = Date.now();
    if (now - currentWeapon.lastFire < currentWeapon.fireRate) return;
    
    currentWeapon.lastFire = now;
    currentWeapon.ammo--;
    updateHUD();

    if (!currentWeapon.isAuto) isFiring = false;

    // Recoil Values
    recoilKick.y += currentWeapon.recoilAmt;
    recoilKick.z += currentWeapon.recoilAmt * 2;
    recoilKick.x += (Math.random() - 0.5) * currentWeapon.recoilAmt;

    // Trigger Visual Gun Fire Flash
    const activeModel = activeWeaponKey === 'm4a3' ? m4Model : pistolModel;
    const mFlash = activeModel.getObjectByName("muzzleFlash");
    if (mFlash) {
        mFlash.visible = true;
        mFlash.rotation.z = Math.random() * Math.PI * 2;
        setTimeout(() => { mFlash.visible = false; }, 40);
    }

    emitGunshotSound(camera.position, 60);

    // Hitscan calculation (ignoring weapon attachments)
    bulletRaycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = bulletRaycaster.intersectObjects(scene.children, true);
    
    for (let hit of hits) {
        if (!hit.object.visible) continue;
        
        // BUG FIX: Prevent ray from intersecting elements childed to the camera (the gun itself)
        let parent = hit.object.parent;
        let isPlayerGunPart = false;
        while (parent) {
            if (parent === camera) { isPlayerGunPart = true; break; }
            parent = parent.parent;
        }
        if (isPlayerGunPart) continue;
        
        if (hit.object.userData && hit.object.userData.isEnemy) {
            let multiplier = hit.object.userData.multiplier;
            let dmg = currentWeapon.damage * multiplier;
            hit.object.userData.parent.takeDamage(dmg);
            spawnImpactSpark(hit.point, new THREE.Vector3(1,0,0)); // Blood spray
            break; 
        } 
        else if (hit.object.geometry && !hit.object.userData.isDoor) {
            spawnImpactSpark(hit.point, hit.face.normal); // Wall impact spark
            break; 
        }
    }
}

function spawnImpactSpark(pos, normal) {
    const isBlood = (normal.x === 1 && normal.y === 0 && normal.z === 0);
    const sparkColor = isBlood ? 0x990000 : 0xffaa33;
    const count = isBlood ? 8 : 4;
    
    for (let i = 0; i < count; i++) {
        const size = 0.05 + Math.random() * 0.04;
        const sparkMat = new THREE.MeshBasicMaterial({ color: sparkColor, transparent: true, opacity: 0.9 });
        const spark = new THREE.Mesh(geoLibrary.box, sparkMat);
        spark.scale.set(size, size, size);
        spark.position.copy(pos);
        scene.add(spark);
        
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5
        );
        if (!isBlood) {
            velocity.addScaledVector(normal, 6);
        } else {
            velocity.y -= 1.5;
        }
        
        visualParticles.push({
            mesh: spark,
            velocity: velocity,
            spawnTime: performance.now()
        });
    }
}

// --- 6. ADVANCED ENEMY AI SYSTEM ---
const enemyMatVest = new THREE.MeshStandardMaterial({ color: 0x1f231e, roughness: 0.8 });
const enemyMatSkin = new THREE.MeshStandardMaterial({ color: 0xcc9966, roughness: 0.6 }); 
const enemyMatPants = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }); 

class TacticalEnemy {
    constructor(x, y, z) {
        this.hp = 100;
        this.isDead = false;
        this.group = new THREE.Group();
        this.group.position.set(x, y, z);
        
        // Initialize dynamic self-learning brain
        this.brain = new QNetwork(4, 6, 4); // 4 Inputs, 6 Hidden, 4 Actions
        this.prevState = null;
        this.action = 0;
        this.hitPlayerThisFrame = false;
        this.tookDamageThisFrame = false;
        this.strafeDirection = Math.random() > 0.5 ? 1 : -1;

        // Build Hitboxes
        const createPart = (w, h, d, yOff, mat, mult, name) => {
            const mesh = new THREE.Mesh(geoLibrary.box, mat);
            mesh.scale.set(w, h, d); mesh.position.y = yOff;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData = { isEnemy: true, parent: this, multiplier: mult, part: name };
            this.group.add(mesh);
            enemyHitboxes.push(mesh);
            return mesh;
        };

        this.torso = createPart(1.2, 1.8, 0.8, 3.5, enemyMatVest, 1.0, 'torso');
        this.head = createPart(0.6, 0.6, 0.6, 4.8, enemyMatSkin, 4.0, 'head'); 
        this.legL = createPart(0.4, 2.5, 0.4, 1.3, enemyMatPants, 0.5, 'legL'); this.legL.position.x = -0.3;
        this.legR = createPart(0.4, 2.5, 0.4, 1.3, enemyMatPants, 0.5, 'legR'); this.legR.position.x = 0.3;

        // Uniform Accessories
        const helmet = new THREE.Mesh(geoLibrary.box, gunMatDark);
        helmet.scale.set(0.68, 0.3, 0.68); helmet.position.set(0, 5.1, 0);
        this.group.add(helmet);

        const goggles = new THREE.Mesh(geoLibrary.box, gunMatMetal);
        goggles.scale.set(0.56, 0.16, 0.15); goggles.position.set(0, 4.8, -0.28);
        this.group.add(goggles);

        // Enemy Weapon Mesh
        this.gun = new THREE.Mesh(geoLibrary.box, gunMatDark);
        this.gun.scale.set(0.12, 0.18, 0.8); this.gun.position.set(0.5, 3.3, 0.5);
        this.group.add(this.gun);

        scene.add(this.group);
        enemies.push(this);

        this.state = 'patrol'; 
        this.targetPos = this.getRandomPatrolPoint();
        this.reactionTimer = 0; 
        this.lastShot = 0;
        this.waitTimer = 0;
    }

    getRandomPatrolPoint() {
        return new THREE.Vector3(
            this.group.position.x + (Math.random() - 0.5) * 15,
            this.group.position.y,
            this.group.position.z + (Math.random() - 0.5) * 15
        );
    }

    investigate(pos) {
        if (this.state === 'alert') return; 
        this.state = 'investigate';
        this.targetPos = pos;
    }

    takeDamage(amt) {
        if (this.isDead) return;
        this.hp -= amt;
        this.tookDamageThisFrame = true;
        
        if (this.state !== 'alert') {
            this.state = 'alert';
            this.reactionTimer = 1.0; 
        }
        
        this.group.rotation.x -= 0.15; 

        if (this.hp <= 0) {
            this.isDead = true;
            let fall = 0;
            const dieAnim = setInterval(() => {
                fall += 0.1; this.group.rotation.x = -fall;
                if(fall > Math.PI/2) { this.group.rotation.x = -Math.PI/2; clearInterval(dieAnim); }
            }, 16);
            
            this.group.children.forEach(c => {
                if(c.userData.isEnemy) {
                    enemyHitboxes = enemyHitboxes.filter(h => h !== c);
                    c.userData.isEnemy = false; 
                }
            });
        }
    }

    isPlayerLookingAtMe() {
        const headPos = new THREE.Vector3();
        this.head.getWorldPosition(headPos);
        const playerDir = new THREE.Vector3();
        camera.getWorldDirection(playerDir);
        const toEnemyVec = new THREE.Vector3().subVectors(headPos, camera.position).normalize();
        return playerDir.dot(toEnemyVec) > 0.85; // Player is facing roughly within 15 degrees of AI
    }

    walkTowards(dest, speed, delta) {
        let dir = new THREE.Vector3().subVectors(dest, this.group.position);
        dir.y = 0;
        if (dir.length() < 1.0) return true; 
        dir.normalize();

        // Push open doors blockages
        bulletRaycaster.set(this.group.position, dir);
        const hits = bulletRaycaster.intersectObjects(scene.children, true);
        for(let hit of hits) {
            if (hit.distance > 3.0) break; 
            if (hit.object.userData && hit.object.userData.isDoor) {
                hit.object.userData.doorObj.open(); 
            }
        }

        let nextPos = this.group.position.clone();
        nextPos.x += dir.x * speed * delta * 50;
        nextPos.z += dir.z * speed * delta * 50;

        const applyAICollisions = (pos) => {
            let pR = 0.6;
            for (let c of colliders) {
                if (pos.y + 1 < c.minY || pos.y - 4.9 > c.maxY) continue; 
                if (pos.x + pR > c.minX && pos.x - pR < c.maxX && pos.z + pR > c.minZ && pos.z - pR < c.maxZ) {
                    let oL = (pos.x + pR) - c.minX, oR = c.maxX - (pos.x - pR);
                    let oT = (pos.z + pR) - c.minZ, oB = c.maxZ - (pos.z - pR);
                    let m = Math.min(oL, oR, oT, oB);
                    if (m === oL) pos.x = c.minX - pR;
                    else if (m === oR) pos.x = c.maxX + pR;
                    else if (m === oT) pos.z = c.minZ - pR;
                    else if (m === oB) pos.z = c.maxZ + pR;
                }
            }
            return pos;
        };

        this.group.position.copy(applyAICollisions(nextPos));
        if (typeof calculateFloorY === 'function') {
            this.group.position.y = calculateFloorY(this.group.position.x, this.group.position.z, this.group.position.y);
        }

        this.group.rotation.y = Math.atan2(dir.x, dir.z);
        return false;
    }

    update(delta) {
        if (this.isDead) return;
        this.group.rotation.x += (0 - this.group.rotation.x) * 0.1; 

        const distToPlayer = this.group.position.distanceTo(camera.position);
        let seesPlayer = false;

        if (distToPlayer < 50) {
            const headPos = new THREE.Vector3();
            this.head.getWorldPosition(headPos);
            const dir = new THREE.Vector3().subVectors(camera.position, headPos).normalize();
            
            bulletRaycaster.set(headPos, dir);
            const hits = bulletRaycaster.intersectObjects(scene.children, true);
            
            for(let hit of hits) {
                // BUG FIX: Prevent enemy raycast from hitting its own parts (helmet, goggles, pouches, etc.)
                let parent = hit.object.parent;
                let isSelf = false;
                while (parent) {
                    if (parent === this.group) { isSelf = true; break; }
                    parent = parent.parent;
                }
                if (isSelf) continue;
                
                if(hit.distance > distToPlayer) { seesPlayer = true; break; } 
                else { break; } 
            }
        }

        // --- DEEP Q-LEARNING STATE ACTION DECISION TREE ---
        if (seesPlayer) {
            this.state = 'alert';
            this.reactionTimer += delta;

            const targetRot = Math.atan2(camera.position.x - this.group.position.x, camera.position.z - this.group.position.z);
            this.group.rotation.y = targetRot;

            // Define Normalized Neural Inputs
            let currentState = [
                distToPlayer / 60.0,
                this.hp / 100.0,
                isFiring ? 1.0 : 0.0,
                this.isPlayerLookingAtMe() ? 1.0 : 0.0
            ];

            // Train Q Network on previous transition reward
            if (this.prevState) {
                let reward = 0.01; // Base survival reward
                if (this.hitPlayerThisFrame) reward += 12.0;
                if (this.tookDamageThisFrame) reward -= 10.0;
                
                // Discourage rushing direct line of fire
                if (this.action === 0 && this.isPlayerLookingAtMe()) reward -= 5.0;

                let maxNextQ = Math.max(...this.brain.forward(currentState).out);
                let targetQ = reward + this.gamma * maxNextQ;
                
                this.brain.backward(this.prevState, this.action, targetQ);
            }

            this.prevState = currentState;

            // Decaying Epsilon-Greedy action picker (15% exploration)
            if (Math.random() < 0.15) {
                this.action = Math.floor(Math.random() * 4);
            } else {
                let { out } = this.brain.forward(currentState);
                this.action = out.indexOf(Math.max(...out));
            }

            // Execute Chosen Actions
            let speed = 0.05;
            let accuracyModifier = 0.35; // Default accuracy base

            if (this.action === 0) { // CHARGE
                this.walkTowards(camera.position, 0.09, delta);
            } 
            else if (this.action === 1) { // TACTICAL RETREAT
                let retreatVector = new THREE.Vector3().subVectors(this.group.position, camera.position).normalize().multiplyScalar(10);
                this.walkTowards(this.group.position.clone().add(retreatVector), 0.06, delta);
            } 
            else if (this.action === 2) { // STRAFE
                let playerDirVec = new THREE.Vector3().subVectors(camera.position, this.group.position).normalize();
                let sideVec = new THREE.Vector3(-playerDirVec.z, 0, playerDirVec.x).normalize().multiplyScalar(this.strafeDirection * 4);
                
                if (Math.random() < 0.02) this.strafeDirection *= -1; // Randomly flip strafe directions
                this.walkTowards(this.group.position.clone().add(sideVec), 0.07, delta);
            } 
            else if (this.action === 3) { // ANCHOR & AIM (No movement, high accuracy output)
                speed = 0;
                accuracyModifier = 0.75;
            }

            this.hitPlayerThisFrame = false;
            this.tookDamageThisFrame = false;

            // Handle shooting outputs
            if (this.reactionTimer > 0.4) {
                if (Date.now() - this.lastShot > 600) { 
                    this.lastShot = Date.now();
                    
                    // Show Weapon Visual Flash
                    const flashGroup = new THREE.Group();
                    flashGroup.name = "muzzleFlash";
                    flashGroup.position.set(0, 0, 0.45);
                    const flashCore = new THREE.Mesh(geoLibrary.cone, new THREE.MeshBasicMaterial({color: 0xffa500, transparent: true, opacity: 0.9}));
                    flashCore.scale.set(0.12, 0.22, 0.12); flashCore.rotation.x = Math.PI / 2;
                    flashGroup.add(flashCore);
                    this.gun.add(flashGroup);
                    setTimeout(() => { this.gun.remove(flashGroup); }, 40);

                    // Shoot bullet tracer visuals
                    const eGunPos = new THREE.Vector3();
                    this.gun.getWorldPosition(eGunPos);
                    const tracerMat = new THREE.LineBasicMaterial({ color: 0xff3300 });
                    const tracerGeo = new THREE.BufferGeometry().setFromPoints([
                        eGunPos,
                        camera.position.clone().add(new THREE.Vector3((Math.random()-0.5)*2, (Math.random()-0.5)*2, (Math.random()-0.5)*2))
                    ]);
                    const tracerLine = new THREE.Line(tracerGeo, tracerMat);
                    scene.add(tracerLine);
                    setTimeout(() => { scene.remove(tracerLine); tracerGeo.dispose(); tracerMat.dispose(); }, 40);

                    // Process hits to Player
                    let roll = Math.random();
                    let hitChance = distToPlayer < 12 ? accuracyModifier : accuracyModifier * 0.5;
                    if (roll < hitChance) {
                        this.hitPlayerThisFrame = true;
                        playerHit(15);
                    }
                }
            }
        } else {
            this.reactionTimer = Math.max(0, this.reactionTimer - delta);

            if (this.state === 'alert') {
                this.investigate(camera.position.clone());
            } 
            else if (this.state === 'investigate') {
                let reached = this.walkTowards(this.targetPos, 0.08, delta); 
                if (reached) {
                    this.waitTimer += delta;
                    if (this.waitTimer > 4.0) { 
                        this.state = 'patrol';
                        this.waitTimer = 0;
                    }
                }
            } 
            else if (this.state === 'patrol') {
                let reached = this.walkTowards(this.targetPos, 0.03, delta); 
                if (reached) {
                    this.waitTimer += delta;
                    if (this.waitTimer > 3.0) {
                        this.targetPos = this.getRandomPatrolPoint();
                        this.waitTimer = 0;
                    }
                }
            }
        }
    }
}

function playerHit(dmg) {
    playerHP -= dmg;
    updateHUD();
    
    const flash = document.getElementById('dmg-overlay');
    flash.style.opacity = 0.5;
    setTimeout(() => { flash.style.opacity = 0; }, 100);

    pitch += 0.08; yaw += (Math.random() - 0.5) * 0.08;
    camera.rotation.set(pitch, yaw, 0, 'YXZ');

    if (playerHP <= 0) {
        document.body.innerHTML = "<div style='color:red; font-size:45px; font-family:Courier New; width:100%; height:100%; display:flex; justify-content:center; align-items:center; background:black; font-weight:bold;'>KIA - RELOAD TO RESTART</div>";
    }
}

// Spawners
new TacticalEnemy(25, 2, 0);   
new TacticalEnemy(-25, 2, 0);  
new TacticalEnemy(25, 12, -20); 
new TacticalEnemy(-25, 12, -10); 
new TacticalEnemy(0, 12, -25);   

// --- 8. GAME LOOP INJECTOR HOOK ---
const originalRender = renderer.render.bind(renderer);

renderer.render = function(s, c) {
    if (!currentWeapon) {
        setupTacticalUI();
        equipWeapon();
    }

    let now = performance.now();
    let delta = Math.min((now - lastPatchTime) / 1000, 0.1);
    lastPatchTime = now;

    if (isFiring) fireWeapon();

    const w = currentWeapon;
    const model = activeWeaponKey === 'm4a3' ? m4Model : pistolModel;
    
    recoilKick.x += (0 - recoilKick.x) * 0.15;
    recoilKick.y += (0 - recoilKick.y) * 0.15;
    recoilKick.z += (0 - recoilKick.z) * 0.15;

    if (moveDelta.x !== 0 || moveDelta.y !== 0 || keys.w || keys.a || keys.s || keys.d) {
        sway.x = Math.sin(walkTime * 2) * 0.01;
        sway.y = Math.abs(Math.cos(walkTime * 2)) * 0.01;
    } else {
        sway.x += (0 - sway.x) * 0.1; sway.y += (0 - sway.y) * 0.1;
    }

    let target = isAiming ? w.aimOffset : w.hipOffset;
    model.position.x += (target.x + sway.x - model.position.x) * 0.2;
    model.position.y += (target.y + sway.y + recoilKick.y - model.position.y) * 0.2;
    model.position.z += (target.z + recoilKick.z - model.position.z) * 0.2;
    
    model.rotation.x = recoilKick.y * 2;
    model.rotation.y = recoilKick.x;

    updateHUD(); 

    // Update floating spark particles using real-time gravity updates
    visualParticles.forEach(p => {
        p.mesh.position.addScaledVector(p.velocity, delta);
        p.velocity.y -= 9.8 * delta; // Earth Gravity
        p.mesh.scale.multiplyScalar(0.92); // Shrink factor
    });
    
    visualParticles = visualParticles.filter(p => {
        if (now - p.spawnTime > 250) {
            scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            return false;
        }
        return true;
    });

    enemies.forEach(e => e.update(delta));
    originalRender(s, c);
};
