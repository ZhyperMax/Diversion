(function() {
const max = 100;
let secret = Math.floor(Math.random() * max) + 1;
let attempts = 0;

const guessInput = document.getElementById('guess');
const btnMinus = document.getElementById('btn-minus');
const btnPlus = document.getElementById('btn-plus');
const btnTry = document.getElementById('btn-try');
const btnReset = document.getElementById('btn-reset');
const msg = document.getElementById('message');
const hint = document.getElementById('hint');
const attemptsEl = document.getElementById('attempts');
const feedbackIcon = document.getElementById('feedback-icon');

	if (!guessInput || !btnMinus || !btnPlus || !btnTry || !btnReset || !msg || !hint || !attemptsEl || !feedbackIcon) {
return;
}

function clampGuess(value) {
if (Number.isNaN(value)) {
return 1;
}

return Math.min(max, Math.max(1, value));
}

function setGuess(value) {
guessInput.value = clampGuess(value);
}

function setFeedback(kind, html, hintText) {
msg.innerHTML = html;
hint.textContent = hintText || '';
feedbackIcon.innerHTML = kind === 'correct'
? '<i class="fa-solid fa-check"></i>'
: kind === 'high'
? '<i class="fa-solid fa-arrow-up"></i>'
: '<i class="fa-solid fa-arrow-down"></i>';
feedbackIcon.style.color = '#61f63a';
feedbackIcon.style.borderColor = kind === 'correct' ? 'rgba(97, 246, 58, 0.65)' : 'rgba(97, 246, 58, 0.48)';
}

function tryGuess() {
const value = clampGuess(Number(guessInput.value));
setGuess(value);
attempts += 1;
attemptsEl.textContent = attempts;

if (value === secret) {
setFeedback('correct', '¡Correcto! Encontraste el número <strong>' + secret + '</strong>', 'Podés reiniciar para jugar otra vez.');
btnTry.disabled = true;
guessInput.disabled = true;
btnMinus.disabled = true;
btnPlus.disabled = true;
return;
}

if (value < secret) {
setFeedback('high', 'El número es <strong>MÁS ALTO</strong>', 'Probá con un número mayor.');
return;
}

setFeedback('low', 'El número es <strong>MÁS BAJO</strong>', 'Probá con un número menor.');
}

btnMinus.addEventListener('click', function() {
setGuess(Number(guessInput.value) - 1);
});

btnPlus.addEventListener('click', function() {
setGuess(Number(guessInput.value) + 1);
});

btnTry.addEventListener('click', tryGuess);
guessInput.addEventListener('keydown', function(event) {
if (event.key === 'Enter') {
tryGuess();
}
});
guessInput.addEventListener('input', function() {
setGuess(Number(guessInput.value));
});

btnReset.addEventListener('click', function() {
secret = Math.floor(Math.random() * max) + 1;
attempts = 0;
attemptsEl.textContent = '0';
setGuess(42);
guessInput.disabled = false;
btnTry.disabled = false;
btnMinus.disabled = false;
btnPlus.disabled = false;
setFeedback('high', 'El número es <strong>MÁS ALTO</strong>', 'Presta atención a las pistas para encontrar el número más rápido.');
});

setGuess(42);
setFeedback('high', 'El número es <strong>MÁS ALTO</strong>', 'Presta atención a las pistas para encontrar el número más rápido.');
})();
