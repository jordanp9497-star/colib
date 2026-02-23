import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export type SlotKey = "morning" | "afternoon" | "evening" | "day";

const SLOT_CONFIG: Record<SlotKey, { label: string; startHour: number; endHour: number }> = {
  morning: { label: "Matin (08h-12h)", startHour: 8, endHour: 12 },
  afternoon: { label: "Apres-midi (12h-17h)", startHour: 12, endHour: 17 },
  evening: { label: "Soiree (17h-21h)", startHour: 17, endHour: 21 },
  day: { label: "Journee (08h-21h)", startHour: 8, endHour: 21 },
};

export function buildWindowTimestamps(dateValue: string, slot: SlotKey) {
  const [dayStr, monthStr, yearStr] = dateValue.split("/");
  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = Number(yearStr);

  if (
    !Number.isFinite(day) ||
    !Number.isFinite(month) ||
    !Number.isFinite(year) ||
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12 ||
    year < 2024
  ) {
    return null;
  }

  const cfg = SLOT_CONFIG[slot];
  const start = new Date(year, month - 1, day, cfg.startHour, 0, 0, 0);
  const end = new Date(year, month - 1, day, cfg.endHour, 0, 0, 0);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return null;
  }

  return {
    windowStartTs: start.getTime(),
    windowEndTs: end.getTime(),
  };
}

export function buildDayWindowTimestamps(dateValue: string) {
  const [dayStr, monthStr, yearStr] = dateValue.split("/");
  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = Number(yearStr);

  if (
    !Number.isFinite(day) ||
    !Number.isFinite(month) ||
    !Number.isFinite(year) ||
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12 ||
    year < 2024
  ) {
    return null;
  }

  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day, 23, 59, 59, 999);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return null;
  }

  return {
    windowStartTs: start.getTime(),
    windowEndTs: end.getTime(),
  };
}

interface Props {
  title: string;
  subtitle: string;
  dateValue: string;
  onDateChange: (value: string) => void;
  slot: SlotKey;
  onSlotChange: (value: SlotKey) => void;
  slotOptions?: SlotKey[];
  showSlots?: boolean;
  slotMode?: "chips" | "dropdown";
}

export function TimeWindowInput({
  title,
  subtitle,
  dateValue,
  onDateChange,
  slot,
  onSlotChange,
  slotOptions = ["morning", "afternoon", "evening", "day"],
  showSlots = true,
  slotMode = "chips",
}: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <TextInput
        style={styles.input}
        value={dateValue}
        onChangeText={onDateChange}
        placeholder="JJ/MM/AAAA"
        placeholderTextColor="#94A3B8"
      />

      {showSlots && slotMode === "chips" ? (
        <View style={styles.slotRow}>
          {slotOptions.map((key) => (
            <Pressable
              key={key}
              style={[styles.slotChip, slot === key && styles.slotChipActive]}
              onPress={() => onSlotChange(key)}
            >
              <Text style={[styles.slotText, slot === key && styles.slotTextActive]}>
                {SLOT_CONFIG[key].label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {showSlots && slotMode === "dropdown" ? (
        <View style={styles.dropdownWrap}>
          <Pressable
            style={styles.dropdownTrigger}
            onPress={() => setDropdownOpen((prev) => !prev)}
          >
            <Text style={styles.dropdownTriggerText}>{SLOT_CONFIG[slot].label}</Text>
            <Text style={styles.dropdownTriggerIcon}>{dropdownOpen ? "-" : "+"}</Text>
          </Pressable>
          {dropdownOpen ? (
            <View style={styles.dropdownList}>
              {slotOptions.map((key) => (
                <Pressable
                  key={key}
                  style={[styles.dropdownItem, key === slot && styles.dropdownItemActive]}
                  onPress={() => {
                    onSlotChange(key);
                    setDropdownOpen(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, key === slot && styles.dropdownItemTextActive]}>
                    {SLOT_CONFIG[key].label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    marginBottom: 8,
  },
  input: {
    borderColor: "#CBD5E1",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  slotRow: {
    marginTop: 10,
    gap: 8,
  },
  slotChip: {
    borderColor: "#CBD5E1",
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#F8FAFC",
  },
  slotChipActive: {
    borderColor: "#4F46E5",
    backgroundColor: "#EEF2FF",
  },
  slotText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  slotTextActive: {
    color: "#3730A3",
  },
  dropdownWrap: {
    marginTop: 10,
  },
  dropdownTrigger: {
    borderColor: "#CBD5E1",
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownTriggerText: {
    color: "#0F172A",
    fontWeight: "600",
    fontSize: 13,
  },
  dropdownTriggerIcon: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 16,
  },
  dropdownList: {
    marginTop: 6,
    borderColor: "#CBD5E1",
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
  },
  dropdownItemActive: {
    backgroundColor: "#EEF2FF",
  },
  dropdownItemText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
  },
  dropdownItemTextActive: {
    color: "#3730A3",
  },
});
