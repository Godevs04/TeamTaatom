import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Dimensions,
  Animated,
  Image,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { callService, CallState } from '../services/callService';

const { width, height } = Dimensions.get('window');

interface CallScreenProps {
  visible: boolean;
  onClose: () => void;
  otherUser: {
    _id: string;
    fullName: string;
    profilePic?: string;
  };
}

export default function CallScreen({ visible, onClose, otherUser }: CallScreenProps) {
  const { theme } = useTheme();
  const [callState, setCallState] = useState<CallState>(() => {
    const serviceState = callService.getCallState();
    // If this is a test user and service state has no otherUserId, create a test state
    if (otherUser._id === 'test_user_id' && !serviceState.otherUserId) {
      return {
        ...serviceState,
        otherUserId: 'test_user_id',
        isIncomingCall: true,
        callType: 'voice',
        callId: 'test_call_id',
      };
    }
    return serviceState;
  });
  
  console.log('📞 CallScreen render - visible:', visible, 'callState:', callState, 'otherUser:', otherUser);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    const unsubscribe = callService.onCallStateChange((newState) => {
      // If this is a test user, preserve the test state
      if (otherUser._id === 'test_user_id') {
        setCallState(prevState => ({
          ...newState,
          otherUserId: 'test_user_id',
          isIncomingCall: prevState.isIncomingCall || newState.isIncomingCall,
          callType: prevState.callType || newState.callType || 'voice',
          callId: prevState.callId || newState.callId || 'test_call_id',
        }));
      } else {
        setCallState(newState);
      }
    });
    return unsubscribe;
  }, [otherUser._id]);

  useEffect(() => {
    if (callState.isIncomingCall) {
      // Pulse animation for incoming call
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [callState.isIncomingCall]);

  const handleAcceptCall = async () => {
    try {
      await callService.acceptCall();
    } catch (error) {
      console.error('Error accepting call:', error);
      Alert.alert('Error', 'Failed to accept call');
    }
  };

  const handleRejectCall = async () => {
    try {
      await callService.rejectCall();
      onClose();
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  };

  const handleEndCall = async () => {
    try {
      await callService.endCall();
      onClose();
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  const handleMuteToggle = async () => {
    await callService.toggleMute();
  };

  const handleVideoToggle = async () => {
    await callService.toggleVideo();
  };

  const handleSwitchCamera = async () => {
    await callService.switchCamera();
  };

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      flex: 1,
      backgroundColor: '#000',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: 'rgba(0,0,0,0.8)',
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    callInfo: {
      flex: 1,
      alignItems: 'center',
    },
    userName: {
      fontSize: 18,
      fontWeight: '600',
      color: '#fff',
      marginBottom: 4,
    },
    callStatus: {
      fontSize: 14,
      color: '#ccc',
    },
    videoContainer: {
      flex: 1,
      position: 'relative',
      backgroundColor: '#1a1a1a',
      justifyContent: 'center',
      alignItems: 'center',
    },
    remoteVideo: {
      flex: 1,
      width: '100%',
      backgroundColor: '#333',
      justifyContent: 'center',
      alignItems: 'center',
    },
    localVideo: {
      position: 'absolute',
      top: 20,
      right: 20,
      width: 120,
      height: 160,
      borderRadius: 12,
      backgroundColor: '#555',
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
    },
    videoPlaceholder: {
      fontSize: 16,
      color: '#999',
      textAlign: 'center',
    },
    videoPlaceholderContainer: {
      flex: 1,
      width: '100%',
      position: 'relative',
    },
    videoPlayer: {
      flex: 1,
      width: '100%',
    },
    videoOverlay: {
      position: 'absolute',
      bottom: 20,
      left: 20,
      right: 20,
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: 15,
      borderRadius: 10,
    },
    videoOverlayText: {
      color: 'white',
      fontSize: 18,
      fontWeight: 'bold',
      textAlign: 'center',
    },
    videoStatusText: {
      color: '#ccc',
      fontSize: 14,
      textAlign: 'center',
      marginTop: 5,
    },
    localVideoPlayer: {
      width: '100%',
      height: '100%',
    },
    localVideoOverlay: {
      position: 'absolute',
      bottom: 5,
      left: 5,
      right: 5,
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: 5,
      borderRadius: 5,
    },
    localVideoText: {
      color: 'white',
      fontSize: 12,
      textAlign: 'center',
    },
    controlsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 30,
      backgroundColor: 'rgba(0,0,0,0.8)',
    },
    controlButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 15,
    },
    muteButton: {
      backgroundColor: callState.isMuted ? '#ff4444' : 'rgba(255,255,255,0.2)',
    },
    videoButton: {
      backgroundColor: callState.isVideoEnabled ? 'rgba(255,255,255,0.2)' : '#ff4444',
    },
    switchCameraButton: {
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    endCallButton: {
      backgroundColor: '#ff4444',
      width: 70,
      height: 70,
      borderRadius: 35,
    },
    incomingCallContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.9)',
    },
    incomingCallAvatar: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 30,
    },
    incomingCallName: {
      fontSize: 24,
      fontWeight: '700',
      color: '#fff',
      marginBottom: 8,
    },
    incomingCallType: {
      fontSize: 16,
      color: '#ccc',
      marginBottom: 40,
    },
    incomingCallButtons: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    acceptButton: {
      backgroundColor: '#4CAF50',
      width: 70,
      height: 70,
      borderRadius: 35,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 30,
    },
    rejectButton: {
      backgroundColor: '#ff4444',
      width: 70,
      height: 70,
      borderRadius: 35,
      alignItems: 'center',
      justifyContent: 'center',
    },
    callDuration: {
      fontSize: 16,
      color: '#fff',
      marginTop: 10,
      fontWeight: '500',
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileImage: {
      width: 100,
      height: 100,
      borderRadius: 50,
    },
    avatarText: {
      fontSize: 40,
      color: theme.colors.textSecondary,
      fontWeight: '700',
    },
  });

  if (!visible) {
    console.log('📞 CallScreen not visible, returning null');
    return null;
  }

  // Incoming call screen
  if (callState.isIncomingCall) {
    console.log('📞 Rendering incoming call screen');
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.incomingCallContainer}>
          <Animated.View style={[styles.incomingCallAvatar, { transform: [{ scale: pulseAnim }] }]}>
            {otherUser.profilePic ? (
              <Image 
                source={{ uri: otherUser.profilePic }} 
                style={styles.profileImage}
                resizeMode={ResizeMode.COVER}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {otherUser.fullName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </Animated.View>
          
          <Text style={styles.incomingCallName}>{otherUser.fullName}</Text>
          <Text style={styles.incomingCallType}>
            {callState.callType === 'video' ? 'Video Call' : 'Voice Call'}
          </Text>
          
          <View style={styles.incomingCallButtons}>
            <TouchableOpacity 
              style={styles.acceptButton}
              onPress={handleAcceptCall}
            >
              <Ionicons name="call" size={30} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.rejectButton}
              onPress={handleRejectCall}
            >
              <Ionicons name="call" size={30} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Active call screen
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.callInfo}>
          <Text style={styles.userName}>{otherUser.fullName}</Text>
          <Text style={styles.callStatus}>
            {callState.isCallActive ? 'Connected' : 'Connecting...'}
          </Text>
          {callState.isCallActive && (
            <Text style={styles.callDuration}>
              {callService.formatCallDuration(callState.callDuration)}
            </Text>
          )}
        </View>
        
        <View style={{ width: 40 }} />
      </View>

      {/* Video Container */}
      <View style={styles.videoContainer}>
        {/* Remote Video */}
        <View style={styles.remoteVideo}>
          {callState.callType === 'video' ? (
            // Video Call - Show video placeholder with user info
            <View style={styles.videoPlaceholderContainer}>
              {/* Try multiple video sources for better reliability */}
              <Video
                source={{ uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' }}
                style={styles.videoPlayer}
                shouldPlay={true}
                isLooping={true}
                isMuted={true}
                resizeMode={ResizeMode.COVER}
                onError={(error) => {
                  console.log('Primary video error:', error);
                  // Try fallback video
                }}
                onLoad={() => {
                  console.log('📞 Primary video loaded successfully');
                }}
              />
              <View style={styles.videoOverlay}>
                <Text style={styles.videoOverlayText}>
                  {otherUser.fullName}
                </Text>
                <Text style={styles.videoStatusText}>
                  Video Call Active
                </Text>
              </View>
            </View>
          ) : (
            // Voice Call - Show profile picture
            <>
              {otherUser.profilePic ? (
                <Image 
                  source={{ uri: otherUser.profilePic }} 
                  style={styles.profileImage}
                  resizeMode={ResizeMode.COVER}
                />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {otherUser.fullName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.videoPlaceholder}>
                Voice Call Active
              </Text>
            </>
          )}
        </View>
        
        {/* Local Video */}
        {callState.callType === 'video' && (
          <View style={styles.localVideo}>
            <Video
              source={{ uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4' }}
              style={styles.localVideoPlayer}
              shouldPlay={true}
              isLooping={true}
              isMuted={true}
              resizeMode={ResizeMode.COVER}
              onError={(error) => {
                console.log('Local video error:', error);
                // Fallback to avatar if video fails
              }}
              onLoad={() => {
                console.log('📞 Local video loaded successfully');
              }}
            />
            <View style={styles.localVideoOverlay}>
              <Text style={styles.localVideoText}>You</Text>
            </View>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        {/* Mute Button */}
        <TouchableOpacity 
          style={[styles.controlButton, styles.muteButton]}
          onPress={handleMuteToggle}
        >
          <Ionicons 
            name={callState.isMuted ? "mic-off" : "mic"} 
            size={24} 
            color="#fff" 
          />
        </TouchableOpacity>

        {/* Video Toggle (only for video calls) */}
        {callState.callType === 'video' && (
          <TouchableOpacity 
            style={[styles.controlButton, styles.videoButton]}
            onPress={handleVideoToggle}
          >
            <Ionicons 
              name={callState.isVideoEnabled ? "videocam" : "videocam-off"} 
              size={24} 
              color="#fff" 
            />
          </TouchableOpacity>
        )}

        {/* Switch Camera (only for video calls) */}
        {callState.callType === 'video' && (
          <TouchableOpacity 
            style={[styles.controlButton, styles.switchCameraButton]}
            onPress={handleSwitchCamera}
          >
            <Ionicons name="camera-reverse" size={24} color="#fff" />
          </TouchableOpacity>
        )}

        {/* End Call Button */}
        <TouchableOpacity 
          style={[styles.controlButton, styles.endCallButton]}
          onPress={handleEndCall}
        >
          <Ionicons name="call" size={30} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}