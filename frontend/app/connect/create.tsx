import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  Image,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { theme as themeConstants } from '../../constants/theme';
import { createConnectPage, fetchCurrencyConfig, getCurrencySymbol, CurrencyConfig } from '../../services/connect';
import logger from '../../utils/logger';

// Common countries for quick selection
const COUNTRY_LIST = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
  { code: 'SG', name: 'Singapore' },
  { code: 'AE', name: 'UAE' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'TH', name: 'Thailand' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
];

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';

const getFontFamily = (weight: '400' | '500' | '600' | '700' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

export default function CreateConnectPageScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [category, setCategory] = useState<'connect' | 'community'>('connect');
  const [type, setType] = useState<'public' | 'private'>('public');
  const [websiteEnabled, setWebsiteEnabled] = useState(true);
  const [groupChatEnabled, setGroupChatEnabled] = useState(true);
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);
  const [subscriptionPrice, setSubscriptionPrice] = useState('');
  const [creating, setCreating] = useState(false);
  const [profileImage, setProfileImage] = useState<{ uri: string; type?: string; name?: string } | null>(null);
  const [bannerImage, setBannerImage] = useState<{ uri: string; type?: string; name?: string } | null>(null);
  // Multi-currency
  const [selectedCountry, setSelectedCountry] = useState('IN');
  const [currency, setCurrency] = useState('INR');
  const [currencyConfig, setCurrencyConfig] = useState<Record<string, CurrencyConfig> | null>(null);
  const [countryToCurrency, setCountryToCurrency] = useState<Record<string, string>>({ IN: 'INR' });
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  // Bank / payout details
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [upiId, setUpiId] = useState('');
  const [wiseEmail, setWiseEmail] = useState('');

  const isDomestic = selectedCountry === 'IN';
  const isCommunity = category === 'community';
  const subLabel = isCommunity ? 'Buy' : 'Subscription';
  const subButtonText = isCommunity ? 'Buy' : 'Subscribe';

  useEffect(() => {
    fetchCurrencyConfig().then((config) => {
      setCurrencyConfig(config.currencies);
      setCountryToCurrency(config.countryToCurrency);
    }).catch(() => {});
  }, []);

  const handleCountryChange = useCallback((countryCode: string) => {
    setSelectedCountry(countryCode);
    const newCurrency = countryToCurrency[countryCode] || 'USD';
    setCurrency(newCurrency);
    setSubscriptionPrice(''); // reset price when currency changes
    setShowCountryPicker(false);
  }, [countryToCurrency]);

  const activeCurrencyConfig = currencyConfig?.[currency] || { symbol: getCurrencySymbol(currency), minPrice: 1, maxPrice: 10000, decimals: 2, code: currency, name: currency };

  const pickImage = async (type: 'profile' | 'banner') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need gallery access to pick an image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: type === 'profile' ? [1, 1] : [16, 9],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const imageData = {
          uri: asset.uri,
          type: asset.mimeType || 'image/jpeg',
          name: asset.fileName || `${type}_${Date.now()}.jpg`,
        };
        if (type === 'profile') setProfileImage(imageData);
        else setBannerImage(imageData);
      }
    } catch (error) {
      logger.error('Error picking image:', error);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a page name.');
      return;
    }
    if (name.trim().length < 3) {
      Alert.alert('Too Short', 'Page name must be at least 3 characters.');
      return;
    }
    if (subscriptionEnabled && subscriptionPrice) {
      const price = parseFloat(subscriptionPrice);
      if (isNaN(price) || price < activeCurrencyConfig.minPrice || price > activeCurrencyConfig.maxPrice) {
        Alert.alert('Invalid Price', `Price must be between ${activeCurrencyConfig.symbol}${activeCurrencyConfig.minPrice} and ${activeCurrencyConfig.symbol}${activeCurrencyConfig.maxPrice}.`);
        return;
      }
    }

    try {
      setCreating(true);
      const response = await createConnectPage({
        name: name.trim(),
        category,
        type,
        bio: bio.trim() || undefined,
        features: {
          website: websiteEnabled,
          groupChat: groupChatEnabled,
          subscription: subscriptionEnabled,
        },
        subscriptionPrice: subscriptionEnabled && subscriptionPrice ? parseFloat(subscriptionPrice) : undefined,
        subscriptionCurrency: currency,
        country: selectedCountry,
        payoutInfo: subscriptionEnabled ? {
          bankAccountName: isDomestic ? bankAccountName.trim() : undefined,
          bankAccountNumber: isDomestic ? bankAccountNumber.trim() : undefined,
          bankIfsc: isDomestic ? bankIfsc.trim() : undefined,
          upiId: isDomestic ? upiId.trim() : undefined,
          wiseEmail: !isDomestic ? wiseEmail.trim() : undefined,
        } : undefined,
        profileImage,
        bannerImage,
      } as any);
      router.replace(`/connect/page/${response.page._id}`);
    } catch (error: any) {
      logger.error('Error creating connect page:', error);
      Alert.alert('Error', error.message || 'Failed to create page.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={isTablet ? 28 : 24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Create {isCommunity ? 'Community' : 'Connect'} Page
        </Text>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: theme.colors.primary, opacity: creating || !name.trim() ? 0.5 : 1 }]}
          onPress={handleCreate}
          disabled={creating || !name.trim()}
          activeOpacity={0.7}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.createButtonText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={isIOS ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Banner Image */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Banner</Text>
            <TouchableOpacity
              style={[styles.bannerPicker, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={() => pickImage('banner')}
              activeOpacity={0.7}
            >
              {bannerImage ? (
                <Image source={{ uri: bannerImage.uri }} style={styles.bannerPreview} />
              ) : (
                <View style={styles.bannerPlaceholder}>
                  <Ionicons name="image-outline" size={isTablet ? 32 : 26} color={theme.colors.textSecondary} />
                  <Text style={[styles.imagePickerText, { color: theme.colors.textSecondary }]}>
                    Add Banner
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {bannerImage && (
              <TouchableOpacity onPress={() => setBannerImage(null)} activeOpacity={0.7} style={{ alignSelf: 'flex-end' }}>
                <Text style={[styles.removeImageText, { color: theme.colors.error }]}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Profile Image */}
          <View style={[styles.field, { alignItems: 'center' }]}>
            <TouchableOpacity
              style={[styles.imagePicker, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={() => pickImage('profile')}
              activeOpacity={0.7}
            >
              {profileImage ? (
                <Image source={{ uri: profileImage.uri }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera-outline" size={isTablet ? 36 : 30} color={theme.colors.textSecondary} />
                  <Text style={[styles.imagePickerText, { color: theme.colors.textSecondary }]}>
                    Add Photo
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {profileImage && (
              <TouchableOpacity onPress={() => setProfileImage(null)} activeOpacity={0.7}>
                <Text style={[styles.removeImageText, { color: theme.colors.error }]}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Page Name */}
          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Connect Page Name *</Text>
              <Text style={[styles.charCountInline, { color: theme.colors.textSecondary }]}>
                {name.length}/50
              </Text>
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Enter your page name"
              placeholderTextColor={theme.colors.textSecondary}
              value={name}
              onChangeText={setName}
              maxLength={50}
              autoFocus
            />
          </View>

          {/* Bio */}
          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Bio / Description</Text>
              <Text style={[styles.charCountInline, { color: theme.colors.textSecondary }]}>
                {bio.length}/300
              </Text>
            </View>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border },
              ]}
              placeholder="Tell others about your page..."
              placeholderTextColor={theme.colors.textSecondary}
              value={bio}
              onChangeText={setBio}
              maxLength={300}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Category */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Category</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  { borderColor: category === 'connect' ? theme.colors.primary : theme.colors.border },
                  category === 'connect' && { backgroundColor: theme.colors.primary + '15' },
                ]}
                onPress={() => setCategory('connect')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="link-outline"
                  size={20}
                  color={category === 'connect' ? theme.colors.primary : theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.typeLabel,
                    { color: category === 'connect' ? theme.colors.primary : theme.colors.textSecondary },
                  ]}
                >
                  Connect
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  { borderColor: category === 'community' ? theme.colors.primary : theme.colors.border },
                  category === 'community' && { backgroundColor: theme.colors.primary + '15' },
                ]}
                onPress={() => setCategory('community')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="people-outline"
                  size={20}
                  color={category === 'community' ? theme.colors.primary : theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.typeLabel,
                    { color: category === 'community' ? theme.colors.primary : theme.colors.textSecondary },
                  ]}
                >
                  Community
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Page Type */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Visibility</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  { borderColor: type === 'public' ? theme.colors.primary : theme.colors.border },
                  type === 'public' && { backgroundColor: theme.colors.primary + '15' },
                ]}
                onPress={() => setType('public')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="globe-outline"
                  size={20}
                  color={type === 'public' ? theme.colors.primary : theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.typeLabel,
                    { color: type === 'public' ? theme.colors.primary : theme.colors.textSecondary },
                  ]}
                >
                  Public
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  { borderColor: type === 'private' ? theme.colors.primary : theme.colors.border },
                  type === 'private' && { backgroundColor: theme.colors.primary + '15' },
                ]}
                onPress={() => setType('private')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={type === 'private' ? theme.colors.primary : theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.typeLabel,
                    { color: type === 'private' ? theme.colors.primary : theme.colors.textSecondary },
                  ]}
                >
                  Private
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Features */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Features</Text>
            <View style={[styles.featureCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.featureRow}>
                <View style={styles.featureInfo}>
                  <Ionicons name="globe-outline" size={20} color={theme.colors.primary} />
                  <View style={styles.featureText}>
                    <Text style={[styles.featureName, { color: theme.colors.text }]}>Website</Text>
                    <Text style={[styles.featureDesc, { color: theme.colors.textSecondary }]}>
                      Create a mini portfolio page
                    </Text>
                  </View>
                </View>
                <Switch
                  value={websiteEnabled}
                  onValueChange={setWebsiteEnabled}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
                  thumbColor={websiteEnabled ? theme.colors.primary : theme.colors.textSecondary}
                />
              </View>

              <View style={[styles.featureDivider, { borderBottomColor: theme.colors.border }]} />

              <View style={styles.featureRow}>
                <View style={styles.featureInfo}>
                  <Ionicons name="chatbubbles-outline" size={20} color={theme.colors.primary} />
                  <View style={styles.featureText}>
                    <Text style={[styles.featureName, { color: theme.colors.text }]}>Group Chat</Text>
                    <Text style={[styles.featureDesc, { color: theme.colors.textSecondary }]}>
                      Shared chat room for followers
                    </Text>
                  </View>
                </View>
                <Switch
                  value={groupChatEnabled}
                  onValueChange={setGroupChatEnabled}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
                  thumbColor={groupChatEnabled ? theme.colors.primary : theme.colors.textSecondary}
                />
              </View>

              <View style={[styles.featureDivider, { borderBottomColor: theme.colors.border }]} />

              <View style={styles.featureRow}>
                <View style={styles.featureInfo}>
                  <Ionicons name="star-outline" size={20} color={theme.colors.primary} />
                  <View style={styles.featureText}>
                    <Text style={[styles.featureName, { color: theme.colors.text }]}>{subLabel}</Text>
                    <Text style={[styles.featureDesc, { color: theme.colors.textSecondary }]}>
                      {isCommunity ? 'Let members buy access to your page' : 'List services you offer'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={subscriptionEnabled}
                  onValueChange={(val) => {
                    setSubscriptionEnabled(val);
                    if (!val) setSubscriptionPrice('');
                  }}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
                  thumbColor={subscriptionEnabled ? theme.colors.primary : theme.colors.textSecondary}
                />
              </View>
              {subscriptionEnabled && (
                <View style={[styles.priceInputRow, { borderTopColor: theme.colors.border }]}>
                  {/* Country / Currency selector */}
                  <TouchableOpacity
                    style={[styles.countrySelector, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                    onPress={() => setShowCountryPicker(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="globe-outline" size={18} color={theme.colors.primary} />
                    <Text style={[styles.countrySelectorText, { color: theme.colors.text }]}>
                      {COUNTRY_LIST.find(c => c.code === selectedCountry)?.name || selectedCountry} · {currency}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={theme.colors.textSecondary} />
                  </TouchableOpacity>

                  <Text style={[styles.priceLabel, { color: theme.colors.textSecondary }]}>
                    Monthly Price ({activeCurrencyConfig.symbol})
                  </Text>
                  <View style={[styles.priceInputWrapper, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                    <Text style={[styles.currencySymbol, { color: theme.colors.textSecondary }]}>{activeCurrencyConfig.symbol}</Text>
                    <TextInput
                      style={[styles.priceInput, { color: theme.colors.text }]}
                      value={subscriptionPrice}
                      onChangeText={(text) => setSubscriptionPrice(text.replace(/[^0-9.]/g, ''))}
                      placeholder={`e.g. ${activeCurrencyConfig.minPrice * 3}`}
                      placeholderTextColor={theme.colors.textSecondary + '80'}
                      keyboardType="decimal-pad"
                      maxLength={8}
                    />
                  </View>
                  <Text style={[styles.priceHint, { color: theme.colors.textSecondary }]}>
                    Min {activeCurrencyConfig.symbol}{activeCurrencyConfig.minPrice} · Max {activeCurrencyConfig.symbol}{activeCurrencyConfig.maxPrice.toLocaleString()}
                  </Text>

                  {/* Subscription Button Preview */}
                  {subscriptionPrice && parseFloat(subscriptionPrice) > 0 && (
                    <View style={styles.buttonPreviewContainer}>
                      <Text style={[styles.buttonPreviewLabel, { color: theme.colors.textSecondary }]}>
                        Button preview — how users will see it
                      </Text>
                      <View style={[styles.buttonPreview, { backgroundColor: theme.colors.primary }]}>
                        <Ionicons name={isCommunity ? 'cart-outline' : 'star'} size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.buttonPreviewText}>
                          {subButtonText} · {activeCurrencyConfig.symbol}{subscriptionPrice}/month
                        </Text>
                      </View>
                      <Text style={[styles.buttonPreviewNote, { color: theme.colors.textSecondary }]}>
                        Price requires admin approval before going live
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Payout Details Section */}
              {subscriptionEnabled && (
                <View style={[styles.payoutSection, { borderTopColor: theme.colors.border }]}>
                  <View style={styles.payoutSectionHeader}>
                    <Ionicons name="wallet-outline" size={18} color={theme.colors.primary} />
                    <Text style={[styles.payoutSectionTitle, { color: theme.colors.text }]}>
                      Payout Details
                    </Text>
                  </View>
                  <Text style={[styles.payoutSectionDesc, { color: theme.colors.textSecondary }]}>
                    {isDomestic
                      ? `Enter your bank account or UPI to receive ${isCommunity ? '' : 'subscription '}payouts`
                      : 'Enter your Wise email to receive international payouts'}
                  </Text>

                  {isDomestic ? (
                    <>
                      <Text style={[styles.payoutFieldLabel, { color: theme.colors.textSecondary }]}>
                        Account Holder Name
                      </Text>
                      <TextInput
                        style={[styles.payoutInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                        value={bankAccountName}
                        onChangeText={setBankAccountName}
                        placeholder="Full name as on bank account"
                        placeholderTextColor={theme.colors.textSecondary + '80'}
                        autoCapitalize="words"
                      />

                      <Text style={[styles.payoutFieldLabel, { color: theme.colors.textSecondary }]}>
                        Bank Account Number
                      </Text>
                      <TextInput
                        style={[styles.payoutInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                        value={bankAccountNumber}
                        onChangeText={(text) => setBankAccountNumber(text.replace(/[^0-9]/g, ''))}
                        placeholder="e.g. 1234567890123"
                        placeholderTextColor={theme.colors.textSecondary + '80'}
                        keyboardType="number-pad"
                        maxLength={18}
                      />

                      <Text style={[styles.payoutFieldLabel, { color: theme.colors.textSecondary }]}>
                        IFSC Code
                      </Text>
                      <TextInput
                        style={[styles.payoutInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                        value={bankIfsc}
                        onChangeText={(text) => setBankIfsc(text.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                        placeholder="e.g. SBIN0001234"
                        placeholderTextColor={theme.colors.textSecondary + '80'}
                        autoCapitalize="characters"
                        maxLength={11}
                      />

                      <View style={styles.payoutDividerRow}>
                        <View style={[styles.payoutDividerLine, { backgroundColor: theme.colors.border }]} />
                        <Text style={[styles.payoutDividerText, { color: theme.colors.textSecondary }]}>or</Text>
                        <View style={[styles.payoutDividerLine, { backgroundColor: theme.colors.border }]} />
                      </View>

                      <Text style={[styles.payoutFieldLabel, { color: theme.colors.textSecondary }]}>
                        UPI ID
                      </Text>
                      <TextInput
                        style={[styles.payoutInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                        value={upiId}
                        onChangeText={setUpiId}
                        placeholder="e.g. name@upi"
                        placeholderTextColor={theme.colors.textSecondary + '80'}
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                    </>
                  ) : (
                    <>
                      <Text style={[styles.payoutFieldLabel, { color: theme.colors.textSecondary }]}>
                        Wise Email
                      </Text>
                      <TextInput
                        style={[styles.payoutInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                        value={wiseEmail}
                        onChangeText={setWiseEmail}
                        placeholder="your@email.com"
                        placeholderTextColor={theme.colors.textSecondary + '80'}
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                      <Text style={[styles.payoutFieldHint, { color: theme.colors.textSecondary }]}>
                        Payouts are sent monthly via Wise in {currency}
                      </Text>
                    </>
                  )}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.countryModalOverlay}>
          <View style={[styles.countryModalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.countryModalHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.countryModalTitle, { color: theme.colors.text }]}>Select Your Country</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRY_LIST}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => {
                const itemCurrency = countryToCurrency[item.code] || 'USD';
                const isSelected = selectedCountry === item.code;
                return (
                  <TouchableOpacity
                    style={[styles.countryItem, isSelected && { backgroundColor: theme.colors.primary + '10' }]}
                    onPress={() => handleCountryChange(item.code)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.countryItemName, { color: theme.colors.text }]}>{item.name}</Text>
                      <Text style={[styles.countryItemCurrency, { color: theme.colors.textSecondary }]}>
                        {getCurrencySymbol(itemCurrency)} {itemCurrency}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />}
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(isWeb && {
      maxWidth: isTablet ? 1000 : 800,
      alignSelf: 'center',
      width: '100%',
    } as any),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
    paddingVertical: isTablet ? themeConstants.spacing.md : 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: isTablet ? themeConstants.spacing.sm : 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: isTablet ? 22 : 18,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: isIOS ? 0.3 : 0.2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  createButton: {
    paddingHorizontal: isTablet ? 20 : 16,
    paddingVertical: isTablet ? 10 : 8,
    borderRadius: themeConstants.borderRadius.sm,
    minWidth: 70,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: isTablet ? 16 : 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
    paddingBottom: 40,
  },
  field: {
    marginBottom: isTablet ? 20 : 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: isTablet ? 16 : 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 6,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  charCountInline: {
    fontSize: 12,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  input: {
    borderWidth: 1,
    borderRadius: themeConstants.borderRadius.sm,
    paddingHorizontal: 14,
    paddingVertical: isIOS ? 14 : 10,
    fontSize: isTablet ? 16 : 15,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      outlineStyle: 'none',
    } as any),
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: themeConstants.borderRadius.sm,
    borderWidth: 1.5,
  },
  typeLabel: {
    fontSize: isTablet ? 16 : 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  featureCard: {
    borderWidth: 1,
    borderRadius: themeConstants.borderRadius.md,
    overflow: 'hidden',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isTablet ? 20 : 16,
    paddingVertical: isTablet ? 16 : 14,
  },
  featureInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  featureText: {
    flex: 1,
  },
  featureName: {
    fontSize: isTablet ? 16 : 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  featureDesc: {
    fontSize: isTablet ? 13 : 12,
    fontFamily: getFontFamily('400'),
    marginTop: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  featureDivider: {
    borderBottomWidth: 1,
    marginHorizontal: 16,
  },
  priceInputRow: {
    borderTopWidth: 1,
    paddingHorizontal: isTablet ? 20 : 16,
    paddingVertical: isTablet ? 14 : 12,
  },
  priceLabel: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    marginBottom: 8,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  priceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: themeConstants.borderRadius.sm,
    paddingHorizontal: 12,
    height: isTablet ? 48 : 44,
  },
  currencySymbol: {
    fontSize: isTablet ? 18 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginRight: 6,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  priceInput: {
    flex: 1,
    fontSize: isTablet ? 18 : 16,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    paddingVertical: 0,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      outlineStyle: 'none',
    } as any),
  },
  priceHint: {
    fontSize: 11,
    fontFamily: getFontFamily('400'),
    marginTop: 6,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  buttonPreviewContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  buttonPreviewLabel: {
    fontSize: 11,
    fontFamily: getFontFamily('400'),
    marginBottom: 10,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  buttonPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: themeConstants.borderRadius.sm,
    width: '100%',
  },
  buttonPreviewText: {
    color: '#FFFFFF',
    fontSize: isTablet ? 16 : 15,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  buttonPreviewNote: {
    fontSize: 11,
    fontFamily: getFontFamily('400'),
    marginTop: 8,
    fontStyle: 'italic',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  // Payout details section
  payoutSection: {
    borderTopWidth: 1,
    paddingHorizontal: isTablet ? 20 : 16,
    paddingVertical: isTablet ? 16 : 14,
  },
  payoutSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  payoutSectionTitle: {
    fontSize: isTablet ? 16 : 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  payoutSectionDesc: {
    fontSize: isTablet ? 13 : 12,
    fontFamily: getFontFamily('400'),
    marginBottom: 14,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  payoutFieldLabel: {
    fontSize: isTablet ? 13 : 12,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    marginBottom: 6,
    marginTop: 10,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  payoutInput: {
    borderWidth: 1,
    borderRadius: themeConstants.borderRadius.sm,
    paddingHorizontal: 14,
    paddingVertical: isIOS ? 12 : 10,
    fontSize: isTablet ? 15 : 14,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      outlineStyle: 'none',
    } as any),
  },
  payoutFieldHint: {
    fontSize: 11,
    fontFamily: getFontFamily('400'),
    marginTop: 6,
    fontStyle: 'italic',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  payoutDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 10,
  },
  payoutDividerLine: {
    flex: 1,
    height: 1,
  },
  payoutDividerText: {
    fontSize: 12,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  // Country selector
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: themeConstants.borderRadius.sm,
    marginBottom: 12,
  },
  countrySelectorText: {
    flex: 1,
    fontSize: isTablet ? 15 : 14,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  // Country picker modal
  countryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  countryModalContent: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  countryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  countryModalTitle: {
    fontSize: 18,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  countryItemName: {
    fontSize: 15,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  countryItemCurrency: {
    fontSize: 13,
    fontFamily: getFontFamily('400'),
    marginTop: 2,
  },
  bannerPicker: {
    width: '100%',
    height: isTablet ? 180 : 140,
    borderRadius: themeConstants.borderRadius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bannerPreview: {
    width: '100%',
    height: '100%',
    borderRadius: themeConstants.borderRadius.md,
  },
  bannerPlaceholder: {
    alignItems: 'center',
    gap: 6,
  },
  imagePicker: {
    width: isTablet ? 120 : 100,
    height: isTablet ? 120 : 100,
    borderRadius: isTablet ? 60 : 50,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: isTablet ? 60 : 50,
  },
  imagePlaceholder: {
    alignItems: 'center',
    gap: 4,
  },
  imagePickerText: {
    fontSize: isTablet ? 13 : 12,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  removeImageText: {
    fontSize: 13,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    marginTop: 8,
  },
});
