const token = '7742982738:AAEKDUd43h9v6-TsZ8fRcfNopn2aDQjr1qY';
const chatId = -1002847077785;
let lastMessageId = null;
let queue = [];
let isPlaying = false;
let pollingInterval = null;
let alertingEnabled = false;

// Use localStorage to sync lastMessageId across tabs/windows
function saveLastMessageId(id) {
  try {
    localStorage.setItem('ZCFD_FAS_LAST_ID', id);
  } catch (e) {}
}
function loadLastMessageId() {
  try {
    return localStorage.getItem('ZCFD_FAS_LAST_ID');
  } catch (e) { return null; }
}

// Listen for changes from other tabs
window.addEventListener('storage', (e) => {
  if (e.key === 'ZCFD_FAS_LAST_ID') {
    lastMessageId = e.newValue ? Number(e.newValue) : null;
  }
});

async function fetchAlert() {
  if (!alertingEnabled) return;
  if (isPlaying || queue.length > 0) return; // Wait for queue to finish
  try {
    // Always sync with localStorage before fetching
    const storedId = loadLastMessageId();
    if (storedId !== null && storedId !== lastMessageId) {
      lastMessageId = Number(storedId);
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const data = await response.json();

    if (!data.ok || !Array.isArray(data.result)) {
      document.getElementById("status").textContent = "Error: Couldn't fetch updates";
      return;
    }

    // Only consider updates for our channel with text
    const updates = data.result.filter(update =>
      update.channel_post &&
      update.channel_post.chat.id === chatId &&
      update.channel_post.text
    );

    // Find all new updates (update_id > lastMessageId), sort oldest to newest
    let newUpdates = [];
    if (lastMessageId === null) {
      // If first run, only process the latest message
      if (updates.length > 0) {
        const latest = updates[updates.length - 1];
        newUpdates = [latest];
      }
    } else {
      newUpdates = updates.filter(u => u.update_id > lastMessageId)
                          .sort((a, b) => a.update_id - b.update_id);
    }

    if (newUpdates.length > 0) {
      queue = newUpdates;
      playNextInQueue();
    }
  } catch (err) {
    console.error(err);
    document.getElementById("status").textContent = "Network or API error";
  }
}

function playNextInQueue() {
  if (queue.length === 0) {
    isPlaying = false;
    return;
  }
  isPlaying = true;
  const update = queue.shift();
  lastMessageId = update.update_id;
  saveLastMessageId(lastMessageId);

  const text = update.channel_post.text;
  document.getElementById("alertBox").textContent = text;

  // Format date/time from Telegram's 'date' (seconds since epoch)
  const alertDate = new Date((update.channel_post.date || Date.now()) * 1000);
  const dateStr = alertDate.toLocaleString();
  document.getElementById("status").textContent = `Alert time: ${dateStr}`;

  const tone1 = document.getElementById("tone1");
  const tone2 = document.getElementById("tone2");

  tone1.onended = () => {
    tone1.onended = null;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = 'en-US';
    speech.onend = () => {
      tone2.currentTime = 0;
      tone2.play();
      tone2.onended = () => {
        tone2.onended = null;
        playNextInQueue();
      };
    };
    speech.onerror = () => {
      playNextInQueue();
    };
    window.speechSynthesis.speak(speech);
  };
  tone1.currentTime = 0;
  tone1.play().catch(() => {
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = 'en-US';
    speech.onend = () => {
      tone2.currentTime = 0;
      tone2.play();
      tone2.onended = () => {
        tone2.onended = null;
        playNextInQueue();
      };
    };
    speech.onerror = () => {
      playNextInQueue();
    };
    window.speechSynthesis.speak(speech);
  });
}

function stopAlerting() {
  alertingEnabled = false;
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  document.getElementById('startBtn').textContent = "Start Alerting";
  document.getElementById('status').textContent = "Alerting stopped.";
}

function startAlerting() {
  alertingEnabled = true;
  document.getElementById('startBtn').textContent = "Stop Alerting";
  document.getElementById('status').textContent = "Alerting enabled.";
  // Resume audio context if needed (for some browsers)
  if (window.AudioContext && AudioContext.prototype.resume) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctx.resume();
    } catch (e) {}
  }
  if (!pollingInterval) {
    fetchAlert();
    pollingInterval = setInterval(fetchAlert, 1000);
  }
}

document.getElementById('startBtn').addEventListener('click', function() {
  if (alertingEnabled) {
    stopAlerting();
  } else {
    startAlerting();
  }
});

// Automatically start alerting on page load
window.addEventListener('DOMContentLoaded', () => {
  startAlerting();
});
