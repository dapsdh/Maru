/* ==========================================================================
   마루의 포근한 모험 (Maru's Cozy Adventure) - 게임 로직
   ========================================================================== */

// 1. 게임 상태 (State)
const state = {
  adaptability: 0,
  isAdult: false,
  churCount: 1, // 기본으로 1개씩 주고 시작
  cheeseCount: 0,
  bgmEnabled: true,
  sfxEnabled: true,
  currentScreen: 'title',
  isEvolving: false,
  selectedAvatar: 'kitten',
  selectedBg: 'livingroom',
  unlockedBgs: ['livingroom'],
  unlockedAvatars: ['kitten']
};

// 고양이 대사 모음
const kittenQuotes = [
  "새로운 집은 조금 낯설다냐옹...",
  "저 구석에 있는 상자가 맘에 든다옹 📦",
  "골골골... 집사 손길이 따뜻하다옹 ❤️",
  "먼지 뭉치를 보면 몸이 먼저 움직인다냐옹! 🐾",
  "맛있는 츄르 냄새가 나는 것 같다옹! 🍖",
  "해먹 위에서 햇살을 받으면 노곤노곤하다옹... ☀️"
];

const adultQuotes = [
  "이제 이 집은 완벽히 내 영역이다옹! 🦁",
  "치즈 장난감은 내 최고의 사냥감이다냐옹 🧀",
  "골골골... 집사야, 츄르 줄 때가 되었다옹! 🍖",
  "캣타워 꼭대기에서 내려다보는 풍경이 최고다냐옹 🏰",
  "집사야 노느라 수고했다옹, 쓰다듬을 허락하겠다 🐾",
  "초록 눈을 반짝이며 집안을 순찰 중이다옹! 👀"
];

// 2. Web Audio API 기반 오디오 합성 시스템 (Synth System)
let audioCtx = null;
let bgmInterval = null;
let bgmStep = 0;
let currentBgmNodes = [];

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

// BGM 아르페지오 음표 정의 (Cmaj7 - Am7 - Fmaj7 - G7 포근한 힐링 진행)
// 주파수 정보
const notes = {
  C3: 130.81, E3: 164.81, G3: 196.00, B3: 246.94,
  A3: 220.00, C4: 261.63, E4: 329.63, G4: 392.00,
  F3: 174.61, A3_2: 220.00, C4_2: 261.63, E4_2: 329.63,
  G3_2: 196.00, B3_2: 246.94, D4: 293.66, F4: 349.23
};

// 아르페지오 패턴 (주파수 배열의 루프)
const chordProgression = [
  // Cmaj7 (C3, E3, G3, B3)
  ['C3', 'E3', 'G3', 'B3', 'G3', 'E3', 'B3', 'E3'],
  // Am7 (A3, C4, E4, G4)
  ['A3', 'C4', 'E4', 'G4', 'E4', 'C4', 'G4', 'C4'],
  // Fmaj7 (F3, A3, C4, E4)
  ['F3', 'A3_2', 'C4_2', 'E4_2', 'C4_2', 'A3_2', 'E4_2', 'A3_2'],
  // G7 (G3, B3, D4, F4)
  ['G3_2', 'B3_2', 'D4', 'F4', 'D4', 'B3_2', 'F4', 'B3_2']
];

function playBgmNote(frequency, duration, time) {
  if (!state.bgmEnabled || !audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  // 트라이앵글 파형으로 포근하고 둥근 아날로그 감성 연주
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(frequency, time);

  // 로우패스 필터로 지나친 고주파를 차단해 몽글몽글한 느낌 연출
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(600, time);

  // 볼륨 엔벨로프 (부드러운 어택 및 긴 릴리즈)
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(0.04, time + 0.1); // 은은한 볼륨
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration - 0.05);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(time);
  osc.stop(time + duration);

  // 진행 중인 노드를 추적하여 BGM 중지 시 청소
  currentBgmNodes.push({ osc, gain, filter });
}

function startBgm() {
  initAudio();
  if (bgmInterval) return;

  bgmStep = 0;
  const noteDuration = 0.45; // 한 음당 속도
  const intervalMs = noteDuration * 1000;

  // Web Audio의 내장 시계를 기반으로 정확한 타이밍 스케줄링
  bgmInterval = setInterval(() => {
    if (!state.bgmEnabled) return;
    
    const chordIndex = Math.floor(bgmStep / 8) % chordProgression.length;
    const noteIndex = bgmStep % 8;
    const noteKey = chordProgression[chordIndex][noteIndex];
    const freq = notes[noteKey];

    const now = audioCtx.currentTime;
    playBgmNote(freq, noteDuration * 1.5, now); // 음이 약간 겹치게 연주해 울림을 줌
    bgmStep++;
  }, intervalMs);
}

function stopBgm() {
  if (bgmInterval) {
    clearInterval(bgmInterval);
    bgmInterval = null;
  }
  // 연주 중인 노드 즉시 정지
  currentBgmNodes.forEach(node => {
    try {
      node.osc.disconnect();
      node.gain.disconnect();
    } catch(e) {}
  });
  currentBgmNodes = [];
}

// 🔊 효과음 (SFX) 합성기

// 1) 뿅 (먼지 터뜨리기 효과음)
function playPopSfx() {
  if (!state.sfxEnabled) return;
  initAudio();

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  // 피치를 아래에서 위로 급격히 올리는 귀여운 뿅 소리
  osc.frequency.setValueAtTime(250, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.2);
}

// 2) 냐옹~ 효과음 (야옹 소리 합성)
function playMeowSfx() {
  if (!state.sfxEnabled) return;
  initAudio();

  const now = audioCtx.currentTime;
  
  // 두 개의 오실레이터를 섞어서 다채로운 고양이 성대 묘사
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc1.type = 'triangle';
  osc2.type = 'sawtooth';

  // 아기 마루는 피치가 높고, 성묘 마루는 피치가 좀 더 묵직함
  const baseFreq = state.isAdult ? 350 : 550;

  // 고양이 특유의 피치 글라이드 (야~옹)
  osc1.frequency.setValueAtTime(baseFreq, now);
  osc1.frequency.linearRampToValueAtTime(baseFreq * 1.2, now + 0.15);
  osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.85, now + 0.4);

  osc2.frequency.setValueAtTime(baseFreq * 1.01, now);
  osc2.frequency.linearRampToValueAtTime(baseFreq * 1.21, now + 0.15);
  osc2.frequency.exponentialRampToValueAtTime(baseFreq * 0.86, now + 0.4);

  filter.type = 'bandpass';
  filter.Q.setValueAtTime(1.5, now);
  filter.frequency.setValueAtTime(1000, now);
  filter.frequency.exponentialRampToValueAtTime(1500, now + 0.15);
  filter.frequency.linearRampToValueAtTime(800, now + 0.4);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.06, now + 0.08); // 페이드인
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45); // 릴리즈

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.5);
  osc2.stop(now + 0.5);
}

// 3) 골골골송 (낮고 따뜻한 주파수 진동 효과음)
function playPurrSfx() {
  if (!state.sfxEnabled) return;
  initAudio();

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const modulator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const modGain = audioCtx.createGain();

  // 골골송은 65Hz 근처의 깊은 울림
  osc.type = 'sine';
  osc.frequency.setValueAtTime(68, now);

  // 모듈레이터로 골골송의 주기적인 떨림(FM 합성)을 만듦
  modulator.type = 'sine';
  modulator.frequency.setValueAtTime(25, now); // 진동 주기 25Hz
  modGain.gain.setValueAtTime(12, now); // 떨림의 깊이

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

  modulator.connect(modGain);
  modGain.connect(osc.frequency);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  modulator.start(now);
  osc.start(now);
  modulator.stop(now + 1.2);
  osc.stop(now + 1.2);
}

// 4) 샤방~ 반짝 효과음 (간식 획득 또는 진화 완료 시)
function playSparkleSfx() {
  if (!state.sfxEnabled) return;
  initAudio();

  const now = audioCtx.currentTime;
  const playSeqNote = (freq, delay, vol) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + delay);
    
    gain.gain.setValueAtTime(vol, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.2);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.25);
  };

  // 짧고 가벼운 주파수 도약 멜로디 (도-미-솔-도)
  playSeqNote(523.25, 0.0, 0.05); // C5
  playSeqNote(659.25, 0.08, 0.05); // E5
  playSeqNote(783.99, 0.16, 0.05); // G5
  playSeqNote(1046.50, 0.24, 0.06); // C6
}


// 3. UI 및 탐험 인터랙션 관리

// 돔 요소 캐싱
const screens = {
  title: document.getElementById('screen-title'),
  profile: document.getElementById('screen-profile'),
  adventure: document.getElementById('screen-adventure')
};

const dom = {
  btnStart: document.getElementById('btn-start'),
  btnProfileBook: document.getElementById('btn-profile-book'),
  btnProfileBack: document.getElementById('btn-profile-back'),
  btnHudBack: document.getElementById('btn-hud-back'),
  btnSettingsOpen: document.getElementById('btn-settings-open'),
  btnSettingsClose: document.getElementById('btn-settings-close'),
  modalSettings: document.getElementById('modal-settings'),
  toggleBgm: document.getElementById('toggle-bgm'),
  toggleSfx: document.getElementById('toggle-sfx'),
  
  // 꾸미기 모달 관련
  btnCustomizeOpenMain: document.getElementById('btn-customize-open-main'),
  btnCustomizeOpen: document.getElementById('btn-customize-open'),
  btnCustomizeClose: document.getElementById('btn-customize-close'),
  modalCustomize: document.getElementById('modal-customize'),
  avatarOptions: document.getElementById('avatar-options'),
  bgOptions: document.getElementById('bg-options'),
  
  // HUD
  txtAdaptability: document.getElementById('txt-adaptability'),
  barAdaptability: document.getElementById('bar-adaptability'),
  countChur: document.getElementById('count-chur'),
  countCheese: document.getElementById('count-cheese'),
  maruAgeBadge: document.getElementById('maru-age-badge'),
  
  // 플레이그라운드
  playground: document.getElementById('playground'),
  playgroundParticles: document.getElementById('playground-particles'),
  maruCharBox: document.getElementById('maru-char-box'),
  maruPlayImg: document.getElementById('maru-play-img'),
  speechBubble: document.getElementById('speech-bubble'),
  speechText: document.getElementById('speech-text'),
  
  // 액션
  btnUseChur: document.getElementById('btn-use-chur'),
  btnUseCheese: document.getElementById('btn-use-cheese'),
  slotChurCount: document.getElementById('slot-chur-count'),
  slotCheeseCount: document.getElementById('slot-cheese-count'),
  btnEvolve: document.getElementById('btn-evolve'),
  
  // 도감 카드
  cardKitten: document.getElementById('card-kitten'),
  cardAdult: document.getElementById('card-adult'),
  
  // 진화 모달
  modalEvolution: document.getElementById('modal-evolution'),
  btnEvolutionOk: document.getElementById('btn-evolution-ok'),
  evoFlash: document.querySelector('.evo-flash'),
  evoKitten: document.querySelector('.evo-kitten'),
  evoAdult: document.querySelector('.evo-adult')
};

// 스크린 전환 함수
function showScreen(screenKey) {
  Object.keys(screens).forEach(key => {
    if (key === screenKey) {
      screens[key].classList.add('active');
    } else {
      screens[key].classList.remove('active');
    }
  });
  state.currentScreen = screenKey;

  // 어드벤처 화면 진입 시 오디오 활성화 및 먼지 생성 시작
  if (screenKey === 'adventure') {
    startBgm();
    startDustSpawnLoop();
  } else {
    stopDustSpawnLoop();
  }
}

// 4. 게임 상태 업데이트 렌더링
function updateHUD() {
  dom.txtAdaptability.textContent = `${state.adaptability}%`;
  dom.barAdaptability.style.width = `${state.adaptability}%`;
  
  dom.countChur.textContent = state.churCount;
  dom.slotChurCount.textContent = state.churCount;
  
  dom.countCheese.textContent = state.cheeseCount;
  dom.slotCheeseCount.textContent = state.cheeseCount;

  // 아이템 버튼 활성화 상태 조절
  dom.btnUseChur.disabled = state.churCount <= 0 || state.adaptability >= 100;
  dom.btnUseCheese.disabled = state.cheeseCount <= 0 || state.adaptability >= 100;

  // 성장 진화 버튼 상태
  if (state.adaptability >= 100 && !state.isAdult) {
    dom.btnEvolve.disabled = false;
  } else {
    dom.btnEvolve.disabled = true;
  }
}

// 마루 말풍선 표시 기능
let speechTimeout = null;
function showMaruSpeech(text) {
  dom.speechText.textContent = text;
  dom.speechBubble.classList.add('active');
  
  if (speechTimeout) clearTimeout(speechTimeout);
  speechTimeout = setTimeout(() => {
    dom.speechBubble.classList.remove('active');
  }, 3500);
}

// 먼지 뭉치 스폰 제어
let dustSpawnInterval = null;
function startDustSpawnLoop() {
  if (dustSpawnInterval) return;
  // 첫 먼지 1초 후 즉시 스폰
  setTimeout(spawnDustBunny, 1000);
  
  dustSpawnInterval = setInterval(() => {
    // 플레이그라운드 상에 존재하는 먼지 개수가 3개 미만일 때만 추가 생성
    const activeDusts = dom.playground.querySelectorAll('.dust-bunny');
    if (activeDusts.length < 3) {
      spawnDustBunny();
    }
  }, 4000); // 4초마다 기회
}

function stopDustSpawnLoop() {
  if (dustSpawnInterval) {
    clearInterval(dustSpawnInterval);
    dustSpawnInterval = null;
  }
  // 화면에 남은 먼지 삭제
  const activeDusts = dom.playground.querySelectorAll('.dust-bunny');
  activeDusts.forEach(d => d.remove());
}

function spawnDustBunny() {
  if (state.currentScreen !== 'adventure') return;

  const dust = document.createElement('div');
  dust.className = 'dust-bunny';
  dust.textContent = '💨';

  // 무작위 좌표 계산 (상하단 UI 바를 피해서 배치)
  const x = Math.random() * 80 + 10; // 10% ~ 90%
  const y = Math.random() * 50 + 20; // 20% ~ 70%
  
  dust.style.left = `${x}%`;
  dust.style.top = `${y}%`;

  // 먼지 뭉치 클릭 이벤트
  dust.addEventListener('click', (e) => {
    e.stopPropagation(); // 플레이그라운드 뒷배경 클릭 방지
    
    // 먼지 팡 터뜨리는 뿅 소리
    playPopSfx();

    // 터지는 파티클 시각 효과 생성
    createClickSparkle(e.clientX, e.clientY, '✨');
    
    // 적응도 증가 (+5% ~ +8% 사이 무작위)
    const adaptGain = Math.floor(Math.random() * 4) + 5;
    increaseAdaptability(adaptGain);

    // 25% 확률로 츄르 또는 치즈 발견!
    const roll = Math.random();
    if (roll < 0.15) {
      state.churCount++;
      showToastAlert(e.clientX, e.clientY, '🍖 츄르 발견!');
      playSparkleSfx();
    } else if (roll < 0.25) {
      state.cheeseCount++;
      showToastAlert(e.clientX, e.clientY, '🧀 치즈 발견!');
      playSparkleSfx();
    }

    // 소멸 애니메이션 후 DOM 제거
    dust.style.transform = 'scale(0) rotate(180deg)';
    dust.style.opacity = '0';
    setTimeout(() => dust.remove(), 250);
  });

  dom.playground.appendChild(dust);
}

// 텍스트 토스트 알림 (화면에 둥실 떠오르는 글씨)
function showToastAlert(clientX, clientY, text) {
  const toast = document.createElement('div');
  toast.className = 'click-particle';
  toast.style.left = `${clientX - dom.playground.getBoundingClientRect().left}px`;
  toast.style.top = `${clientY - dom.playground.getBoundingClientRect().top}px`;
  toast.style.color = '#fff';
  toast.style.background = 'rgba(229, 169, 59, 0.9)';
  toast.style.padding = '4px 10px';
  toast.style.borderRadius = '12px';
  toast.style.fontSize = '12px';
  toast.style.fontWeight = '800';
  toast.style.border = '2px solid #fff';
  toast.style.boxShadow = '0 4px 10px rgba(0,0,0,0.15)';
  toast.textContent = text;

  dom.playgroundParticles.appendChild(toast);
  setTimeout(() => toast.remove(), 800);
}

// 파티클 생성 함수
function createClickSparkle(x, y, char = '🐾') {
  const rect = dom.playgroundParticles.getBoundingClientRect();
  const particle = document.createElement('div');
  particle.className = 'click-particle';
  particle.style.left = `${x - rect.left}px`;
  particle.style.top = `${y - rect.top}px`;
  particle.textContent = char;

  dom.playgroundParticles.appendChild(particle);
  setTimeout(() => particle.remove(), 800);
}

// 적응도 증가 처리
function increaseAdaptability(amount) {
  if (state.adaptability >= 100) return;

  state.adaptability = Math.min(100, state.adaptability + amount);
  updateHUD();

  // 배경 잠금 해제 체크
  checkBackgroundUnlocks();

  // 100% 도달하여 처음 성장 기회가 생겼을 때 알림
  if (state.adaptability === 100 && !state.isAdult) {
    showMaruSpeech("어라..? 힘이 막 솟아난다냐옹! ✨");
    playSparkleSfx();
  }
}

// 배경 잠금 해제 판단 및 알림
function checkBackgroundUnlocks() {
  // 1) 침실 해금 (30% 적응)
  if (state.adaptability >= 30 && !state.unlockedBgs.includes('bedroom')) {
    state.unlockedBgs.push('bedroom');
    const opt = document.getElementById('opt-bg-bedroom');
    if (opt) {
      opt.classList.remove('locked');
      const lock = opt.querySelector('.lock-indicator');
      if (lock) lock.remove();
    }
    showMaruSpeech("새로운 침실 구역이 열렸다냐옹! 🛌");
    playSparkleSfx();
  }
  
  // 2) 베란다 해금 (60% 적응)
  if (state.adaptability >= 60 && !state.unlockedBgs.includes('balcony')) {
    state.unlockedBgs.push('balcony');
    const opt = document.getElementById('opt-bg-balcony');
    if (opt) {
      opt.classList.remove('locked');
      const lock = opt.querySelector('.lock-indicator');
      if (lock) lock.remove();
    }
    showMaruSpeech("베란다에도 가볼 수 있게 되었다옹! 🪴");
    playSparkleSfx();
  }
}

// 5. 마루 터치 상호작용
dom.maruCharBox.addEventListener('click', (e) => {
  // 캐릭터 통통 튀는 애니메이션 리셋 및 적용
  dom.maruPlayImg.classList.remove('bounce-effect', 'float-anim');
  void dom.maruPlayImg.offsetWidth; // 리플로우 유발
  dom.maruPlayImg.classList.add('bounce-effect');
  
  setTimeout(() => {
    if (!state.isEvolving) {
      dom.maruPlayImg.classList.remove('bounce-effect');
      dom.maruPlayImg.classList.add('float-anim');
    }
  }, 400);

  // 클릭 이펙트 발자국
  createClickSparkle(e.clientX, e.clientY, '🐾');

  // 효과음 재생
  const rand = Math.random();
  if (rand < 0.4) {
    playPurrSfx(); // 40% 골골송
  } else {
    playMeowSfx(); // 60% 야옹~
  }

  // 대사 출력
  const quotes = state.isAdult ? adultQuotes : kittenQuotes;
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
  showMaruSpeech(randomQuote);

  // 상호작용으로 적응도 소량 증가
  increaseAdaptability(1);
});


// 6. 아이템 사용 로직
dom.btnUseChur.addEventListener('click', () => {
  if (state.churCount <= 0 || state.adaptability >= 100) return;
  
  state.churCount--;
  increaseAdaptability(15);
  playSparkleSfx();
  
  // 마루 기쁨 대사
  const meowJoy = state.isAdult 
    ? "집사야! 츄르는 역시 천상의 맛이다옹! 🍖😻" 
    : "와아! 츄르 너무 맛있다냐옹! 솜방망이 춤이 절로 난다옹! 🍖";
  showMaruSpeech(meowJoy);
});

dom.btnUseCheese.addEventListener('click', () => {
  if (state.cheeseCount <= 0 || state.adaptability >= 100) return;
  
  state.cheeseCount--;
  increaseAdaptability(25);
  playSparkleSfx();
  
  const cheeseJoy = state.isAdult 
    ? "이 치즈 장난감은 완전 내 차지다냐옹! 🧀🦁" 
    : "이 치즈 인형 너무 신기하다옹! 킁킁... 내 냄새를 묻히겠다옹! 🧀";
  showMaruSpeech(cheeseJoy);
});


// 7. 폭풍 성장 (진화) 연출
dom.btnEvolve.addEventListener('click', () => {
  if (state.adaptability < 100 || state.isAdult) return;

  state.isEvolving = true;
  stopBgm();
  
  // 진화 성공 축하 팝업 열기
  dom.modalEvolution.classList.add('active');
  
  // 모달 이미지 초기화
  dom.evoKitten.style.opacity = '1';
  dom.evoAdult.style.opacity = '0';
  dom.evoFlash.classList.remove('active');

  // 진화 애니메이션 타임라인 실행
  setTimeout(() => {
    // 1초 뒤 하얀 섬광(Flash) 터짐
    dom.evoFlash.classList.add('active');
    playSparkleSfx();
    
    setTimeout(() => {
      // 섬광이 최고조일 때 이미지 스왑
      dom.evoKitten.style.opacity = '0';
      dom.evoAdult.style.opacity = '1';
      
      // 야옹~ 크게 울음소리 재생
      setTimeout(() => {
        playMeowSfx();
      }, 100);
      
    }, 400);

  }, 1200);
});

// 진화 모달 닫기 (늠름한 마루 쓰다듬기 클릭)
dom.btnEvolutionOk.addEventListener('click', () => {
  dom.modalEvolution.classList.remove('active');
  
  // 실제 게임 스탯 상태 변환
  state.isAdult = true;
  state.isEvolving = false;

  // 아바타 해금 정보 업데이트
  if (!state.unlockedAvatars.includes('adult')) state.unlockedAvatars.push('adult');
  if (!state.unlockedAvatars.includes('loaf')) state.unlockedAvatars.push('loaf');

  // 꾸미기 옵션 자물쇠 제거
  const optAdult = document.getElementById('opt-avatar-adult');
  if (optAdult) {
    optAdult.classList.remove('locked');
    const lock = optAdult.querySelector('.lock-indicator');
    if (lock) lock.remove();
  }
  const optLoaf = document.getElementById('opt-avatar-loaf');
  if (optLoaf) {
    optLoaf.classList.remove('locked');
    const lock = optLoaf.querySelector('.lock-indicator');
    if (lock) lock.remove();
  }

  // 게임 내 마루 이미지 변경 (기본적으로 성묘로 기본 아바타 교체)
  state.selectedAvatar = 'adult';
  dom.maruPlayImg.src = 'assets/maru_adult.png?v=16';
  
  // 꾸미기 팝업 내 선택 상태 동기화
  document.querySelectorAll('#avatar-options .customize-option').forEach(opt => {
    if (opt.getAttribute('data-id') === 'adult') {
      opt.classList.add('active');
    } else {
      opt.classList.remove('active');
    }
  });

  dom.maruAgeBadge.textContent = '위풍당당 성묘';
  dom.maruAgeBadge.className = 'age-badge adult';

  // 메인 화면 프리뷰 이미지 변경
  document.querySelector('.preview-img.kitten').classList.remove('active');
  document.querySelector('.preview-img.adult').classList.add('active');

  // 도감에서 '성묘 마루' 해금!
  dom.cardAdult.classList.remove('locked');
  dom.cardAdult.querySelector('.lock-overlay').style.display = 'none';

  updateHUD();
  startBgm();

  showMaruSpeech("크크... 이제 나도 멋진 어른 고양이다옹! 🦁🐾");
});


// 8. 설정 모달 및 내비게이션 바인딩

// 뒤로가기 / 네비게이션 버튼들
dom.btnStart.addEventListener('click', () => {
  showScreen('adventure');
  playSparkleSfx();
});

dom.btnProfileBook.addEventListener('click', () => {
  showScreen('profile');
  playSparkleSfx();
});

dom.btnProfileBack.addEventListener('click', () => {
  showScreen('title');
  playPopSfx();
});

dom.btnHudBack.addEventListener('click', () => {
  showScreen('title');
  playPopSfx();
});

// 설정 팝업 제어
dom.btnSettingsOpen.addEventListener('click', () => {
  initAudio();
  dom.modalSettings.classList.add('active');
  playPopSfx();
});

dom.btnSettingsClose.addEventListener('click', () => {
  dom.modalSettings.classList.remove('active');
  playPopSfx();
});

// 바깥 영역 클릭 시 모달 닫기
window.addEventListener('click', (e) => {
  if (e.target === dom.modalSettings) {
    dom.modalSettings.classList.remove('active');
  }
});

// 소리 스위치 설정 동기화
dom.toggleBgm.addEventListener('change', (e) => {
  state.bgmEnabled = e.target.checked;
  if (state.bgmEnabled) {
    if (state.currentScreen === 'adventure') {
      startBgm();
    }
  } else {
    stopBgm();
  }
});

dom.toggleSfx.addEventListener('change', (e) => {
  state.sfxEnabled = e.target.checked;
});

// 모바일이 아닌 경우 커스텀 발바닥 포인터 활성화
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const cursor = document.getElementById('custom-cursor');

if (!isMobile) {
  cursor.style.display = 'block';
  document.addEventListener('mousemove', (e) => {
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;
  });
}

// 9. 최초 초기화 실행
updateHUD();

// ==========================================================================
// 10. 꾸미기 모달 및 옵션 선택 바인딩
// ==========================================================================

// 꾸미기 모달 열기/닫기
if (dom.btnCustomizeOpenMain) {
  dom.btnCustomizeOpenMain.addEventListener('click', () => {
    initAudio();
    dom.modalCustomize.classList.add('active');
    playPopSfx();
  });
}

if (dom.btnCustomizeOpen) {
  dom.btnCustomizeOpen.addEventListener('click', () => {
    initAudio();
    dom.modalCustomize.classList.add('active');
    playPopSfx();
  });
}

if (dom.btnCustomizeClose) {
  dom.btnCustomizeClose.addEventListener('click', () => {
    dom.modalCustomize.classList.remove('active');
    playPopSfx();
  });
}

// 바깥 영역 클릭 시 꾸미기 모달 닫기
window.addEventListener('click', (e) => {
  if (e.target === dom.modalCustomize) {
    dom.modalCustomize.classList.remove('active');
  }
});

// 아바타 선택 클릭 핸들러
if (dom.avatarOptions) {
  dom.avatarOptions.addEventListener('click', (e) => {
    const option = e.target.closest('.customize-option');
    if (!option || option.classList.contains('locked')) return;

    const id = option.getAttribute('data-id');
    const src = option.getAttribute('data-src');

    // active 클래스 토글
    dom.avatarOptions.querySelectorAll('.customize-option').forEach(opt => opt.classList.remove('active'));
    option.classList.add('active');

    // 상태 및 캐릭터 이미지 변경
    state.selectedAvatar = id;
    dom.maruPlayImg.src = src;

    // 배지 텍스트 동기화
    if (id === 'kitten') {
      dom.maruAgeBadge.textContent = '아기 마루';
      dom.maruAgeBadge.className = 'age-badge baby';
    } else if (id === 'adult') {
      dom.maruAgeBadge.textContent = '위풍당당 성묘';
      dom.maruAgeBadge.className = 'age-badge adult';
    } else if (id === 'loaf') {
      dom.maruAgeBadge.textContent = '식빵 마루';
      dom.maruAgeBadge.className = 'age-badge adult';
    }

    // 소리 재생
    playMeowSfx();

    // 말풍선 대사 출력
    if (id === 'kitten') {
      showMaruSpeech("아장아장 아기 고양이라옹! 🐾");
    } else if (id === 'adult') {
      showMaruSpeech("위풍당당한 마루다옹! 🦁");
    } else if (id === 'loaf') {
      showMaruSpeech("지금 식빵 굽는 중이다옹, 빵 구워줄까냐옹? 🍞");
    }
  });
}

// 배경 선택 클릭 핸들러
if (dom.bgOptions) {
  dom.bgOptions.addEventListener('click', (e) => {
    const option = e.target.closest('.customize-option');
    if (!option || option.classList.contains('locked')) return;

    const id = option.getAttribute('data-id');
    const src = option.getAttribute('data-src');

    // active 클래스 토글
    dom.bgOptions.querySelectorAll('.customize-option').forEach(opt => opt.classList.remove('active'));
    option.classList.add('active');

    // 상태 및 인게임 배경 변경
    state.selectedBg = id;
    const bgLayer = document.getElementById('screen-adventure');
    if (bgLayer) {
      bgLayer.style.backgroundImage = `url('${src}')`;
    }

    // 소리 재생
    playPopSfx();

    // 힌트 가이드 텍스트 업데이트
    const hintSpan = document.querySelector('.play-guide-hint');
    if (hintSpan) {
      let areaName = "거실";
      if (id === "bedroom") areaName = "침실";
      else if (id === "balcony") areaName = "베란다";
      
      hintSpan.innerHTML = `💡 ${areaName}을 돌아다니는 <span class="hl">먼지 뭉치</span>를 터치하거나 <span class="hl">마루</span>를 쓰다듬어 적응도를 올리세요!`;
    }

    // 배경에 맞는 마루 대사 출력
    if (id === 'livingroom') {
      showMaruSpeech("거실 구석의 상자가 아주 마음에 든다옹! 📦");
    } else if (id === 'bedroom') {
      showMaruSpeech("침대가 엄청 푹신하고 따뜻하다옹! 🛌❤️");
    } else if (id === 'balcony') {
      showMaruSpeech("초록 식물들이 가득해서 킁킁 냄새 맡기 좋다옹! 🪴");
    }
  });
}
