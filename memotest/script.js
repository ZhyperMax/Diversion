(function(){
	const board = document.getElementById('memoBoard');
	const btnStart = document.getElementById('btn-start');
	const timerEl = document.getElementById('timer');
	const movesEl = document.getElementById('moves');
	const foundEl = document.getElementById('found');

	if (!board || !btnStart || !timerEl || !movesEl || !foundEl) return;

	// load images from img/ folder (use first 8 images and duplicate to make pairs)
	const availableImages = [
		'img/1.png','img/2.png','img/3.png','img/4.png','img/5.png','img/6.png','img/7.png','img/8.png','img/9.png','img/10.png','img/11.png','img/12.png','img/13.png','img/14.png','img/15.png','img/16.png'
	];
	const pairCount = Math.min(8, Math.floor(availableImages.length/2));
	const images = availableImages.slice(0, pairCount);
	let deck = [];
	let started = false;
	let first = null;
	let second = null;
	let lock = false;
	let moves = 0;
	let found = 0;
	let timer = 0;
	let timerId = null;

	function buildDeck(){
		deck = images.concat(images).map((src,idx)=>({id: idx, src, matched:false, revealed:false}));
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
			const face = document.createElement('span');
			face.className = 'card-face';
			// always include the image element to reserve layout and avoid reflow when revealing
			const img = document.createElement('img');
			img.className = 'card-img';
			img.src = card.src;
			img.alt = 'carta';
			if(card.matched || card.revealed){
				img.style.visibility = 'visible';
				img.style.opacity = '1';
			} else {
				img.style.visibility = 'hidden';
				img.style.opacity = '0';
			}
			face.appendChild(img);
			el.appendChild(face);
			if(card.matched || card.revealed) el.classList.add('revealed');
			el.addEventListener('click', onCardClick);
			board.appendChild(el);
		});
		updateStats();
	}

	function onCardClick(e){
		if(!started) return; // ignore clicks before game start
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
		if(first.card.src === second.card.src){
			deck[first.idx].matched = true; deck[second.idx].matched = true; found++; updateStats();
		} else {
			deck[first.idx].revealed = false; deck[second.idx].revealed = false;
		}
		first = null; second = null; lock=false;
		renderBoard();
		if(found===images.length) finish();
	}

	function updateStats(){
		movesEl.textContent = String(moves);
		foundEl.textContent = found+' / '+images.length;
	}

	function startTimer(){
		clearInterval(timerId); timer=0; timerEl.textContent='00:00';
		timerId = setInterval(()=>{ timer++; const m=Math.floor(timer/60); const s=timer%60; timerEl.textContent = (m<10?'0':'')+m+':'+(s<10?'0':'')+s; },1000);
	}

	function stopTimer(){ clearInterval(timerId); timerId=null; }

	function startGame(){
		started = true;
		// hide portal logo overlay
		const logo = document.querySelector('.memo-logo');
		if(logo) logo.classList.add('hidden');

		buildDeck();
		moves=0; found=0; first=second=null; lock=false;
		renderBoard();
		startTimer();
	}

	function finish(){ stopTimer(); setTimeout(()=>{ alert('¡Ganaste! Encontraste todas las parejas en '+moves+' movimientos.'); },200); }

	btnStart.addEventListener('click', startGame);
	// initial state: show placeholders and logo; do not build deck until start
	function renderPlaceholders(){
		board.innerHTML='';
		for(let i=0;i<16;i++){
			const el = document.createElement('button');
			el.className='memo-card';
			el.disabled = true;
			const face = document.createElement('span');
			face.className='card-face';
			el.appendChild(face);
			board.appendChild(el);
		}
	}

	renderPlaceholders();
})();
