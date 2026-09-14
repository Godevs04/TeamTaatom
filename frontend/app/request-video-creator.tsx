import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import {
  getCreatorApplicationForm,
  getVideoCreatorStatus,
  requestVideoCreatorAccess,
  type ApplicationField,
  type CreatorApplicationPayload,
} from '../services/videoCreator';
import { createLogger } from '../utils/logger';

const logger = createLogger('RequestVideoCreator');

const EMPTY_FORM: CreatorApplicationPayload = {
  contentNiche: '',
  contentNicheOther: '',
  experienceLevel: '',
  sampleLinks: '',
  postingFrequency: '',
  audienceRegions: '',
  equipment: '',
  whyTaatom: '',
  guidelinesAccepted: false,
};

export default function RequestVideoCreatorScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [fields, setFields] = useState<ApplicationField[]>([]);
  const [form, setForm] = useState<CreatorApplicationPayload>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  const colors = useMemo(
    () => ({
      bg: isDark ? '#0B1220' : '#F4F7FB',
      card: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
      text: isDark ? '#FFFFFF' : '#0F172A',
      meta: isDark ? 'rgba(255,255,255,0.62)' : '#64748B',
      border: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)',
      accent: '#1C73B4',
      accentSoft: isDark ? 'rgba(28,115,180,0.22)' : 'rgba(28,115,180,0.10)',
      chipOn: isDark ? 'rgba(28,115,180,0.35)' : 'rgba(28,115,180,0.14)',
    }),
    [isDark]
  );

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        try {
          const [status, formFields] = await Promise.all([
            getVideoCreatorStatus(),
            getCreatorApplicationForm(),
          ]);
          if (!alive) return;
          setFields(formFields);
          if (status.status === 'approved') {
            setBlockedMessage('You are already an approved creator.');
          } else if (status.status === 'pending') {
            setBlockedMessage('Your creator request is already pending review.');
          } else if (status.status === 'rejected' && status.rejectionReason) {
            setBlockedMessage(null);
            Alert.alert(
              'Previous rejection',
              status.rejectionReason,
              [{ text: 'OK' }]
            );
          }
        } catch (e) {
          logger.error('Load application form failed', e);
          if (alive) Alert.alert('Error', 'Could not load the application form.');
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  const setField = useCallback(<K extends keyof CreatorApplicationPayload>(key: K, value: CreatorApplicationPayload[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const validateLocal = useCallback((): string | null => {
    if (!form.contentNiche) return 'Select a content niche';
    if (form.contentNiche === 'other' && !(form.contentNicheOther || '').trim()) {
      return 'Describe your niche';
    }
    if (!form.experienceLevel) return 'Select your experience level';
    if ((form.sampleLinks || '').trim().length < 8) return 'Add at least one sample link';
    if (!form.postingFrequency) return 'Select posting frequency';
    if ((form.audienceRegions || '').trim().length < 2) return 'Add regions or destinations';
    if ((form.whyTaatom || '').trim().length < 10) return 'Tell us why TAATOM (min 10 characters)';
    if (!form.guidelinesAccepted) return 'Accept the community guidelines to continue';
    return null;
  }, [form]);

  const onSubmit = useCallback(async () => {
    if (submitting || blockedMessage) return;
    const err = validateLocal();
    if (err) {
      Alert.alert('Almost there', err);
      return;
    }
    setSubmitting(true);
    try {
      await requestVideoCreatorAccess({
        ...form,
        contentNicheOther: form.contentNicheOther?.trim() || '',
        sampleLinks: form.sampleLinks.trim(),
        audienceRegions: form.audienceRegions.trim(),
        equipment: form.equipment?.trim() || '',
        whyTaatom: form.whyTaatom.trim(),
        guidelinesAccepted: true,
      });
      Alert.alert(
        'Submitted',
        'Your creator application is pending admin review. We will update your status when a decision is made.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not submit application';
      logger.error('Submit failed', e);
      Alert.alert('Submit failed', message);
    } finally {
      setSubmitting(false);
    }
  }, [form, submitting, blockedMessage, validateLocal, router]);

  const renderField = (field: ApplicationField) => {
    if (field.requiredWhen) {
      const current = form[field.requiredWhen.field as keyof CreatorApplicationPayload];
      if (current !== field.requiredWhen.equals) return null;
    }

    if (field.type === 'select' && field.options) {
      return (
        <View key={field.id} style={styles.fieldBlock}>
          <Text style={[styles.label, { color: colors.text }]}>
            {field.label}
            {field.required ? ' *' : ''}
          </Text>
          <View style={styles.chipWrap}>
            {field.options.map((opt) => {
              const selected = form[field.id as keyof CreatorApplicationPayload] === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setField(field.id as keyof CreatorApplicationPayload, opt.value as never)}
                  style={[
                    styles.chip,
                    {
                      borderColor: colors.border,
                      backgroundColor: selected ? colors.chipOn : colors.card,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: selected ? '700' : '500',
                      fontSize: 13,
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    if (field.type === 'checkbox') {
      return (
        <View
          key={field.id}
          style={[
            styles.checkRow,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>
              {field.label}
              {field.required ? ' *' : ''}
            </Text>
          </View>
          <Switch
            value={!!form.guidelinesAccepted}
            onValueChange={(v) => setField('guidelinesAccepted', v)}
            trackColor={{ false: colors.border, true: colors.accent }}
          />
        </View>
      );
    }

    const isArea = field.type === 'textarea';
    const value = String(form[field.id as keyof CreatorApplicationPayload] ?? '');
    return (
      <View key={field.id} style={styles.fieldBlock}>
        <Text style={[styles.label, { color: colors.text }]}>
          {field.label}
          {field.required ? ' *' : ''}
        </Text>
        {field.helper ? (
          <Text style={[styles.helper, { color: colors.meta }]}>{field.helper}</Text>
        ) : null}
        <TextInput
          value={value}
          onChangeText={(t) => setField(field.id as keyof CreatorApplicationPayload, t as never)}
          placeholder={field.helper || field.label}
          placeholderTextColor={colors.meta}
          multiline={isArea}
          maxLength={field.maxLength}
          style={[
            styles.input,
            isArea && styles.textarea,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ color: colors.meta, marginTop: 12 }}>Loading application…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Creator application</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={isDark ? ['#12324A', '#0B1220'] : ['#D7EBFA', '#F4F7FB']}
            style={[styles.hero, { borderColor: colors.border }]}
          >
            <Text style={[styles.heroEyebrow, { color: colors.accent }]}>VIDEOS</Text>
            <Text style={[styles.heroTitle, { color: colors.text }]}>
              Apply to upload long videos
            </Text>
            <Text style={[styles.heroBody, { color: colors.meta }]}>
              Answer a few questions so admins can review your fit for TAATOM Videos.
            </Text>
          </LinearGradient>

          {blockedMessage ? (
            <View style={[styles.blocked, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{blockedMessage}</Text>
            </View>
          ) : (
            <>
              {fields.map(renderField)}
              <TouchableOpacity
                onPress={onSubmit}
                disabled={submitting}
                style={{ opacity: submitting ? 0.55 : 1, marginTop: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Submit creator application"
              >
                <LinearGradient
                  colors={['#1C73B4', '#50C878']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submit}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color="#fff" />
                      <Text style={styles.submitText}>Submit for approval</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 40 },
  hero: { borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1 },
  heroEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  heroTitle: { marginTop: 8, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  heroBody: { marginTop: 8, fontSize: 13, lineHeight: 19 },
  fieldBlock: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  helper: { fontSize: 12, marginBottom: 8, lineHeight: 17 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textarea: { minHeight: 96, textAlignVertical: 'top' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  blocked: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  submit: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
