import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { addComment } from '../services/posts';
import { getUserFromStorage } from '../services/auth';
import CustomAlert from './CustomAlert';

const { height: screenHeight } = Dimensions.get('window');

interface Comment {
  _id: string;
  text: string;
  user: {
    _id: string;
    fullName: string;
    profilePic: string;
  };
  createdAt: string;
}

interface CommentModalProps {
  visible: boolean;
  postId: string;
  comments: Comment[];
  onClose: () => void;
  onCommentAdded: (newComment: Comment) => void;
}

export default function CommentModal({
  visible,
  postId,
  comments,
  onClose,
  onCommentAdded,
}: CommentModalProps) {
  const { theme } = useTheme();
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showCustomAlert, setShowCustomAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
    onConfirm: () => {},
  });

  // Animation values
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      // Reset animation values
      translateY.setValue(screenHeight);
      opacity.setValue(0);
      scale.setValue(0.9);
      
      // Animate in with proper timing
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]).start();
    }
  }, [visible]);

  React.useEffect(() => {
    const loadUser = async () => {
      const user = await getUserFromStorage();
      setCurrentUser(user);
    };
    loadUser();
  }, []);

  const showCustomAlertMessage = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'warning' | 'info',
    onConfirm?: () => void
  ) => {
    setAlertConfig({
      title,
      message,
      type,
      onConfirm: onConfirm || (() => {}),
    });
    setShowCustomAlert(true);
  };

  const addCommentWithRetry = async (postId: string, comment: string, retries = 3): Promise<any> => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await addComment(postId, comment);
        return response;
      } catch (error: any) {
        // If it's a rate limit error and we have retries left, wait and retry
        if (error?.response?.status === 429 && i < retries - 1) {
          const waitTime = Math.pow(2, i) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`Rate limited, waiting ${waitTime}ms before retry ${i + 1}/${retries}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        throw error; // Re-throw if not rate limit or no retries left
      }
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) {
      showCustomAlertMessage('Error', 'Please enter a comment.', 'error');
      return;
    }

    if (!currentUser) {
      showCustomAlertMessage('Error', 'You must be signed in to comment.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await addCommentWithRetry(postId, newComment.trim());
      onCommentAdded(response.comment);
      setNewComment('');
      
      // Show success message but don't auto-close the modal
      // showCustomAlertMessage('Success', 'Comment added successfully!', 'success');
      console.log('Comment added successfully!');
      
      // Small delay to prevent rapid state changes
      setTimeout(() => {
        setIsSubmitting(false);
      }, 100);
      
    } catch (error: any) {
      console.error('Error adding comment:', error);
      
      // Handle rate limiting specifically
      if (error?.response?.status === 429) {
        showCustomAlertMessage('Rate Limited', 'Too many requests. Please wait a moment before commenting again.', 'warning');
      } else {
        showCustomAlertMessage('Error', 'Failed to add comment. Please try again.', 'error');
      }
      setIsSubmitting(false);
    }
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentItem}>
      <Image
        source={{
          uri: item.user.profilePic || 'https://via.placeholder.com/32',
        }}
        style={styles.commentAvatar}
      />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={[styles.commentUsername, { color: theme.colors.text }]}>
            {item.user.fullName}
          </Text>
          <Text style={[styles.commentTime, { color: theme.colors.textSecondary }]}>
            {new Date(item.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <Text style={[styles.commentText, { color: theme.colors.text }]}>
          {item.text}
        </Text>
      </View>
    </View>
  );

  const handleClose = () => {
    // Reset form state
    setNewComment('');
    setIsSubmitting(false);
    
    // Close any open alerts first
    setShowCustomAlert(false);
    
    // Animate out smoothly
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: screenHeight,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.9,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Only close after animation completes
      onClose();
    });
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="none"
        transparent={true}
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <Animated.View 
          style={[
            styles.overlay,
            {
              opacity: opacity,
            }
          ]}
        >
          <TouchableOpacity 
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={handleClose}
          >
            <View />
          </TouchableOpacity>
          
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                backgroundColor: theme.colors.background,
                transform: [
                  { translateY: translateY },
                  { scale: scale }
                ],
                opacity: opacity,
              },
            ]}
          >
            <KeyboardAvoidingView
              style={styles.container}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
              enabled={true}
            >
              {/* Handle Bar */}
              <View style={styles.handleBar}>
                <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
              </View>

              {/* Header */}
              <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                  Comments ({comments.length})
                </Text>
                <TouchableOpacity style={styles.moreButton}>
                  <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              {/* Comments List */}
              <FlatList
                data={comments}
                renderItem={renderComment}
                keyExtractor={(item) => item._id}
                style={styles.commentsList}
                contentContainerStyle={styles.commentsContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyComments}>
                    <Ionicons name="chatbubbles-outline" size={48} color={theme.colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                      No comments yet
                    </Text>
                    <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>
                      Be the first to comment!
                    </Text>
                  </View>
                }
              />

              {/* Comment Input */}
              <View style={[styles.inputContainer, { borderTopColor: theme.colors.border }]}>
                <Image
                  source={{
                    uri: currentUser?.profilePic || 'https://via.placeholder.com/32',
                  }}
                  style={styles.userAvatar}
                />
                <TextInput
                  style={[
                    styles.commentInput,
                    {
                      backgroundColor: theme.colors.surface,
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  placeholder="Add a comment..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={newComment}
                  onChangeText={setNewComment}
                  multiline
                  maxLength={500}
                  returnKeyType="default"
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    {
                      backgroundColor: newComment.trim() ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                  onPress={handleSubmitComment}
                  disabled={!newComment.trim() || isSubmitting}
                >
                  {isSubmitting ? (
                    <Ionicons name="hourglass-outline" size={20} color={theme.colors.textSecondary} />
                  ) : (
                    <Ionicons
                      name="send"
                      size={20}
                      color={newComment.trim() ? 'white' : theme.colors.textSecondary}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Custom Alert */}
      <CustomAlert
        visible={showCustomAlert}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={alertConfig.onConfirm || (() => {})}
        onClose={() => setShowCustomAlert(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  bottomSheet: {
    height: screenHeight * 0.75, // Increased height for better experience
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 15,
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  moreButton: {
    padding: 8,
    borderRadius: 20,
  },
  commentsList: {
    flex: 1,
  },
  commentsContent: {
    paddingVertical: 12,
  },
  commentItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  commentUsername: {
    fontSize: 15,
    fontWeight: '700',
    marginRight: 12,
    letterSpacing: 0.2,
  },
  commentTime: {
    fontSize: 12,
    opacity: 0.7,
  },
  commentText: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  emptyComments: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.7,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 44,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
});
