import { useTheme } from '@/lib/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Max height as a fraction of the screen */
  maxHeight?: `${number}%`;
}

/** Bottom sheet with a drag handle, dimmed backdrop (tap to close) and safe-area padding. */
export function Sheet({ visible, onClose, title, subtitle, children, maxHeight = '90%' }: SheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable
          style={{ flex: 1, backgroundColor: colors.overlay }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderTopWidth: 1,
            borderColor: colors.cardBorder,
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            maxHeight,
          }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.borderSecondary, marginBottom: 14 }} />
          {(title || subtitle) && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                {title && <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{title}</Text>}
                {subtitle && <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>{subtitle}</Text>}
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backgroundSecondary }}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          )}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export interface SheetAction {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions: SheetAction[];
}

/** Replacement for Alert-based menus: a list of big, tappable actions. */
export function ActionSheet({ visible, onClose, title, subtitle, actions }: ActionSheetProps) {
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={subtitle}>
      {actions.map((a) => {
        const tint = a.destructive ? colors.error : colors.text;
        return (
          <Pressable
            key={a.label}
            onPress={() => {
              onClose();
              // Let the sheet close before the next modal opens
              setTimeout(a.onPress, 250);
            }}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 14,
              paddingHorizontal: 14,
              borderRadius: 16,
              marginBottom: 8,
              backgroundColor: pressed ? colors.backgroundTertiary : colors.backgroundSecondary,
            })}
          >
            {a.icon && (
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: a.destructive ? 'rgba(239,68,68,0.12)' : colors.primarySoft,
                  marginRight: 12,
                }}
              >
                <Ionicons name={a.icon} size={18} color={a.destructive ? colors.error : colors.primary} />
              </View>
            )}
            <Text style={{ color: tint, fontSize: 16, fontWeight: '600' }}>{a.label}</Text>
          </Pressable>
        );
      })}
    </Sheet>
  );
}

interface ConfirmSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}

/** Two-button confirmation, used instead of Alert.alert for archive/delete. */
export function ConfirmSheet({ visible, onClose, title, message, confirmLabel, destructive, onConfirm }: ConfirmSheetProps) {
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={message}>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          style={{ flex: 1, height: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backgroundSecondary }}
        >
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            onClose();
            onConfirm();
          }}
          accessibilityRole="button"
          style={{
            flex: 1,
            height: 50,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: destructive ? colors.error : colors.primary,
          }}
        >
          <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}
