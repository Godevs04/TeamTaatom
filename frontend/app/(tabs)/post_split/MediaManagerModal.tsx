import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width: screenWidth } = Dimensions.get('window');

interface MediaManagerModalProps {
  visible: boolean;
  onClose: () => void;
  mode: 'light' | 'dark' | 'auto';
  theme: any;
  selectedImages: any[];
  onRemoveImage: (index: number) => void;
  onAppendMoreImages: () => void;
}

export const MediaManagerModal = ({
  visible,
  onClose,
  mode,
  theme,
  selectedImages,
  onRemoveImage,
  onAppendMoreImages,
}: MediaManagerModalProps) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={{
          height: '75%',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderWidth: 1,
          borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.45)',
          overflow: 'hidden',
          backgroundColor: mode === 'dark' ? 'rgba(10, 18, 32, 0.92)' : 'rgba(255, 255, 255, 0.85)',
          paddingBottom: Platform.OS === 'ios' ? 34 : 24,
        }}>
          <BlurView
            intensity={80}
            tint={mode === 'dark' ? 'dark' : 'light'}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={{ flex: 1, zIndex: 1 }}>
            {/* Modal Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}>
              <View>
                <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.text }}>Selected Photos</Text>
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>
                  {selectedImages.length} of 10 photos selected
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={28} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            <ScrollView 
              style={{ flex: 1 }} 
              contentContainerStyle={{ padding: 16 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {selectedImages.map((image, index) => (
                  <View 
                    key={image.uri || index} 
                    style={{ 
                      width: (screenWidth - 32 - 24) / 3, 
                      aspectRatio: 1, 
                      position: 'relative', 
                      borderRadius: 12, 
                      overflow: 'hidden',
                      backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0,0,0,0.05)',
                      borderWidth: 1,
                      borderColor: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    }}
                  >
                    <Image source={{ uri: image.uri }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                    <TouchableOpacity
                      onPress={() => onRemoveImage(index)}
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        backgroundColor: 'rgba(239, 68, 68, 0.9)',
                        borderRadius: 12,
                        width: 24,
                        height: 24,
                        justifyContent: 'center',
                        alignItems: 'center',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.25,
                        shadowRadius: 3.84,
                        elevation: 5,
                      }}
                    >
                      <Ionicons name="close" size={14} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Add More slot if less than 10 */}
                {selectedImages.length < 10 && (
                  <TouchableOpacity
                    onPress={onAppendMoreImages}
                    style={{
                      width: (screenWidth - 32 - 24) / 3,
                      aspectRatio: 1,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderStyle: 'dashed',
                      borderColor: '#0095F6',
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: mode === 'dark' ? 'rgba(0, 149, 246, 0.08)' : 'rgba(0, 149, 246, 0.04)',
                    }}
                  >
                    <Ionicons name="add" size={32} color="#0095F6" />
                    <Text style={{ fontSize: 10, color: '#0095F6', fontWeight: '600', marginTop: 4 }}>Add More</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>

            {/* Done Button */}
            <TouchableOpacity
              onPress={onClose}
              style={{
                marginHorizontal: 20,
                marginTop: 8,
                borderRadius: 9999,
                shadowColor: '#14B8A6',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 4,
                overflow: 'hidden',
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#38BDF8', '#14B8A6', '#34D399']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingVertical: 16,
                  borderRadius: 9999,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.35)',
                }}
              >
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.25)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 0.4 }}
                  style={StyleSheet.absoluteFillObject}
                  pointerEvents="none"
                />
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: 16,
                  fontWeight: '700',
                  zIndex: 1,
                }}>
                  Done
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
