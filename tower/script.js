(function () {
	const board = document.getElementById('tdBoard');
	const overlay = document.getElementById('tdOverlay');
	const hud = document.getElementById('tdHud');
	const btnStart = document.getElementById('btn-start');
	const btnReset = document.getElementById('btn-reset');
	const waveEl = document.getElementById('wave');
	const aliveEl = document.getElementById('alive');
	const towersEl = document.getElementById('towers');
	const livesEl = document.getElementById('lives');

	if (!board || !overlay || !hud || !btnStart || !btnReset || !waveEl || !aliveEl || !towersEl || !livesEl) return;

	const towerImg = './img/CannonTower.png';
	const enemyImg = './img/Swordsman.png';
	const bulletImg = './img/cannonball.png';
	const pathPoints = [
		{ x: 0.00, y: 0.33 },
		{ x: 0.20, y: 0.33 },
		{ x: 0.20, y: 0.17 },
		{ x: 0.58, y: 0.17 },
		{ x: 0.58, y: 0.32 },
		{ x: 0.82, y: 0.32 },
		{ x: 0.82, y: 0.47 },
		{ x: 0.66, y: 0.47 },
		{ x: 0.66, y: 0.62 },
		{ x: 0.86, y: 0.62 },
		{ x: 0.86, y: 0.50 },
		{ x: 1.00, y: 0.50 }
	];

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

	function toPointFromPercent(point) {
		const rect = getBoardRect();
		return {
			x: point.x * rect.width,
			y: point.y * rect.height
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
		const rect = getBoardRect();
		const point = { x: pxPoint.x * rect.width, y: pxPoint.y * rect.height };
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
		element.style.left = `${point.x * 100}%`;
		element.style.top = `${point.y * 100}%`;
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
		const rect = getBoardRect();
		const x = (event.clientX - rect.left) / rect.width;
		const y = (event.clientY - rect.top) / rect.height;
		return {
			x: Math.max(0, Math.min(1, x)),
			y: Math.max(0, Math.min(1, y))
		};
	}

	function spawnEnemy() {
		const enemy = {
			id: `${state.currentWave}-${state.spawnedInWave}-${Date.now()}`,
			segmentIndex: 0,
			progress: 0,
			x: pathPoints[0].x,
			y: pathPoints[0].y,
			health: 3 + (state.currentWave - 1),
			maxHealth: 3 + (state.currentWave - 1),
			speed: 0.06 + state.currentWave * 0.01,
			alive: true,
			exited: false,
			element: null,
			healthFill: null
		};
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
		let remaining = enemy.speed * dt;
		while (remaining > 0 && enemy.segmentIndex < pathPoints.length - 1) {
			const start = pathPoints[enemy.segmentIndex];
			const end = pathPoints[enemy.segmentIndex + 1];
			const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
			if (segmentLength === 0) {
				enemy.segmentIndex += 1;
				continue;
			}
			const segmentRemaining = segmentLength - enemy.progress;
			const step = Math.min(segmentRemaining, remaining);
			enemy.progress += step;
			remaining -= step;
			if (enemy.progress >= segmentLength - 0.00001) {
				enemy.segmentIndex += 1;
				enemy.progress = 0;
			}
			const currentStart = pathPoints[Math.min(enemy.segmentIndex, pathPoints.length - 1)];
			const currentEnd = pathPoints[Math.min(enemy.segmentIndex + 1, pathPoints.length - 1)];
			const currentLength = Math.hypot(currentEnd.x - currentStart.x, currentEnd.y - currentStart.y) || 1;
			const ratio = Math.min(1, enemy.progress / currentLength);
			enemy.x = currentStart.x + (currentEnd.x - currentStart.x) * ratio;
			enemy.y = currentStart.y + (currentEnd.y - currentStart.y) * ratio;
		}

		if (enemy.segmentIndex >= pathPoints.length - 1) {
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
		placementMarker.style.left = `${point.x * 100}%`;
		placementMarker.style.top = `${point.y * 100}%`;
		placementMarker.classList.toggle('visible', !pointNearPath(point) && !state.finished);
	});

	board.addEventListener('mouseleave', () => {
		placementMarker.classList.remove('visible');
	});

	btnStart.addEventListener('click', startGame);
	btnReset.addEventListener('click', () => {
		resetState();
		setHud('Partida reiniciada. Volvé a empezar cuando quieras.');
	});

	resetState();
	requestAnimationFrame(loop);
})();