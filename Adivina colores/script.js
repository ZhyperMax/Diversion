(function() {
	const maxAttempts = 7;
	const colors = [
		{ key: 'red', label: 'Rojo', short: 'R', hex: '#ff5252' },
		{ key: 'blue', label: 'Azul', short: 'A', hex: '#3aa9ff' },
		{ key: 'green', label: 'Verde', short: 'V', hex: '#5ddd40' },
		{ key: 'yellow', label: 'Amarillo', short: 'A', hex: '#ffd84a' },
		{ key: 'purple', label: 'Púrpura', short: 'P', hex: '#cd57ff' }
	];

	const secretOrder = [...colors].sort(() => Math.random() - 0.5).map((color) => color.key);
	let attempts = 0;
	let guessOrder = [];
	let locked = false;
	const history = [];

	const slots = Array.from(document.querySelectorAll('.sequence-slot'));
	const paletteButtons = Array.from(document.querySelectorAll('.palette-btn'));
	const btnOrder = document.getElementById('btn-order');
	const btnTry = document.getElementById('btn-try');
	const btnReset = document.getElementById('btn-reset');
	const msg = document.getElementById('message');
	const hint = document.getElementById('hint');
	const attemptsEl = document.getElementById('attempts');
	const remainingAttemptsEl = document.getElementById('remainingAttempts');
	const feedbackIcon = document.getElementById('feedback-icon');
	const historyList = document.getElementById('historyList');

	if (!slots.length || !paletteButtons.length || !btnOrder || !btnTry || !btnReset || !msg || !hint || !attemptsEl || !remainingAttemptsEl || !feedbackIcon || !historyList) {
		return;
	}

	function setFeedback(kind, html, hintText) {
		msg.innerHTML = html;
		hint.textContent = hintText || '';
		feedbackIcon.innerHTML = kind === 'correct'
			? '<i class="fa-solid fa-check"></i>'
			: kind === 'over'
				? '<i class="fa-solid fa-xmark"></i>'
			: kind === 'close'
				? '<i class="fa-solid fa-palette"></i>'
				: '<i class="fa-solid fa-arrow-right"></i>';
		feedbackIcon.style.color = kind === 'correct' ? '#61f63a' : kind === 'over' ? '#ff6b6b' : '#ffd54d';
		feedbackIcon.style.borderColor = kind === 'correct' ? 'rgba(97, 246, 58, 0.65)' : kind === 'over' ? 'rgba(255, 107, 107, 0.65)' : 'rgba(255, 207, 46, 0.55)';
	}

	function renderGuess() {
		slots.forEach((slot, index) => {
			const colorKey = guessOrder[index];
			slot.className = 'sequence-slot' + (colorKey ? '' : ' empty');
			slot.style.background = colorKey ? colors.find((color) => color.key === colorKey).hex : 'rgba(255, 255, 255, 0.04)';
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
				const color = colors.find((item) => item.key === colorKey);
				return '<span class="history-chip" style="background:' + color.hex + '">' + color.short + '</span>';
			}).join('');
			const statusClass = entry.win ? 'success' : 'fail';
			const statusText = entry.win ? 'Victoria' : entry.exhausted ? 'Sin intentos' : 'En juego';

			return '<div class="history-item">'
				+ '<div class="history-index">' + entry.number + '</div>'
				+ '<div class="history-sequence">' + sequence + '</div>'
				+ '<div class="history-result ' + statusClass + '">' + statusText + ' · ' + entry.exactMatches + '/' + colors.length + '</div>'
				+ '</div>';
		}).join('');
	}

	function updateCounters() {
		attemptsEl.textContent = String(attempts);
		remainingAttemptsEl.textContent = String(Math.max(maxAttempts - attempts, 0));
	}

	function resetGuess() {
		guessOrder = [];
		renderGuess();
	}

	function setLocked(value) {
		locked = value;
		paletteButtons.forEach((button) => {
			button.disabled = value;
		});
		btnTry.disabled = value;
	}

	function addColor(colorKey) {
		if (locked || guessOrder.length >= colors.length) {
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
		if (locked) {
			return;
		}

		if (guessOrder.length !== colors.length) {
			setFeedback('close', 'Todavía faltan colores en el orden', 'Completá las 5 posiciones antes de comprobar.');
			return;
		}

		attempts += 1;
		updateCounters();

		let exactMatches = 0;
		let colorMatches = 0;
		const secretRemaining = [];
		const guessRemaining = [];

		secretOrder.forEach((key, index) => {
			if (guessOrder[index] === key) {
				exactMatches += 1;
				return;
			}

			secretRemaining.push(key);
			guessRemaining.push(guessOrder[index]);
		});

		guessRemaining.forEach((key) => {
			const foundIndex = secretRemaining.indexOf(key);
			if (foundIndex !== -1) {
				colorMatches += 1;
				secretRemaining.splice(foundIndex, 1);
			}
		});

		history.push({
			number: attempts,
			guess: [...guessOrder],
			exactMatches,
			colorMatches,
			win: exactMatches === colors.length,
			exhausted: false
		});
		renderHistory();

		if (exactMatches === colors.length) {
			finishGame('correct', '¡Victoria! Encontraste el orden secreto', 'Podés reiniciar para jugar otra vez.');
			return;
		}

		if (attempts >= maxAttempts) {
			history[history.length - 1].exhausted = true;
			renderHistory();
			finishGame('over', 'Se terminaron tus 7 intentos', 'El orden secreto era: ' + secretOrder.map((key) => colors.find((color) => color.key === key).label).join(' · '));
			return;
		}

		setFeedback('close', 'Hay <strong>' + exactMatches + '</strong> colores en el lugar correcto y <strong>' + colorMatches + '</strong> color(es) en otra posición.', 'El intento se guardó en el historial y el tablero quedó listo para probar otra vez.');
		resetGuess();
	}

	paletteButtons.forEach((button) => {
		button.addEventListener('click', function() {
			addColor(button.dataset.color);
		});
	});

	btnOrder.addEventListener('click', function() {
		resetGuess();
		setFeedback('close', 'Intento borrado', 'Usá la paleta para construir un nuevo orden sin reiniciar la partida.');
	});

	btnTry.addEventListener('click', compareGuess);
	btnReset.addEventListener('click', function() {
		attempts = 0;
		history.length = 0;
		updateCounters();
		guessOrder = [];
		secretOrder.splice(0, secretOrder.length, ...[...colors].sort(() => Math.random() - 0.5).map((color) => color.key));
		setLocked(false);
		resetGuess();
		renderHistory();
		setFeedback('close', 'El orden correcto tiene <strong>5 colores</strong>', 'Presta atención a las pistas de color para encontrar el orden más rápido.');
	});

	resetGuess();
	renderHistory();
	updateCounters();
	setFeedback('close', 'El orden correcto tiene <strong>5 colores</strong>', 'Presta atención a las pistas de color para encontrar el orden más rápido.');
})();
