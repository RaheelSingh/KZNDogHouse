import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { colors, radius } from '@/theme';

type DateTimeFieldProps = {
  label: string;
  value: string | null; // full ISO timestamp, or null
  onChange: (value: string | null) => void;
  placeholder?: string;
  minimumDate?: Date;
};

function formatDisplay(value: string): string {
  return new Date(value).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DateTimeField({ label, value, onChange, placeholder, minimumDate }: DateTimeFieldProps) {
  const [showPicker, setShowPicker] = useState(false); // iOS only, Android uses the imperative API below

  const currentDate = value ? new Date(value) : new Date();

  const openPicker = () => {
    if (Platform.OS === 'android') {
      const handleDatePicked = (_event: unknown, selectedDate?: Date) => {
        if (!selectedDate) return;
        const handleTimePicked = (_evt: unknown, selectedTime?: Date) => {
          if (!selectedTime) return;
          const combined = new Date(selectedDate);
          combined.setHours(selectedTime.getHours(), selectedTime.getMinutes());
          onChange(combined.toISOString());
        };
        DateTimePickerAndroid.open({
          value: selectedDate,
          mode: 'time',
          onValueChange: handleTimePicked,
        } as any);
      };
      DateTimePickerAndroid.open({
        value: currentDate,
        mode: 'date',
        onValueChange: handleDatePicked,
        minimumDate,
      } as any);
    } else {
      setShowPicker(true);
    }
  };

  return (
    <View style={{ marginTop: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.input} onPress={openPicker}>
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value ? formatDisplay(value) : (placeholder ?? 'Select date & time')}
        </Text>
      </Pressable>
      {value ? (
        <Pressable onPress={() => onChange(null)}>
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      ) : null}
      {Platform.OS === 'ios' && showPicker ? (
        <DateTimePicker
          value={currentDate}
          mode="datetime"
          display="spinner"
          themeVariant="dark"
          onValueChange={(_event, selectedDate) => {
            if (selectedDate) onChange(selectedDate.toISOString());
          }}
          minimumDate={minimumDate}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.fgMuted, fontSize: 12, fontWeight: '800', letterSpacing: 0.4, marginBottom: 8 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  valueText: { fontSize: 15, color: colors.fg },
  placeholderText: { fontSize: 15, color: colors.fgFaint },
  clearText: { fontSize: 12, color: colors.dangerSoft, marginTop: 8, fontWeight: '700' },
});