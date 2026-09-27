import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

const GREEN = '#16302a';

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
  const [showPicker, setShowPicker] = useState(false); // iOS only — Android uses the imperative API below

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
          onChange: handleTimePicked,
          onValueChange: handleTimePicked,
        } as any);
      };
      DateTimePickerAndroid.open({
        value: currentDate,
        mode: 'date',
        onChange: handleDatePicked,
        onValueChange: handleDatePicked,
        minimumDate,
      } as any);
    } else {
      setShowPicker(true);
    }
  };

  return (
    <View>
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
  label: { fontSize: 12, fontWeight: '600', color: GREEN, marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#d9e0d9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  valueText: { fontSize: 13, color: GREEN },
  placeholderText: { fontSize: 13, color: '#8a9a8f' },
  clearText: { fontSize: 11, color: '#b3261e', marginTop: 6 },
});