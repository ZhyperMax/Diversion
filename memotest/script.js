(function(){
	const board = document.getElementById('memoBoard');
	const btnStart = document.getElementById('btn-start');
	const timerEl = document.getElementById('timer');
	const movesEl = document.getElementById('moves');
	const foundEl = document.getElementById('found');

	if (!board || !btnStart || !timerEl || !movesEl || !foundEl) return;

	const icons = ['🍎','🚗','🐶','⭐','⚽','🎵','🌟','🍀']; // 8 icons -> 16 cards
	let deck = [];
	let first = null;
	let second = null;
	let lock = false;
	let moves = 0;
	let found = 0;
	let timer = 0;
	let timerId = null;

	function buildDeck(){
		deck = icons.concat(icons).map((icon,idx)=>({id: idx, icon, matched:false}));
		// shuffle
		for(let i=deck.length-1;i>0;i--){
			const j = Math.floor(Math.random()*(i+1));
			[deck[i],deck[j]]=[deck[j],deck[i]];
		}
	}

	function renderBoard(){
		board.innerHTML='';
		deck.forEach((card, idx)=>{
			const el = document.createElement('button');
			el.className='memo-card';
			el.dataset.index = idx;
			el.innerHTML = '<span class="card-face">'+(card.matched||card.revealed?card.icon:'')+'</span>';
			if(card.matched) el.classList.add('revealed');
			el.addEventListener('click', onCardClick);
			board.appendChild(el);
		});
		updateStats();
	}

	function onCardClick(e){
		if(lock) return;
		const idx = Number(e.currentTarget.dataset.index);
		const card = deck[idx];
		if(card.matched || card.revealed) return;
		card.revealed = true;
		renderBoard();
		if(!first) { first = {idx, card}; return; }
		if(first && !second){ second = {idx, card}; lock=true; moves++; updateStats();
			setTimeout(()=>{
				checkMatch();
			},600);
		}
	}

	function checkMatch(){
		if(first.card.icon === second.card.icon){
			deck[first.idx].matched = true; deck[second.idx].matched = true; found++; updateStats();
		} else {
			deck[first.idx].revealed = false; deck[second.idx].revealed = false;
		}
		first = null; second = null; lock=false;
		renderBoard();
		if(found===icons.length) finish();
	}

	function updateStats(){
		movesEl.textContent = String(moves);
		foundEl.textContent = found+' / '+icons.length;
	}

	function startTimer(){
		clearInterval(timerId); timer=0; timerEl.textContent='00:00';
		timerId = setInterval(()=>{ timer++; const m=Math.floor(timer/60); const s=timer%60; timerEl.textContent = (m<10?'0':'')+m+':'+(s<10?'0':'')+s; },1000);
	}

	function stopTimer(){ clearInterval(timerId); timerId=null; }

	function startGame(){ buildDeck(); moves=0; found=0; first=second=null; lock=false; renderBoard(); startTimer(); }

	function finish(){ stopTimer(); setTimeout(()=>{ alert('¡Ganaste! Encontraste todas las parejas en '+moves+' movimientos.'); },200); }

	btnStart.addEventListener('click', startGame);
	// build initial board
	buildDeck(); renderBoard();
})();
