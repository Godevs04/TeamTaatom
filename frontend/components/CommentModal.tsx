import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { addComment } from '../services/posts';
import { getUserFromStorage } from '../services/auth';

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

  React.useEffect(() => {
    const loadUser = async () => {
      const user = await getUserFromStorage();
      setCurrentUser(user);
    };
    loadUser();
  }, []);

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !currentUser) return;

    setIsSubmitting(true);
    try {
      const response = await addComment(postId, newComment.trim());
      onCommentAdded(response.comment);
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
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
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <Text style={[styles.commentText, { color: theme.colors.text }]}>
          {item.text}
        </Text>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        >
          <View />
        </TouchableOpacity>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Bottom Sheet Container */}
          <TouchableOpacity 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.bottomSheet, { backgroundColor: theme.colors.background }]}>
            {/* Handle Bar */}
            <View style={styles.handleBar}>
              <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            </View>

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                Comments ({comments.length})
              </Text>
              <View style={styles.placeholder} />
            </View>

            {/* Comments List */}
            <FlatList
              data={comments}
              renderItem={renderComment}
              keyExtractor={(item) => item._id}
              style={styles.commentsList}
              contentContainerStyle={styles.commentsContent}
              showsVerticalScrollIndicator={false}
            />

            {/* Comment Input */}
            <View style={[styles.inputContainer, { borderTopColor: theme.colors.border }]}>
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
                <Ionicons
                  name="send"
                  size={20}
                  color={newComment.trim() ? 'white' : theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    </Modal>
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
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    height: screenHeight * 0.6, // Half screen height
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  placeholder: {
    width: 32,
  },
  commentsList: {
    flex: 1,
  },
  commentsContent: {
    paddingVertical: 8,
  },
  commentItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  commentTime: {
    fontSize: 12,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
