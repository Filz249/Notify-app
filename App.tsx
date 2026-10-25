import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Linking, Modal, PanResponder, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path } from 'react-native-svg';
import {
  AlarmClock, ArrowLeft, Check, Circle, FileText, Lightbulb, ListChecks,
  Music, Pencil, Plus, Search, ShoppingBag, Star, Trash2, X,
  Settings, Palette, Download, ExternalLink, CheckCircle2,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteNote, getSetting, loadNotes, saveNote, setSetting } from './src/storage';
import { prepareNotifications, syncReminder } from './src/notifications';
import type { ListItem, Note, NoteType, SketchStroke } from './src/types';

const C = {
  bg: '#20130D', panel: '#2B1B12', panel2: '#352319', line: '#4B3425',
  cream: '#F5EBDD', muted: '#BBA995', amber: '#F2B23D', orange: '#F08A3E',
  green: '#A8C66C', teal: '#63BBB8', pink: '#D98EB5', violet: '#B49ADF',
  red: '#E77C70', white: '#FFFFFF',
};
const TYPES: { id: NoteType; label: string; color: string; glyph: string }[] = [
  { id: 'note', label: 'Note', color: C.amber, glyph: '✎' },
  { id: 'todo', label: 'Tasks', color: C.green, glyph: '☑' },
  { id: 'shopping', label: 'Shopping', color: C.orange, glyph: '▧' },
  { id: 'lyrics', label: 'Lyrics', color: C.pink, glyph: '♫' },
  { id: 'poem', label: 'Poem', color: C.violet, glyph: '❝' },
  { id: 'sketch', label: 'Sketch', color: C.teal, glyph: '⌁' },
  { id: 'brainstorm', label: 'Ideas', color: C.violet, glyph: '✳' },
];
type ThemeName = 'espresso' | 'midnight' | 'forest';
const PALETTES: Record<ThemeName, { name: string; bg: string; panel: string; panel2: string; line: string; cream: string; muted: string; accent: string }> = {
  espresso: { name: 'Espresso', bg: '#20130D', panel: '#2B1B12', panel2: '#352319', line: '#4B3425', cream: '#F5EBDD', muted: '#BBA995', accent: '#F2B23D' },
  midnight: { name: 'Midnight', bg: '#11151D', panel: '#1B222E', panel2: '#242D3B', line: '#394658', cream: '#F3F4F6', muted: '#A5B1C3', accent: '#83B8FF' },
  forest: { name: 'Forest', bg: '#101A15', panel: '#1B2A20', panel2: '#24372B', line: '#375040', cream: '#F1F6E9', muted: '#ACBEA9', accent: '#B7D96C' },
};
const SKETCH_COLORS = ['#F2B23D', '#F5EBDD', '#E77C70', '#63BBB8', '#A8C66C', '#B49ADF', '#69AEEB', '#24201D'];
const SKETCH_BACKGROUNDS = [{label:'Espresso',color:'#2B1B12'}, {label:'Paper',color:'#F5EBDD'}, {label:'White',color:'#FFFFFF'}, {label:'Sage',color:'#E7EBDD'}];
const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const emptyNote = (type: NoteType = 'note'): Note => ({
  id: makeId(), title: '', body: '', type, important: false,
  color: TYPES.find((t) => t.id === type)?.color || C.amber,
  createdAt: Date.now(), updatedAt: Date.now(), items: [], sketchPaths: [],
  sketchColor: C.amber, sketchBackground: C.panel, sketchWidth: 3, sketchStyle: 'solid',
});
const typeInfo = (type: NoteType) => {
  if (type === 'checklist' || type === 'todo') return TYPES.find((t) => t.id === 'todo')!;
  return TYPES.find((t) => t.id === type) || TYPES[0];
};
const aisleFor = (name: string) => {
  const s = name.toLowerCase();
  if (/apple|banana|tomato|lettuce|potato|onion|fruit|vegetable|salad|carrot|pepper/.test(s)) return 'Produce';
  if (/milk|cheese|yogurt|yoghurt|butter|cream|egg/.test(s)) return 'Dairy & eggs';
  if (/bread|bun|bagel|croissant|bakery/.test(s)) return 'Bakery';
  if (/chicken|beef|fish|pork|meat|salmon|shrimp/.test(s)) return 'Meat & seafood';
  if (/ice cream|frozen|pizza/.test(s)) return 'Frozen';
  if (/soap|detergent|tissue|toilet paper|cleaner|sponge|shampoo/.test(s)) return 'Household';
  if (/rice|pasta|flour|sugar|oil|beans|cereal|coffee|tea|sauce|canned/.test(s)) return 'Pantry';
  return 'Other';
};
const money = (n: number) => '€' + n.toFixed(2);

function Glyph({ type, size = 22, color }: { type: NoteType; size?: number; color?: string }) {
  const meta = typeInfo(type);
  return <Text style={{ fontSize: size, color: color || meta.color, fontWeight: '600', lineHeight: size + 5 }}>{meta.glyph}</Text>;
}
function Button({ title, onPress, icon, subtle = false, danger = false }: {
  title: string; onPress: () => void; icon?: React.ReactNode; subtle?: boolean; danger?: boolean;
}) {
  return <Pressable onPress={onPress} style={({ pressed }) => [s.button, subtle && s.buttonSubtle, danger && s.buttonDanger, pressed && s.pressed]}>
    {icon}{<Text style={[s.buttonText, subtle && { color: C.cream }, danger && { color: C.red }]}>{title}</Text>}
  </Pressable>;
}
function SketchPad({
  paths, onChange, color, width, style, backgroundColor,
}: {
  paths: Array<string | SketchStroke>;
  onChange: (paths: Array<string | SketchStroke>) => void;
  color: string;
  width: number;
  style: 'solid' | 'dashed' | 'dotted';
  backgroundColor: string;
}) {
  const [current, setCurrent] = useState('');
  const pathRef = useRef('');
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      pathRef.current = 'M ' + e.nativeEvent.locationX + ' ' + e.nativeEvent.locationY;
      setCurrent(pathRef.current);
    },
    onPanResponderMove: (e) => {
      pathRef.current += ' L ' + e.nativeEvent.locationX + ' ' + e.nativeEvent.locationY;
      setCurrent(pathRef.current);
    },
    onPanResponderRelease: () => {
      if (pathRef.current) onChange([...paths, { path: pathRef.current, color, width, style }]);
      pathRef.current = '';
      setCurrent('');
    },
  }), [onChange, paths, color, width, style]);
  const renderStroke = (stroke: string | SketchStroke, i: number) => {
    const legacy = typeof stroke === 'string';
    const d = legacy ? stroke : stroke.path;
    const strokeColor = legacy ? C.amber : stroke.color;
    const strokeWidth = legacy ? 3 : stroke.width;
    const strokeStyle = legacy ? 'solid' : (stroke.style || 'solid');
    return <Path key={String(i)} d={d} stroke={strokeColor} strokeWidth={strokeWidth} fill="none"
      strokeLinecap="round" strokeLinejoin="round"
      strokeDasharray={strokeStyle === 'dashed' ? '8 6' : strokeStyle === 'dotted' ? '1 6' : undefined} />;
  };
  const hintColor = backgroundColor === '#F5EBDD' || backgroundColor === '#FFFFFF' || backgroundColor === '#E7EBDD' ? '#6F6254' : C.muted;
  return <View style={[s.sketch, { backgroundColor }]} {...responder.panHandlers}>
    <Svg style={StyleSheet.absoluteFill}>
      {paths.map(renderStroke)}
      {current ? <Path d={current} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={style === 'dashed' ? '8 6' : style === 'dotted' ? '1 6' : undefined} /> : null}
    </Svg>
    {paths.length === 0 && !current ? <Text pointerEvents="none" style={[s.sketchHint, { color: hintColor }]}>Draw with your finger</Text> : null}
  </View>;
}

export default function App() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const compactLayout = screenHeight < 790 || screenWidth < 360;
  const sidePad = Math.max(13, Math.min(21, screenWidth * 0.05));
  const cardWidth = Math.max(58, Math.min(72, (screenWidth - sidePad * 2 - 6 * 7) / 7));
  const [themeName, setThemeName] = useState<ThemeName>('espresso');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const palette = PALETTES[themeName];
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'important' | 'tasks' | 'creative'>('all');
  const [editor, setEditor] = useState(false);
  const [draft, setDraft] = useState<Note>(emptyNote());
  const [newItem, setNewItem] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [typePicker, setTypePicker] = useState(false);

  useEffect(() => {
    loadNotes().then(setNotes).catch((err) => console.warn('Could not load local notes', err)).finally(() => setLoaded(true));
    getSetting('theme', 'espresso').then((value) => {
      if (value === 'espresso' || value === 'midnight' || value === 'forest') setThemeName(value);
    }).catch((err) => console.warn('Could not load preferences', err));
    prepareNotifications().catch((err) => console.warn('Notifications could not be prepared', err));
  }, []);

  const chooseTheme = (next: ThemeName) => {
    setThemeName(next);
    setSetting('theme', next).catch((err) => console.warn('Could not save theme preference', err));
  };
  const checkForUpdates = async () => {
    setUpdateMessage('Opening Notify releases so you can check the latest build.');
    try { await Linking.openURL('https://github.com/Filz249/Notify-app/releases'); }
    catch { Alert.alert('Could not open updates', 'Please open the Notify GitHub releases page in your browser.'); }
  };
  const downloadLatest = async () => {
    setUpdateMessage('Opening the latest Android APK download. Android will ask you to confirm installation.');
    try { await Linking.openURL('https://github.com/Filz249/Notify-app/releases/download/android-latest/app-release.apk'); }
    catch { Alert.alert('Could not open download', 'Please download the latest APK from the Notify GitHub releases page.'); }
  };

  const patch = (change: Partial<Note>) => setDraft((value) => ({ ...value, ...change }));
  const openNew = (type: NoteType = 'note') => {
    setDraft(emptyNote(type)); setNewItem(''); setNewPrice(''); setTypePicker(false); setEditor(true);
  };
  const openEdit = (note: Note) => {
    setDraft({ ...note, items: [...note.items], sketchPaths: [...note.sketchPaths] });
    setNewItem(''); setNewPrice(''); setTypePicker(false); setEditor(true);
  };
  const save = async () => {
    if (!draft.title.trim() && !draft.body.trim() && draft.items.length === 0 && draft.sketchPaths.length === 0) {
      Alert.alert('Nothing to save yet', 'Add a title, some text, a list item or a sketch first.'); return;
    }
    const base = { ...draft, title: draft.title.trim(), updatedAt: Date.now() };
    try {
      const notificationId = await syncReminder(base);
      const finalNote = { ...base, notificationId };
      await saveNote(finalNote);
      setNotes((current) => [finalNote, ...current.filter((n) => n.id !== finalNote.id)].sort((a, b) => b.updatedAt - a.updatedAt));
      setEditor(false);
    } catch (err) {
      console.warn('Note save failed', err);
      Alert.alert('Could not save note', 'Please try saving again.');
    }
  };
  const remove = (note: Note) => Alert.alert('Delete note?', 'This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await deleteNote(note.id); setNotes((all) => all.filter((n) => n.id !== note.id)); }
      catch { Alert.alert('Delete failed', 'Please try again.'); }
    } },
  ]);
  const toggleImportant = async (note: Note) => {
    const next = { ...note, important: !note.important, updatedAt: Date.now() };
    try { await saveNote(next); setNotes((all) => [next, ...all.filter((n) => n.id !== next.id)].sort((a, b) => b.updatedAt - a.updatedAt)); }
    catch { Alert.alert('Could not update note', 'Please try again.'); }
  };
  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    const item: ListItem = {
      id: makeId(), text, checked: false,
      ...(draft.type === 'shopping' ? { category: aisleFor(text), price: Math.max(0, Number(newPrice.replace(',', '.')) || 0), quantity: 1 } : {}),
    };
    patch({ items: [...draft.items, item] }); setNewItem(''); setNewPrice('');
  };
  const patchItem = (id: string, change: Partial<ListItem>) => patch({ items: draft.items.map((it) => it.id === id ? { ...it, ...change } : it) });
  const groupedItems = useMemo(() => {
    const groups: Record<string, ListItem[]> = {};
    draft.items.forEach((it) => { const key = draft.type === 'shopping' ? (it.category || 'Other') : 'Items'; (groups[key] ||= []).push(it); });
    return groups;
  }, [draft.items, draft.type]);
  const shoppingTotal = draft.items.reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 1), 0);
  const filtered = useMemo(() => notes
    .filter((n) => {
      const haystack = (n.title + ' ' + n.body + ' ' + n.items.map((i) => i.text).join(' ')).toLowerCase();
      if (query.trim() && !haystack.includes(query.toLowerCase().trim())) return false;
      if (filter === 'important' && !n.important) return false;
      if (filter === 'tasks' && !['todo', 'checklist', 'shopping'].includes(n.type)) return false;
      if (filter === 'creative' && !['lyrics', 'poem', 'sketch', 'brainstorm'].includes(n.type)) return false;
      return true;
    })
    .sort((a, b) => Number(b.important) - Number(a.important) || b.updatedAt - a.updatedAt), [notes, query, filter]);

  const renderNote = (note: Note) => {
    const info = typeInfo(note.type);
    const checked = note.items.filter((i) => i.checked).length;
    return <Pressable key={note.id} onPress={() => openEdit(note)} style={({ pressed }) => [s.noteCard, { backgroundColor: palette.panel, borderColor: palette.line }, pressed && s.pressed]}>
      <View style={[s.noteStripe, { backgroundColor: note.color || info.color }]} />
      <View style={s.noteContent}>
        <View style={s.noteTop}>
          <View style={[s.noteGlyph, { borderColor: (note.color || info.color) + '66' }]}><Glyph type={note.type} size={21} /></View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={s.noteTitle}>{note.title || info.label}</Text>
            <Text style={s.noteMeta}>{info.label} · {new Date(note.updatedAt).toLocaleDateString()}</Text>
          </View>
          <Pressable hitSlop={10} onPress={() => toggleImportant(note)} style={s.starHit}><Star size={19} color={note.important ? C.amber : C.muted} fill={note.important ? C.amber : 'transparent'} /></Pressable>
        </View>
        {note.type === 'checklist' || note.type === 'todo' || note.type === 'shopping'
          ? <Text style={s.preview}>{checked}/{note.items.length} completed{note.type === 'shopping' ? ' · ' + money(note.items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0)) : ''}</Text>
          : <Text numberOfLines={3} style={s.preview}>{note.body || (note.type === 'sketch' ? 'A little drawing saved here' : 'Tap to add your thoughts…')}</Text>}
      </View>
    </Pressable>;
  };

  return <SafeAreaView style={[s.safe, { backgroundColor: palette.bg }]}>
    <StatusBar style="light" />
    <View style={[s.homeHeader, { paddingHorizontal: sidePad }, compactLayout && { paddingTop: 2, paddingBottom: 5 }]}>
      <View>
        <View style={s.brandRow}>
          <Svg width={31} height={34} viewBox="0 0 34 38" style={{ marginRight: 6 }}>
            <Path d="M7 2h18a5 5 0 0 1 5 5v24a4 4 0 0 1-4 4H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z" fill={palette.accent}/>
            <Path d="M8 10h14M8 15h11M8 20h8" stroke={palette.bg} strokeWidth="2" strokeLinecap="round" />
            <Path d="m17 28 8-8 4 4-8 8-5 1Z" fill={palette.cream} stroke={palette.bg} strokeWidth="1.5" strokeLinejoin="round" />
          </Svg>
          <Text style={s.brand}>Notify</Text><View style={[s.brandDot, { backgroundColor: palette.accent }]} />
        </View>
        <Text style={s.tagline}>Your ideas, remembered.</Text>
      </View>
      <View style={s.headerActions}>
        <View style={[s.headerBadge, { backgroundColor: palette.panel, borderColor: palette.line }]}><AlarmClock color={palette.accent} size={18} /><Text style={s.headerBadgeText}>{notes.filter((n) => n.important).length} important</Text></View>
        <Pressable accessibilityLabel="Open settings" onPress={() => setSettingsVisible(true)} style={[s.settingsButton, { backgroundColor: palette.panel, borderColor: palette.line }]}><Settings color={palette.cream} size={19} /></Pressable>
      </View>
    </View>
    <View style={[s.searchWrap, { marginHorizontal: sidePad, height: compactLayout ? 41 : 46, backgroundColor: palette.panel, borderColor: palette.line }]}><Search color={palette.muted} size={19} /><TextInput value={query} onChangeText={setQuery} placeholder="Search notes, lists, ideas…" placeholderTextColor={palette.muted} style={[s.searchInput, { color: palette.cream }]} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.filters, { paddingHorizontal: sidePad, paddingTop: 2, paddingBottom: 2, gap: 6 }]}>
      {([{ id: 'all', label: 'All' }, { id: 'important', label: '★ Important' }, { id: 'tasks', label: 'Tasks' }, { id: 'creative', label: 'Creative' }] as const).map((item) =>
        <Pressable key={item.id} onPress={() => setFilter(item.id)} style={[s.filterChip, { backgroundColor: palette.panel, borderColor: palette.line, height: compactLayout ? 29 : 31 }, filter === item.id && { backgroundColor: palette.accent, borderColor: palette.accent }]}>
          <Text style={[s.filterText, { color: palette.muted }, filter === item.id && { color: palette.bg }]}>{item.label}</Text>
        </Pressable>)}
    </ScrollView>
    <View style={[s.sectionHead, { paddingHorizontal: sidePad, marginTop: compactLayout ? 1 : 3, marginBottom: 4 }]}><Text style={[s.sectionTitle, { color: palette.cream, fontSize: compactLayout ? 15 : 16 }]}>Quick create</Text><Text style={[s.sectionSub, { color: palette.muted }]}>Choose a format</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.quickRow, { paddingHorizontal: sidePad, paddingBottom: compactLayout ? 4 : 6, gap: 7 }]}>
      {TYPES.map((type) => <Pressable key={type.id} onPress={() => openNew(type.id)} style={({ pressed }) => [s.quickCard, { width: cardWidth, height: compactLayout ? 57 : 62, backgroundColor: palette.panel, borderColor: palette.line, borderBottomColor: type.color, paddingVertical: 3, gap: 2 }, pressed && s.pressed]}>
        <View style={[s.quickGlyph, { backgroundColor: type.color + '1D', width: 30, height: 29 }]}><Glyph type={type.id} size={22} /></View>
        <Text style={s.quickLabel}>{type.label}</Text>
      </Pressable>)}
    </ScrollView>
    <View style={[s.sectionHead, { paddingHorizontal: sidePad, marginTop: compactLayout ? 1 : 3, marginBottom: 5 }]}><Text style={[s.sectionTitle, { color: palette.cream, fontSize: compactLayout ? 16 : 17 }]}>Your notes</Text><Text style={[s.sectionSub, { color: palette.muted }]}>{filtered.length} saved</Text></View>
    <ScrollView style={s.feed} contentContainerStyle={[s.feedContent, { paddingHorizontal: sidePad, gap: compactLayout ? 7 : 9 }]} showsVerticalScrollIndicator={false}>
      {!loaded ? <Text style={s.emptyText}>Loading your notes…</Text> : filtered.length === 0
        ? <View style={s.emptyState}><View style={s.emptyIcon}><FileText color={C.amber} size={29} /></View><Text style={s.emptyTitle}>{query ? 'Nothing found' : 'A little room for your next idea'}</Text><Text style={s.emptyText}>{query ? 'Try another search.' : 'Create a note, make a list or capture a thought.'}</Text><Button title="Create your first note" icon={<Plus color={C.bg} size={18} />} onPress={() => openNew()} /></View>
        : filtered.map(renderNote)}
      <View style={{ height: 100 }} />
    </ScrollView>
    <Pressable accessibilityLabel="Create new note" onPress={() => setTypePicker(true)} style={({ pressed }) => [s.fab, { backgroundColor: palette.accent }, pressed && s.pressed]}><Plus color={palette.bg} size={29} strokeWidth={2.4} /></Pressable>

    <Modal visible={typePicker} transparent animationType="slide" onRequestClose={() => setTypePicker(false)}>
      <Pressable style={s.sheetShade} onPress={() => setTypePicker(false)}><View style={s.sheet} onStartShouldSetResponder={() => true}>
        <View style={s.sheetHandle} /><View style={s.sheetHead}><Text style={s.sheetTitle}>Create something</Text><Pressable onPress={() => setTypePicker(false)}><X color={C.muted} size={22} /></Pressable></View>
        <View style={s.typeGrid}>{TYPES.map((type) => <Pressable key={type.id} onPress={() => openNew(type.id)} style={s.typeOption}>
          <View style={[s.typeOptionGlyph, { borderBottomColor: type.color }]}><Glyph type={type.id} size={23} /></View><Text style={s.typeOptionTitle}>{type.label}</Text><Text style={s.typeOptionDesc}>{type.id === 'shopping' ? 'Aisles & budget' : type.id === 'sketch' ? 'Draw an idea' : type.id === 'brainstorm' ? 'Explore connections' : type.id === 'lyrics' || type.id === 'poem' ? 'Write creatively' : type.id === 'checklist' || type.id === 'todo' ? 'Track progress' : 'Capture a thought'}</Text>
        </Pressable>)}</View>
      </View></Pressable>
    </Modal>

    <Modal visible={settingsVisible} transparent animationType="slide" onRequestClose={() => setSettingsVisible(false)}>
      <View style={s.settingsShade}>
        <View style={[s.settingsPanel, { backgroundColor: palette.panel, borderColor: palette.line, maxHeight: Math.min(screenHeight * 0.88, 720) }]}>
          <View style={s.sheetHandle} />
          <View style={s.sheetHead}>
            <View><Text style={[s.sheetTitle, { color: palette.cream }]}>Settings</Text><Text style={[s.settingsIntro, { color: palette.muted }]}>Make Notify feel like yours</Text></View>
            <Pressable accessibilityLabel="Close settings" onPress={() => setSettingsVisible(false)}><X color={palette.muted} size={22} /></Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
            <View style={s.settingsSectionHead}><Palette color={palette.accent} size={18} /><Text style={[s.settingsSectionTitle, { color: palette.cream }]}>Appearance</Text></View>
            <Text style={[s.settingsHint, { color: palette.muted }]}>Choose a color theme. Your choice is saved on this device.</Text>
            <View style={s.themeChoices}>
              {(['espresso', 'midnight', 'forest'] as ThemeName[]).map((key) => {
                const p = PALETTES[key]; const active = themeName === key;
                return <Pressable key={key} onPress={() => chooseTheme(key)} style={[s.themeChoice, { backgroundColor: p.bg, borderColor: active ? p.accent : p.line }]}>
                  <View style={[s.themePreview, { backgroundColor: p.panel, borderColor: p.line }]}><View style={[s.themePreviewLine, { backgroundColor: p.accent }]} /><View style={[s.themePreviewLine, { backgroundColor: p.muted, width: '65%' }]} /><View style={[s.themePreviewChip, { backgroundColor: p.panel2 }]} /></View>
                  <View style={s.themeChoiceFooter}><Text style={[s.themeChoiceLabel, { color: p.cream }]}>{p.name}</Text>{active ? <CheckCircle2 size={15} color={p.accent} /> : null}</View>
                </Pressable>;
              })}
            </View>
            <View style={[s.settingsDivider, { backgroundColor: palette.line }]} />
            <View style={s.settingsSectionHead}><Download color={palette.accent} size={18} /><Text style={[s.settingsSectionTitle, { color: palette.cream }]}>Updates</Text></View>
            <Text style={[s.settingsHint, { color: palette.muted }]}>Check the latest release or open the APK download. Android requires you to confirm installing an update.</Text>
            <Pressable onPress={checkForUpdates} style={[s.settingsAction, { borderColor: palette.line, backgroundColor: palette.panel2 }]}>
              <View style={{ flex: 1 }}><Text style={[s.settingsActionTitle, { color: palette.cream }]}>Check for updates</Text><Text style={[s.settingsActionSub, { color: palette.muted }]}>Open Notify releases in your browser</Text></View><ExternalLink color={palette.muted} size={18} />
            </Pressable>
            <Pressable onPress={downloadLatest} style={[s.settingsAction, { borderColor: palette.accent, backgroundColor: palette.accent }]}>
              <View style={{ flex: 1 }}><Text style={[s.settingsActionTitle, { color: palette.bg }]}>Download latest APK</Text><Text style={[s.settingsActionSub, { color: palette.bg, opacity: 0.8 }]}>Install manually after downloading</Text></View><Download color={palette.bg} size={18} />
            </Pressable>
            {updateMessage ? <Text style={[s.settingsHint, { color: palette.muted, marginTop: 9 }]}>{updateMessage}</Text> : null}
            <View style={[s.settingsDivider, { backgroundColor: palette.line }]} />
            <Text style={[s.settingsFooter, { color: palette.muted }]}>Notify · version 0.1.0</Text>
            <Text style={[s.settingsHint, { color: palette.muted }]}>Updates are installed with your approval; this app cannot silently replace its own APK.</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>

    <Modal visible={editor} animationType="slide" onRequestClose={() => setEditor(false)}>
      <SafeAreaView style={s.editorSafe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.editorHeader}>
            <Pressable onPress={() => setEditor(false)} style={s.headerAction}><ArrowLeft color={C.cream} size={22} /></Pressable>
            <View style={s.editorHeaderTitle}><Glyph type={draft.type} size={21} /><Text style={s.editorType}>{typeInfo(draft.type).label}</Text></View>
            <Pressable onPress={() => patch({ important: !draft.important })} style={[s.headerAction, draft.important && s.starActive]}><Star color={draft.important ? C.amber : C.muted} fill={draft.important ? C.amber : 'transparent'} size={20} /></Pressable>
            <Pressable onPress={save} style={s.saveButton}><Check color={C.bg} size={18} /><Text style={s.saveButtonText}>Save</Text></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.editorScroll}>
            <TextInput value={draft.title} onChangeText={(title) => patch({ title })} placeholder={draft.type === 'shopping' ? 'Shopping for…' : 'Give this a title'} placeholderTextColor={C.muted} style={s.titleInput} multiline />
            {draft.important ? <View style={s.importantPill}><Star color={C.bg} fill={C.bg} size={13} /><Text style={s.importantPillText}>Marked important</Text></View> : null}
            {['checklist', 'todo', 'shopping'].includes(draft.type) ? <View style={s.listSection}>
              {draft.type === 'shopping' ? <View style={s.totalRow}><View><Text style={s.totalLabel}>ESTIMATED TOTAL</Text><Text style={s.totalAmount}>{money(shoppingTotal)}</Text></View><ShoppingBag color={C.orange} size={27} /></View> : <Text style={s.fieldLabel}>YOUR ITEMS · {draft.items.filter((i) => i.checked).length}/{draft.items.length} done</Text>}
              {Object.entries(groupedItems).map(([category, items]) => <View key={category}>
                {draft.type === 'shopping' ? <Text style={s.aisleTitle}>{category.toUpperCase()}</Text> : null}
                {items.map((item) => <View key={item.id} style={s.itemRow}>
                  <Pressable onPress={() => patchItem(item.id, { checked: !item.checked })} style={[s.checkBox, item.checked && s.checkBoxOn]}>{item.checked ? <Check color={C.bg} size={14} /> : null}</Pressable>
                  <Text style={[s.itemText, item.checked && s.itemDone]}>{item.text}</Text>
                  {draft.type === 'shopping' ? <Text style={s.itemPrice}>{item.price ? money(item.price) : '—'}</Text> : null}
                  <Pressable onPress={() => patch({ items: draft.items.filter((i) => i.id !== item.id) })} hitSlop={8}><X color={C.muted} size={17} /></Pressable>
                </View>)}
              </View>)}
              <View style={s.addItemRow}>
                <TextInput value={newItem} onChangeText={setNewItem} onSubmitEditing={addItem} placeholder={draft.type === 'shopping' ? 'Add an item…' : 'Add a task…'} placeholderTextColor={C.muted} style={s.addItemInput} returnKeyType="done" />
                {draft.type === 'shopping' ? <TextInput value={newPrice} onChangeText={setNewPrice} placeholder="€" placeholderTextColor={C.muted} keyboardType="decimal-pad" style={s.priceInput} /> : null}
                <Pressable onPress={addItem} style={s.addItemButton}><Plus color={C.bg} size={20} /></Pressable>
              </View>
              {draft.type === 'shopping' ? <Text style={s.hint}>Items are grouped by likely supermarket aisle. Enter prices to estimate your total.</Text> : null}
            </View> : null}
            {draft.type === 'sketch' ? <View style={{ marginTop: 10 }}>
              <View style={s.fieldHead}><Text style={s.fieldLabel}>SKETCHPAD</Text><Pressable onPress={() => patch({ sketchPaths: [] })}><Text style={s.clearText}>Clear canvas</Text></Pressable></View>
              <View style={[s.sketchTools, { backgroundColor: palette.panel, borderColor: palette.line }]}>
                <Text style={[s.sketchToolLabel, { color: palette.muted }]}>PEN COLOR</Text>
                <View style={s.sketchSwatches}>{SKETCH_COLORS.map((color) => <Pressable key={color} accessibilityLabel={'Pen color ' + color} onPress={() => patch({ sketchColor: color })} style={[s.sketchSwatch, { backgroundColor: color, borderColor: draft.sketchColor === color ? palette.cream : palette.line, borderWidth: draft.sketchColor === color ? 3 : 1 }]} />)}</View>
                <Text style={[s.sketchToolLabel, { color: palette.muted }]}>PEN STYLE</Text>
                <View style={s.sketchOptionRow}>{([{key:'solid',label:'Solid'},{key:'dashed',label:'Dashed'},{key:'dotted',label:'Dotted'}] as const).map((option) => <Pressable key={option.key} onPress={() => patch({ sketchStyle: option.key })} style={[s.sketchOption, { borderColor: draft.sketchStyle === option.key ? palette.accent : palette.line, backgroundColor: draft.sketchStyle === option.key ? palette.panel2 : 'transparent' }]}><Text style={[s.sketchOptionText, { color: palette.cream }]}>{option.label}</Text></Pressable>)}</View>
                <Text style={[s.sketchToolLabel, { color: palette.muted }]}>STROKE WIDTH</Text>
                <View style={s.sketchOptionRow}>{([2,4,7] as number[]).map((strokeWidth) => <Pressable key={strokeWidth} onPress={() => patch({ sketchWidth: strokeWidth })} style={[s.sketchOption, { borderColor: draft.sketchWidth === strokeWidth ? palette.accent : palette.line, backgroundColor: draft.sketchWidth === strokeWidth ? palette.panel2 : 'transparent' }]}><View style={{ width: 25, height: strokeWidth, borderRadius: 5, backgroundColor: draft.sketchColor || C.amber }} /></Pressable>)}</View>
                <Text style={[s.sketchToolLabel, { color: palette.muted }]}>CANVAS BACKGROUND</Text>
                <View style={s.sketchSwatches}>{SKETCH_BACKGROUNDS.map((option) => <Pressable key={option.color} accessibilityLabel={option.label + ' canvas'} onPress={() => patch({ sketchBackground: option.color })} style={[s.sketchSwatch, { backgroundColor: option.color, borderColor: draft.sketchBackground === option.color ? palette.accent : palette.line, borderWidth: draft.sketchBackground === option.color ? 3 : 1 }]} />)}</View>
              </View>
              <SketchPad paths={draft.sketchPaths} onChange={(sketchPaths) => patch({ sketchPaths })} color={draft.sketchColor || C.amber} width={draft.sketchWidth || 3} style={draft.sketchStyle || 'solid'} backgroundColor={draft.sketchBackground || C.panel} />
            </View> : null}
            <Text style={s.fieldLabel}>{draft.type === 'lyrics' ? 'LYRICS' : draft.type === 'poem' ? 'YOUR POEM' : draft.type === 'brainstorm' ? 'YOUR IDEAS' : 'NOTE'}</Text>
            <TextInput value={draft.body} onChangeText={(body) => patch({ body })} placeholder={draft.type === 'lyrics' ? 'Verse, chorus, a line you don’t want to lose…' : draft.type === 'poem' ? 'Begin anywhere. Let the words arrive…' : draft.type === 'brainstorm' ? 'Capture an idea, question or possibility…' : 'Write anything worth remembering…'} placeholderTextColor={C.muted} style={[s.bodyInput, (draft.type === 'poem' || draft.type === 'lyrics') && s.creativeBody]} multiline textAlignVertical="top" />
            <View style={s.reminderCard}>
              <View style={s.reminderIcon}><AlarmClock color={C.amber} size={21} /></View><View style={{ flex: 1 }}><Text style={s.reminderTitle}>{draft.reminderAt ? 'Reminder set' : 'Remember this later'}</Text><Text style={s.reminderSub}>{draft.reminderAt ? new Date(draft.reminderAt).toLocaleString() : 'Choose a gentle nudge'}</Text></View>
              {draft.reminderAt ? <Pressable onPress={() => patch({ reminderAt: undefined, notificationId: undefined })}><X color={C.muted} size={20} /></Pressable> : null}
            </View>
            <View style={s.reminderOptions}>
              <Button title="In 1 hour" icon={<AlarmClock color={C.cream} size={15} />} subtle onPress={() => patch({ reminderAt: Date.now() + 60 * 60 * 1000 })} />
              <Button title="Tomorrow 9 AM" icon={<AlarmClock color={C.cream} size={15} />} subtle onPress={() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); patch({ reminderAt: d.getTime() }); }} />
            </View>
            <Text style={s.hint}>Stored on this device. Reminders use your phone’s notification system.</Text>
            {notes.some((n) => n.id === draft.id) ? <Button title="Delete note" icon={<Trash2 color={C.red} size={17} />} danger onPress={() => { setEditor(false); remove(draft); }} /> : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  homeHeader: { paddingTop: 3, paddingHorizontal: 19, paddingBottom: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'flex-end' },
  brand: { color: C.cream, fontSize: 32, letterSpacing: -1.3, fontWeight: '700' },
  brandDot: { width: 8, height: 8, borderRadius: 5, backgroundColor: C.amber, marginLeft: 4, marginBottom: 8 },
  tagline: { color: C.muted, marginTop: 1, fontSize: 12 },
  headerBadge: { borderWidth: 1, borderColor: C.line, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 9, backgroundColor: C.panel },
  headerBadgeText: { color: C.cream, fontSize: 10, fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  settingsButton: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { marginHorizontal: 19, height: 44, borderRadius: 24, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  searchInput: { flex: 1, color: C.cream, fontSize: 14, paddingVertical: 0 },
  filters: { paddingHorizontal: 19, paddingTop: 2, paddingBottom: 2, gap: 6 },
  filterChip: { height: 31, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel },
  filterActive: { backgroundColor: C.cream, borderColor: C.cream },
  filterText: { color: C.muted, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: C.bg },
  sectionHead: { paddingHorizontal: 19, marginTop: 1, marginBottom: 4, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { color: C.cream, fontSize: 17, fontWeight: '700', letterSpacing: -.2 },
  sectionSub: { color: C.muted, fontSize: 11 },
  quickRow: { paddingHorizontal: 19, paddingTop: 0, paddingBottom: 4, gap: 7 },
  quickCard: { width: 68, height: 62, borderRadius: 13, borderWidth: 1, borderColor: C.line, borderBottomWidth: 3, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center', paddingVertical: 5, gap: 3 },
  quickGlyph: { width: 30, height: 29, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { color: C.cream, fontSize: 10, fontWeight: '600' },
  feed: { flex: 1 },
  feedContent: { paddingHorizontal: 19, gap: 8, paddingTop: 2, paddingBottom: 8 },
  noteCard: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 17, overflow: 'hidden', minHeight: 105, flexDirection: 'row' },
  noteStripe: { width: 4 },
  noteContent: { flex: 1, padding: 13 },
  noteTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  noteGlyph: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel2, borderWidth: 1 },
  noteTitle: { color: C.cream, fontSize: 14, fontWeight: '700' },
  noteMeta: { color: C.muted, fontSize: 10, marginTop: 3 },
  starHit: { padding: 5 },
  preview: { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 10 },
  emptyState: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 30, paddingBottom: 25 },
  emptyIcon: { width: 65, height: 65, borderRadius: 21, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line, marginBottom: 15 },
  emptyTitle: { color: C.cream, fontWeight: '700', fontSize: 17, textAlign: 'center' },
  emptyText: { color: C.muted, fontSize: 12, marginTop: 7, marginBottom: 16, textAlign: 'center', lineHeight: 18 },
  button: { minHeight: 36, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: C.amber, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  buttonSubtle: { backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line },
  buttonDanger: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, marginTop: 16 },
  buttonText: { color: C.bg, fontSize: 11, fontWeight: '700' },
  pressed: { opacity: .78, transform: [{ scale: .99 }] },
  fab: { position: 'absolute', right: 22, bottom: 27, height: 57, width: 57, borderRadius: 20, backgroundColor: C.amber, alignItems: 'center', justifyContent: 'center', elevation: 7, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: .3, shadowRadius: 6 },
  sheetShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,4,2,.72)' },
  sheet: { backgroundColor: C.panel, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 34, borderWidth: 1, borderColor: C.line },
  sheetHandle: { alignSelf: 'center', height: 4, width: 40, borderRadius: 3, backgroundColor: C.line, marginBottom: 16 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { color: C.cream, fontSize: 20, fontWeight: '700' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  typeOption: { width: '48%', borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, borderRadius: 15, padding: 12, minHeight: 107 },
  typeOptionGlyph: { width: 37, height: 36, borderRadius: 12, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderBottomWidth: 3, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  typeOptionTitle: { color: C.cream, fontSize: 13, fontWeight: '700' },
  typeOptionDesc: { color: C.muted, fontSize: 10, marginTop: 4 },
  editorSafe: { flex: 1, backgroundColor: C.bg },
  editorHeader: { height: 60, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7, borderBottomWidth: 1, borderBottomColor: C.line },
  headerAction: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  starActive: { backgroundColor: '#493116', borderColor: '#8E6428' },
  editorHeaderTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  editorType: { color: C.muted, fontSize: 12, fontWeight: '600' },
  saveButton: { height: 38, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 12, backgroundColor: C.amber },
  saveButtonText: { color: C.bg, fontWeight: '800', fontSize: 12 },
  editorScroll: { padding: 20, paddingBottom: 35 },
  titleInput: { color: C.cream, fontSize: 26, fontWeight: '700', paddingHorizontal: 0, paddingVertical: 10, minHeight: 55 },
  importantPill: { alignSelf: 'flex-start', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: C.amber, flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  importantPillText: { color: C.bg, fontSize: 10, fontWeight: '800' },
  listSection: { marginTop: 13, marginBottom: 22, borderWidth: 1, borderColor: C.line, borderRadius: 16, backgroundColor: C.panel, padding: 13 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  totalLabel: { color: C.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  totalAmount: { color: C.cream, fontSize: 24, fontWeight: '800', marginTop: 4 },
  fieldLabel: { color: C.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginTop: 17, marginBottom: 9 },
  aisleTitle: { color: C.orange, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 14, marginBottom: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  checkBox: { height: 21, width: 21, borderRadius: 7, borderWidth: 1.3, borderColor: C.muted, alignItems: 'center', justifyContent: 'center' },
  checkBoxOn: { backgroundColor: C.green, borderColor: C.green },
  itemText: { color: C.cream, fontSize: 13, flex: 1 },
  itemDone: { textDecorationLine: 'line-through', color: C.muted },
  itemPrice: { color: C.cream, fontSize: 11, width: 57, textAlign: 'right' },
  addItemRow: { marginTop: 13, borderRadius: 13, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addItemInput: { color: C.cream, flex: 1, minWidth: 0, paddingVertical: 11, fontSize: 12 },
  priceInput: { width: 45, color: C.cream, fontSize: 12, paddingHorizontal: 3, paddingVertical: 8, textAlign: 'center', borderLeftWidth: 1, borderColor: C.line },
  addItemButton: { height: 34, width: 34, borderRadius: 10, backgroundColor: C.amber, alignItems: 'center', justifyContent: 'center' },
  hint: { color: C.muted, fontSize: 10, marginTop: 10, lineHeight: 15 },
  sketchTools: { borderWidth: 1, borderRadius: 14, padding: 11, marginBottom: 10, gap: 7 },
  sketchToolLabel: { fontSize: 9, fontWeight: '800', letterSpacing: .9, marginTop: 2 },
  sketchSwatches: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9, marginBottom: 3 },
  sketchSwatch: { width: 25, height: 25, borderRadius: 13 },
  sketchOptionRow: { flexDirection: 'row', gap: 7, marginBottom: 3 },
  sketchOption: { minWidth: 58, minHeight: 30, paddingHorizontal: 9, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sketchOptionText: { fontSize: 11, fontWeight: '600' },
  sketch: { height: 300, borderRadius: 16, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, overflow: 'hidden', marginBottom: 18 },
  sketchHint: { position: 'absolute', top: '48%', alignSelf: 'center', color: C.muted, fontSize: 13 },
  fieldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearText: { color: C.amber, fontSize: 11, fontWeight: '700' },
  bodyInput: { minHeight: 170, color: C.cream, fontSize: 15, lineHeight: 24, paddingHorizontal: 0, paddingTop: 3, paddingBottom: 12 },
  creativeBody: { fontSize: 18, lineHeight: 30 },
  reminderCard: { marginTop: 17, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, borderRadius: 15, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  reminderIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#493116', alignItems: 'center', justifyContent: 'center' },
  reminderTitle: { color: C.cream, fontWeight: '700', fontSize: 12 },
  reminderSub: { color: C.muted, fontSize: 10, marginTop: 3 },
  reminderOptions: { flexDirection: 'row', gap: 9, marginTop: 10 },
  settingsShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,4,2,.75)' },
  settingsPanel: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  settingsIntro: { fontSize: 11, marginTop: 4 },
  settingsSectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 6 },
  settingsSectionTitle: { fontSize: 14, fontWeight: '800' },
  settingsHint: { fontSize: 11, lineHeight: 16, marginBottom: 8 },
  themeChoices: { flexDirection: 'row', gap: 9 },
  themeChoice: { flex: 1, minWidth: 0, padding: 8, borderRadius: 13, borderWidth: 1.5 },
  themePreview: { height: 55, borderRadius: 8, borderWidth: 1, padding: 7, justifyContent: 'center', gap: 5 },
  themePreviewLine: { height: 4, width: '80%', borderRadius: 3 },
  themePreviewChip: { height: 9, width: '40%', borderRadius: 4, marginTop: 2 },
  themeChoiceFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  themeChoiceLabel: { fontSize: 10, fontWeight: '700' },
  settingsDivider: { height: 1, marginTop: 14, marginBottom: 3 },
  settingsAction: { minHeight: 57, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 7 },
  settingsActionTitle: { fontSize: 12, fontWeight: '800' },
  settingsActionSub: { fontSize: 10, marginTop: 3 },
  settingsFooter: { fontSize: 11, fontWeight: '800', marginBottom: 4 },
});