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
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import LoadingGlobe from '../LoadingGlobe';
import { useTheme } from '../../context/ThemeContext';

interface DetectPlaceModalProps {
  visible: boolean;
  onClose: () => void;
  mode: 'light' | 'dark' | 'auto';
  detectPlaceName: string;
  onChangeDetectPlaceName: (text: string) => void;
  isSearchingPlace: boolean;
  detectedPlace: any;
  onSearchPlace: () => void;
  onUsePlace: () => void;
}

export const DetectPlaceModal = ({
  visible,
  onClose,
  mode,
  detectPlaceName,
  onChangeDetectPlaceName,
  isSearchingPlace,
  detectedPlace,
  onSearchPlace,
  onUsePlace,
}: DetectPlaceModalProps) => {
  const { theme, isDark } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <View style={{
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.45)',
          maxHeight: Dimensions.get('window').height * 0.85,
          minHeight: 300,
          ...theme.shadows.large
        }}>
          <BlurView
            intensity={80}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDark ? 'rgba(10, 18, 32, 0.75)' : 'rgba(255, 255, 255, 0.65)' }]} />
          <LinearGradient
            colors={
              isDark
                ? ['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.02)']
                : ['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.1)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 0.4, y: 0.4 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <View style={{ flexShrink: 1, zIndex: 1 }}>
            {/* Fixed Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: theme.spacing.lg,
              paddingTop: theme.spacing.lg,
              marginBottom: theme.spacing.lg,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: theme.colors.primary + '15',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Ionicons name="location" size={20} color={theme.colors.primary} />
                </View>
                <Text style={{
                  fontSize: theme.typography.h3.fontSize,
                  fontWeight: '600',
                  color: theme.colors.text,
                }}>
                  Detect Place
                </Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Scrollable Content */}
            <ScrollView 
              style={{ 
                maxHeight: Dimensions.get('window').height * 0.7,
              }}
              contentContainerStyle={{ 
                paddingHorizontal: theme.spacing.lg,
                paddingBottom: theme.spacing.xl,
                flexGrow: 1,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              <View style={{ marginBottom: theme.spacing.md }}>
                <Text style={{
                  fontSize: theme.typography.body.fontSize,
                  fontWeight: '600',
                  color: theme.colors.text,
                  marginBottom: theme.spacing.sm,
                }}>
                  Enter Place Name
                </Text>
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  <TextInput
                    style={[
                      {
                        flex: 1,
                        backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                        borderRadius: theme.borderRadius.md,
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.md,
                        fontSize: theme.typography.body.fontSize,
                        color: theme.colors.text,
                        borderWidth: 1.5,
                        borderColor: theme.colors.border,
                      },
                      Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)
                    ]}
                    placeholder="e.g., Museum of Anthropology"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={detectPlaceName}
                    onChangeText={onChangeDetectPlaceName}
                    onSubmitEditing={() => {
                      Keyboard.dismiss();
                      onSearchPlace();
                    }}
                    returnKeyType="search"
                  />
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      onSearchPlace();
                    }}
                    disabled={isSearchingPlace || !detectPlaceName.trim()}
                    style={{
                      borderRadius: 9999,
                      shadowColor: '#14B8A6',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.25,
                      shadowRadius: 8,
                      elevation: 3,
                      overflow: 'hidden',
                      opacity: (isSearchingPlace || !detectPlaceName.trim()) ? 0.5 : 1,
                    }}
                  >
                    <LinearGradient
                      colors={['#38BDF8', '#14B8A6', '#34D399']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        paddingHorizontal: theme.spacing.lg,
                        paddingVertical: theme.spacing.md,
                        borderRadius: 9999,
                        justifyContent: 'center',
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
                      {isSearchingPlace ? (
                        <LoadingGlobe size="small" color="#FFFFFF" style={{ zIndex: 1 }} />
                      ) : (
                        <Ionicons name="search" size={20} color="#FFFFFF" style={{ zIndex: 1 }} />
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>

              {detectedPlace && (
                <View style={{
                  marginBottom: theme.spacing.lg,
                  padding: theme.spacing.md,
                  backgroundColor: theme.colors.secondary + '10',
                  borderRadius: theme.borderRadius.md,
                  borderWidth: 1,
                  borderColor: theme.colors.secondary + '30',
                }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: theme.spacing.sm,
                  }}>
                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.secondary} style={{ marginRight: theme.spacing.xs }} />
                    <Text style={{
                      fontSize: theme.typography.body.fontSize,
                      fontWeight: '600',
                      color: theme.colors.text,
                    }}>
                      Place Found!
                    </Text>
                  </View>
                  <View style={{ gap: theme.spacing.xs }}>
                    <Text style={{ fontSize: theme.typography.small.fontSize, color: theme.colors.text }}>
                      <Text style={{ fontWeight: '600' }}>Name:</Text> {detectedPlace.name}
                    </Text>
                    <Text style={{ fontSize: theme.typography.small.fontSize, color: theme.colors.text }}>
                      <Text style={{ fontWeight: '600' }}>Address:</Text> {detectedPlace.formattedAddress}
                    </Text>
                    {detectedPlace.city && (
                      <Text style={{ fontSize: theme.typography.small.fontSize, color: theme.colors.text }}>
                        <Text style={{ fontWeight: '600' }}>City:</Text> {detectedPlace.city}
                      </Text>
                    )}
                    {detectedPlace.stateProvince && (
                      <Text style={{ fontSize: theme.typography.small.fontSize, color: theme.colors.text }}>
                        <Text style={{ fontWeight: '600' }}>State/Province:</Text> {detectedPlace.stateProvince}
                      </Text>
                    )}
                    {detectedPlace.country && (
                      <Text style={{ fontSize: theme.typography.small.fontSize, color: theme.colors.text }}>
                        <Text style={{ fontWeight: '600' }}>Country:</Text> {detectedPlace.country} {detectedPlace.countryCode ? `(${detectedPlace.countryCode})` : ''}
                      </Text>
                    )}
                    {detectedPlace.continent && (
                      <Text style={{ fontSize: theme.typography.small.fontSize, color: theme.colors.text }}>
                        <Text style={{ fontWeight: '600' }}>Continent:</Text> {detectedPlace.continent}
                      </Text>
                    )}
                    <Text style={{ fontSize: theme.typography.small.fontSize, color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>
                      Coordinates: {detectedPlace.lat.toFixed(6)}, {detectedPlace.lng.toFixed(6)}
                    </Text>
                  </View>
                </View>
              )}

              {detectedPlace && (
                <TouchableOpacity
                  onPress={onUsePlace}
                  style={{
                    borderRadius: 9999,
                    shadowColor: '#14B8A6',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 4,
                    overflow: 'hidden',
                    marginTop: theme.spacing.sm,
                  }}
                >
                  <LinearGradient
                    colors={['#38BDF8', '#14B8A6', '#34D399']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      paddingVertical: theme.spacing.md,
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
                      fontSize: theme.typography.body.fontSize,
                      fontWeight: '700',
                      zIndex: 1,
                    }}>
                      Use This Place
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
