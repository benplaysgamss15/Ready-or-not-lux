// ==========================================
// TACTICAL ENTRY - ADVANCED AI & WEAPONS PATCH
// ==========================================
console.log("Advanced AI Patch Loaded!");

// --- 1. NEW GLOBALS & STATE ---
var enemies = [];
var enemyHitboxes =[];
var currentWeapon = null;
var isAiming = false;
var isFiring = false;
var playerHP = 100;
var recoilKick = { x: 0, y: 0, z: 0 };
var sway = { x: 0, y: 0 };
var lastPatchTime = performance.now(); // For AI Delta Time

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
        // Perfectly calibrated center for the Red Dot
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
const gunMatDark = new THREE.MeshLambertMaterial({ color: 0x111111 });
const gunMatMetal = new THREE.MeshLambertMaterial({ color: 0x333333 });
const redDotMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

function buildM4A3() {
    const group = new THREE.Group();
    const rec = new THREE.Mesh(geoLibrary.box, gunMatDark);
    rec.scale.set(0.06, 0.1, 0.3); group.add(rec);
    const barrel = new THREE.Mesh(geoLibrary.cylinder, gunMatMetal);
    barrel.scale.set(0.015, 0.4, 0.015); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.02, -0.3); group.add(barrel);
    const mag = new THREE.Mesh(geoLibrary.box, gunMatDark);
    mag.scale.set(0.05, 0.15, 0.08); mag.position.set(0, -0.1, -0.05); mag.rotation.x = -0.1; group.add(mag);
    const stock = new THREE.Mesh(geoLibrary.box, gunMatDark);
    stock.scale.set(0.05, 0.1, 0.25); stock.position.set(0, -0.02, 0.25); group.add(stock);
    const handle = new THREE.Mesh(geoLibrary.box, gunMatDark);
    handle.scale.set(0.04, 0.12, 0.06); handle.position.set(0, -0.1, 0.1); handle.rotation.x = 0.2; group.add(handle);
    
    // Sight aligned precisely
    const sightBase = new THREE.Mesh(geoLibrary.box, gunMatDark);
    sightBase.scale.set(0.05, 0.05, 0.05); sightBase.position.set(0, 0.07, -0.05); group.add(sightBase);
    const glass = new THREE.Mesh(geoLibrary.plane, new THREE.MeshBasicMaterial({color:0x55aaff, transparent:true, opacity:0.2}));
    glass.scale.set(0.04, 0.04, 1); glass.position.set(0, 0.095, -0.05); group.add(glass);
    
    const dot = new THREE.Mesh(geoLibrary.plane, redDotMat);
    dot.scale.set(0.006, 0.006, 1); dot.position.set(0, 0.095, -0.051); group.add(dot); 
    
    return group;
}

function buildPistol() {
    const group = new THREE.Group();
    const slide = new THREE.Mesh(geoLibrary.box, gunMatMetal);
    slide.scale.set(0.04, 0.05, 0.2); group.add(slide);
    const grip = new THREE.Mesh(geoLibrary.box, gunMatDark);
    grip.scale.set(0.035, 0.1, 0.06); grip.position.set(0, -0.06, 0.05); grip.rotation.x = 0.15; group.add(grip);
    
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

// --- 5. SHOOTING & SOUND MECHANICS ---
const bulletRaycaster = new THREE.Raycaster();

function emitGunshotSound(origin, volumeRadius) {
    // Limits the amount of enemies that rush you to prevent swarming
    let alertedCount = 0; 
    const MAX_RUSHERS = 2; 

    // Shuffle enemies array to randomize who investigates
    let shuffledEnemies = enemies.sort(() => 0.5 - Math.random());

    shuffledEnemies.forEach(e => {
        if (e.isDead || e.state === 'alert' || alertedCount >= MAX_RUSHERS) return;
        
        let dist = e.group.position.distanceTo(origin);
        if (dist < volumeRadius) {
            // Chance to hear falls off with distance
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
            spawnImpactSpark(hit.point, new THREE.Vector3(1,0,0)); // Blood flash
            break; 
        } 
        else if (hit.object.geometry && !hit.object.userData.isDoor) {
            spawnImpactSpark(hit.point, hit.face.normal);
            break; 
        }
    }
}

function spawnImpactSpark(pos, colorVec) {
    const sparkMat = new THREE.MeshBasicMaterial({color: colorVec.x > 0.5 && colorVec.y === 0 ? 0xff0000 : 0xffddaa});
    const spark = new THREE.Mesh(geoLibrary.box, sparkMat);
    spark.scale.set(0.1, 0.1, 0.1); spark.position.copy(pos);
    scene.add(spark);
    setTimeout(() => scene.remove(spark), 100);
}

// --- 6. ADVANCED ENEMY AI ---
const enemyMatVest = new THREE.MeshLambertMaterial({ color: 0x222222 }); 
const enemyMatSkin = new THREE.MeshLambertMaterial({ color: 0xcc9966 }); 
const enemyMatPants = new THREE.MeshLambertMaterial({ color: 0x3b3a36 }); 

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
        this.head = createPart(0.6, 0.6, 0.6, 4.8, enemyMatSkin, 10.0, 'head'); // Headshot
        this.legL = createPart(0.4, 2.5, 0.4, 1.3, enemyMatPants, 0.5, 'legL'); this.legL.position.x = -0.3;
        this.legR = createPart(0.4, 2.5, 0.4, 1.3, enemyMatPants, 0.5, 'legR'); this.legR.position.x = 0.3;
        this.armL = createPart(0.3, 1.6, 0.3, 3.5, enemyMatVest, 0.5, 'armL'); this.armL.position.x = -0.8;
        this.armR = createPart(0.3, 1.6, 0.3, 3.5, enemyMatVest, 0.5, 'armR'); this.armR.position.x = 0.8;

        this.gun = new THREE.Mesh(geoLibrary.box, gunMatDark);
        this.gun.scale.set(0.1, 0.2, 0.8); this.gun.position.set(0.5, 3.3, 0.5);
        this.group.add(this.gun);

        scene.add(this.group);
        enemies.push(this);

        this.state = 'patrol'; // idle, patrol, investigate, alert
        this.targetPos = this.getRandomPatrolPoint();
        this.reactionTimer = 0; // Delay before firing
        this.lastShot = 0;
        this.waitTimer = 0;
    }

    getRandomPatrolPoint() {
        // Wanders within ~10 units of current spot
        return new THREE.Vector3(
            this.group.position.x + (Math.random() - 0.5) * 15,
            this.group.position.y,
            this.group.position.z + (Math.random() - 0.5) * 15
        );
    }

    investigate(pos) {
        if (this.state === 'alert') return; // Don't get distracted if fighting
        this.state = 'investigate';
        this.targetPos = pos;
    }

    takeDamage(amt) {
        if (this.isDead) return;
        this.hp -= amt;
        
        // Instantly snap to alert if shot from behind
        if (this.state !== 'alert') {
            this.state = 'alert';
            this.reactionTimer = 1.0; // Skip reaction time if they get shot
        }
        
        this.group.rotation.x -= 0.2; // Flinch

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

    // Helper to safely navigate and open doors
    walkTowards(dest, speed, delta) {
        let dir = new THREE.Vector3().subVectors(dest, this.group.position);
        dir.y = 0;
        if (dir.length() < 1.0) return true; // Reached target
        
        dir.normalize();

        // 1. Check for doors blocking the path
        bulletRaycaster.set(this.group.position, dir);
        const hits = bulletRaycaster.intersectObjects(scene.children, true);
        for(let hit of hits) {
            if (hit.distance > 3.0) break; 
            if (hit.object.userData && hit.object.userData.isDoor) {
                hit.object.userData.doorObj.open(); // Push door open
            }
        }

        // 2. Move and apply collisions
        let nextPos = this.group.position.clone();
        nextPos.x += dir.x * speed * delta * 50;
        nextPos.z += dir.z * speed * delta * 50;

        // Custom AI Collision Check (re-using global colliders array)
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
        
        // Ground them properly to stairs/floors using main script's function
        if (typeof calculateFloorY === 'function') {
            this.group.position.y = calculateFloorY(this.group.position.x, this.group.position.z, this.group.position.y);
        }

        // Rotate body
        this.group.rotation.y = Math.atan2(dir.x, dir.z);
        return false;
    }

    update(delta) {
        if (this.isDead) return;
        this.group.rotation.x += (0 - this.group.rotation.x) * 0.1; // Recover flinch

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
                else { break; } // Wall blocked view
            }
        }

        // State Machine
        if (seesPlayer) {
            this.state = 'alert';
            this.reactionTimer += delta; // Reaction Time Build-up

            // Turn to face player
            const targetRot = Math.atan2(camera.position.x - this.group.position.x, camera.position.z - this.group.position.z);
            this.group.rotation.y = targetRot;

            // Firing logic (Only shoot if reaction time > 0.6 seconds)
            if (this.reactionTimer > 0.6) {
                if (Date.now() - this.lastShot > 600) { 
                    this.lastShot = Date.now();
                    spawnImpactSpark(this.gun.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(0,1,0));
                    
                    // Add inaccuracy based on distance (closer = more accurate)
                    let accuracyRoll = Math.random();
                    let hitChance = distToPlayer < 10 ? 0.6 : 0.3;

                    if (accuracyRoll < hitChance) playerHit(15);
                }
            }
        } else {
            // Lost Sight
            this.reactionTimer = Math.max(0, this.reactionTimer - delta);

            if (this.state === 'alert') {
                // If they lose sight, investigate last known pos
                this.investigate(camera.position.clone());
            } 
            else if (this.state === 'investigate') {
                let reached = this.walkTowards(this.targetPos, 0.08, delta); // Fast walk
                if (reached) {
                    this.waitTimer += delta;
                    if (this.waitTimer > 5.0) { // Look around for 5 seconds
                        this.state = 'patrol';
                        this.waitTimer = 0;
                    }
                }
            } 
            else if (this.state === 'patrol') {
                let reached = this.walkTowards(this.targetPos, 0.03, delta); // Slow patrol
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

    updateHUD(); // Updates crosshair dynamic hiding

    enemies.forEach(e => e.update(delta));

    originalRender(s, c);
};
