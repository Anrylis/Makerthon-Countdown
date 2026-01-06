let started = false;
let isSwitching = false;
let remainingSeconds = 28 * 60 * 60;
let queue = [];
let currentIndex = 0;
let ytPlayer = null;
let countdownTimer = null;
let pollTimer = null;

// 載入 YouTube API 
const tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
document.body.appendChild(tag);

// Start 按鈕
document.getElementById("startBtn").addEventListener("click", () => {
  if (started) return;
  started = true;

  startCountdown();   // 開始倒數

  document.getElementById("startBtn").style.display = "none";
});

// music 按鈕
document.getElementById("musicBtn").addEventListener("click", () => {
  if (!started) return;

  startPolling();   // 開始抓表單

  //document.getElementById("musicBtn").style.display = "none";
});
 
// 倒數函式
function startCountdown() {
  countdownTimer = setInterval(() => {
    remainingSeconds--;

    const h = String(Math.floor(remainingSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((remainingSeconds % 3600) / 60)).padStart(2, "0");
    const s = String(remainingSeconds % 60).padStart(2, "0");

    document.getElementById("countdown").textContent = `${h}:${m}:${s}`;
  }, 1000);
}

//抓後台表單
function startPolling() {
  pollTimer = setInterval(fetchSheet, 100000); // 每 100 秒抓一次
  fetchSheet(); // 先抓一次
}

function extractYouTubeID(url) {
  if (url.includes("youtu.be")) return url.split("/").pop();
  const params = new URL(url).searchParams;
  return params.get("v");
}

function playCurrent() {
  if (!queue[currentIndex] || !queue[currentIndex].url) return;
  if (currentIndex >= queue.length) return;
  const { url, type } = queue[currentIndex];    
  const player = document.getElementById("player");
  player.innerHTML = "";
  isSwitching = true;

  if (type == "youtube") {
    const videoId = extractYouTubeID(url);
    if (!ytPlayer) {
    ytPlayer = new YT.Player("player", {
      width: 320,
      height: 180,
      videoId,
      playerVars: { autoplay: 1 },
      events: {
        onReady: e => {
          e.target.playVideo();
          isSwitching = false;
        },
        onStateChange: onPlayerStateChange
      }
    });
    } else {
      ytPlayer.loadVideoById(videoId);
    }
  } else if (type === "spotify") {
      player.innerHTML = `<iframe src="${url.replace("open.spotify.com","open.spotify.com/embed")}" width="300" height="80" allow="autoplay; encrypted-media" frameborder="0"></iframe>`;
      document.getElementById("musicBtn").textContent = "Click!";
  }
  isSwitching = false;
}

// 往下播放
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

function next(){
  if(isSwitching) return;
  if(currentIndex<queue.length-1){
    currentIndex++;
    playCurrent();
  } else {
    console.log("播放清單結束，等待新歌曲...");
  }
}

// csv 抓歌曲
function fetchSheet() {
  fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vQHFZuvJPJz--YWbAF1Kgpwlre9GMRHK_QgGz-2YkEIlVvrhOkb4Pre3gNTQeP1ieWMMZR8R6WqUg76/pub?output=csv")
    .then(res => res.text())
    .then(text => {
      const rows = text.split("\n").slice(1);

      // 建一個新 queue
      const newQueue = rows
        .map(row => {
          let [timestamp, url] = row.split(",");
          if (!url) return null;
          url = url.trim();
          if(url.includes("music.youtube.com")){
            const videoId = new URL(url).searchParams.get("v");
            url = `https://www.youtube.com/watch?v=${videoId}`;
            return { url, type:"youtube" };
          }
          else if(url.includes("youtu") && !url.includes("music")) return { url, type:"youtube" };
          else if(url.includes("spotify.com")) return { url, type:"spotify" };
        })
        .filter(Boolean);

      // 避免當前歌曲被吃掉
      const currentUrl = queue[currentIndex]?.url;
      queue = newQueue;

      // currentIndex 指向正在播放的歌曲或第一首
      if (currentUrl) {
        const idx = queue.findIndex(item => item.url === currentUrl);
        currentIndex = idx >= 0 ? idx : 0;
      } else {
        currentIndex = 0;
      }

      // 初始會播第一首或新加入的歌
      if (started &&  ((queue[currentIndex]?.type === "youtube" && (!ytPlayer || ytPlayer.getPlayerState() !== YT.PlayerState.PLAYING)) || (queue[currentIndex]?.type !== "youtube" && !isSwitching))) {
        playCurrent();
      }
    });
}

document.getElementById("nextBtn").addEventListener("click", next);