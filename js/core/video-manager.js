import { CONFIG } from './constants.js';

const VIDEO_RATES = {
  'fondos/isabela.mp4': 0.5
};

function getVideoPlaybackRate(videoFile) {
  return VIDEO_RATES[videoFile] || 1.0;
}

export function initVideoBackground() {
  const v1 = document.getElementById('bgVideo1');
  const v2 = document.getElementById('bgVideo2');
  if (!v1 || !v2) return;

  let activeV = v1;
  let nextV = v2;
  let bgi = 0;
  let isSwitching = false;

  activeV.src = CONFIG.backgrounds[bgi];
  activeV.playbackRate = getVideoPlaybackRate(CONFIG.backgrounds[bgi]);
  activeV.play().catch(e => console.log('Autoplay blocked initially:', e));
  bgi = (bgi + 1) % CONFIG.backgrounds.length;

  function switchVideo() {
    if (isSwitching) return;
    isSwitching = true;

    const videoFile = CONFIG.backgrounds[bgi];

    const cleanup = () => {
      nextV.removeEventListener('loadeddata', onLoaded);
      nextV.removeEventListener('error', onError);
      isSwitching = false;
    };

    const onError = () => {
      cleanup();
      bgi = (bgi + 1) % CONFIG.backgrounds.length;
      setTimeout(switchVideo, 500);
    };

    const onLoaded = async () => {
      cleanup();
      try {
        nextV.playbackRate = getVideoPlaybackRate(videoFile);
        await nextV.play();
        nextV.style.opacity = '1';
        activeV.style.opacity = '0';
        const oldV = activeV;
        setTimeout(() => { if (oldV !== activeV) oldV.pause(); }, 1600);
        [activeV, nextV] = [nextV, activeV];
        bgi = (bgi + 1) % CONFIG.backgrounds.length;
      } catch (err) {
        bgi = (bgi + 1) % CONFIG.backgrounds.length;
        setTimeout(switchVideo, 1000);
      }
    };

    nextV.addEventListener('loadeddata', onLoaded, { once: true });
    nextV.addEventListener('error', onError, { once: true });
    nextV.src = videoFile;
    nextV.load();
  }

  setInterval(switchVideo, CONFIG.bgInterval);
}
