let started = false;
let isSwitching = false;
let remainingSeconds = 28 * 60 * 60;
let queue = [];
let currentIndex = 0;
let ytPlayer = null;
let countdownTimer = null;
let pollTimer = null;
let stopScroll = 0;
const YTAPI_KEY = "AIzaSyDUshU65Iy1sgzw7PLjwWrwiosrwE_lQf8";

// 載入 YouTube API 
const tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
document.body.appendChild(tag);

window.onerror = function (message, source, lineno, colno, error) {
  // 太多不影響功能的 error 了，先不顯示
  if (message.includes("googleads") || message.includes("youtubei")) {
    return true; 
  }
  console.error("Caught error:", message, error);
  return false; 
};

// Start 按鈕
document.getElementById("startBtn").addEventListener("click", () => {
  if (started) return;
  started = true;
  startCountdown(); 
  document.getElementById("startBtn").style.display = "none";
});

// music 按鈕
document.getElementById("musicBtn").addEventListener("click", () => {
  if (!started) return;
  startPolling();   // 開始抓表單
  document.getElementById("musicBtn").style.display = "none";
});
 
// 倒數函式
function startCountdown() {
  countdownTimer = setInterval(() => {
    remainingSeconds--;

    const h = String(Math.floor(remainingSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((remainingSeconds % 3600) / 60)).padStart(2, "0");
    const s = String(remainingSeconds % 60).padStart(2, "0");

    document.getElementById("countdown").textContent = `${h}:${m}:${s}`;
    
    // 最後倒數 30 分鐘 !!!
    if (remainingSeconds <= 30 * 60) {
      countdownElement.style.color = "red"; 
    } 
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

async function playCurrent() {
  if (!queue[currentIndex] || !queue[currentIndex].url) return;
  if (currentIndex >= queue.length) return;
  const { url, type } = queue[currentIndex];    
  const player = document.getElementById("player");
  player.innerHTML = "";
  isSwitching = true;

  if (type == "youtube") {
    const videoId = extractYouTubeID(url);
    let title = await fetchYouTubeTitle(videoId);
    setTrackTitle(title);
    if (!ytPlayer) {
    ytPlayer = new YT.Player("player", {
      width: 170,
      height: 100,
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
      player.innerHTML = `<iframe src="${url.replace("open.spotify.com","open.spotify.com/embed")}" width="300" height="80" style="border: none;" allow="autoplay; encrypted-media"></iframe>`;
      document.getElementById("musicBtn").textContent = "Click!";
  }
  isSwitching = false;
}

// 下一首
function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    currentIndex++;

    if (currentIndex < queue.length) {
      playCurrent();
    } else {
      console.log("播放清單結束");
    }
  }
}

function next(){
  if(isSwitching) return;
  stopScroll++;
  if(currentIndex<queue.length-1){
    currentIndex++;
    // 先暫時顯示 "--"
    document.getElementById("trackTitle").textContent = "--";
    playCurrent();
  } else {
    console.log("播放清單結束");
  }
}

// 用 csv 抓後台歌單
function fetchSheet() {
  fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vQHFZuvJPJz--YWbAF1Kgpwlre9GMRHK_QgGz-2YkEIlVvrhOkb4Pre3gNTQeP1ieWMMZR8R6WqUg76/pub?output=csv")
    .then(res => res.text())
    .then(text => {
      const rows = text.split("\n").slice(1);

      // 每次都建一個新 queue
      const newQueue = rows
        .map(row => {
          let columns = row.split(",");
          let url = columns[1]?.trim();
          let comment = columns[2]?.trim();
          if (!url) return null;

          // 把 YT music 轉 YT 連結
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

      if (currentUrl) {
        const idx = queue.findIndex(item => item.url === currentUrl);
        currentIndex = idx >= 0 ? idx : 0;
      } else {
        currentIndex = 0;
      }

      // 初始
      if (started &&  ((queue[currentIndex]?.type === "youtube" && (!ytPlayer || ytPlayer.getPlayerState() !== YT.PlayerState.PLAYING)) || (queue[currentIndex]?.type !== "youtube" && !isSwitching))) {
        playCurrent();
      }

      displayComment(queue[currentIndex]?.comment);
    });
}

async function fetchYouTubeTitle(videoId) {
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YTAPI_KEY}`);
    const data = await res.json();
    return data.items?.[0]?.snippet?.title || "Unknown";
  } catch (e) {
    console.error(e);
    return "Unknown";
  }
}


async function setTrackTitle(name) {
  const count = ++stopScroll;
  let title = document.getElementById("trackTitle");
  const mask = title.parentElement;

  title.style.transition = "none";
  title.style.transform = "translateX(0)";
  title.textContent = name;

  // 等瀏覽器算歌名長度
  await new Promise(requestAnimationFrame);
  const titleWidth = title.scrollWidth;
  const maskWidth = mask.clientWidth;

  // 沒超過，別滾
  if (titleWidth <= maskWidth) return;

  const distance = titleWidth - maskWidth;
  const speed = 60;
  const duration = distance / speed;

  while (count === stopScroll) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    title.style.transition = `transform ${duration}s linear`;
    title.style.transform = `translateX(-${distance}px)`;

    // 反覆滾 T=2s, offset=2s
    await new Promise(resolve => setTimeout(resolve, duration * 1000 + 2000));
    title.style.transition = "none";
    title.style.transform = "translateX(0)";
  }
}

function stopScrollTitle() {
  stopScroll = true;
}

function displayComment(comment) {
  const commentEl = document.getElementById("comment"); 
  if (comment) {
    commentElement.textContent = comment;
  } else {
    commentElement.textContent = "無";
  }
}
document.getElementById("nextBtn").addEventListener("click", next);
setTrackTitle("-");