import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

type Mode = 'date' | 'datetime';

type Props = {
  label: string;
  value: Date | null;
  onChange: (next: Date | null) => void;
  mode?: Mode;
  optional?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
};

function formatDisplay(value: Date | null, mode: Mode): string {
  if (!value || Number.isNaN(value.getTime())) return '';
  if (mode === 'date') {
    return value.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  return value.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function DateTimeField({
  label,
  value,
  onChange,
  mode = 'datetime',
  optional = false,
  minimumDate,
  maximumDate,
  placeholder,
}: Props) {
  const { theme, isDark } = useTheme();
  const ink = theme.colors.text;
  const muted = theme.colors.textSecondary;
  const accent = theme.colors.primary;
  const hairline = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)';
  const surface = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)';

  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(value || new Date());

  const display = useMemo(() => formatDisplay(value, mode), [value, mode]);
  const emptyHint =
    placeholder ||
    (mode === 'date' ? 'Select date' : 'Select date & time') + (optional ? ' (optional)' : '');

  const openAndroid = () => {
    const base = value && !Number.isNaN(value.getTime()) ? value : new Date();
    DateTimePickerAndroid.open({
      value: base,
      mode: 'date',
      minimumDate,
      maximumDate,
      onChange: (event: DateTimePickerEvent, selected?: Date) => {
        if (event.type !== 'set' || !selected) return;
        if (mode === 'date') {
          const next = new Date(selected);
          next.setHours(0, 0, 0, 0);
          onChange(next);
          return;
        }
        DateTimePickerAndroid.open({
          value: selected,
          mode: 'time',
          is24Hour: false,
          onChange: (timeEvent: DateTimePickerEvent, timeSelected?: Date) => {
            if (timeEvent.type !== 'set' || !timeSelected) return;
            const merged = new Date(selected);
            merged.setHours(timeSelected.getHours(), timeSelected.getMinutes(), 0, 0);
            onChange(merged);
          },
        });
      },
    });
  };

  const openPicker = () => {
    if (Platform.OS === 'android') {
      openAndroid();
      return;
    }
    setIosDraft(value && !Number.isNaN(value.getTime()) ? value : new Date());
    setIosOpen(true);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: muted }]}>{label}</Text>
        {optional && value ? (
          <TouchableOpacity onPress={() => onChange(null)} hitSlop={8}>
            <Text style={{ color: accent, fontSize: 12, fontWeight: '700' }}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={openPicker}
        activeOpacity={0.85}
        style={[
          styles.field,
          {
            borderColor: hairline,
            backgroundColor: surface,
          },
        ]}
      >
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: isDark ? 'rgba(56,189,248,0.14)' : 'rgba(28,115,180,0.1)',
            },
          ]}
        >
          <Ionicons
            name={mode === 'date' ? 'calendar-outline' : 'calendar'}
            size={16}
            color={accent}
          />
        </View>
        <Text
          style={[styles.valueText, { color: display ? ink : muted }]}
          numberOfLines={1}
        >
          {display || emptyHint}
        </Text>
        <Ionicons name="chevron-down" size={16} color={muted} />
      </TouchableOpacity>

      {Platform.OS === 'ios' && iosOpen ? (
        <View
          style={[
            styles.iosInline,
            {
              borderColor: hairline,
              backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.95)',
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <TouchableOpacity
              onPress={() => {
                setIosOpen(false);
              }}
            >
              <Text style={{ color: muted, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.sheetTitle, { color: ink }]}>{label}</Text>
            <TouchableOpacity
              onPress={() => {
                onChange(iosDraft);
                setIosOpen(false);
              }}
            >
              <Text style={{ color: accent, fontWeight: '700' }}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={iosDraft}
            mode={mode === 'date' ? 'date' : 'datetime'}
            display="spinner"
            themeVariant={isDark ? 'dark' : 'light'}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(_: DateTimePickerEvent, selected?: Date) => {
              if (selected) setIosDraft(selected);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  iosInline: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 16,
    paddingTop: 10,
    paddingBottom: 4,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 2,
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
});
