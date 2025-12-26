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
  Platform,
  Dimensions,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { addComment } from '../../services/posts';
import { getUserFromStorage } from '../../services/auth';
import CustomAlert from '../CustomAlert';

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

interface PostCommentsProps {
  visible: boolean;
  postId: string;
  comments: Comment[];
  onClose: () => void;
  onCommentAdded: (newComment: Comment) => void;
  commentsDisabled?: boolean;
}

export default function PostComments({
  visible,
  postId,
  comments,
  onClose,
  onCommentAdded,
  commentsDisabled = false,
}: PostCommentsProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible) {
      translateY.setValue(screenHeight);
      opacity.setValue(0);
      scale.setValue(0.9);

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
  }, [visible, opacity, scale, translateY]);

  React.useEffect(() => {
    const loadUser = async () => {
      const user = await getUserFromStorage();
      setCurrentUser(user);
    };
    loadUser();
  }, []);

  // Handle keyboard show/hide for proper input visibility
  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }

    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        const height = e.endCoordinates.height;
        setKeyboardHeight(height);
        // Scroll to end when keyboard opens
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [visible]);

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

  const addCommentWithRetry = async (comment: string, retries = 3): Promise<any> => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await addComment(postId, comment);
        return response;
      } catch (error: any) {
        if (error?.response?.status === 429 && i < retries - 1) {
          const waitTime = Math.pow(2, i) * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        throw error;
      }
    }
  };

  const handleSubmitComment = async () => {
    if (commentsDisabled) {
      showCustomAlertMessage('Comments Disabled', 'Comments are disabled for this post.', 'warning');
      return;
    }

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
      const response = await addCommentWithRetry(newComment.trim());
      onCommentAdded(response.comment);
      setNewComment('');

      setTimeout(() => {
        setIsSubmitting(false);
      }, 100);
    } catch (error: any) {
      if (error?.response?.status === 429) {
        showCustomAlertMessage('Rate Limited', 'Too many requests. Please wait a moment before commenting again.', 'warning');
      } else {
        showCustomAlertMessage('Error', 'Failed to add comment. Please try again.', 'error');
      }
      setIsSubmitting(false);
    }
  };

  const renderComment = ({ item }: { item: Comment }) => {
    // Handle case where user might be undefined or missing profilePic
    const commentUser = item.user || { 
      _id: 'unknown', 
      fullName: 'Unknown User', 
      profilePic: null 
    };
    const profilePicUri = commentUser.profilePic || 'https://via.placeholder.com/32';
    
    return (
      <View style={styles.commentItem}>
        <Image
          source={{ uri: profilePicUri }}
          style={styles.commentAvatar}
          onError={() => {
            // Image failed to load - fallback handled by placeholder in uri
          }}
        />
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={[styles.commentUsername, { color: theme.colors.text }]}>
              {commentUser.fullName || 'Unknown User'}
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
  };

  const handleClose = () => {
    setNewComment('');
    setIsSubmitting(false);
    setShowCustomAlert(false);

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
      onClose();
    });
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="none"
        transparent
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
                // Force Bottom Sheet container to lift using animated marginBottom
                marginBottom: keyboardHeight,
              },
            ]}
          >
            <View style={styles.handleBar}>
              <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            </View>

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

            {/* Wrap only the Bottom Sheet CONTENT (not the sheet container) with KeyboardAvoidingView */}
            <KeyboardAvoidingView 
              behavior="padding" 
              style={styles.container}
              keyboardVerticalOffset={0}
            >
              <FlatList
                ref={flatListRef}
                data={comments}
                renderItem={renderComment}
                keyExtractor={(item) => item._id}
                style={styles.commentsList}
                contentContainerStyle={[
                  styles.commentsContent,
                  keyboardHeight > 0 && { paddingBottom: 20 }
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
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

              {commentsDisabled ? (
                <View style={[styles.inputContainer, styles.disabledInputContainer, { 
                  borderTopColor: theme.colors.border,
                  backgroundColor: theme.colors.surfaceSecondary 
                }]}>
                  <Ionicons name="lock-closed" size={20} color={theme.colors.textSecondary} />
                  <Text style={[styles.disabledText, { color: theme.colors.textSecondary }]}>
                    Comments are disabled for this post
                  </Text>
                </View>
              ) : (
                <View 
                  style={[
                    styles.inputContainer, 
                    { 
                      borderTopColor: theme.colors.border,
                      // Ensure input box is always above keyboard
                      paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 12) : 12,
                    }
                  ]}
                >
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
                    onFocus={() => {
                      // Scroll to end when input is focused
                      setTimeout(() => {
                        flatListRef.current?.scrollToEnd({ animated: true });
                      }, 300);
                    }}
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
              )}
            </KeyboardAvoidingView>
          </Animated.View>
        </Animated.View>
      </Modal>

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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    maxHeight: '90%',
    minHeight: 400,
  },
  container: {
    flex: 1,
    minHeight: 0,
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  moreButton: {
    padding: 4,
  },
  commentsList: {
    flex: 1,
  },
  commentsContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    flexGrow: 1,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentTime: {
    fontSize: 12,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyComments: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  disabledInputContainer: {
    justifyContent: 'center',
  },
  disabledText: {
    marginLeft: 12,
    fontSize: 14,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
});


