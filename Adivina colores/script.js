(function() {
	const maxAttempts = 8;
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

	const slots = Array.from(document.querySelectorAll('.sequence-slot'));
	const paletteButtons = Array.from(document.querySelectorAll('.palette-btn'));
	const btnOrder = document.getElementById('btn-order');
	const btnTry = document.getElementById('btn-try');
	const btnReset = document.getElementById('btn-reset');
	const msg = document.getElementById('message');
	const hint = document.getElementById('hint');
	const attemptsEl = document.getElementById('attempts');
	const feedbackIcon = document.getElementById('feedback-icon');

	if (!slots.length || !paletteButtons.length || !btnOrder || !btnTry || !btnReset || !msg || !hint || !attemptsEl || !feedbackIcon) {
		return;
	}

	function setFeedback(kind, html, hintText) {
		msg.innerHTML = html;
		hint.textContent = hintText || '';
		feedbackIcon.innerHTML = kind === 'correct'
			? '<i class="fa-solid fa-check"></i>'
			: kind === 'close'
				? '<i class="fa-solid fa-palette"></i>'
				: '<i class="fa-solid fa-arrow-right"></i>';
		feedbackIcon.style.color = kind === 'correct' ? '#61f63a' : '#ffd54d';
		feedbackIcon.style.borderColor = kind === 'correct' ? 'rgba(97, 246, 58, 0.65)' : 'rgba(255, 207, 46, 0.55)';
	}

	function renderGuess() {
		slots.forEach((slot, index) => {
			const colorKey = guessOrder[index];
			slot.className = 'sequence-slot' + (colorKey ? '' : ' empty');
			slot.style.background = colorKey ? colors.find((color) => color.key === colorKey).hex : 'rgba(255, 255, 255, 0.04)';
			slot.textContent = colorKey ? '' : '';
		});
	}

	function resetGuess() {
		guessOrder = [];
		renderGuess();
	}

	function addColor(colorKey) {
		if (guessOrder.length >= colors.length) {
			return;
		}

		guessOrder.push(colorKey);
		renderGuess();
	}

	function compareGuess() {
		attempts += 1;
		attemptsEl.textContent = attempts;

		if (guessOrder.length !== colors.length) {
			setFeedback('close', 'Todavía faltan colores en el orden', 'Completá las 5 posiciones antes de comprobar.');
			return;
		}

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

		if (exactMatches === colors.length) {
			setFeedback('correct', '¡Correcto! Encontraste el orden secreto', 'Podés reiniciar para jugar otra vez.');
			btnTry.disabled = true;
			paletteButtons.forEach((button) => button.disabled = true);
			return;
		}

		setFeedback('close', 'Hay <strong>' + exactMatches + '</strong> colores en el lugar correcto y <strong>' + colorMatches + '</strong> color(es) en otra posición.', 'Revisa el orden y probá otra vez.');
	}

	paletteButtons.forEach((button) => {
		button.addEventListener('click', function() {
			addColor(button.dataset.color);
		});
	});

	btnOrder.addEventListener('click', function() {
		resetGuess();
		setFeedback('close', 'Reorganiza el orden antes de comprobar', 'Usá la paleta para construir tu intento.');
	});

	btnTry.addEventListener('click', compareGuess);
	btnReset.addEventListener('click', function() {
		attempts = 0;
		attemptsEl.textContent = '0';
		guessOrder = [];
		btnTry.disabled = false;
		paletteButtons.forEach((button) => button.disabled = false);
		secretOrder.splice(0, secretOrder.length, ...[...colors].sort(() => Math.random() - 0.5).map((color) => color.key));
		resetGuess();
		setFeedback('close', 'El orden correcto tiene <strong>5 colores</strong>', 'Presta atención a las pistas de color para encontrar el orden más rápido.');
	});

	resetGuess();
	setFeedback('close', 'El orden correcto tiene <strong>5 colores</strong>', 'Presta atención a las pistas de color para encontrar el orden más rápido.');
})();
