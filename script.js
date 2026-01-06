// ===== 全域變數 =====
let started = false;
let remainingSeconds = 27 * 60 * 60; // 27 小時倒數
let queue = [];
let currentIndex = 0;
let ytPlayer = null;
let countdownTimer = null;
let pollTimer = null;

// ===== 載入 YouTube API =====
const tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
document.body.appendChild(tag);

// ===== Start 按鈕事件 =====
document.getElementById("startBtn").addEventListener("click", () => {
  if (started) return;
  started = true;

  startCountdown();   // 開始倒數

  document.getElementById("startBtn").style.display = "none";
});

// ===== Start 按鈕事件2 =====
document.getElementById("musicBtn").addEventListener("click", () => {
  if (started) return;
  started = true;

  startPolling();   // 開始抓表單

  document.getElementById("musicBtn").style.display = "none";
});
 
// ===== 倒數函式 =====
function startCountdown() {
  countdownTimer = setInterval(() => {
    remainingSeconds--;

    const h = String(Math.floor(remainingSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((remainingSeconds % 3600) / 60)).padStart(2, "0");
    const s = String(remainingSeconds % 60).padStart(2, "0");

    document.getElementById("countdown").textContent = `${h}:${m}:${s}`;
  }, 1000);
}

// ===== 輪詢表單 =====
function startPolling() {
  pollTimer = setInterval(fetchSheet, 100000); // 每 100 秒抓一次
  fetchSheet(); // 先抓一次
}

// ===== 解析 YouTube ID =====
function extractYouTubeID(url) {
  if (url.includes("youtu.be")) return url.split("/").pop();
  const params = new URL(url).searchParams;
  return params.get("v");
}

// ===== 播放目前歌曲 =====
function playCurrent() {
  if (currentIndex >= queue.length) return;

  const videoId = extractYouTubeID(queue[currentIndex].url);

  if (!ytPlayer) {
    ytPlayer = new YT.Player("player", {
      width: 320,
      height: 180,
      videoId,
      playerVars: { autoplay: 1 },
      events: {
        onReady: e => e.target.playVideo(),
        onStateChange: onPlayerStateChange
      }
    });
  } else {
    ytPlayer.loadVideoById(videoId);
  }
}

// ===== 播放狀態變化事件 =====
function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    currentIndex++;

    if (currentIndex < queue.length) {
      playCurrent();
    } else {
      console.log("播放清單結束，等待新歌曲...");
    }
  }
}

// ===== 取得 Google Sheet 的歌曲列表 =====
function fetchSheet() {
  fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vQHFZuvJPJz--YWbAF1Kgpwlre9GMRHK_QgGz-2YkEIlVvrhOkb4Pre3gNTQeP1ieWMMZR8R6WqUg76/pub?output=csv")
    .then(res => res.text())
    .then(text => {
      const rows = text.split("\n").slice(1);

      // 先建立最新 queue
      const newQueue = rows
        .map(row => {
          const [timestamp, url] = row.split(",");
          if (!url || !url.includes("youtu")) return null;
          return { timestamp, url };
        })
        .filter(Boolean);

      // 保留正在播放歌曲（如果還存在）
      const currentUrl = queue[currentIndex]?.url;
      queue = newQueue;

      // 更新 currentIndex 指向正在播放歌曲或第一首
      if (currentUrl) {
        const idx = queue.findIndex(item => item.url === currentUrl);
        currentIndex = idx >= 0 ? idx : 0;
      } else {
        currentIndex = 0;
      }

      // 如果播放器空閒，立刻播第一首或新加入的歌
      if (started && (!ytPlayer || ytPlayer.getPlayerState() !== YT.PlayerState.PLAYING)) {
        playCurrent();
      }
    });
}

// ===== 手動播放（可選） =====
function playMusic(url) {
  if (!url) url = document.getElementById("urlInput")?.value;
  if (!url) return;

  const player = document.getElementById("player");
  player.innerHTML = "";

  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    const videoId = extractYouTubeID(url);
    player.innerHTML = `
      <iframe width="320" height="180"
        src="https://www.youtube.com/embed/${videoId}?autoplay=1"
        frameborder="0"
        allow="autoplay; encrypted-media"
        allowfullscreen>
      </iframe>
    `;
  } else if (url.includes("spotify.com")) {
    const embedUrl = url.replace("open.spotify.com", "open.spotify.com/embed");
    player.innerHTML = `
      <iframe
        src="${embedUrl}"
        width="300"
        height="80"
        frameborder="0"
        allow="encrypted-media">
      </iframe>
    `;
  }
}