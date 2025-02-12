# WebRTC Video Chat Application

A real-time peer-to-peer video chat application built with WebRTC and Firebase, featuring a modern UI and robust functionality.

## Main.js Technical Documentation

The `main.js` file is the core of the application, handling all WebRTC connections, Firebase interactions, and UI controls. Here's a detailed breakdown of its functionality:

### Firebase Configuration and Setup
- Initializes Firebase with configuration for Firestore database
- Enables offline persistence for better user experience
- Sets up analytics tracking

### Connection Status Monitoring
- Tracks online/offline status using the Navigator API
- Provides real-time feedback to users about their connection status
- Prevents operations when offline to maintain stability

### WebRTC Configuration
- Uses Google's STUN servers for NAT traversal
- Configures ICE candidate pool size for optimal connection establishment
- Sets up peer connection with standard WebRTC configuration

### Media Stream Handling
- Manages local and remote media streams
- Configures video constraints for optimal quality:
  - Width: 640px (ideal) to 1280px (max)
  - Height: 480px (ideal) to 720px (max)
  - Uses front-facing camera by default
- Configures audio with noise suppression and echo cancellation
- Implements track handling for both local and remote streams

### Audio Visualization
- Creates real-time audio level visualization
- Uses Web Audio API for frequency analysis
- Provides visual feedback for speaking participants
- Updates audio indicators in real-time using requestAnimationFrame

### UI Controls
- Camera controls:
  - Start/stop camera
  - Mute/unmute audio
  - Enable/disable video
- Call management:
  - Create new calls
  - Join existing calls
  - End active calls
- Volume control for remote participant
- Copy functionality for sharing call IDs

### Call Creation Process
1. Creates new Firestore document for the call
2. Generates and stores local ICE candidates
3. Creates and stores WebRTC offer
4. Listens for remote answer and ICE candidates
5. Establishes peer connection when answer is received

### Call Joining Process
1. Validates call ID and checks for call expiration
2. Retrieves call data from Firestore
3. Sets up ICE candidate gathering
4. Creates and stores WebRTC answer
5. Establishes peer connection with caller

### Error Handling
- Comprehensive error checking for media devices
- Connection status validation
- Call existence verification
- Expired call detection (calls expire after 1 hour)
- Browser compatibility checks
- Secure context verification

### Security Features
- Requires HTTPS or localhost for camera access
- Implements call expiration
- Uses secure WebRTC configuration
- Validates all Firebase operations

### Performance Optimizations
- Implements proper cleanup on call termination
- Manages WebRTC connection lifecycle
- Handles browser tab synchronization
- Optimizes media stream quality based on network conditions

## Key Technical Features
- Peer-to-peer video/audio streaming
- Real-time signaling through Firebase
- Automatic NAT traversal
- Connection state management
- Media device control
- Audio visualization
- Responsive design support
- Offline capability detection
- Secure communication channels

## Browser Compatibility
The application uses modern Web APIs and requires browsers that support:
- WebRTC
- MediaDevices API
- Web Audio API
- Secure Contexts
