// ==========================================
// TACTICAL ENTRY - ADVANCED AI & WEAPONS PATCH
// ==========================================
console.log("Advanced AI Patch Loaded!");

// --- 1. NEW GLOBALS & STATE ---
var enemies = [];
var enemyHitboxes = [];
var currentWeapon = null;
var isAiming = false;
var isFiring = false;
var playerHP = 100;
var recoilKick = { x: 0, y: 0, z: 0 };
var sway = { x: 0, y: 0 };
var lastPatchTime = performance.now(); // For AI Delta Time
var visualParticles = []; // For particle bursts

// --- 2. WEAPON PROFILES ---
const WEAPONS = {
    pistol: {
        name: "Glock 19",
        damage: 25,
        magSize: 15,
        ammo: 15,
        fireRate: 200, 
        isAuto: false,
        recoilAmt: 0.05,
        reloadTime: 1200,
        hipOffset: new THREE.Vector3(0.2, -0.25, -0.5),
        aimOffset: new THREE.Vector3(0, -0.11, -0.4), // Aligned Iron Sights
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
        recoilAmt: 0.025,
        reloadTime: 2000,
        hipOffset: new THREE.Vector3(0.3, -0.3, -0.6),
        // Aligned with the center of the Red Dot Sight
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
    
    // Toggle standard crosshair based on Aiming status
    document.getElementById('crosshair').style.display = isAiming ? 'none' : 'block';
}

// --- 4. PROCEDURAL GUN BUILDER ---
const gunMatDark = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.75, metalness: 0.2 });
const gunMatMetal = new THREE.MeshStandardMaterial({ color: 0x2e3033, roughness: 0.5, metalness: 0.8 });
const redDotMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

function buildM4A3() {
    const group = new THREE.Group();
    
    // Core Upper & Lower Receiver
    const rec = new THREE.Mesh(geoLibrary.box, gunMatDark);
    rec.scale.set(0.06, 0.1, 0.32); group.add(rec);
    
    // Detailed Quad-Rail Handguard
    const handguard = new THREE.Mesh(geoLibrary.box, gunMatMetal);
    handguard.scale.set(0.055, 0.075, 0.24); handguard.position.set(0, 0.01, -0.22); group.add(handguard);
    
    // Handguard rails (ribbed dimensional pattern)
    for (let i = 0; i < 6; i++) {
        let zPos = -0.12 - (i * 0.035);
        let topRail = new THREE.Mesh(geoLibrary.box, gunMatDark);
        topRail.scale.set(0.045, 0.01, 0.015); topRail.position.set(0, 0.05, zPos); group.add(topRail);
        
        let bottomRail = new THREE.Mesh(geoLibrary.box, gunMatDark);
        bottomRail.scale.set(0.045, 0.01, 0.015); bottomRail.position.set(0, -0.03, zPos); group.add(bottomRail);
    }
    
    // Foregrip
    const gripVertical = new THREE.Mesh(geoLibrary.box, gunMatDark);
    gripVertical.scale.set(0.03, 0.1, 0.03); gripVertical.position.set(0, -0.08, -0.22); group.add(gripVertical);
    
    // Barrel
    const barrel = new THREE.Mesh(geoLibrary.cylinder, gunMatMetal);
    barrel.scale.set(0.015, 0.45, 0.015); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.02, -0.45); group.add(barrel);
    
    // Muzzle compensator
    const compensator = new THREE.Mesh(geoLibrary.cylinder, gunMatDark);
    compensator.scale.set(0.018, 0.05, 0.018); compensator.rotation.x = Math.PI/2; compensator.position.set(0, 0.02, -0.68); group.add(compensator);
    
    // Magazine (with visual floor plate)
    const mag = new THREE.Mesh(geoLibrary.box, gunMatDark);
    mag.scale.set(0.05, 0.15, 0.08); mag.position.set(0, -0.1, -0.05); mag.rotation.x = -0.15; group.add(mag);
    const magFloor = new THREE.Mesh(geoLibrary.box, gunMatMetal);
    magFloor.scale.set(0.054, 0.02, 0.084); magFloor.position.set(0, -0.18, -0.06); magFloor.rotation.x = -0.15; group.add(magFloor);
    
    // Buffer Tube & Tactical Cranestock
    const buffer = new THREE.Mesh(geoLibrary.cylinder, gunMatMetal);
    buffer.scale.set(0.02, 0.15, 0.02); buffer.rotation.x = Math.PI/2; buffer.position.set(0, 0, 0.2); group.add(buffer);
    const stock = new THREE.Mesh(geoLibrary.box, gunMatDark);
    stock.scale.set(0.05, 0.11, 0.18); stock.position.set(0, -0.03, 0.32); group.add(stock);
    const stockButt = new THREE.Mesh(geoLibrary.box, gunMatMetal);
    stockButt.scale.set(0.054, 0.13, 0.02); stockButt.position.set(0, -0.03, 0.41); group.add(stockButt);
    
    // Pistol Grip
    const handle = new THREE.Mesh(geoLibrary.box, gunMatDark);
    handle.scale.set(0.045, 0.12, 0.06); handle.position.set(0, -0.1, 0.1); handle.rotation.x = 0.25; group.add(handle);
    
    // Red Dot Sight Housing & Glass
    const sightBase = new THREE.Mesh(geoLibrary.box, gunMatDark);
    sightBase.scale.set(0.055, 0.04, 0.08); sightBase.position.set(0, 0.07, -0.05); group.add(sightBase);
    const sightHood = new THREE.Mesh(geoLibrary.box, gunMatDark);
    sightHood.scale.set(0.055, 0.06, 0.015); sightHood.position.set(0, 0.12, -0.08); group.add(sightHood);
    
    const glass = new THREE.Mesh(geoLibrary.plane, new THREE.MeshBasicMaterial({color:0x33ffaa, transparent:true, opacity:0.3}));
    glass.scale.set(0.045, 0.045, 1); glass.position.set(0, 0.095, -0.05); group.add(glass);
    
    const dot = new THREE.Mesh(geoLibrary.plane, redDotMat);
    dot.scale.set(0.004, 0.004, 1); dot.position.set(0, 0.095, -0.051); group.add(dot); 
    
    // Tan Tactical PEQ-15 Laser Box on Right Handguard
    const peq = new THREE.Mesh(geoLibrary.box, new THREE.MeshStandardMaterial({color: 0x8c765c, roughness: 0.85}));
    peq.scale.set(0.03, 0.02, 0.07); peq.position.set(0.035, 0.02, -0.18); group.add(peq);
    const peqLens = new THREE.Mesh(geoLibrary.cylinder, new THREE.MeshBasicMaterial({color: 0xff3333}));
    peqLens.scale.set(0.008, 0.01, 0.008); peqLens.rotation.x = Math.PI/2; peqLens.position.set(0.035, 0.02, -0.216); group.add(peqLens);

    // Dynamic Muzzle Flash Anchor (Initially Invisible)
    const flashGroup = new THREE.Group();
    flashGroup.position.set(0, 0.02, -0.72);
    flashGroup.name = "muzzleFlash";
    flashGroup.visible = false;
    
    const flashCore = new THREE.Mesh(geoLibrary.cone, new THREE.MeshBasicMaterial({color: 0xffaa44, transparent: true, opacity: 0.9}));
    flashCore.scale.set(0.08, 0.15, 0.08); flashCore.rotation.x = -Math.PI / 2; flashCore.position.set(0, 0, -0.07);
    flashGroup.add(flashCore);
    const flashSpike = new THREE.Mesh(geoLibrary.cone, new THREE.MeshBasicMaterial({color: 0xff3300, transparent: true, opacity: 0.7}));
    flashSpike.scale.set(0.04, 0.22, 0.04); flashSpike.rotation.x = -Math.PI / 2; flashSpike.position.set(0, 0, -0.1);
    flashGroup.add(flashSpike);

    const flashLight = new THREE.PointLight(0xff9900, 2.0, 15);
    flashLight.position.set(0, 0, -0.1);
    flashGroup.add(flashLight);
    group.add(flashGroup);

    return group;
}

function buildPistol() {
    const group = new THREE.Group();
    
    // Two-tone Metallic Slide
    const slide = new THREE.Mesh(geoLibrary.box, gunMatMetal);
    slide.scale.set(0.04, 0.045, 0.22); group.add(slide);
    const slideTop = new THREE.Mesh(geoLibrary.box, gunMatDark);
    slideTop.scale.set(0.038, 0.01, 0.218); slideTop.position.set(0, 0.024, 0); group.add(slideTop);
    
    // Slide serrations (rear textured grip plates)
    for (let i = 0; i < 4; i++) {
        let ser = new THREE.Mesh(geoLibrary.box, gunMatDark);
        ser.scale.set(0.042, 0.03, 0.005); ser.position.set(0, 0, 0.06 - (i * 0.015)); group.add(ser);
    }
    
    // Lower Receiver Frame
    const frame = new THREE.Mesh(geoLibrary.box, gunMatDark);
    frame.scale.set(0.042, 0.04, 0.21); frame.position.set(0, -0.025, 0.005); group.add(frame);
    
    // Pistol Grip Frame & Textured Side panels
    const grip = new THREE.Mesh(geoLibrary.box, gunMatDark);
    grip.scale.set(0.036, 0.12, 0.062); grip.position.set(0, -0.08, 0.05); grip.rotation.x = 0.2; group.add(grip);
    const panelL = new THREE.Mesh(geoLibrary.box, gunMatMetal);
    panelL.scale.set(0.004, 0.1, 0.05); panelL.position.set(-0.019, -0.08, 0.05); panelL.rotation.x = 0.2; group.add(panelL);
    const panelR = new THREE.Mesh(geoLibrary.box, gunMatMetal);
    panelR.scale.set(0.004, 0.1, 0.05); panelR.position.set(0.019, -0.08, 0.05); panelR.rotation.x = 0.2; group.add(panelR);
    
    // Trigger Guard & Metallic Trigger
    const guard = new THREE.Mesh(geoLibrary.box, gunMatDark);
    guard.scale.set(0.042, 0.04, 0.05); guard.position.set(0, -0.045, -0.04); group.add(guard);
    const trigger = new THREE.Mesh(geoLibrary.box, gunMatMetal);
    trigger.scale.set(0.01, 0.025, 0.015); trigger.position.set(0, -0.04, -0.035); trigger.rotation.x = -0.2; group.add(trigger);
    
    // Tritium Glowing Sights
    const frontSight = new THREE.Mesh(geoLibrary.box, gunMatDark);
    frontSight.scale.set(0.01, 0.018, 0.015); frontSight.position.set(0, 0.035, -0.095); group.add(frontSight);
    const frontGlow = new THREE.Mesh(geoLibrary.plane, new THREE.MeshBasicMaterial({color: 0x33ff33}));
    frontGlow.scale.set(0.004, 0.004, 1); frontGlow.position.set(0, 0.04, -0.087); group.add(frontGlow);
    
    const backSight = new THREE.Mesh(geoLibrary.box, gunMatDark);
    backSight.scale.set(0.025, 0.018, 0.015); backSight.position.set(0, 0.035, 0.095); group.add(backSight);
    const backGlowL = new THREE.Mesh(geoLibrary.plane, new THREE.MeshBasicMaterial({color: 0x33ff33}));
    backGlowL.scale.set(0.003, 0.003, 1); backGlowL.position.set(-0.008, 0.039, 0.087); group.add(backGlowL);
    const backGlowR = new THREE.Mesh(geoLibrary.plane, new THREE.MeshBasicMaterial({color: 0x33ff33}));
    backGlowR.scale.set(0.003, 0.003, 1); backGlowR.position.set(0.008, 0.039, 0.087); group.add(backGlowR);
    
    // Tactical Under-barrel Flashlight unit
    const lightUnit = new THREE.Mesh(geoLibrary.box, gunMatDark);
    lightUnit.scale.set(0.035, 0.03, 0.08); lightUnit.position.set(0, -0.055, -0.07); group.add(lightUnit);
    const lightLens = new THREE.Mesh(geoLibrary.cylinder, new THREE.MeshBasicMaterial({color: 0xffffff}));
    lightLens.scale.set(0.012, 0.01, 0.012); lightLens.rotation.x = Math.PI/2; lightLens.position.set(0, -0.055, -0.111); group.add(lightLens);

    // Muzzle Flash Anchor (Initially Invisible)
    const flashGroup = new THREE.Group();
    flashGroup.position.set(0, 0.01, -0.12);
    flashGroup.name = "muzzleFlash";
    flashGroup.visible = false;
    
    const flashCore = new THREE.Mesh(geoLibrary.cone, new THREE.MeshBasicMaterial({color: 0xffaa44, transparent: true, opacity: 0.9}));
    flashCore.scale.set(0.06, 0.1, 0.06); flashCore.rotation.x = -Math.PI / 2; flashCore.position.set(0, 0, -0.05);
    flashGroup.add(flashCore);

    const flashLight = new THREE.PointLight(0xff9900, 1.5, 10);
    flashLight.position.set(0, 0, -0.05);
    flashGroup.add(flashLight);
    group.add(flashGroup);

    return group;
}

const m4Model = buildM4A3();
const pistolModel = buildPistol();
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

// --- 5. SHOOTING & SOUND MECHANICS ---
const bulletRaycaster = new THREE.Raycaster();

function emitGunshotSound(origin, volumeRadius) {
    let alertedCount = 0; 
    const MAX_RUSHERS = 2; 

    // Shuffle enemies array to randomize who investigates
    let shuffledEnemies = enemies.sort(() => 0.5 - Math.random());

    shuffledEnemies.forEach(e => {
        if (e.isDead || e.state === 'alert' || alertedCount >= MAX_RUSHERS) return;
        
        let dist = e.group.position.distanceTo(origin);
        if (dist < volumeRadius) {
            let chance = 1.0 - (dist / volumeRadius);
            if (Math.random() < chance) {
                e.investigate(origin.clone());
                alertedCount++;
            }
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

    // Recoil
    recoilKick.y += currentWeapon.recoilAmt;
    recoilKick.z += currentWeapon.recoilAmt * 2;
    recoilKick.x += (Math.random() - 0.5) * currentWeapon.recoilAmt;

    // Trigger visual muzzle flash
    const activeModel = activeWeaponKey === 'm4a3' ? m4Model : pistolModel;
    const mFlash = activeModel.getObjectByName("muzzleFlash");
    if (mFlash) {
        mFlash.visible = true;
        mFlash.rotation.z = Math.random() * Math.PI * 2;
        setTimeout(() => { mFlash.visible = false; }, 40);
    }

    // Emit Noise to AI
    emitGunshotSound(camera.position, 60);

    // Hitscan
    bulletRaycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = bulletRaycaster.intersectObjects(scene.children, true);
    
    for (let hit of hits) {
        if(!hit.object.visible) continue;
        
        if (hit.object.userData && hit.object.userData.isEnemy) {
            let multiplier = hit.object.userData.multiplier;
            let dmg = currentWeapon.damage * multiplier;
            hit.object.userData.parent.takeDamage(dmg);
            spawnImpactSpark(hit.point, new THREE.Vector3(1,0,0)); // Trigger blood splash
            break; 
        } 
        else if (hit.object.geometry && !hit.object.userData.isDoor) {
            spawnImpactSpark(hit.point, hit.face.normal);
            break; 
        }
    }
}

function spawnImpactSpark(pos, normal) {
    // Check if the coordinate indicates blood flash color
    const isBlood = (normal.x === 1 && normal.y === 0 && normal.z === 0);
    const sparkColor = isBlood ? 0xb30000 : 0xffcc44;
    const count = isBlood ? 8 : 5;
    
    for (let i = 0; i < count; i++) {
        const size = 0.05 + Math.random() * 0.05;
        const sparkMat = new THREE.MeshBasicMaterial({
            color: sparkColor,
            transparent: true,
            opacity: 0.95
        });
        const spark = new THREE.Mesh(geoLibrary.box, sparkMat);
        spark.scale.set(size, size, size);
        spark.position.copy(pos);
        scene.add(spark);
        
        // Push outward along normal vector with structural noise
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 6
        );
        if (!isBlood) {
            velocity.addScaledVector(normal, 8); // Spray outward from wall
        } else {
            velocity.y -= 2.0; // Blood drops slightly downward
        }
        
        visualParticles.push({
            mesh: spark,
            velocity: velocity,
            spawnTime: performance.now()
        });
    }
}

// --- 6. ADVANCED ENEMY AI ---
const enemyMatVest = new THREE.MeshStandardMaterial({ color: 0x1f231e, roughness: 0.8 }); // Tactical Camo Green
const enemyMatSkin = new THREE.MeshStandardMaterial({ color: 0xcc9966, roughness: 0.6 }); 
const enemyMatPants = new THREE.MeshStandardMaterial({ color: 0x222224, roughness: 0.85 }); 

class TacticalEnemy {
    constructor(x, y, z) {
        this.hp = 100;
        this.isDead = false;
        this.group = new THREE.Group();
        this.group.position.set(x, y, z);
        
        // Build Hitboxes
        const createPart = (w, h, d, yOff, mat, mult, name) => {
            const mesh = new THREE.Mesh(geoLibrary.box, mat);
            mesh.scale.set(w, h, d); mesh.position.y = yOff;
            mesh.userData = { isEnemy: true, parent: this, multiplier: mult, part: name };
            this.group.add(mesh);
            enemyHitboxes.push(mesh);
            return mesh;
        };

        this.torso = createPart(1.2, 1.8, 0.8, 3.5, enemyMatVest, 1.0, 'torso');
        this.head = createPart(0.6, 0.6, 0.6, 4.8, enemyMatSkin, 10.0, 'head'); 
        this.legL = createPart(0.4, 2.5, 0.4, 1.3, enemyMatPants, 0.5, 'legL'); this.legL.position.x = -0.3;
        this.legR = createPart(0.4, 2.5, 0.4, 1.3, enemyMatPants, 0.5, 'legR'); this.legR.position.x = 0.3;
        this.armL = createPart(0.3, 1.6, 0.3, 3.5, enemyMatVest, 0.5, 'armL'); this.armL.position.x = -0.8;
        this.armR = createPart(0.3, 1.6, 0.3, 3.5, enemyMatVest, 0.5, 'armR'); this.armR.position.x = 0.8;

        // Custom Visual-Only Commando Uniform Accessories (No hitboxes generated to maintain exact collision maps)
        const helmetMat = new THREE.MeshStandardMaterial({ color: 0x3d3d33, roughness: 0.85 });
        const helmet = new THREE.Mesh(geoLibrary.box, helmetMat);
        helmet.scale.set(0.68, 0.35, 0.68); helmet.position.set(0, 5.05, 0);
        this.group.add(helmet);
        
        const earL = new THREE.Mesh(geoLibrary.box, gunMatDark);
        earL.scale.set(0.05, 0.25, 0.15); earL.position.set(-0.31, 4.95, 0);
        this.group.add(earL);
        const earR = new THREE.Mesh(geoLibrary.box, gunMatDark);
        earR.scale.set(0.05, 0.25, 0.15); earR.position.set(0.31, 4.95, 0);
        this.group.add(earR);

        const nvgShroud = new THREE.Mesh(geoLibrary.box, gunMatMetal);
        nvgShroud.scale.set(0.12, 0.12, 0.05); nvgShroud.position.set(0, 5.0, -0.33);
        this.group.add(nvgShroud);

        const goggleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.9 });
        const goggles = new THREE.Mesh(geoLibrary.box, goggleMat);
        goggles.scale.set(0.56, 0.16, 0.15); goggles.position.set(0, 4.82, -0.28);
        this.group.add(goggles);
        const strap = new THREE.Mesh(geoLibrary.box, gunMatDark);
        strap.scale.set(0.62, 0.08, 0.62); strap.position.set(0, 4.82, 0);
        this.group.add(strap);

        const faceMask = new THREE.Mesh(geoLibrary.box, gunMatDark);
        faceMask.scale.set(0.58, 0.25, 0.58); faceMask.position.set(0, 4.6, 0.01);
        this.group.add(faceMask);

        const chestPlates = new THREE.Mesh(geoLibrary.box, gunMatDark);
        chestPlates.scale.set(1.24, 1.5, 0.9); chestPlates.position.set(0, 3.5, 0);
        this.group.add(chestPlates);

        // MOLLE Chest Pouches
        for (let i = -0.35; i <= 0.35; i += 0.35) {
            const p = new THREE.Mesh(geoLibrary.box, new THREE.MeshStandardMaterial({color: 0x162015, roughness: 0.85}));
            p.scale.set(0.24, 0.5, 0.15); p.position.set(i, 3.2, -0.48);
            this.group.add(p);
        }

        const radioAntenna = new THREE.Mesh(geoLibrary.cylinder, gunMatDark);
        radioAntenna.scale.set(0.015, 0.8, 0.015); radioAntenna.position.set(-0.45, 4.6, 0.3);
        this.group.add(radioAntenna);

        const padMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });
        const kneeL = new THREE.Mesh(geoLibrary.box, padMat);
        kneeL.scale.set(0.48, 0.3, 0.2); kneeL.position.set(-0.3, 1.3, -0.22);
        this.group.add(kneeL);
        const kneeR = new THREE.Mesh(geoLibrary.box, padMat);
        kneeR.scale.set(0.48, 0.3, 0.2); kneeR.position.set(0.3, 1.3, -0.22);
        this.group.add(kneeR);

        const elbowL = new THREE.Mesh(geoLibrary.box, padMat);
        elbowL.scale.set(0.22, 0.25, 0.38); elbowL.position.set(-0.85, 3.3, 0);
        this.group.add(elbowL);
        const elbowR = new THREE.Mesh(geoLibrary.box, padMat);
        elbowR.scale.set(0.22, 0.25, 0.38); elbowR.position.set(0.85, 3.3, 0);
        this.group.add(elbowR);

        const bootMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
        const bootL = new THREE.Mesh(geoLibrary.box, bootMat);
        bootL.scale.set(0.44, 0.4, 0.65); bootL.position.set(-0.3, 0.2, -0.1);
        this.group.add(bootL);
        const bootR = new THREE.Mesh(geoLibrary.box, bootMat);
        bootR.scale.set(0.44, 0.4, 0.65); bootR.position.set(0.3, 0.2, -0.1);
        this.group.add(bootR);

        // Weapon
        this.gun = new THREE.Mesh(geoLibrary.box, gunMatDark);
        this.gun.scale.set(0.1, 0.2, 0.8); this.gun.position.set(0.5, 3.3, 0.5);
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
        
        if (this.state !== 'alert') {
            this.state = 'alert';
            this.reactionTimer = 1.0; 
        }
        
        this.group.rotation.x -= 0.2; 

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

    walkTowards(dest, speed, delta) {
        let dir = new THREE.Vector3().subVectors(dest, this.group.position);
        dir.y = 0;
        if (dir.length() < 1.0) return true; 
        
        dir.normalize();

        // 1. Check for blocking doors
        bulletRaycaster.set(this.group.position, dir);
        const hits = bulletRaycaster.intersectObjects(scene.children, true);
        for(let hit of hits) {
            if (hit.distance > 3.0) break; 
            if (hit.object.userData && hit.object.userData.isDoor) {
                hit.object.userData.doorObj.open(); 
            }
        }

        // 2. Move
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

        // Vision Check
        const distToPlayer = this.group.position.distanceTo(camera.position);
        let seesPlayer = false;

        if (distToPlayer < 50) {
            const headPos = new THREE.Vector3();
            this.head.getWorldPosition(headPos);
            const dir = new THREE.Vector3().subVectors(camera.position, headPos).normalize();
            
            bulletRaycaster.set(headPos, dir);
            const hits = bulletRaycaster.intersectObjects(scene.children, true);
            
            for(let hit of hits) {
                if(hit.object === this.head || hit.object === this.torso || hit.object.userData.isEnemy) continue; 
                if(hit.distance > distToPlayer) { seesPlayer = true; break; } 
                else { break; } 
            }
        }

        // State Machine
        if (seesPlayer) {
            this.state = 'alert';
            this.reactionTimer += delta; 

            const targetRot = Math.atan2(camera.position.x - this.group.position.x, camera.position.z - this.group.position.z);
            this.group.rotation.y = targetRot;

            if (this.reactionTimer > 0.6) {
                if (Date.now() - this.lastShot > 600) { 
                    this.lastShot = Date.now();
                    
                    // Show visual muzzle flash on enemy gun
                    const eFlash = this.gun.getObjectByName("muzzleFlash");
                    if (eFlash) {
                        eFlash.visible = true;
                        setTimeout(() => { eFlash.visible = false; }, 40);
                    } else {
                        // Create visual-only muzzle flash once on the tip of the enemy gun barrel
                        const flashGroup = new THREE.Group();
                        flashGroup.name = "muzzleFlash";
                        flashGroup.position.set(0, 0, 0.45);
                        
                        const flashCore = new THREE.Mesh(geoLibrary.cone, new THREE.MeshBasicMaterial({color: 0xffa500, transparent: true, opacity: 0.95}));
                        flashCore.scale.set(0.12, 0.22, 0.12); flashCore.rotation.x = Math.PI / 2;
                        flashGroup.add(flashCore);
                        
                        this.gun.add(flashGroup);
                        flashGroup.visible = true;
                        setTimeout(() => { flashGroup.visible = false; }, 40);
                    }
                    
                    spawnImpactSpark(this.gun.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(0,1,0));
                    
                    let accuracyRoll = Math.random();
                    let hitChance = distToPlayer < 10 ? 0.6 : 0.3;

                    if (accuracyRoll < hitChance) playerHit(15);
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
                    if (this.waitTimer > 5.0) { 
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

    pitch += 0.1; yaw += (Math.random() - 0.5) * 0.1;
    camera.rotation.set(pitch, yaw, 0, 'YXZ');

    if (playerHP <= 0) {
        document.body.innerHTML = "<div style='color:red; font-size:50px; font-family:Courier New; width:100%; height:100%; display:flex; justify-content:center; align-items:center; background:black;'>KIA - REFRESH TO RESTART</div>";
    }
}

// Spawn Roaming Enemies
new TacticalEnemy(25, 2, 0);   
new TacticalEnemy(-25, 2, 0);  
new TacticalEnemy(25, 12, -20); 
new TacticalEnemy(-25, 12, -10); 
new TacticalEnemy(0, 12, -25);   

// --- 8. HOOK INTO THE MAIN LOOP ---
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

    // Update and animate flying spark particles with real-time gravity
    visualParticles.forEach(p => {
        p.mesh.position.addScaledVector(p.velocity, delta);
        p.velocity.y -= 9.8 * delta; // Gravity scale
        p.mesh.scale.multiplyScalar(0.92); // Shrink factor
    });
    
    // Dispose resources of expired particles to prevent leaks
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
