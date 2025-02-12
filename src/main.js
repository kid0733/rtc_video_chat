// main.js

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  getDoc,
  setDoc,
  enableIndexedDbPersistence
} from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Firebase configuration and initialization
const firebaseConfig = {
  apiKey: "AIzaSyByP2FBVaQbhbcygnwrUuSmTwt9RBlvIhE",
  authDomain: "rtc-video-chat-29a80.firebaseapp.com",
  projectId: "rtc-video-chat-29a80",
  storageBucket: "rtc-video-chat-29a80.firebasestorage.app",
  messagingSenderId: "128189272045",
  appId: "1:128189272045:web:dcb48a8c7344436ff3a1e4",
  measurementId: "G-T87JHWLQL6"
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);
const analytics = getAnalytics(app);

// Enable offline persistence (Firebase warns that this will be deprecated in the future)
enableIndexedDbPersistence(firestore).catch((err) => {
  if (err.code === "failed-precondition") {
    console.error("Multiple tabs open; persistence can only be enabled in one tab at a time.");
  } else if (err.code === "unimplemented") {
    console.error("The current browser does not support persistence.");
  }
});

// Monitor connection status
let isOnline = navigator.onLine;
function updateOnlineStatus() {
  isOnline = navigator.onLine;
  console.log("Connection status:", isOnline ? "online" : "offline");
  if (!isOnline) {
    alert("You are currently offline. Please check your internet connection.");
  }
}
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
updateOnlineStatus();

function ensureOnline() {
  if (!navigator.onLine) {
    throw new Error("No internet connection. Please check your connection and try again.");
  }
}

// WebRTC configuration
const servers = {
  iceServers: [
    { urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] }
  ],
  iceCandidatePoolSize: 10
};

let pc;
let localStream = null;
let remoteStream = new MediaStream();

function createPeerConnection() {
  pc = new RTCPeerConnection(servers);
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };
}

// UI element references
const webcamButton = document.getElementById("webcamButton");
const webcamVideo = document.getElementById("webcamVideo");
const createCallButton = document.getElementById("createCallButton");
const callInfo = document.getElementById("callInfo");
const callInput = document.getElementById("callInput");
const copyButton = document.getElementById("copyButton");
const answerInput = document.getElementById("answerInput");
const answerButton = document.getElementById("answerButton");
const remoteVideo = document.getElementById("remoteVideo");
const hangupButton = document.getElementById("hangupButton");
const muteAudioButton = document.getElementById("muteAudioButton");
const muteVideoButton = document.getElementById("muteVideoButton");
const volumeSlider = document.getElementById("volumeSlider");

// Audio visualization setup
let audioContext, audioAnalyser, audioDataArray;
function setupAudioVisualization(stream) {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  const source = audioContext.createMediaStreamSource(stream);
  audioAnalyser = audioContext.createAnalyser();
  audioAnalyser.fftSize = 256;
  source.connect(audioAnalyser);
  audioDataArray = new Uint8Array(audioAnalyser.frequencyBinCount);

  const localContainer = webcamVideo.parentElement;
  let localAudioIndicator = localContainer.querySelector(".audio-indicator");
  if (!localAudioIndicator) {
    localAudioIndicator = document.createElement("div");
    localAudioIndicator.className = "audio-indicator";
    localContainer.appendChild(localAudioIndicator);
  }

  function updateAudioIndicators() {
    audioAnalyser.getByteFrequencyData(audioDataArray);
    const audioLevel = audioDataArray.reduce((sum, value) => sum + value, 0) / audioDataArray.length;
    if (audioLevel > 30) {
      localAudioIndicator.classList.add("speaking");
    } else {
      localAudioIndicator.classList.remove("speaking");
    }
    requestAnimationFrame(updateAudioIndicators);
  }
  updateAudioIndicators();
}

// Audio/video mute toggles
let isAudioMuted = false;
let isVideoMuted = false;
muteAudioButton.onclick = () => {
  if (localStream && localStream.getAudioTracks().length > 0) {
    isAudioMuted = !isAudioMuted;
    localStream.getAudioTracks()[0].enabled = !isAudioMuted;
    muteAudioButton.classList.toggle("muted", isAudioMuted);
    muteAudioButton.querySelector(".icon").textContent = isAudioMuted ? "🔇" : "🎤";
  }
};
muteVideoButton.onclick = () => {
  if (localStream && localStream.getVideoTracks().length > 0) {
    isVideoMuted = !isVideoMuted;
    localStream.getVideoTracks()[0].enabled = !isVideoMuted;
    muteVideoButton.classList.toggle("muted", isVideoMuted);
    muteVideoButton.querySelector(".icon").textContent = isVideoMuted ? "🚫" : "📹";
  }
};
volumeSlider.oninput = (e) => {
  remoteVideo.volume = e.target.value / 100;
};

// Copy call ID functionality
copyButton.onclick = () => {
  callInput.select();
  document.execCommand("copy");
  copyButton.textContent = "Copied!";
  setTimeout(() => {
    copyButton.textContent = "Copy ID";
  }, 2000);
};

// Add a status indicator to the camera container
function addStatusIndicator() {
  const webcamContainer = document.querySelector(".video-container");
  const status = document.createElement("span");
  status.className = "status-badge disconnected";
  status.textContent = "Camera Off";
  webcamContainer.appendChild(status);
  return status;
}
const statusIndicator = addStatusIndicator();

// Common hangup/cleanup function used by both call creation and answering
let unsubscribeAnswer, unsubscribeCandidates;
function hangUpCall() {
  if (unsubscribeAnswer) unsubscribeAnswer();
  if (unsubscribeCandidates) unsubscribeCandidates();
  if (pc) pc.close();
  if (localStream) localStream.getTracks().forEach((track) => track.stop());
  if (remoteStream) remoteStream.getTracks().forEach((track) => track.stop());

  webcamVideo.srcObject = null;
  remoteVideo.srcObject = null;
  localStream = null;
  remoteStream = new MediaStream();

  // Reset UI states
  webcamButton.disabled = false;
  webcamButton.textContent = "Start Camera";
  createCallButton.disabled = true;
  answerButton.disabled = true;
  hangupButton.disabled = true;
  callInfo.classList.remove("visible");
  answerInput.value = "";
  callInput.value = "";
  statusIndicator.textContent = "Camera Off";
  statusIndicator.classList.remove("connected");
  statusIndicator.classList.add("disconnected");
}

// Start Camera button handler
webcamButton.onclick = async () => {
  console.log("Webcam button clicked");
  try {
    webcamButton.disabled = true;
    webcamButton.textContent = "Connecting...";

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("getUserMedia is not supported in this browser");
    }
    if (!window.isSecureContext) {
      throw new Error("Camera access requires a secure context (HTTPS or localhost)");
    }

    // Request both audio and video in one call
    const constraints = {
      video: {
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 },
        facingMode: "user"
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    if (!localStream.getAudioTracks().length || !localStream.getVideoTracks().length) {
      throw new Error("Required media tracks not available");
    }

    // Set up the media stream and peer connection
    setupAudioVisualization(localStream);
    remoteStream = new MediaStream();
    createPeerConnection();
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    // Attach streams to video elements
    webcamVideo.srcObject = localStream;
    remoteVideo.srcObject = remoteStream;

    // Update UI state
    createCallButton.disabled = false;
    answerButton.disabled = false;
    hangupButton.disabled = false;
    webcamButton.textContent = "Camera Started";
    statusIndicator.textContent = "Camera On";
    statusIndicator.classList.remove("disconnected");
    statusIndicator.classList.add("connected");
    console.log("Camera setup complete");
  } catch (error) {
    console.error("Error accessing media devices:", error);
    alert(error.message);
    webcamButton.disabled = false;
    webcamButton.textContent = "Start Camera";
  }
};

// Create a new call (caller)
createCallButton.onclick = async () => {
  try {
    ensureOnline();
    createCallButton.disabled = true;
    createCallButton.textContent = "Creating call...";

    // Create a new call document and its candidate subcollections
    const callDocRef = doc(collection(firestore, "calls"));
    const offerCandidates = collection(callDocRef, "offerCandidates");
    const answerCandidates = collection(callDocRef, "answerCandidates");

    // Display the call ID for sharing
    callInput.value = callDocRef.id;
    callInfo.classList.add("visible");

    // Gather ICE candidates and store them in Firestore
    pc.onicecandidate = (event) => {
      if (event.candidate && navigator.onLine) {
        addDoc(offerCandidates, event.candidate.toJSON()).catch(console.error);
      }
    };

    // Create offer and save it to Firestore
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);
    await setDoc(callDocRef, {
      offer: {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
        timestamp: Date.now()
      }
    });

    // Listen for the answer from the remote peer
    unsubscribeAnswer = onSnapshot(
      callDocRef,
      (snapshot) => {
        const data = snapshot.data();
        if (!pc.currentRemoteDescription && data?.answer) {
          pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(console.error);
        }
      },
      (error) => {
        console.error("Error listening for answer:", error);
      }
    );

    // Listen for remote ICE candidates
    unsubscribeCandidates = onSnapshot(answerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate).catch(console.error);
        }
      });
    });

    hangupButton.onclick = hangUpCall;
    createCallButton.textContent = "Call Created!";
  } catch (error) {
    console.error("Error creating call:", error);
    alert(error.message || "Failed to create call. Please try again.");
    createCallButton.disabled = false;
    createCallButton.textContent = "Create New Call";
    callInfo.classList.remove("visible");
  }
};

// Join an existing call (answerer)
answerButton.onclick = async () => {
  try {
    ensureOnline();
    answerButton.disabled = true;
    answerButton.textContent = "Joining...";
    const callId = answerInput.value.trim();
    if (!callId) throw new Error("Please enter a Call ID");

    const callDocRef = doc(firestore, "calls", callId);
    const answerCandidates = collection(callDocRef, "answerCandidates");
    const offerCandidates = collection(callDocRef, "offerCandidates");

    const callSnapshot = await getDoc(callDocRef);
    if (!callSnapshot.exists()) {
      throw new Error("Call not found. Please check the Call ID and try again.");
    }
    const callData = callSnapshot.data();
    if (!callData.offer) {
      throw new Error("Invalid call data. Please try with a different Call ID.");
    }
    if (callData.offer.timestamp && Date.now() - callData.offer.timestamp > 3600000) {
      throw new Error("This call has expired. Please create a new call.");
    }

    // Set up ICE candidate gathering for the answerer
    pc.onicecandidate = (event) => {
      if (event.candidate && navigator.onLine) {
        addDoc(answerCandidates, event.candidate.toJSON()).catch(console.error);
      }
    };

    // Set the remote offer and create an answer
    await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);
    await updateDoc(callDocRef, {
      answer: {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
        timestamp: Date.now()
      }
    });

    // Listen for remote ICE candidates from the caller
    unsubscribeCandidates = onSnapshot(offerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate).catch(console.error);
        }
      });
    });

    hangupButton.onclick = hangUpCall;
    hangupButton.disabled = false;
    answerButton.textContent = "Connected!";
    answerInput.disabled = true;
  } catch (error) {
    console.error("Error joining call:", error);
    alert(error.message);
    answerButton.disabled = false;
    answerButton.textContent = "Join Existing Call";
    answerInput.disabled = false;
  }
};
