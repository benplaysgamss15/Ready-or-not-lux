// ==========================================
// TACTICAL ENTRY - MONKEY PATCH MODULE
// ==========================================
// This script hooks directly into the global variables from the main HTML file.

console.log("Tactical Patch Loaded!");

// --- 1. NEW GLOBALS & STATE ---
var enemies = [];
var enemyHitboxes =[];
var currentWeapon = null;
var isAiming = false;
var isFiring = false;
var playerHP = 100;
var recoilKick = { x: 0, y: 0, z: 0 };
var sway = { x: 0, y: 0 };

// --- 2. WEAPON PROFILES ---
const WEAPONS = {
    pistol: {
        name: "Glock 19",
        damage: 25,
        magSize: 15,
        ammo: 15,
        fireRate: 200, // ms between shots
        isAuto: false,
        recoilAmt: 0.05,
        reloadTime: 1200,
        hipOffset: new THREE.Vector3(0.2, -0.25, -0.5),
        aimOffset: new THREE.Vector3(0, -0.15, -0.4),
        lastFire: 0,
        isReloading: false
    },
    m4a3: {
        name: "M4A3 Tactical",
        damage: 34, // 3 body shots to kill 100HP
        magSize: 30,
        ammo: 30,
        fireRate: 90, 
        isAuto: true,
        recoilAmt: 0.03,
        reloadTime: 2000,
        hipOffset: new THREE.Vector3(0.3, -0.3, -0.6),
        aimOffset: new THREE.Vector3(0, -0.22, -0.4), // Perfect red dot alignment
        lastFire: 0,
        isReloading: false
    }
};

let activeWeaponKey = 'm4a3';

// --- 3. UI INJECTION ---
function setupTacticalUI() {
    const uiContainer = document.getElementById('ui');

    // Ammo & Health Counter
    const hudInfo = document.createElement('div');
    hudInfo.id = 'hud-info';
    hudInfo.style.cssText = "position:absolute; bottom:20px; left:20px; color:white; font-size:24px; text-shadow: 2px 2px #000; font-family:'Courier New'; font-weight:bold;";
    uiContainer.appendChild(hudInfo);

    // Damage Overlay (Red Flash)
    const dmgOverlay = document.createElement('div');
    dmgOverlay.id = 'dmg-overlay';
    dmgOverlay.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; background:red; opacity:0; pointer-events:none; transition: opacity 0.2s; z-index:5;";
    uiContainer.appendChild(dmgOverlay);

    if (isMobile) {
        // Weapon Switch Button
        const swapBtn = document.createElement('div');
        swapBtn.innerText = "SWITCH";
        swapBtn.style.cssText = "position:absolute; top:20px; right:20px; width:80px; height:50px; background:rgba(200,200,200,0.3); border:2px solid white; display:flex; justify-content:center; align-items:center; color:white; font-weight:bold; pointer-events:auto; z-index:100;";
        swapBtn.addEventListener('touchstart', (e) => { e.preventDefault(); toggleWeapon(); });
        uiContainer.appendChild(swapBtn);

        // Fire Button
        const fireBtn = document.createElement('div');
        fireBtn.style.cssText = "position:absolute; bottom:40px; right:40px; width:90px; height:90px; border-radius:50%; background:rgba(255,50,50,0.4); border:3px solid #ff3333; pointer-events:auto; z-index:100;";
        fireBtn.addEventListener('touchstart', (e) => { e.preventDefault(); isFiring = true; });
        fireBtn.addEventListener('touchend', (e) => { e.preventDefault(); isFiring = false; });
        uiContainer.appendChild(fireBtn);

        // Aim Button
        const aimBtn = document.createElement('div');
        aimBtn.style.cssText = "position:absolute; bottom:150px; right:60px; width:70px; height:70px; border-radius:50%; background:rgba(255,255,255,0.3); border:2px solid white; pointer-events:auto; z-index:100;";
        aimBtn.addEventListener('touchstart', (e) => { e.preventDefault(); isAiming = !isAiming; });
        uiContainer.appendChild(aimBtn);

        // Reload Button
        const reloadBtn = document.createElement('div');
        reloadBtn.innerText = "RELOAD";
        reloadBtn.style.cssText = "position:absolute; bottom:40px; left:40px; width:80px; height:80px; border-radius:50%; background:rgba(100,100,100,0.4); border:2px solid #aaa; color:white; display:flex; justify-content:center; align-items:center; font-weight:bold; pointer-events:auto; z-index:100;";
        reloadBtn.addEventListener('touchstart', (e) => { e.preventDefault(); reloadWeapon(); });
        uiContainer.appendChild(reloadBtn);
    } else {
        // PC Controls Hook
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
}

// --- 4. PROCEDURAL GUN BUILDER ---
const gunMatDark = new THREE.MeshLambertMaterial({ color: 0x111111 });
const gunMatMetal = new THREE.MeshLambertMaterial({ color: 0x333333 });
const redDotMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

function buildM4A3() {
    const group = new THREE.Group();
    // Receiver
    const rec = new THREE.Mesh(geoLibrary.box, gunMatDark);
    rec.scale.set(0.06, 0.1, 0.3); group.add(rec);
    // Barrel
    const barrel = new THREE.Mesh(geoLibrary.cylinder, gunMatMetal);
    barrel.scale.set(0.015, 0.4, 0.015); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.02, -0.3); group.add(barrel);
    // Magazine
    const mag = new THREE.Mesh(geoLibrary.box, gunMatDark);
    mag.scale.set(0.05, 0.15, 0.08); mag.position.set(0, -0.1, -0.05); mag.rotation.x = -0.1; group.add(mag);
    // Stock
    const stock = new THREE.Mesh(geoLibrary.box, gunMatDark);
    stock.scale.set(0.05, 0.1, 0.25); stock.position.set(0, -0.02, 0.25); group.add(stock);
    // Handle
    const handle = new THREE.Mesh(geoLibrary.box, gunMatDark);
    handle.scale.set(0.04, 0.12, 0.06); handle.position.set(0, -0.1, 0.1); handle.rotation.x = 0.2; group.add(handle);
    // Red Dot Sight
    const sightBase = new THREE.Mesh(geoLibrary.box, gunMatDark);
    sightBase.scale.set(0.05, 0.05, 0.05); sightBase.position.set(0, 0.07, -0.05); group.add(sightBase);
    const glass = new THREE.Mesh(geoLibrary.plane, new THREE.MeshBasicMaterial({color:0x55aaff, transparent:true, opacity:0.3}));
    glass.scale.set(0.04, 0.04, 1); glass.position.set(0, 0.09, -0.05); group.add(glass);
    const dot = new THREE.Mesh(geoLibrary.plane, redDotMat);
    dot.scale.set(0.005, 0.005, 1); dot.position.set(0, 0.09, -0.051); group.add(dot); // Floating dot
    
    return group;
}

function buildPistol() {
    const group = new THREE.Group();
    // Slide/Barrel
    const slide = new THREE.Mesh(geoLibrary.box, gunMatMetal);
    slide.scale.set(0.04, 0.05, 0.2); group.add(slide);
    // Grip
    const grip = new THREE.Mesh(geoLibrary.box, gunMatDark);
    grip.scale.set(0.035, 0.1, 0.06); grip.position.set(0, -0.06, 0.05); grip.rotation.x = 0.15; group.add(grip);
    // Iron Sights
    const frontSight = new THREE.Mesh(geoLibrary.box, gunMatDark);
    frontSight.scale.set(0.01, 0.02, 0.01); frontSight.position.set(0, 0.03, -0.09); group.add(frontSight);
    const backSight = new THREE.Mesh(geoLibrary.box, gunMatDark);
    backSight.scale.set(0.03, 0.02, 0.01); backSight.position.set(0, 0.03, 0.09); group.add(backSight);

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

// --- 5. SHOOTING MECHANICS ---
const bulletRaycaster = new THREE.Raycaster();

function reloadWeapon() {
    const w = WEAPONS[activeWeaponKey];
    if (w.isReloading || w.ammo === w.magSize) return;
    w.isReloading = true;
    updateHUD();
    
    // Fake reload animation by pushing gun down
    recoilKick.y = -0.5;
    recoilKick.x = 0.5;

    setTimeout(() => {
        w.ammo = w.magSize;
        w.isReloading = false;
        updateHUD();
    }, w.reloadTime);
}

function fireWeapon() {
    if (!currentWeapon || currentWeapon.isReloading || currentWeapon.ammo <= 0) {
        if(currentWeapon && currentWeapon.ammo <= 0 && isFiring && !currentWeapon.isAuto) reloadWeapon(); // Auto reload on empty click
        isFiring = false; // Force re-click for semi-auto empty
        return;
    }

    const now = Date.now();
    if (now - currentWeapon.lastFire < currentWeapon.fireRate) return;
    
    currentWeapon.lastFire = now;
    currentWeapon.ammo--;
    updateHUD();

    // Semi-auto lock
    if (!currentWeapon.isAuto) isFiring = false;

    // Visual Recoil
    recoilKick.y += currentWeapon.recoilAmt;
    recoilKick.z += currentWeapon.recoilAmt * 2;
    recoilKick.x += (Math.random() - 0.5) * currentWeapon.recoilAmt;

    // Hitscan Raycast
    bulletRaycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    
    // Check against ALL scene children (walls + enemies)
    const hits = bulletRaycaster.intersectObjects(scene.children, true);
    
    for (let hit of hits) {
        // Ignore invisible bounds/triggers
        if(!hit.object.visible) continue;
        
        if (hit.object.userData && hit.object.userData.isEnemy) {
            let multiplier = hit.object.userData.multiplier;
            let dmg = currentWeapon.damage * multiplier;
            hit.object.userData.parent.takeDamage(dmg);
            break; // Stop bullet
        } 
        else if (hit.object.geometry && !hit.object.userData.isDoor) {
            // Hit a wall/floor!
            spawnImpactSpark(hit.point, hit.face.normal);
            break; // Bullet stops at wall
        }
    }
}

// Spark Effect
function spawnImpactSpark(pos, normal) {
    const sparkMat = new THREE.MeshBasicMaterial({color: 0xffddaa});
    const spark = new THREE.Mesh(geoLibrary.box, sparkMat);
    spark.scale.set(0.1, 0.1, 0.1);
    spark.position.copy(pos);
    scene.add(spark);
    setTimeout(() => scene.remove(spark), 100);
}

// --- 6. ENEMIES (READY OR NOT STYLE) ---
const enemyMatVest = new THREE.MeshLambertMaterial({ color: 0x222222 }); // Tactical Vest
const enemyMatSkin = new THREE.MeshLambertMaterial({ color: 0xcc9966 }); // Skin
const enemyMatPants = new THREE.MeshLambertMaterial({ color: 0x3b3a36 }); // Cargo pants

class TacticalEnemy {
    constructor(x, y, z) {
        this.hp = 100;
        this.isDead = false;
        this.group = new THREE.Group();
        this.group.position.set(x, y, z);
        
        // Build Hitboxes
        const createPart = (w, h, d, yOff, mat, mult, name) => {
            const mesh = new THREE.Mesh(geoLibrary.box, mat);
            mesh.scale.set(w, h, d);
            mesh.position.y = yOff;
            mesh.userData = { isEnemy: true, parent: this, multiplier: mult, part: name };
            this.group.add(mesh);
            enemyHitboxes.push(mesh);
            return mesh;
        };

        // Torso (1.0x)
        this.torso = createPart(1.2, 1.8, 0.8, 3.5, enemyMatVest, 1.0, 'torso');
        // Head (10.0x Instakill)
        this.head = createPart(0.6, 0.6, 0.6, 4.8, enemyMatSkin, 10.0, 'head');
        // Legs (0.5x)
        this.legL = createPart(0.4, 2.5, 0.4, 1.3, enemyMatPants, 0.5, 'legL'); this.legL.position.x = -0.3;
        this.legR = createPart(0.4, 2.5, 0.4, 1.3, enemyMatPants, 0.5, 'legR'); this.legR.position.x = 0.3;
        // Arms (0.5x)
        this.armL = createPart(0.3, 1.6, 0.3, 3.5, enemyMatVest, 0.5, 'armL'); this.armL.position.x = -0.8;
        this.armR = createPart(0.3, 1.6, 0.3, 3.5, enemyMatVest, 0.5, 'armR'); this.armR.position.x = 0.8;

        // Enemy Gun
        this.gun = new THREE.Mesh(geoLibrary.box, gunMatDark);
        this.gun.scale.set(0.1, 0.2, 0.8);
        this.gun.position.set(0.5, 3.3, 0.5);
        this.group.add(this.gun);

        scene.add(this.group);
        enemies.push(this);

        this.lastShot = 0;
        this.state = 'idle'; // idle, alert
    }

    takeDamage(amt) {
        if (this.isDead) return;
        this.hp -= amt;
        this.state = 'alert'; // Aggro if shot from behind
        
        // Flinch
        this.group.rotation.x -= 0.2;

        if (this.hp <= 0) {
            this.isDead = true;
            // Death Animation (Tip over)
            let fall = 0;
            const dieAnim = setInterval(() => {
                fall += 0.1;
                this.group.rotation.x = -fall;
                if(fall > Math.PI/2) {
                    this.group.rotation.x = -Math.PI/2;
                    clearInterval(dieAnim);
                }
            }, 16);
            
            // Remove hitboxes so bodies don't block bullets
            this.group.children.forEach(c => {
                if(c.userData.isEnemy) {
                    enemyHitboxes = enemyHitboxes.filter(h => h !== c);
                    c.userData.isEnemy = false; 
                }
            });
        }
    }

    update() {
        if (this.isDead) return;

        // Recover flinch
        this.group.rotation.x += (0 - this.group.rotation.x) * 0.1;

        // Vision Check
        const dist = this.group.position.distanceTo(camera.position);
        if (dist < 40) {
            // Line of Sight Raycast from Enemy Head to Player
            const headPos = new THREE.Vector3();
            this.head.getWorldPosition(headPos);
            
            const dir = new THREE.Vector3().subVectors(camera.position, headPos).normalize();
            bulletRaycaster.set(headPos, dir);
            
            // Look for walls blocking
            const hits = bulletRaycaster.intersectObjects(scene.children, true);
            let seesPlayer = false;
            
            for(let hit of hits) {
                if(hit.object === this.head || hit.object === this.torso) continue; // Ignore self
                if(hit.object.userData.isEnemy) continue; // Ignore other enemies
                if(hit.distance > dist) {
                    seesPlayer = true; // Hit nothing before reaching player distance
                    break; 
                } else {
                    break; // Hit a wall!
                }
            }

            if (seesPlayer) {
                this.state = 'alert';
                // Look at player (Y-axis only)
                const targetRot = Math.atan2(camera.position.x - this.group.position.x, camera.position.z - this.group.position.z);
                this.group.rotation.y = targetRot;

                // Shoot at player
                if (Date.now() - this.lastShot > 800) { // Slower fire rate
                    this.lastShot = Date.now();
                    spawnImpactSpark(this.gun.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(0,1,0));
                    
                    // Add inaccuracy
                    if(Math.random() > 0.4) {
                        playerHit(15);
                    }
                }
            } else {
                this.state = 'idle';
            }
        }
    }
}

function playerHit(dmg) {
    playerHP -= dmg;
    updateHUD();
    
    // Screen Flash Red
    const flash = document.getElementById('dmg-overlay');
    flash.style.opacity = 0.5;
    setTimeout(() => { flash.style.opacity = 0; }, 100);

    // Flinch Camera
    pitch += 0.1;
    yaw += (Math.random() - 0.5) * 0.1;
    camera.rotation.set(pitch, yaw, 0, 'YXZ');

    if (playerHP <= 0) {
        document.body.innerHTML = "<div style='color:red; font-size:50px; font-family:Courier New; width:100%; height:100%; display:flex; justify-content:center; align-items:center; background:black;'>KIA - REFRESH TO RESTART</div>";
    }
}

// --- 7. SPAWN ENEMIES ---
// Spawning them in specific rooms
new TacticalEnemy(25, 2, 0);   // Living Room
new TacticalEnemy(-25, 2, 0);  // Library
new TacticalEnemy(25, 12, -20); // 2F Bath
new TacticalEnemy(-25, 12, -10); // 2F Master Bed
new TacticalEnemy(0, 12, -25);   // Grand Hall Top Balcony

// --- 8. HOOK INTO THE MAIN LOOP (MONKEY PATCHING) ---
// We intercept the renderer to run our weapon math before rendering
const originalRender = renderer.render.bind(renderer);

renderer.render = function(s, c) {
    if (!currentWeapon) {
        setupTacticalUI();
        equipWeapon();
    }

    if (isFiring) fireWeapon();

    // Weapon Animation Math
    const w = currentWeapon;
    const model = activeWeaponKey === 'm4a3' ? m4Model : pistolModel;
    
    // Recoil recovery (Lerp back to 0)
    recoilKick.x += (0 - recoilKick.x) * 0.15;
    recoilKick.y += (0 - recoilKick.y) * 0.15;
    recoilKick.z += (0 - recoilKick.z) * 0.15;

    // Movement Sway
    if (moveDelta.x !== 0 || moveDelta.y !== 0 || keys.w || keys.a || keys.s || keys.d) {
        sway.x = Math.sin(walkTime * 2) * 0.01;
        sway.y = Math.abs(Math.cos(walkTime * 2)) * 0.01;
    } else {
        sway.x += (0 - sway.x) * 0.1;
        sway.y += (0 - sway.y) * 0.1;
    }

    // ADS target offset
    let target = isAiming ? w.aimOffset : w.hipOffset;

    // Apply everything to model position
    model.position.x += (target.x + sway.x - model.position.x) * 0.2;
    model.position.y += (target.y + sway.y + recoilKick.y - model.position.y) * 0.2;
    model.position.z += (target.z + recoilKick.z - model.position.z) * 0.2;
    
    // Apply pitch recoil to rotation
    model.rotation.x = recoilKick.y * 2;
    model.rotation.y = recoilKick.x;

    // Update Enemies
    enemies.forEach(e => e.update());

    // Execute original render
    originalRender(s, c);
};
