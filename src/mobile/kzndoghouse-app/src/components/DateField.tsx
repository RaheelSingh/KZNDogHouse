import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

const GREEN = '#16302a';

type DateFieldProps = {
  label: string;
  value: string | null; // stored as 'YYYY-MM-DD', or null if not set
  onChange: (value: string | null) => void;
  placeholder?: string;
  minimumDate?: Date;
};

function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateOnlyString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDisplay(value: string): string {
  return parseDateOnlyString(value).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function DateField({ label, value, onChange, placeholder, minimumDate }: DateFieldProps) {
  const [showPicker, setShowPicker] = useState(false); // iOS only — Android uses the imperative API below

  const currentDate = value ? parseDateOnlyString(value) : new Date();

  const openPicker = () => {
    if (Platform.OS === 'android') {
      // Android's picker is a native dialog. Mounting/unmounting <DateTimePicker>
      // declaratively can crash on some devices, so Android always uses this
      // imperative call instead — there's no component to unmount.
      DateTimePickerAndroid.open({
        value: currentDate,
        mode: 'date',
        onValueChange: (_event, selectedDate) => {
          if (selectedDate) onChange(toDateOnlyString(selectedDate));
        },
        minimumDate,
      });
    } else {
      setShowPicker(true);
    }
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.input} onPress={openPicker}>
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value ? formatDisplay(value) : (placeholder ?? 'Select a date')}
        </Text>
      </Pressable>
      {value ? (
        <Pressable onPress={() => onChange(null)}>
          <Text style={styles.clearText}>Clear date</Text>
        </Pressable>
      ) : null}
      {Platform.OS === 'ios' && showPicker ? (
        <DateTimePicker
          value={currentDate}
          mode="date"
          display="spinner"
          onValueChange={(_event, selectedDate) => {
            if (selectedDate) onChange(toDateOnlyString(selectedDate));
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