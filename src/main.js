// main.js

// ==========================================
// FIREBASE CONFIGURATION AND INITIALIZATION
// ==========================================

// Import required Firebase modules
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

// Firebase configuration object containing all necessary credentials and IDs
// These values are loaded from environment variables for security
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase application with our config
const app = initializeApp(firebaseConfig);
// Get Firestore database instance
const firestore = getFirestore(app);
// Initialize Firebase Analytics
const analytics = getAnalytics(app);

// ==========================================
// OFFLINE PERSISTENCE CONFIGURATION
// ==========================================

// Enable offline data persistence in Firebase
// This allows the app to work even when internet connection is lost temporarily
enableIndexedDbPersistence(firestore).catch((err) => {
  if (err.code === "failed-precondition") {
    // Multiple tabs open, persistence can only be enabled in one tab at a time
    console.error("Multiple tabs open; persistence can only be enabled in one tab at a time.");
  } else if (err.code === "unimplemented") {
    // The current browser doesn't support all of the required features
    console.error("The current browser does not support persistence.");
  }
});

// ==========================================
// ONLINE/OFFLINE STATUS MONITORING
// ==========================================

// Track the current online/offline status
let isOnline = navigator.onLine;

// Function to update the online status and notify user if offline
function updateOnlineStatus() {
  isOnline = navigator.onLine;
  console.log("Connection status:", isOnline ? "online" : "offline");
  if (!isOnline) {
    alert("You are currently offline. Please check your internet connection.");
  }
}

// Add event listeners for online/offline status changes
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
// Initial check of online status
updateOnlineStatus();

// Helper function to ensure internet connectivity before performing actions
function ensureOnline() {
  if (!navigator.onLine) {
    throw new Error("No internet connection. Please check your connection and try again.");
  }
}

// ==========================================
// WEBRTC CONFIGURATION
// ==========================================

// Configure ICE (Interactive Connectivity Establishment) servers
// These servers help establish peer-to-peer connections
const servers = {
  iceServers: [
    // Google's public STUN servers for NAT traversal
    { urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] }
  ],
  iceCandidatePoolSize: 10  // Pre-allocate ICE candidates pool
};

// Global WebRTC variables
let pc; // RTCPeerConnection instance
let localStream = null; // Stream from user's camera/mic
let remoteStream = new MediaStream(); // Stream from remote peer

// Function to create new RTCPeerConnection with configured servers
function createPeerConnection() {
  pc = new RTCPeerConnection(servers);
  
  // Handle incoming tracks from remote peer
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };
}

// ==========================================
// UI ELEMENT REFERENCES
// ==========================================

// Get references to all UI elements we'll need to interact with
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

// ==========================================
// AUDIO VISUALIZATION SETUP
// ==========================================

// Variables for audio visualization
let audioContext, audioAnalyser, audioDataArray;

// Function to set up audio visualization for the local stream
function setupAudioVisualization(stream) {
  // Create audio context if it doesn't exist
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  // Create audio source from stream
  const source = audioContext.createMediaStreamSource(stream);
  audioAnalyser = audioContext.createAnalyser();
  audioAnalyser.fftSize = 256; // Set size of FFT for frequency analysis
  source.connect(audioAnalyser);
  audioDataArray = new Uint8Array(audioAnalyser.frequencyBinCount);

  // Create or get the audio indicator element
  const localContainer = webcamVideo.parentElement;
  let localAudioIndicator = localContainer.querySelector(".audio-indicator");
  if (!localAudioIndicator) {
    localAudioIndicator = document.createElement("div");
    localAudioIndicator.className = "audio-indicator";
    localContainer.appendChild(localAudioIndicator);
  }

  // Function to continuously update audio indicators
  function updateAudioIndicators() {
    audioAnalyser.getByteFrequencyData(audioDataArray);
    // Calculate average audio level
    const audioLevel = audioDataArray.reduce((sum, value) => sum + value, 0) / audioDataArray.length;
    
    // Update visual indicator based on audio level
    if (audioLevel > 30) {
      localAudioIndicator.classList.add("speaking");
    } else {
      localAudioIndicator.classList.remove("speaking");
    }
    // Request next animation frame
    requestAnimationFrame(updateAudioIndicators);
  }
  updateAudioIndicators();
}

// ==========================================
// AUDIO/VIDEO CONTROLS
// ==========================================

// Track mute states
let isAudioMuted = false;
let isVideoMuted = false;

// Handle audio mute/unmute
muteAudioButton.onclick = () => {
  if (localStream && localStream.getAudioTracks().length > 0) {
    isAudioMuted = !isAudioMuted;
    localStream.getAudioTracks()[0].enabled = !isAudioMuted;
    muteAudioButton.classList.toggle("muted", isAudioMuted);
    muteAudioButton.querySelector(".icon").textContent = isAudioMuted ? "🔇" : "🎤";
  }
};

// Handle video mute/unmute
muteVideoButton.onclick = () => {
  if (localStream && localStream.getVideoTracks().length > 0) {
    isVideoMuted = !isVideoMuted;
    localStream.getVideoTracks()[0].enabled = !isVideoMuted;
    muteVideoButton.classList.toggle("muted", isVideoMuted);
    muteVideoButton.querySelector(".icon").textContent = isVideoMuted ? "🚫" : "📹";
  }
};

// Handle remote video volume control
volumeSlider.oninput = (e) => {
  remoteVideo.volume = e.target.value / 100;
};

// ==========================================
// CALL ID COPYING FUNCTIONALITY
// ==========================================

// Handle copying call ID to clipboard
copyButton.onclick = () => {
  callInput.select();
  document.execCommand("copy");
  copyButton.textContent = "Copied!";
  setTimeout(() => {
    copyButton.textContent = "Copy ID";
  }, 2000);
};

// ==========================================
// STATUS INDICATOR
// ==========================================

// Function to add status indicator to the video container
function addStatusIndicator() {
  const webcamContainer = document.querySelector(".video-container");
  const status = document.createElement("span");
  status.className = "status-badge disconnected";
  status.textContent = "Camera Off";
  webcamContainer.appendChild(status);
  return status;
}
const statusIndicator = addStatusIndicator();

// ==========================================
// CALL CLEANUP AND HANGUP
// ==========================================

// Variables to store unsubscribe functions for Firebase listeners
let unsubscribeAnswer, unsubscribeCandidates;

// Function to clean up all resources when call ends
function hangUpCall() {
  // Clean up Firebase listeners
  if (unsubscribeAnswer) unsubscribeAnswer();
  if (unsubscribeCandidates) unsubscribeCandidates();
  
  // Close peer connection
  if (pc) pc.close();
  
  // Stop all tracks in both streams
  if (localStream) localStream.getTracks().forEach(track => track.stop());
  if (remoteStream) remoteStream.getTracks().forEach(track => track.stop());

  // Clear video sources
  webcamVideo.srcObject = null;
  remoteVideo.srcObject = null;
  
  // Reset streams
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

// ==========================================
// CAMERA SETUP AND INITIALIZATION
// ==========================================

// Handle starting the camera when webcam button is clicked
webcamButton.onclick = async () => {
  console.log("Webcam button clicked");
  try {
    webcamButton.disabled = true;
    webcamButton.textContent = "Connecting...";

    // Check for browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("getUserMedia is not supported in this browser");
    }
    if (!window.isSecureContext) {
      throw new Error("Camera access requires a secure context (HTTPS or localhost)");
    }

    // Define media constraints for both video and audio
    const constraints = {
      video: {
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 },
        facingMode: "user"  // Use front camera on mobile devices
      },
      audio: {
        echoCancellation: true,  // Reduce echo
        noiseSuppression: true,  // Reduce background noise
        autoGainControl: true    // Automatically adjust audio levels
      }
    };

    // Request access to camera and microphone
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Verify we got both audio and video tracks
    if (!localStream.getAudioTracks().length || !localStream.getVideoTracks().length) {
      throw new Error("Required media tracks not available");
    }

    // Set up media streams and peer connection
    setupAudioVisualization(localStream);
    remoteStream = new MediaStream();
    createPeerConnection();
    
    // Add all local tracks to the peer connection
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    // Connect streams to video elements
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

// ==========================================
// CALL CREATION (CALLER SIDE)
// ==========================================

// Handle creating a new call
createCallButton.onclick = async () => {
  try {
    ensureOnline();
    createCallButton.disabled = true;
    createCallButton.textContent = "Creating call...";

    // Create new documents in Firestore for the call
    const callDocRef = doc(collection(firestore, "calls"));
    const offerCandidates = collection(callDocRef, "offerCandidates");
    const answerCandidates = collection(callDocRef, "answerCandidates");

    // Display call ID for sharing
    callInput.value = callDocRef.id;
    callInfo.classList.add("visible");

    // Listen for and store ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && navigator.onLine) {
        addDoc(offerCandidates, event.candidate.toJSON()).catch(console.error);
      }
    };

    // Create and store the offer
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);
    await setDoc(callDocRef, {
      offer: {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
        timestamp: Date.now()
      }
    });

    // Listen for the answer from remote peer
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

    // Set up hangup handler
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

// ==========================================
// CALL JOINING (ANSWERER SIDE)
// ==========================================

// Handle joining an existing call
answerButton.onclick = async () => {
  try {
    ensureOnline();
    answerButton.disabled = true;
    answerButton.textContent = "Joining...";
    
    // Get and validate call ID
    const callId = answerInput.value.trim();
    if (!callId) throw new Error("Please enter a Call ID");

    // Get references to Firestore documents
    const callDocRef = doc(firestore, "calls", callId);
    const answerCandidates = collection(callDocRef, "answerCandidates");
    const offerCandidates = collection(callDocRef, "offerCandidates");

    // Verify call exists and is valid
    const callSnapshot = await getDoc(callDocRef);
    if (!callSnapshot.exists()) {
      throw new Error("Call not found. Please check the Call ID and try again.");
    }
    const callData = callSnapshot.data();
    if (!callData.offer) {
      throw new Error("Invalid call data. Please try with a different Call ID.");
    }
    
    // Check if call has expired (1 hour limit)
    if (callData.offer.timestamp && Date.now() - callData.offer.timestamp > 3600000) {
      throw new Error("This call has expired. Please create a new call.");
    }

    // Set up ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate && navigator.onLine) {
        addDoc(answerCandidates, event.candidate.toJSON()).catch(console.error);
      }
    };

    // Set remote description and create answer
    await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);
    
    // Store the answer in Firestore
    await updateDoc(callDocRef, {
      answer: {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
        timestamp: Date.now()
      }
    });

    // Listen for remote ICE candidates
    unsubscribeCandidates = onSnapshot(offerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate).catch(console.error);
        }
      });
    });

    // Set up hangup handler and update UI
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
