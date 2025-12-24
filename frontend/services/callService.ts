import { socketService } from './socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import logger from '../utils/logger';

export interface CallState {
  isCallActive: boolean;
  isIncomingCall: boolean;
  isOutgoingCall: boolean;
  callType: 'voice' | 'video' | null;
  otherUserId: string | null;
  callId: string | null;
  callDuration: number;
  isMuted: boolean;
  isVideoEnabled: boolean;
}

class CallService {
  private callState: CallState = {
    isCallActive: false,
    isIncomingCall: false,
    isOutgoingCall: false,
    callType: null,
    otherUserId: null,
    callId: null,
    callDuration: 0,
    isMuted: false,
    isVideoEnabled: true,
  };
  private callbacks: { [key: string]: (data: any) => void } = {};
  private callTimer: ReturnType<typeof setInterval> | null = null;
  private recording: Audio.Recording | null = null;
  private sound: Audio.Sound | null = null;
  private isAudioInitialized: boolean = false;
  // WebRTC dynamic members (to avoid hard dependency if lib isn't installed)
  private RTCPeerConnectionImpl: any | null = null;
  private mediaDevicesImpl: any | null = null;
  private RTCViewImpl: any | null = null;
  private peerConnection: any | null = null;
  private localStream: any | null = null;
  private remoteStream: any | null = null;
  private iceServers: any[] = [
    { urls: 'stun:stun.l.google.com:19302' },
  ];
  private pendingRemoteIceCandidates: any[] = [];

  constructor() {
    logger.debug('📞 CallService constructor - ready to initialize');
  }

  // Initialize the call service
  async initialize(): Promise<void> {
    logger.debug('📞 CallService initializing...');
    await this.bootstrapWebRTC();
    await this.setupSocketListeners();
    await this.initializeAudio();
    logger.debug('📞 CallService initialized successfully');
  }

  // Initialize audio permissions and settings
  private async initializeAudio(): Promise<void> {
    try {
      logger.debug('📞 Initializing audio...');
      
      // Request audio permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        logger.warn('📞 Audio permission not granted');
        return;
      }

      // Configure audio mode for calls
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: true,
        staysActiveInBackground: true,
      });

      this.isAudioInitialized = true;
      logger.debug('📞 Audio initialized successfully');
    } catch (error) {
      logger.error('📞 Error initializing audio:', error);
    }
  }

  private async getCurrentUserId(): Promise<string> {
    const userDataString = await AsyncStorage.getItem('userData');
    if (!userDataString) {
      throw new Error('User not authenticated');
    }
    
    const userData = JSON.parse(userDataString);
    const currentUserId = userData._id || userData.id;
    
    if (!currentUserId) {
      throw new Error('User ID not found in stored data');
    }
    
    return currentUserId;
  }

  // Store socket event handlers for cleanup
  private socketHandlers: { [event: string]: (data: any) => void } = {};

  private async setupSocketListeners() {
    logger.debug('📞 Setting up call service socket listeners...');
    
    // Ensure socket is connected
    await socketService.connect();
    logger.debug('📞 Socket connected, setting up listeners');
    
    // Listen for incoming calls
    const onIncomingCall = (data: any) => {
      logger.debug('📞 Incoming call received:', data);
      this.handleIncomingCall(data);
    };
    this.socketHandlers['call:incoming'] = onIncomingCall;
    await socketService.subscribe('call:incoming', onIncomingCall);

    // Listen for call accepted
    const onCallAccepted = (data: any) => {
      logger.debug('📞 Call accepted:', data);
      this.handleCallAccepted(data);
    };
    this.socketHandlers['call:accepted'] = onCallAccepted;
    await socketService.subscribe('call:accepted', onCallAccepted);

    // Listen for call rejected
    const onCallRejected = (data: any) => {
      logger.debug('📞 Call rejected:', data);
      this.handleCallRejected(data);
    };
    this.socketHandlers['call:rejected'] = onCallRejected;
    await socketService.subscribe('call:rejected', onCallRejected);

    // Listen for call ended
    const onCallEnded = (data: any) => {
      logger.debug('📞 Call ended:', data);
      this.handleCallEnded(data);
    };
    this.socketHandlers['call:ended'] = onCallEnded;
    await socketService.subscribe('call:ended', onCallEnded);

    // WebRTC signaling events
    const onOffer = async (data: any) => {
      logger.debug('📞 Signaling - offer received', !!data?.offer);
      await this.onOfferReceived(data);
    };
    this.socketHandlers['call:offer'] = onOffer;
    await socketService.subscribe('call:offer', onOffer);
    
    const onAnswer = async (data: any) => {
      logger.debug('📞 Signaling - answer received', !!data?.answer);
      await this.onAnswerReceived(data);
    };
    this.socketHandlers['call:answer'] = onAnswer;
    await socketService.subscribe('call:answer', onAnswer);
    
    const onIceCandidate = async (data: any) => {
      logger.debug('📞 Signaling - candidate received', !!data?.candidate);
      await this.onIceCandidateReceived(data);
    };
    this.socketHandlers['call:ice-candidate'] = onIceCandidate;
    await socketService.subscribe('call:ice-candidate', onIceCandidate);

    // Listen for mute state changes
    const onMute = (data: any) => {
      logger.debug('📞 Mute state changed:', data);
      this.handleMuteChange(data);
    };
    this.socketHandlers['call:mute'] = onMute;
    await socketService.subscribe('call:mute', onMute);

    // Listen for video state changes
    const onVideo = (data: any) => {
      logger.debug('📞 Video state changed:', data);
      this.handleVideoChange(data);
    };
    this.socketHandlers['call:video'] = onVideo;
    await socketService.subscribe('call:video', onVideo);

    // Listen for camera switch
    const onCameraSwitch = (data: any) => {
      logger.debug('📞 Camera switched:', data);
      this.handleCameraSwitch(data);
    };
    this.socketHandlers['call:camera-switch'] = onCameraSwitch;
    await socketService.subscribe('call:camera-switch', onCameraSwitch);
    
    logger.debug('📞 All call socket listeners set up successfully');
  }

  async startCall(otherUserId: string, callType: 'voice' | 'video'): Promise<void> {
    try {
      logger.debug(`📞 Starting ${callType} call with ${otherUserId}`);
      
      // Ensure socket is connected
      await socketService.connect();
      logger.debug('📞 Socket connected for call start');
      
      // Get current user ID
      const currentUserId = await this.getCurrentUserId();
      logger.debug('📞 Current user ID:', currentUserId);
      
      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Only update call state if not already set by UI
      const currentState = this.getCallState();
      if (!currentState.isOutgoingCall || currentState.otherUserId !== otherUserId) {
        this.updateCallState({
          isOutgoingCall: true,
          callType,
          otherUserId,
          callId,
          callDuration: 0,
          isMuted: false,
          isVideoEnabled: callType === 'video',
        });
      } else {
        // Update only the callId if state is already set
        this.updateCallState({
          callId,
        });
      }

      // Send call invitation
      logger.debug('📞 Sending call invitation:', {
        to: otherUserId,
        callId,
        callType,
        from: currentUserId,
      });
      
      await socketService.emit('call:invite', {
        to: otherUserId,
        callId,
        callType,
        from: currentUserId,
      });
      
      logger.debug('📞 Call invitation sent successfully');

      // Establish WebRTC and send SDP offer if available
      await this.ensurePeerConnection(callType);
      await this.createAndSendOffer(otherUserId, callId);

      // Simulate call ringing for 10 seconds
      setTimeout(() => {
        if (this.callState.isOutgoingCall) {
          logger.debug('📞 Call timed out - no answer');
          this.endCall();
        }
      }, 10000);
      
    } catch (error) {
      logger.error('📞 Error starting call:', error);
      this.endCall();
    }
  }

  async acceptCall(): Promise<void> {
    try {
      logger.debug('Accepting call');
      
      // Get current user ID
      const currentUserId = await this.getCurrentUserId();  
      
      // Send call accepted
      logger.debug('Sending call accepted:', {
        callId: this.callState.callId,
        to: this.callState.otherUserId,
        from: currentUserId,
      });
      
      socketService.emit('call:accept', {
        callId: this.callState.callId,
        to: this.callState.otherUserId,
        from: currentUserId,
      });

      // Prepare WebRTC answer
      await this.ensurePeerConnection(this.callState.callType || 'voice');
      // If an offer should have arrived already, onOfferReceived will handle. If offer already set, create answer now.
      if (this.peerConnection && this.peerConnection.remoteDescription) {
        await this.createAndSendAnswer(this.callState.otherUserId as string, this.callState.callId as string);
      }

      this.updateCallState({
        isIncomingCall: false,
        isOutgoingCall: false,
        isCallActive: true,
        callDuration: 0,
      });

      // Start call duration timer
      this.startCallTimer();

    } catch (error) {
      logger.error('Error accepting call:', error);
      this.rejectCall();
    }
  }

  async rejectCall(): Promise<void> {
    logger.debug('Rejecting call');
    
    // Get current user ID
    try {
      const currentUserId = await this.getCurrentUserId();
      
      logger.debug('Sending call rejected:', {
        callId: this.callState.callId,
        to: this.callState.otherUserId,
        from: currentUserId,
      });
      
      socketService.emit('call:reject', {
        callId: this.callState.callId,
        to: this.callState.otherUserId,
        from: currentUserId,
      });
    } catch (error) {
      logger.error('Error getting user ID for reject:', error);
    }

    this.endCall();
  }

  async endCall(): Promise<void> {
    logger.debug('Ending call');
    
    if (this.callState.callId) {
      // Get current user ID
      try {
        const currentUserId = await this.getCurrentUserId();
        
        logger.debug('Sending call ended:', {
          callId: this.callState.callId,
          to: this.callState.otherUserId,
          from: currentUserId,
        });
        
        socketService.emit('call:end', {
          callId: this.callState.callId,
          to: this.callState.otherUserId,
          from: currentUserId,
        });
      } catch (error) {
        logger.error('Error getting user ID for end call:', error);
      }
    }

    this.cleanup();
  }

  private startCallTimer(): void {
    this.callTimer = setInterval(() => {
      this.updateCallState({
        callDuration: this.callState.callDuration + 1,
      });
    }, 1000);
  }

  private stopCallTimer(): void {
    if (this.callTimer) {
      clearInterval(this.callTimer);
      this.callTimer = null;
    }
  }

  private async handleIncomingCall(data: any): Promise<void> {
    logger.debug('📞 Handling incoming call:', data);
    
    this.updateCallState({
      isIncomingCall: true,
      callType: data.callType,
      otherUserId: data.from,
      callId: data.callId,
      callDuration: 0,
      isMuted: false,
      isVideoEnabled: data.callType === 'video',
    });
    
    // Auto-show incoming call screen
    logger.debug('📞 Incoming call state updated, should show call screen');
  }

  private async handleCallAccepted(data: any): Promise<void> {
    logger.debug('📞 Call accepted by other user:', data);
    
    this.updateCallState({
      isOutgoingCall: false,
      isIncomingCall: false,
      isCallActive: true,
      callDuration: 0,
    });

    // Start call duration timer
    this.startCallTimer();
    // Do not play simulated audio; real audio will flow via WebRTC when available
    
    logger.debug('📞 Call is now active, timer started');
  }

  // Start audio simulation for active call
  private async startCallAudio(): Promise<void> { return; }

  // Play a simple call tone for testing
  private async playCallTone(): Promise<void> {
    return;
  }

  private async handleCallRejected(data: any): Promise<void> {
    logger.debug('📞 Call rejected by other user:', data);
    this.endCall();
  }

  private async handleCallEnded(data: any): Promise<void> {
    logger.debug('📞 Call ended by other user:', data);
    this.endCall();
  }

  private async handleMuteChange(data: any): Promise<void> {
    logger.debug('📞 Other user mute state changed:', data);
    // In a real implementation, you would update the UI to show the other user's mute state
    // For now, we'll just log it
  }

  private async handleVideoChange(data: any): Promise<void> {
    logger.debug('📞 Other user video state changed:', data);
    // In a real implementation, you would update the UI to show the other user's video state
    // For now, we'll just log it
  }

  private async handleCameraSwitch(data: any): Promise<void> {
    logger.debug('📞 Other user switched camera:', data);
    // In a real implementation, you would update the UI to show the camera switch
    // For now, we'll just log it
  }

  private updateCallState(updates: Partial<CallState>): void {
    this.callState = { ...this.callState, ...updates };
    
    // Notify callbacks
    Object.values(this.callbacks).forEach(callback => {
      callback(this.callState);
    });
  }

  private cleanup(): void {
    this.stopCallTimer();
    
    // Clean up socket listeners to prevent memory leaks
    Object.keys(this.socketHandlers).forEach(event => {
      const handler = this.socketHandlers[event];
      if (handler) {
        socketService.unsubscribe(event, handler);
      }
    });
    this.socketHandlers = {};
    logger.debug('📞 Socket listeners cleaned up');
    
    // Clean up audio resources
    this.cleanupAudio();

    // Clean up WebRTC resources
    try {
      if (this.peerConnection) {
        this.peerConnection.onicecandidate = null;
        this.peerConnection.ontrack = null;
        this.peerConnection.onconnectionstatechange = null;
        this.peerConnection.close();
      }
      this.peerConnection = null;
      if (this.localStream) {
        this.localStream.getTracks?.().forEach((t: any) => t.stop?.());
      }
      this.localStream = null;
      this.remoteStream = null;
    } catch (e) {
      logger.debug('📞 Error cleaning up WebRTC:', e);
    }
    
    this.updateCallState({
      isCallActive: false,
      isIncomingCall: false,
      isOutgoingCall: false,
      callType: null,
      otherUserId: null,
      callId: null,
      callDuration: 0,
      isMuted: false,
      isVideoEnabled: true,
    });
  }

  // Clean up audio resources
  private async cleanupAudio(): Promise<void> {
    try {
      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      }
      
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
      }
      
      logger.debug('📞 Audio resources cleaned up');
    } catch (error) {
      logger.error('📞 Error cleaning up audio:', error);
    }
  }

  // Public methods
  getCallState(): CallState {
    return this.callState;
  }

  isCallActive(): boolean {
    return this.callState.isCallActive || this.callState.isIncomingCall || this.callState.isOutgoingCall;
  }

  // Check if call service is properly initialized
  isInitialized(): boolean {
    return socketService.isConnected();
  }

  // Test socket connection
  async testSocketConnection(): Promise<boolean> {
    try {
      await socketService.connect();
      const isConnected = socketService.isConnected();
      logger.debug('📞 Socket connection test:', isConnected ? 'SUCCESS' : 'FAILED');
      return isConnected;
    } catch (error) {
      logger.error('📞 Socket connection test failed:', error);
      return false;
    }
  }

  // Get debug info about call service state
  getDebugInfo(): any {
    return {
      isInitialized: this.isInitialized(),
      isSocketConnected: socketService.isConnected(),
      callState: this.callState,
      hasCallbacks: Object.keys(this.callbacks).length,
    };
  }

  // Simple method to check if call service is working
  isWorking(): boolean {
    try {
      return this.isInitialized() && socketService.isConnected();
    } catch (error) {
      logger.error('📞 Error checking if call service is working:', error);
      return false;
    }
  }

  onCallStateChange(callback: (state: CallState) => void): () => void {
    const id = Math.random().toString(36).substr(2, 9);
    this.callbacks[id] = callback;
    
    return () => {
      delete this.callbacks[id];
    };
  }

  async toggleMute(): Promise<boolean> {
    const newMuteState = !this.callState.isMuted;
    this.updateCallState({ isMuted: newMuteState });
    
    // Control actual microphone
    if (this.isAudioInitialized) {
      this.controlMicrophone(newMuteState);
    }
    
    // Emit mute state change to other user
    if (this.callState.isCallActive) {
      try {
        const currentUserId = await this.getCurrentUserId();
        socketService.emit('call:mute', {
          callId: this.callState.callId,
          isMuted: newMuteState,
          userId: currentUserId
        });
      } catch (error) {
        logger.error('📞 Error getting user ID for mute:', error);
      }
    }
    
    logger.debug(`📞 Microphone ${newMuteState ? 'muted' : 'unmuted'}`);
    return newMuteState;
  }

  // Control actual microphone recording
  private async controlMicrophone(isMuted: boolean): Promise<void> {
    try {
      if (isMuted) {
        // Stop recording
        if (this.recording) {
          await this.recording.stopAndUnloadAsync();
          this.recording = null;
        }
      } else {
        // Start recording
        if (!this.recording) {
          const recordingOptions = {
            android: {
              extension: '.m4a',
              outputFormat: Audio.AndroidOutputFormat.MPEG_4,
              audioEncoder: Audio.AndroidAudioEncoder.AAC,
              sampleRate: 44100,
              numberOfChannels: 2,
              bitRate: 128000,
            },
            ios: {
              extension: '.m4a',
              outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
              audioQuality: Audio.IOSAudioQuality.HIGH,
              sampleRate: 44100,
              numberOfChannels: 2,
              bitRate: 128000,
              linearPCMBitDepth: 16,
              linearPCMIsBigEndian: false,
              linearPCMIsFloat: false,
            },
            web: {
              mimeType: 'audio/webm',
              bitsPerSecond: 128000,
            },
          };

          this.recording = new Audio.Recording();
          await this.recording.prepareToRecordAsync(recordingOptions);
          await this.recording.startAsync();
          logger.debug('📞 Microphone recording started');
        }
      }
    } catch (error) {
      logger.error('📞 Error controlling microphone:', error);
    }
  }

  async toggleVideo(): Promise<boolean> {
    const newVideoState = !this.callState.isVideoEnabled;
    this.updateCallState({ isVideoEnabled: newVideoState });
    
    // Emit video state change to other user
    if (this.callState.isCallActive) {
      try {
        const currentUserId = await this.getCurrentUserId();
        socketService.emit('call:video', {
          callId: this.callState.callId,
          isVideoEnabled: newVideoState,
          userId: currentUserId
        });
      } catch (error) {
        logger.error('📞 Error getting user ID for video toggle:', error);
      }
    }
    
    logger.debug(`📞 Video ${newVideoState ? 'enabled' : 'disabled'}`);
    return newVideoState;
  }

  async switchCamera(): Promise<void> {
    // Simulate camera switch with visual feedback
    logger.debug('📞 Switching camera (simulated)');
    
    // Emit camera switch to other user
    if (this.callState.isCallActive) {
      try {
        const currentUserId = await this.getCurrentUserId();
        socketService.emit('call:camera-switch', {
          callId: this.callState.callId,
          userId: currentUserId
        });
      } catch (error) {
        logger.error('📞 Error getting user ID for camera switch:', error);
      }
    }
    
    // Add a brief visual indication
    this.updateCallState({ 
      // Add a temporary flag to indicate camera switch
      callDuration: this.callState.callDuration 
    });
  }

  formatCallDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // ========== WebRTC helpers ==========
  private async bootstrapWebRTC(): Promise<void> {
    try {
      let rnWebRTC: any = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        rnWebRTC = (eval('require') as any)?.('react-native-webrtc');
      } catch {}
      if (!rnWebRTC) {
        logger.debug('📞 WebRTC module not found - running in fallback mode');
        return;
      }
      this.RTCPeerConnectionImpl = rnWebRTC.RTCPeerConnection || rnWebRTC.default?.RTCPeerConnection;
      this.mediaDevicesImpl = rnWebRTC.mediaDevices || rnWebRTC.default?.mediaDevices;
      this.RTCViewImpl = rnWebRTC.RTCView || rnWebRTC.default?.RTCView;
      if (this.RTCPeerConnectionImpl && this.mediaDevicesImpl) {
        logger.debug('📞 WebRTC available - signaling enabled');
      } else {
        logger.debug('📞 WebRTC not fully available - will use fallback');
      }
    } catch (e) {
      logger.debug('📞 WebRTC setup failed - fallback mode');
    }
  }

  private async ensurePeerConnection(callType: 'voice' | 'video'): Promise<void> {
    if (!this.RTCPeerConnectionImpl || !this.mediaDevicesImpl) return;
    if (this.peerConnection) return;

    this.peerConnection = new this.RTCPeerConnectionImpl({ iceServers: this.iceServers });

    this.peerConnection.onicecandidate = (event: any) => {
      if (event.candidate && this.callState.otherUserId && this.callState.callId) {
        socketService.emit('call:ice-candidate', {
          to: this.callState.otherUserId,
          callId: this.callState.callId,
          candidate: event.candidate,
        });
      }
    };

    this.peerConnection.ontrack = (event: any) => {
      logger.debug('📞 Remote track received');
      this.remoteStream = event.streams?.[0] || null;
      // Notify UI to refresh streams
      this.updateCallState({ callDuration: this.callState.callDuration });
    };

    const constraints = callType === 'video' ? { audio: true, video: true } : { audio: true, video: false };
    try {
      this.localStream = await this.mediaDevicesImpl.getUserMedia(constraints);
      this.localStream.getTracks().forEach((track: any) => this.peerConnection.addTrack(track, this.localStream));
      // Notify UI to refresh local preview
      this.updateCallState({ callDuration: this.callState.callDuration });
    } catch (e) {
      logger.error('📞 Failed to get local media:', e);
    }
  }

  private async createAndSendOffer(toUserId: string, callId: string): Promise<void> {
    if (!this.peerConnection) return;
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      await socketService.emit('call:offer', { to: toUserId, callId, offer });
    } catch (e) {
      logger.error('📞 Failed to create/send offer:', e);
    }
  }

  private async createAndSendAnswer(toUserId: string, callId: string): Promise<void> {
    if (!this.peerConnection) return;
    try {
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      await socketService.emit('call:answer', { to: toUserId, callId, answer });
    } catch (e) {
      logger.error('📞 Failed to create/send answer:', e);
    }
  }

  private async onOfferReceived(data: any): Promise<void> {
    if (!this.callState.otherUserId) {
      this.updateCallState({ otherUserId: data.from, callId: data.callId });
    }
    await this.ensurePeerConnection(this.callState.callType || 'voice');
    if (!this.peerConnection) return;
    try {
      await this.peerConnection.setRemoteDescription(data.offer);
      // Drain any queued ICE candidates for this remote description
      await this.flushPendingCandidates();
      await this.createAndSendAnswer(data.from, data.callId);
    } catch (e) {
      logger.error('📞 Failed handling offer:', e);
    }
  }

  private async onAnswerReceived(data: any): Promise<void> {
    if (!this.peerConnection) return;
    try {
      await this.peerConnection.setRemoteDescription(data.answer);
      // Drain any queued ICE candidates for this remote description
      await this.flushPendingCandidates();
    } catch (e) {
      logger.error('📞 Failed handling answer:', e);
    }
  }

  private async onIceCandidateReceived(data: any): Promise<void> {
    if (!this.peerConnection || !data?.candidate) return;
    try {
      // If remote description not set yet, queue the candidate
      if (!this.peerConnection.remoteDescription) {
        this.pendingRemoteIceCandidates.push(data.candidate);
        return;
      }
      const Ctor = (global as any)?.RTCIceCandidate;
      await this.peerConnection.addIceCandidate(Ctor ? new Ctor(data.candidate) : data.candidate);
    } catch (e) {
      logger.error('📞 Failed adding ice candidate:', e);
    }
  }

  private async flushPendingCandidates(): Promise<void> {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    const Ctor = (global as any)?.RTCIceCandidate;
    while (this.pendingRemoteIceCandidates.length > 0) {
      const cand = this.pendingRemoteIceCandidates.shift();
      try {
        await this.peerConnection.addIceCandidate(Ctor ? new Ctor(cand) : cand);
      } catch (e) {
        logger.error('📞 Failed adding queued ice candidate:', e);
      }
    }
  }
}


export const callService = new CallService();
