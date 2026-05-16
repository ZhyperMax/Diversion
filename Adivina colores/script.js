(function() {
	// Paleta maestra con hasta 7 colores
	const masterColors = [
		{ key: 'red', label: 'Rojo', short: 'R', hex: '#ff5252' },
		{ key: 'blue', label: 'Azul', short: 'A', hex: '#3aa9ff' },
		{ key: 'green', label: 'Verde', short: 'V', hex: '#5ddd40' },
		{ key: 'yellow', label: 'Amarillo', short: 'Y', hex: '#ffd84a' },
		{ key: 'purple', label: 'Púrpura', short: 'P', hex: '#cd57ff' },
		{ key: 'orange', label: 'Naranja', short: 'N', hex: '#ff7a29' },
		{ key: 'teal', label: 'Turquesa', short: 'T', hex: '#00c8a2' }
	];

	let mode = 'easy';
	let colors = masterColors.slice(0,5);
	let colorsCount = 5;
	let maxAttempts = 7;
	let allowRepeats = false;

	let secretOrder = [];
	let attempts = 0;
	let guessOrder = [];
	let locked = false;
	const history = [];

	const slotsContainer = document.getElementById('sequenceSlots');
	const btnOrder = document.getElementById('btn-order');
	const btnTry = document.getElementById('btn-try');
	const btnReset = document.getElementById('btn-reset');
	const msg = document.getElementById('message');
	const hint = document.getElementById('hint');
	const attemptsEl = document.getElementById('attempts');
	const remainingAttemptsEl = document.getElementById('remainingAttempts');
	const feedbackIcon = document.getElementById('feedback-icon');
	const historyList = document.getElementById('historyList');
	const paletteGrid = document.getElementById('paletteGrid');
	const difficultySelect = document.getElementById('difficultySelect');

	if (!slotsContainer || !btnOrder || !btnTry || !btnReset || !msg || !hint || !attemptsEl || !remainingAttemptsEl || !feedbackIcon || !historyList || !paletteGrid || !difficultySelect) return;

	function setFeedback(kind, html, hintText) {
		msg.innerHTML = html;
		hint.textContent = hintText || '';
		feedbackIcon.innerHTML = kind === 'correct' ? '<i class="fa-solid fa-check"></i>' : kind === 'over' ? '<i class="fa-solid fa-xmark"></i>' : kind === 'close' ? '<i class="fa-solid fa-palette"></i>' : '<i class="fa-solid fa-arrow-right"></i>';
		feedbackIcon.style.color = kind === 'correct' ? '#61f63a' : kind === 'over' ? '#ff6b6b' : '#ffd54d';
		feedbackIcon.style.borderColor = kind === 'correct' ? 'rgba(97, 246, 58, 0.65)' : kind === 'over' ? 'rgba(255, 107, 107, 0.65)' : 'rgba(255, 207, 46, 0.55)';
	}

	function buildSlots() {
		slotsContainer.innerHTML = '';
		// Force the grid to use exactly colorsCount columns so items won't wrap to another row
		slotsContainer.style.gridTemplateColumns = 'repeat(' + colorsCount + ', minmax(0, 1fr))';
		for (let i = 0; i < colorsCount; i++) {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'sequence-slot empty';
			btn.dataset.index = String(i);
			btn.setAttribute('aria-label', 'Color ' + (i+1));
			slotsContainer.appendChild(btn);
		}
	}

	function getSlots() {
		return Array.from(slotsContainer.querySelectorAll('.sequence-slot'));
	}

	function renderGuess() {
		const slots = getSlots();
		slots.forEach((slot, index) => {
			const colorKey = guessOrder[index];
			slot.className = 'sequence-slot' + (colorKey ? '' : ' empty');
			slot.style.background = colorKey ? (colors.find((c) => c.key === colorKey) || masterColors.find(c=>c.key===colorKey)).hex : 'rgba(255,255,255,0.04)';
			slot.textContent = colorKey ? '' : '';
		});
	}

	function renderHistory() {
		if (!history.length) {
			historyList.innerHTML = '<p class="history-empty">Todavía no hiciste comprobaciones.</p>';
			return;
		}
		historyList.innerHTML = history.map((entry) => {
			const sequence = entry.guess.map((colorKey) => {
				const color = (colors.find((item) => item.key === colorKey) || masterColors.find(c=>c.key===colorKey));
				return '<span class="history-chip" style="background:' + color.hex + '">' + color.short + '</span>';
			}).join('');
			const statusClass = entry.win ? 'success' : 'fail';
			const statusText = entry.win ? 'Victoria' : entry.exhausted ? 'Sin intentos' : 'En juego';
			return '<div class="history-item">' + '<div class="history-index">' + entry.number + '</div>' + '<div class="history-sequence">' + sequence + '</div>' + '<div class="history-result ' + statusClass + '">' + statusText + ' · ' + entry.exactMatches + '/' + colorsCount + '</div>' + '</div>';
		}).join('');
	}

	function updateCounters() {
		attemptsEl.textContent = String(attempts);
		remainingAttemptsEl.textContent = String(Math.max(maxAttempts - attempts, 0));
	}

	function buildPalette() {
		paletteGrid.innerHTML = '';
		colors.forEach((color) => {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'palette-btn ' + color.key;
			b.dataset.color = color.key;
			b.title = color.label;
			b.style.background = color.hex;
			b.addEventListener('click', () => addColor(color.key));
			paletteGrid.appendChild(b);
		});
	}

	function setLocked(value) {
		locked = value;
		const pb = paletteGrid.querySelectorAll('button');
		pb.forEach((btn) => btn.disabled = value);
		btnTry.disabled = value;
	}

	function addColor(colorKey) {
		if (locked || guessOrder.length >= colorsCount) return;
		if (!allowRepeats && guessOrder.indexOf(colorKey) !== -1) {
			setFeedback('close', 'No se permiten colores repetidos en este modo', 'Elige otro color.');
			return;
		}
		guessOrder.push(colorKey);
		renderGuess();
	}

	function finishGame(kind, message, hintText) {
		setLocked(true);
		setFeedback(kind, message, hintText);
	}

	function compareGuess() {
		if (locked) return;
		if (guessOrder.length !== colorsCount) {
			setFeedback('close', 'Todavía faltan colores en el orden', 'Completá las ' + colorsCount + ' posiciones antes de comprobar.');
			return;
		}
		attempts += 1;
		updateCounters();

		let exactMatches = 0;
		let colorMatches = 0;
		const secretRemaining = [];
		const guessRemaining = [];

		secretOrder.forEach((key, index) => {
			if (guessOrder[index] === key) { exactMatches += 1; return; }
			secretRemaining.push(key);
			guessRemaining.push(guessOrder[index]);
		});

		guessRemaining.forEach((key) => {
			const foundIndex = secretRemaining.indexOf(key);
			if (foundIndex !== -1) { colorMatches += 1; secretRemaining.splice(foundIndex,1); }
		});

		history.push({ number: attempts, guess: [...guessOrder], exactMatches, colorMatches, win: exactMatches === colorsCount, exhausted: false });
		renderHistory();

		if (exactMatches === colorsCount) { finishGame('correct', '¡Victoria! Encontraste el orden secreto', 'Podés reiniciar para jugar otra vez.'); return; }

		if (attempts >= maxAttempts) {
			history[history.length-1].exhausted = true; renderHistory();
			finishGame('over', 'Se terminaron tus ' + maxAttempts + ' intentos', 'El orden secreto era: ' + secretOrder.map((k)=> (colors.find(c=>c.key===k)||masterColors.find(c=>c.key===k)).label).join(' · '));
			return;
		}

		setFeedback('close', 'Hay <strong>' + exactMatches + '</strong> colores en el lugar correcto y <strong>' + colorMatches + '</strong> color(es) en otra posición.', 'El intento se guardó en el historial y el tablero quedó listo para probar otra vez.');
		guessOrder = [];
		renderGuess();
	}

	function generateSecret() {
		secretOrder = [];
		if (allowRepeats) {
			for (let i=0;i<colorsCount;i++) secretOrder.push(colors[Math.floor(Math.random()*colors.length)].key);
		} else {
			const pool = colors.map(c=>c.key).sort(()=>Math.random()-0.5);
			secretOrder = pool.slice(0, colorsCount);
		}
	}

	function configureMode(selected) {
		mode = selected;
		if (mode === 'easy') { colorsCount = 5; maxAttempts = 7; allowRepeats = false; }
		else if (mode === 'medium') { colorsCount = 6; maxAttempts = 5; allowRepeats = false; }
		else if (mode === 'hard') { colorsCount = 7; maxAttempts = 7; allowRepeats = true; }
		colors = masterColors.slice(0, colorsCount);
		buildSlots(); buildPalette(); resetGame();
	}

	function resetGame() {
		attempts = 0; guessOrder = []; history.length = 0; setLocked(false); generateSecret(); renderGuess(); renderHistory(); updateCounters();
		setFeedback('close', 'El orden correcto tiene <strong>' + colorsCount + '</strong> colores', 'Modo: ' + mode.toUpperCase());
	}

	difficultySelect.addEventListener('change', function() { configureMode(difficultySelect.value); });

	btnOrder.addEventListener('click', function() { guessOrder = []; renderGuess(); setFeedback('close','Intento borrado','Usá la paleta para construir un nuevo orden sin reiniciar la partida.'); });
	btnTry.addEventListener('click', compareGuess);
	btnReset.addEventListener('click', function() { resetGame(); });

	// inicializar
	configureMode('easy');
})();
