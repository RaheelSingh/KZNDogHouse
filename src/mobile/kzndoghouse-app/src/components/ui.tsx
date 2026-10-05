import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];



export function IconBtn({
  icon,
  onPress,
  color = '#fff',
  size = 26,
}: {
  icon: IconName;
  onPress: () => void;
  color?: string;
  size?: number;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Tag({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={[s.tag, { backgroundColor: bg }]}>
      <Text style={[s.tagText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function PillButton({
  label,
  onPress,
  loading,
  disabled,
  variant = 'gold',
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'gold' | 'outline' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const bg = variant === 'gold' ? colors.gold : 'transparent';
  const border = variant === 'gold' ? colors.gold : variant === 'danger' ? colors.dangerSoft : '#fff';
  const fg = variant === 'gold' ? colors.header : variant === 'danger' ? colors.dangerSoft : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[s.pill, { backgroundColor: bg, borderColor: border }, (disabled || loading) && { opacity: 0.6 }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.pillText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}



export function Backdrop({
  uri,
  letter,
  letterSize = 64,
}: {
  uri?: string | null;
  letter?: string;
  letterSize?: number;
}) {
  if (uri) {
    return <ImageBackground source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />;
  }
  return (
    <LinearGradient colors={[colors.raised, colors.surface]} style={StyleSheet.absoluteFill}>
      <Ionicons name="paw" size={220} color="rgba(255,255,255,0.05)" style={s.bgPaw} />
      {letter ? (
        <View style={[StyleSheet.absoluteFill, s.center]}>
          <Text style={[s.bgLetter, { fontSize: letterSize }]}>{letter}</Text>
        </View>
      ) : null}
    </LinearGradient>
  );
}



export function PageHeader({
  title,
  subtitle,
  onBack,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.pageHeader, { paddingTop: insets.top + 10 }]}>
      <StatusBar style="light" />
      <View style={s.topRow}>
        {onBack ? <IconBtn icon="arrow-back" onPress={onBack} /> : <View style={{ width: 26 }} />}
        <View style={s.rightRow}>{right}</View>
      </View>
      <Text style={s.pageTitle}>{title}</Text>
      {subtitle ? <Text style={s.pageSub}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}



export function HeroHeader({
  uri,
  letter,
  title,
  subtitle,
  onBack,
  right,
  children,
  height = 330,
}: {
  uri?: string | null;
  letter?: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  children?: ReactNode;
  height?: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ height, justifyContent: 'space-between' }}>
      <StatusBar style="light" />
      <Backdrop uri={uri} letter={letter} letterSize={120} />
      <LinearGradient
        colors={['rgba(18,36,28,0.75)', 'rgba(18,36,28,0.05)', 'rgba(18,36,28,0.97)']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[s.heroTop, { paddingTop: insets.top + 10 }]}>
        {onBack ? <IconBtn icon="arrow-back" onPress={onBack} /> : <View />}
        <View style={s.rightRow}>{right}</View>
      </View>
      <View style={s.heroBottom}>
        <Text style={s.heroTitle}>{title}</Text>
        {subtitle ? <Text style={s.heroSub}>{subtitle}</Text> : null}
        {children}
      </View>
    </View>
  );
}



export function UnderlineTabs<T extends string>({
  tabs,
  active,
  onChange,
  style,
}: {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.tabsWrap, style]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsRow}>
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <Pressable key={t.key} onPress={() => onChange(t.key)} style={[s.tab, on && s.tabOn]}>
              <Text style={[s.tabText, on && s.tabTextOn]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}



export function SectionTitle({
  title,
  action,
  onAction,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.sectionRow, style]}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} style={s.sectionAction}>
          <Text style={s.sectionActionText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}


export function ImageCard({
  uri,
  letter,
  eyebrow,
  title,
  meta,
  badge,
  actionLabel,
  onAction,
  onPress,
  style,
}: {
  uri?: string | null;
  letter?: string;
  eyebrow?: string;
  title: string;
  meta?: string;
  badge?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable onPress={onPress} style={[s.imageCard, style]}>
      <Backdrop uri={uri} letter={letter} />
      <LinearGradient
        colors={['rgba(18,36,28,0.6)', 'rgba(18,36,28,0)', 'rgba(18,36,28,0.95)']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.cardTop}>
        <Text style={s.cardEyebrow}>{eyebrow ?? ''}</Text>
        {actionLabel ? (
          <Pressable onPress={onAction ?? onPress} style={s.cardAction}>
            <Text style={s.cardActionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      <View>
        {badge ? <View style={{ marginBottom: 6 }}>{badge}</View> : null}
        <Text style={s.cardTitle} numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text style={s.cardMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}



export function ListRow({
  icon,
  uri,
  letter,
  title,
  subtitle,
  right,
  onPress,
  danger,
}: {
  icon?: IconName;
  uri?: string | null;
  letter?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  const tint = danger ? colors.dangerSoft : '#fff';
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={s.row}>
      <View style={s.thumb}>
        {uri ? (
          <ImageBackground source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : icon ? (
          <Ionicons name={icon} size={24} color={tint} />
        ) : (
          <Text style={s.thumbLetter}>{letter ?? '?'}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowTitle, { color: tint }]}>{title}</Text>
        {subtitle ? (
          <Text style={s.rowSub} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress ? <Ionicons name="chevron-forward" size={22} color={tint} /> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  tag: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },

  pill: {
    borderWidth: 2,
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontWeight: '800', fontSize: 15 },

  bgPaw: { position: 'absolute', right: -50, top: -20 },
  bgLetter: { color: 'rgba(255,255,255,0.9)', fontWeight: '800' },

  pageHeader: { backgroundColor: colors.page, paddingHorizontal: 20, paddingBottom: 4 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  pageTitle: { color: colors.fg, fontSize: 34, fontWeight: '800' },
  pageSub: { color: colors.fgMuted, fontSize: 14, marginTop: 4 },

  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  heroBottom: { paddingHorizontal: 20, paddingBottom: 18 },
  heroTitle: { color: '#fff', fontSize: 34, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 },

  tabsWrap: { marginTop: 18, borderBottomWidth: 1, borderBottomColor: colors.line },
  tabsRow: { gap: 26 },
  tab: { paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent', marginBottom: -1 },
  tabOn: { borderBottomColor: colors.gold },
  tabText: { color: colors.fgMuted, fontSize: 15, fontWeight: '600' },
  tabTextOn: { color: '#fff', fontWeight: '800' },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, marginBottom: 14 },
  sectionTitle: { color: '#fff', fontSize: 24, fontWeight: '800', flexShrink: 1 },
  sectionAction: { borderWidth: 2, borderColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 6 },
  sectionActionText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  imageCard: {
    height: 210,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    justifyContent: 'space-between',
    padding: 14,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardEyebrow: { color: '#fff', fontSize: 18, fontWeight: '800', flexShrink: 1 },
  cardAction: { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 8 },
  cardActionText: { color: colors.header, fontWeight: '800', fontSize: 13 },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  cardMeta: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 10,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbLetter: { color: '#fff', fontSize: 22, fontWeight: '800' },
  rowTitle: { fontSize: 17, fontWeight: '800' },
  rowSub: { color: colors.fgMuted, fontSize: 13, marginTop: 2 },
});