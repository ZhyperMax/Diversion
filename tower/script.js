(function () {
	const board = document.getElementById('tdBoard');
	const overlay = document.getElementById('tdOverlay');
	const mapImage = document.getElementById('mapImage');
	const hud = document.getElementById('tdHud');
	const btnStart = document.getElementById('btn-start');
	const btnReset = document.getElementById('btn-reset');
	const waveEl = document.getElementById('wave');
	const aliveEl = document.getElementById('alive');
	const towersEl = document.getElementById('towers');
	const livesEl = document.getElementById('lives');

	if (!board || !overlay || !mapImage || !hud || !btnStart || !btnReset || !waveEl || !aliveEl || !towersEl || !livesEl) return;

	const towerImg = './img/CannonTower.png';
	const enemyImg = './img/Swordsman.png';
	const bulletImg = './img/cannonball.png';
	// map data (normalized coords). Replace or paste your capture output here.
	const mapas = {
	  "mapa1": {
	    "rutas": [
	      {
	        "puntos": [
	          { "x": 0.1424, "y": 0.2952 },
	          { "x": 0.2446, "y": 0.2913 },
	          { "x": 0.2458, "y": 0.1371 },
	          { "x": 0.4166, "y": 0.1409 },
	          { "x": 0.4202, "y": 0.2335 },
	          { "x": 0.6715, "y": 0.2354 },
	          { "x": 0.6787, "y": 0.3511 },
	          { "x": 0.8254, "y": 0.3684 },
	          { "x": 0.8279, "y": 0.5805 },
	          { "x": 0.9385, "y": 0.5708 }
	        ],
	        "spawns": [
	          { "x": 0.0534, "y": 0.2932 },
	          { "x": 0.0762, "y": 0.6903 }
	        ],
	        "finales": [ { "x": 0.9421, "y": 0.4262 } ]
	      },
	      {
	        "puntos": [
	          { "x": 0.1376, "y": 0.6826 },
	          { "x": 0.2506, "y": 0.6768 },
	          { "x": 0.2542, "y": 0.5226 },
	          { "x": 0.3504, "y": 0.5265 },
	          { "x": 0.3492, "y": 0.6614 },
	          { "x": 0.6078, "y": 0.6788 },
	          { "x": 0.6126, "y": 0.7964 },
	          { "x": 0.6968, "y": 0.7848 },
	          { "x": 0.7040, "y": 0.6132 },
	          { "x": 0.9421, "y": 0.5805 }
	        ],
	        "spawns": [],
	        "finales": []
	      }
	    ],
	    "zonasTorres": [ [] ]
	  }
	};

	// Build usable paths from the mapas object for the current mapId (mapa1)
	const currentMapId = 'mapa1';
	const rawRoutes = (mapas[currentMapId] && mapas[currentMapId].rutas) || [];
	// combined pathPoints used for path detection (concatenate all route puntos)
	let pathPoints = [];
	for (const r of rawRoutes) {
		if (r.puntos && r.puntos.length) pathPoints = pathPoints.concat(r.puntos);
	}

	// Build spawnPaths by assigning each spawn (across all routes) to the nearest route point
	const spawnPaths = [];
	// collect all spawns with their originating route
	const allSpawns = [];
	rawRoutes.forEach((r, ri) => {
		(r.spawns || []).forEach(s => allSpawns.push({ spawn: s, routeIndex: ri }));
	});
	// if there are no explicit spawns, fallback: create one spawn per route at its first point
	if (allSpawns.length === 0) {
		rawRoutes.forEach((r, ri) => {
			if (r.puntos && r.puntos.length) {
				const fallbackSpawn = r.puntos[0];
				spawnPaths.push({ routeIndex: ri, spawn: fallbackSpawn, startPointIndex: 0 });
			}
		});
	} else {
		// for each spawn, find nearest route and nearest punto index
		allSpawns.forEach((entry) => {
			const s = entry.spawn;
			let bestRoute = -1, bestIdx = -1, bestD = Infinity;
			rawRoutes.forEach((r, ri) => {
				(r.puntos || []).forEach((pt, pi) => {
					const d = Math.hypot(s.x - pt.x, s.y - pt.y);
					if (d < bestD) { bestD = d; bestRoute = ri; bestIdx = pi; }
				});
			});
			if (bestRoute === -1) {
				// no route points -> attach to originating route start
				spawnPaths.push({ routeIndex: entry.routeIndex, spawn: s, startPointIndex: 0 });
			} else {
				spawnPaths.push({ routeIndex: bestRoute, spawn: s, startPointIndex: bestIdx });
			}
		});
	}
	// convert spawnPaths into concrete normalized path arrays (spawn -> puntos from startPointIndex -> final)
	for (let i = 0; i < spawnPaths.length; i++) {
		const sp = spawnPaths[i];
		const r = rawRoutes[sp.routeIndex];
		const pts = [];
		pts.push(sp.spawn);
		const from = sp.startPointIndex || 0;
		for (let j = from; j < (r.puntos || []).length; j++) pts.push(r.puntos[j]);
		if (r.finales && r.finales.length) pts.push(r.finales[0]);
		spawnPaths[i].path = pts;
	}

	const state = {
		running: false,
		finished: false,
		currentWave: 0,
		spawnedInWave: 0,
		spawnAccumulator: 0,
		betweenTimer: 0,
		lives: 10,
		towers: [],
		enemies: [],
		bullets: [],
		placedTowerIds: 0,
		lastTime: 0
	};

	const towerLayer = document.createElement('div');
	towerLayer.className = 'tower-layer';
	const enemyLayer = document.createElement('div');
	enemyLayer.className = 'enemy-layer';
	const bulletLayer = document.createElement('div');
	bulletLayer.className = 'bullet-layer';
	const placementMarker = document.createElement('div');
	placementMarker.className = 'td-placement';

	overlay.appendChild(towerLayer);
	overlay.appendChild(enemyLayer);
	overlay.appendChild(bulletLayer);
	overlay.appendChild(placementMarker);

	// Debug SVG overlay for routes and hitboxes
	const svgNS = 'http://www.w3.org/2000/svg';
	const debugSvg = document.createElementNS(svgNS, 'svg');
	debugSvg.setAttribute('class', 'td-debug');
	debugSvg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3');
	overlay.appendChild(debugSvg);
	const debugRouteGroup = document.createElementNS(svgNS, 'g');
	const debugSpawnGroup = document.createElementNS(svgNS, 'g');
	const debugEnemyGroup = document.createElementNS(svgNS, 'g');
	debugSvg.appendChild(debugRouteGroup);
	debugSvg.appendChild(debugSpawnGroup);
	debugSvg.appendChild(debugEnemyGroup);

	function drawRouteDebug() {
		while (debugRouteGroup.firstChild) debugRouteGroup.removeChild(debugRouteGroup.firstChild);
		while (debugSpawnGroup.firstChild) debugSpawnGroup.removeChild(debugSpawnGroup.firstChild);
		const boardRect = getBoardRect();
		const mapRect = getMapRenderRect();
		debugSvg.setAttribute('viewBox', `0 0 ${boardRect.width} ${boardRect.height}`);
		const w = mapRect.width;
		const h = mapRect.height;
		const ox = mapRect.left;
		const oy = mapRect.top;
		rawRoutes.forEach((r, ri) => {
			if (!r.puntos) return;
			const poly = document.createElementNS(svgNS, 'polyline');
			poly.setAttribute('fill', 'none');
			poly.setAttribute('stroke', `hsl(${(ri*60)%360} 80% 60%)`);
			poly.setAttribute('stroke-width', '3');
			poly.setAttribute('stroke-linecap', 'round');
			poly.setAttribute('stroke-linejoin', 'round');
			poly.setAttribute('opacity', '0.9');
			const pts = r.puntos.map(p => `${ox + p.x * w},${oy + p.y * h}`).join(' ');
			poly.setAttribute('points', pts);
			debugRouteGroup.appendChild(poly);
			// spawns
			(r.spawns || []).forEach(s => {
				const c = document.createElementNS(svgNS, 'circle');
				c.setAttribute('cx', ox + s.x * w);
				c.setAttribute('cy', oy + s.y * h);
				c.setAttribute('r', '6');
				c.setAttribute('fill', 'cyan');
				debugSpawnGroup.appendChild(c);
			});
		});
	}

	// map of enemy.id -> svg element
	const enemyDebugMap = new Map();
	function updateEnemyDebug() {
		const mapRect = getMapRenderRect();
		const w = mapRect.width;
		const h = mapRect.height;
		const ox = mapRect.left;
		const oy = mapRect.top;
		// remove stale
		for (const key of Array.from(enemyDebugMap.keys())) {
			if (!state.enemies.find(e => e.id === key)) {
				const el = enemyDebugMap.get(key);
				if (el && el.parentNode) el.parentNode.removeChild(el);
				enemyDebugMap.delete(key);
			}
		}
		for (const enemy of state.enemies) {
			let el = enemyDebugMap.get(enemy.id);
			if (!el) {
				el = document.createElementNS(svgNS, 'rect');
				el.setAttribute('width', '14');
				el.setAttribute('height', '14');
				el.setAttribute('fill', 'rgba(255,0,0,0.45)');
				el.setAttribute('stroke', 'rgba(255,0,0,0.9)');
				el.setAttribute('stroke-width', '1');
				debugEnemyGroup.appendChild(el);
				enemyDebugMap.set(enemy.id, el);
			}
			const pxX = ox + enemy.x * w;
			const pxY = oy + enemy.y * h;
			el.setAttribute('x', String(pxX - 7));
			el.setAttribute('y', String(pxY - 7));
		}
	}

	const maxWaves = 2;
	const enemiesPerWave = 10;
	const spawnInterval = 0.9;
	const waveDelay = 1.7;
	const enemyRadius = 0.028;
	const towerRange = 0.14;
	const towerFireDelay = 0.7;
	const bulletSpeed = 0.9;
	const pathBuffer = 0.04;

	function getBoardRect() {
		return board.getBoundingClientRect();
	}

	function getMapRenderRect() {
		const boardRect = getBoardRect();
		const containerWidth = boardRect.width;
		const containerHeight = boardRect.height;
		const naturalWidth = mapImage.naturalWidth || containerWidth;
		const naturalHeight = mapImage.naturalHeight || containerHeight;
		const imageRatio = naturalWidth / Math.max(1, naturalHeight);
		const containerRatio = containerWidth / Math.max(1, containerHeight);

		let width;
		let height;
		let left;
		let top;

		if (containerRatio > imageRatio) {
			height = containerHeight;
			width = height * imageRatio;
			top = 0;
			left = (containerWidth - width) / 2;
		} else {
			width = containerWidth;
			height = width / imageRatio;
			left = 0;
			top = (containerHeight - height) / 2;
		}

		return { left, top, width, height };
	}

	function toPointFromPercent(point) {
		const rect = getMapRenderRect();
		return {
			x: rect.left + point.x * rect.width,
			y: rect.top + point.y * rect.height
		};
	}

	function distance(a, b) {
		const dx = a.x - b.x;
		const dy = a.y - b.y;
		return Math.hypot(dx, dy);
	}

	function pointToSegmentDistance(point, start, end) {
		const segmentLength = distance(start, end);
		if (segmentLength === 0) return distance(point, start);
		let t = ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / (segmentLength * segmentLength);
		t = Math.max(0, Math.min(1, t));
		return distance(point, {
			x: start.x + (end.x - start.x) * t,
			y: start.y + (end.y - start.y) * t
		});
	}

	function pointNearPath(pxPoint) {
		const rect = getMapRenderRect();
		const point = {
			x: rect.left + pxPoint.x * rect.width,
			y: rect.top + pxPoint.y * rect.height
		};
		let minDistance = Infinity;
		for (let index = 0; index < pathPoints.length - 1; index += 1) {
			const start = toPointFromPercent(pathPoints[index]);
			const end = toPointFromPercent(pathPoints[index + 1]);
			minDistance = Math.min(minDistance, pointToSegmentDistance(point, start, end));
		}
		return minDistance < Math.max(rect.width, rect.height) * pathBuffer;
	}

	function setHud(message) {
		hud.textContent = message;
	}

	function updateStats() {
		waveEl.textContent = `${Math.min(state.currentWave, maxWaves)} / ${maxWaves}`;
		aliveEl.textContent = String(state.enemies.length);
		towersEl.textContent = String(state.towers.length);
		livesEl.textContent = String(state.lives);
	}

	function clearBoardLayers() {
		towerLayer.innerHTML = '';
		enemyLayer.innerHTML = '';
		bulletLayer.innerHTML = '';
	}

	function resetState() {
		state.running = false;
		state.finished = false;
		state.currentWave = 0;
		state.spawnedInWave = 0;
		state.spawnAccumulator = 0;
		state.betweenTimer = 0;
		state.lives = 10;
		state.towers = [];
		state.enemies = [];
		state.bullets = [];
		state.placedTowerIds = 0;
		state.lastTime = 0;
		clearBoardLayers();
		updateStats();
		setHud('Haz click en el terreno para colocar una torre. No se puede sobre el camino.');
	}

	function createTowerElement(tower) {
		const el = document.createElement('div');
		el.className = 'td-object tower';
		el.dataset.id = String(tower.id);
		const img = document.createElement('img');
		img.src = towerImg;
		img.alt = 'Torre';
		el.appendChild(img);
		return el;
	}

	function createEnemyElement(enemy) {
		const el = document.createElement('div');
		el.className = 'td-object enemy';
		el.dataset.id = String(enemy.id);
		const img = document.createElement('img');
		img.src = enemyImg;
		img.alt = 'Enemigo';
		const bar = document.createElement('div');
		bar.className = 'enemy-bar';
		const fill = document.createElement('span');
		bar.appendChild(fill);
		el.appendChild(img);
		el.appendChild(bar);
		return { el, fill };
	}

	function createBulletElement() {
		const el = document.createElement('div');
		el.className = 'td-object bullet';
		const img = document.createElement('img');
		img.src = bulletImg;
		img.alt = 'Disparo';
		el.appendChild(img);
		return el;
	}

	function appendTower(tower) {
		const el = createTowerElement(tower);
		tower.element = el;
		towerLayer.appendChild(el);
	}

	function appendEnemy(enemy) {
		const { el, fill } = createEnemyElement(enemy);
		enemy.element = el;
		enemy.healthFill = fill;
		enemyLayer.appendChild(el);
	}

	function appendBullet(bullet) {
		const el = createBulletElement();
		bullet.element = el;
		bulletLayer.appendChild(el);
	}

	function positionObject(element, point, extraStyles = {}) {
		const rect = getMapRenderRect();
		const pxX = rect.left + point.x * rect.width;
		const pxY = rect.top + point.y * rect.height;
		element.style.left = `${pxX}px`;
		element.style.top = `${pxY}px`;
		Object.assign(element.style, extraStyles);
	}

	function placeTowerAtPoint(point) {
		if (state.finished) return;
		if (pointNearPath(point)) {
			setHud('No podés poner torres sobre el camino. Elegí una zona de pasto.');
			return;
		}
		const tower = {
			id: ++state.placedTowerIds,
			x: point.x,
			y: point.y,
			cooldown: 0,
			fireDelay: towerFireDelay,
			range: towerRange,
			element: null
		};
		state.towers.push(tower);
		appendTower(tower);
		updateStats();
		setHud('Torre colocada. Podés seguir poniendo más sin costo.');
	}

	function pointerToPoint(event) {
		const boardRect = getBoardRect();
		const mapRect = getMapRenderRect();
		const xPx = event.clientX - boardRect.left - mapRect.left;
		const yPx = event.clientY - boardRect.top - mapRect.top;
		const x = xPx / Math.max(1, mapRect.width);
		const y = yPx / Math.max(1, mapRect.height);
		return {
			x: Math.max(0, Math.min(1, x)),
			y: Math.max(0, Math.min(1, y))
		};
	}

	function spawnEnemy() {
		// choose a spawn path (round-robin over spawnPaths)
		if (!spawnPaths.length) {
			console.warn('No spawn paths available');
			return;
		}
		const pathIndex = state.spawnedInWave % spawnPaths.length;
		const chosen = spawnPaths[pathIndex];
		const rect = getMapRenderRect();
		const pathNorm = chosen.path;
		// build pixel path for this enemy now (to avoid recalculating on resize we'll recompute on spawn)
		const pixelPath = pathNorm.map(p => ({ x: p.x * rect.width, y: p.y * rect.height }));
		const enemy = {
			id: `${state.currentWave}-${state.spawnedInWave}-${Date.now()}`,
			segmentIndex: 0,
			progress: 0,
			path: chosen.path.slice(), // normalized points (0..1)
			pixelPath,
			x: chosen.path[0].x,
			y: chosen.path[0].y,
			health: 3 + (state.currentWave - 1),
			maxHealth: 3 + (state.currentWave - 1),
			speed: 0.06 + state.currentWave * 0.01,
			alive: true,
			exited: false,
			element: null,
			healthFill: null
		};
		// prepare pixel segments and enemy pixel speed
		const segs = [];
		let totalPx = 0;
		for (let i = 0; i < pixelPath.length - 1; i++) {
			const a = pixelPath[i];
			const b = pixelPath[i + 1];
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			const len = Math.hypot(dx, dy);
			segs.push({ a, b, dx, dy, len });
			totalPx += len;
		}
		enemy.pixelSegs = segs;
		enemy.pixelTotal = totalPx;
		const diag = Math.hypot(rect.width, rect.height) || 1;
		enemy.speedPx = enemy.speed * diag; // convert normalized speed to pixels/sec (approx)
		appendEnemy(enemy);
		state.enemies.push(enemy);
	}

	function spawnBullet(tower, enemy) {
		const bullet = {
			x: tower.x,
			y: tower.y,
			targetId: enemy.id,
			speed: bulletSpeed,
			element: null
		};
		appendBullet(bullet);
		state.bullets.push(bullet);
	}

	function updateEnemyPosition(enemy, dt) {
		if (!enemy.alive) return;
		// Pixel-based movement using precomputed pixel segments
		const segs = enemy.pixelSegs;
		if (!segs || segs.length === 0) return;
		let remainingPx = enemy.speedPx * dt;
		while (remainingPx > 0 && enemy.segmentIndex < segs.length) {
			const seg = segs[enemy.segmentIndex];
			const segmentRemaining = seg.len - enemy.progress;
			const step = Math.min(segmentRemaining, remainingPx);
			enemy.progress += step;
			remainingPx -= step;
			if (enemy.progress >= seg.len - 0.00001) {
				enemy.segmentIndex += 1;
				enemy.progress = 0;
			}
			const currentSeg = segs[Math.min(enemy.segmentIndex, segs.length - 1)];
			const ratio = currentSeg.len === 0 ? 0 : enemy.progress / currentSeg.len;
			const pxX = currentSeg.a.x + currentSeg.dx * ratio;
			const pxY = currentSeg.a.y + currentSeg.dy * ratio;
			const rect = getMapRenderRect();
			enemy.x = pxX / Math.max(1, rect.width);
			enemy.y = pxY / Math.max(1, rect.height);
		}

		if (enemy.segmentIndex >= (enemy.pixelSegs ? enemy.pixelSegs.length : 0)) {
			enemy.alive = false;
			enemy.exited = true;
			state.lives = Math.max(0, state.lives - 1);
			setHud('Un enemigo llegó al final. Colocá más torres o reiniciá la partida.');
			if (state.lives === 0) {
				state.running = false;
				state.finished = true;
				setHud('Derrota. El reino cayó. Presioná Reiniciar para intentarlo otra vez.');
			}
		}
	}

	function updateTower(tower, dt) {
		tower.cooldown -= dt;
		if (tower.cooldown > 0) return;
		let target = null;
		let targetDistance = Infinity;
		for (const enemy of state.enemies) {
			if (!enemy.alive) continue;
			const dist = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
			if (dist <= tower.range && dist < targetDistance) {
				target = enemy;
				targetDistance = dist;
			}
		}
		if (target) {
			spawnBullet(tower, target);
			tower.cooldown = tower.fireDelay;
		}
	}

	function updateBullet(bullet, dt) {
		const target = state.enemies.find((enemy) => enemy.id === bullet.targetId && enemy.alive);
		if (!target) {
			bullet.alive = false;
			return;
		}
		const dx = target.x - bullet.x;
		const dy = target.y - bullet.y;
		const dist = Math.hypot(dx, dy);
		const step = bullet.speed * dt;
		if (dist <= 0.015 || step >= dist) {
			target.health -= 1;
			if (target.healthFill) {
				target.healthFill.style.width = `${Math.max(0, (target.health / target.maxHealth) * 100)}%`;
			}
			if (target.health <= 0) {
				target.alive = false;
			}
			bullet.alive = false;
			return;
		}
		bullet.x += (dx / dist) * step;
		bullet.y += (dy / dist) * step;
	}

	function renderEntities() {
		for (const tower of state.towers) {
			if (tower.element) positionObject(tower.element, tower);
		}
		for (const enemy of state.enemies) {
			if (!enemy.element) continue;
			positionObject(enemy.element, enemy);
			enemy.element.style.display = enemy.alive ? 'block' : 'none';
		}
		for (const bullet of state.bullets) {
			if (bullet.element) positionObject(bullet.element, bullet, {
				transform: 'translate(-50%, -50%) rotate(0deg)'
			});
		}

		// update debug visuals for enemies
		updateEnemyDebug();
	}

	function purgeDeadEntities() {
		state.enemies = state.enemies.filter((enemy) => {
			if (enemy.alive) return true;
			if (enemy.element && enemy.element.parentNode) enemy.element.parentNode.removeChild(enemy.element);
			return false;
		});
		state.bullets = state.bullets.filter((bullet) => {
			if (bullet.alive !== false) return true;
			if (bullet.element && bullet.element.parentNode) bullet.element.parentNode.removeChild(bullet.element);
			return false;
		});
	}

	function beginWave(waveNumber) {
		state.currentWave = waveNumber;
		state.spawnedInWave = 0;
		state.spawnAccumulator = 0;
		state.betweenTimer = 0;
		state.running = true;
		setHud(`Oleada ${waveNumber} en marcha. Se acercan ${enemiesPerWave} enemigos.`);
	}

	function startGame() {
		if (state.finished) {
			resetState();
		}
		if (!state.running && state.currentWave === 0) {
			state.running = true;
			beginWave(1);
			setHud('Oleada 1 iniciada. Colocá torres si querés más defensa.');
		}
	}

	function finishVictory() {
		state.running = false;
		state.finished = true;
		setHud('¡Victoria! Resististe las 2 oleadas. Presioná Reiniciar para volver a jugar.');
	}

	function update(dt) {
		if (state.running && !state.finished) {
			if (state.currentWave > 0 && state.spawnedInWave < enemiesPerWave) {
				state.spawnAccumulator += dt;
				while (state.spawnAccumulator >= spawnInterval && state.spawnedInWave < enemiesPerWave) {
					spawnEnemy();
					state.spawnedInWave += 1;
					state.spawnAccumulator -= spawnInterval;
				}
			} else if (state.currentWave > 0 && state.spawnedInWave >= enemiesPerWave && state.enemies.length === 0) {
				if (state.currentWave < maxWaves) {
					state.currentWave += 1;
					state.betweenTimer = waveDelay;
					state.running = false;
					setHud(`Oleada ${state.currentWave - 1} completada. Preparando la siguiente...`);
				} else {
					finishVictory();
				}
			}
		}

		if (!state.running && state.betweenTimer > 0 && !state.finished) {
			state.betweenTimer -= dt;
			if (state.betweenTimer <= 0) {
				beginWave(state.currentWave);
			}
		}

		for (const tower of state.towers) updateTower(tower, dt);
		for (const enemy of state.enemies) updateEnemyPosition(enemy, dt);
		for (const bullet of state.bullets) updateBullet(bullet, dt);
		purgeDeadEntities();
		if (!state.finished && state.currentWave === maxWaves && state.spawnedInWave >= enemiesPerWave && state.enemies.length === 0 && state.running === false && state.betweenTimer <= 0) {
			finishVictory();
		}
		updateStats();
		renderEntities();
	}

	function loop(timestamp) {
		if (!state.lastTime) state.lastTime = timestamp;
		const dt = Math.min(0.05, (timestamp - state.lastTime) / 1000);
		state.lastTime = timestamp;
		update(dt);
		requestAnimationFrame(loop);
	}

	board.addEventListener('click', (event) => {
		if (event.target.closest('.td-object')) return;
		const point = pointerToPoint(event);
		placeTowerAtPoint(point);
	});

	board.addEventListener('mousemove', (event) => {
		const point = pointerToPoint(event);
		const rect = getMapRenderRect();
		placementMarker.style.left = `${rect.left + point.x * rect.width}px`;
		placementMarker.style.top = `${rect.top + point.y * rect.height}px`;
		placementMarker.classList.toggle('visible', !pointNearPath(point) && !state.finished);
	});

	board.addEventListener('mouseleave', () => {
		placementMarker.classList.remove('visible');
	});

	// Recompute pixel-based paths for active enemies on resize to avoid visual drift
	function recomputeEnemyPixelPaths() {
		const rect = getMapRenderRect();
		const diag = Math.hypot(rect.width, rect.height) || 1;
		for (const enemy of state.enemies) {
			if (!enemy.path || enemy.path.length < 2) continue;
			// build new pixel path
			const pixelPath = enemy.path.map(p => ({ x: p.x * rect.width, y: p.y * rect.height }));
			const segs = [];
			let total = 0;
			for (let i = 0; i < pixelPath.length - 1; i++) {
				const a = pixelPath[i];
				const b = pixelPath[i + 1];
				const dx = b.x - a.x;
				const dy = b.y - a.y;
				const len = Math.hypot(dx, dy);
				segs.push({ a, b, dx, dy, len });
				total += len;
			}
			// compute distance already travelled in previous pixelSegs
			let travelled = 0;
			if (enemy.pixelSegs && enemy.pixelSegs.length) {
				for (let i = 0; i < Math.min(enemy.segmentIndex, enemy.pixelSegs.length); i++) travelled += enemy.pixelSegs[i].len;
				travelled += enemy.progress;
			}
			// update enemy pixel data and speed
			enemy.pixelPath = pixelPath;
			enemy.pixelSegs = segs;
			enemy.pixelTotal = total;
			enemy.speedPx = enemy.speed * diag;
			// reposition segmentIndex and progress according to travelled
			let remain = travelled;
			enemy.segmentIndex = 0;
			enemy.progress = 0;
			for (let i = 0; i < segs.length; i++) {
				if (remain > segs[i].len) { remain -= segs[i].len; continue; }
				enemy.segmentIndex = i;
				enemy.progress = remain;
				break;
			}
			// update normalized position
			if (segs.length) {
				const cur = segs[Math.min(enemy.segmentIndex, segs.length - 1)];
				const t = cur.len === 0 ? 0 : enemy.progress / cur.len;
				const pxX = cur.a.x + cur.dx * t;
				const pxY = cur.a.y + cur.dy * t;
				enemy.x = pxX / Math.max(1, rect.width);
				enemy.y = pxY / Math.max(1, rect.height);
			}
		}
	}

	window.addEventListener('resize', () => {
		recomputeEnemyPixelPaths();
		drawRouteDebug();
		updateEnemyDebug();
	});

	mapImage.addEventListener('load', () => {
		recomputeEnemyPixelPaths();
		drawRouteDebug();
		updateEnemyDebug();
	});

	// initial draw of debug routes
	drawRouteDebug();

	btnStart.addEventListener('click', startGame);
	btnReset.addEventListener('click', () => {
		resetState();
		setHud('Partida reiniciada. Volvé a empezar cuando quieras.');
	});

	resetState();
	requestAnimationFrame(loop);
})();