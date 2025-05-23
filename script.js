const video = document.getElementById('webcam');
const canvas = document.getElementById('overlay-canvas');
const statusDiv = document.getElementById('status');
const ctx = canvas.getContext('2d');

// Audio alerts
const alertAudio = new Audio('alert.mp3');
const highAlertAudio = new Audio('high_alert.mp3');

// Suspicious keywords with severity levels
const suspiciousKeywords = {
  "bomb": 3,
  "explosive": 3,
  "grenade": 3,
  "gun": 2,
  "rifle": 2,
  "pistol": 2,
  "knife": 2,
  "dagger": 2,
  "gunman": 2,
  "thief": 1,
  "dangerous": 1,
  "danger": 1,
  "suspicious": 1,
  "weapon": 2
};

let lastDetectedSuspiciousItem = null;
let lastAlertTime = 0;
const ALERT_COOLDOWN = 10000; // 10 seconds

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  return new Promise(resolve => {
    video.onloadedmetadata = () => resolve(video);
  });
}

async function loadModel() {
  statusDiv.innerText = "Loading MobileNet model...";
  const model = await mobilenet.load();
  statusDiv.innerText = "✅ Model Loaded. Monitoring...";
  return model;
}

function speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function updateStatus(text, color = 'red') {
  statusDiv.innerText = text;
  statusDiv.style.color = color;
}

function getSeverity(name) {
  for (const keyword in suspiciousKeywords) {
    if (name.toLowerCase().includes(keyword)) {
      return suspiciousKeywords[keyword];
    }
  }
  return 0;
}

async function detect(model) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  async function runDetection() {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const predictions = await model.classify(canvas);

    let suspiciousItem = null;
    let suspiciousSeverity = 0;
    let suspiciousConfidence = 0;

    for (let i = 0; i < Math.min(5, predictions.length); i++) {
      const pred = predictions[i];
      const severity = getSeverity(pred.className);
      if (severity > suspiciousSeverity) {
        suspiciousSeverity = severity;
        suspiciousItem = pred.className;
        suspiciousConfidence = pred.probability;
      }
    }

    if (suspiciousSeverity > 0) {
      const now = Date.now();
      const newDetection = suspiciousItem !== lastDetectedSuspiciousItem;

      if ((now - lastAlertTime > ALERT_COOLDOWN) || newDetection) {
        lastDetectedSuspiciousItem = suspiciousItem;
        lastAlertTime = now;

        const confidencePercent = (suspiciousConfidence * 100).toFixed(1);
        updateStatus(`🚨 ALERT (Severity ${suspiciousSeverity}): ${suspiciousItem} (${confidencePercent}%)`);

        if (suspiciousSeverity >= 3) {
          highAlertAudio.play();
          speak(`High alert! ${suspiciousItem} detected.`);
        } else {
          alertAudio.play();
          speak(`Alert. Suspicious item detected. ${suspiciousItem}`);
        }
      }

      // Draw red alert text on canvas
      ctx.font = "24px Arial";
      ctx.fillStyle = "red";
      ctx.fillText(`Alert: ${suspiciousItem} (${(suspiciousConfidence * 100).toFixed(1)}%)`, 10, 30);
    } else {
      updateStatus(`✅ All Clear: ${predictions[0].className} (${(predictions[0].probability * 100).toFixed(1)}%)`, 'lime');
      lastDetectedSuspiciousItem = null;
    }

    requestAnimationFrame(runDetection);
  }

  runDetection();
}

(async () => {
  await setupCamera();
  const model = await loadModel();
  detect(model);
})();
