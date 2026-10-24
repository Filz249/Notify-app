import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path } from 'react-native-svg';
import {
  AlarmClock, ArrowLeft, Check, Circle, FileText, Lightbulb, ListChecks,
  Music, Pencil, Plus, Search, ShoppingBag, Star, Trash2, X,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteNote, loadNotes, saveNote } from './src/storage';
import { prepareNotifications, syncReminder } from './src/notifications';
import type { ListItem, Note, NoteType } from './src/types';

const C = {
  bg: '#20130D', panel: '#2B1B12', panel2: '#352319', line: '#4B3425',
  cream: '#F5EBDD', muted: '#BBA995', amber: '#F2B23D', orange: '#F08A3E',
  green: '#A8C66C', teal: '#63BBB8', pink: '#D98EB5', violet: '#B49ADF',
  red: '#E77C70', white: '#FFFFFF',
};
const TYPES: { id: NoteType; label: string; color: string; glyph: string }[] = [
  { id: 'note', label: 'Note', color: C.amber, glyph: '✎' },
  { id: 'checklist', label: 'Checklist', color: C.green, glyph: '☑' },
  { id: 'shopping', label: 'Shopping', color: C.orange, glyph: '▧' },
  { id: 'todo', label: 'To-do', color: C.teal, glyph: '✓' },
  { id: 'lyrics', label: 'Lyrics', color: C.pink, glyph: '♫' },
  { id: 'poem', label: 'Poem', color: C.violet, glyph: '❝' },
  { id: 'sketch', label: 'Sketch', color: C.teal, glyph: '⌁' },
  { id: 'brainstorm', label: 'Ideas', color: C.violet, glyph: '✳' },
];
const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const emptyNote = (type: NoteType = 'note'): Note => ({
  id: makeId(), title: '', body: '', type, important: false,
  color: TYPES.find((t) => t.id === type)?.color || C.amber,
  createdAt: Date.now(), updatedAt: Date.now(), items: [], sketchPaths: [],
});
const typeInfo = (type: NoteType) => TYPES.find((t) => t.id === type) || TYPES[0];
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
function SketchPad({ paths, onChange }: { paths: string[]; onChange: (paths: string[]) => void }) {
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
      if (pathRef.current) onChange([...paths, pathRef.current]);
      pathRef.current = '';
      setCurrent('');
    },
  }), [onChange, paths]);
  return <View style={s.sketch} {...responder.panHandlers}>
    <Svg style={StyleSheet.absoluteFill}>
      {paths.map((d, i) => <Path key={String(i)} d={d} stroke={C.amber} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
      {current ? <Path d={current} stroke={C.amber} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
    </Svg>
    {paths.length === 0 && !current ? <Text pointerEvents="none" style={s.sketchHint}>Draw with your finger</Text> : null}
  </View>;
}

export default function App() {
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
    prepareNotifications().catch((err) => console.warn('Notifications could not be prepared', err));
  }, []);

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
    return <Pressable key={note.id} onPress={() => openEdit(note)} style={({ pressed }) => [s.noteCard, pressed && s.pressed]}>
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

  return <SafeAreaView style={s.safe}>
    <StatusBar style="light" />
    <View style={s.homeHeader}>
      <View>
        <View style={s.brandRow}><Text style={s.brand}>Notify</Text><View style={s.brandDot} /></View>
        <Text style={s.tagline}>Your ideas, remembered.</Text>
      </View>
      <View style={s.headerBadge}><AlarmClock color={C.amber} size={19} /><Text style={s.headerBadgeText}>{notes.filter((n) => n.important).length} important</Text></View>
    </View>
    <View style={s.searchWrap}><Search color={C.muted} size={19} /><TextInput value={query} onChangeText={setQuery} placeholder="Search notes, lists, ideas…" placeholderTextColor={C.muted} style={s.searchInput} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
      {([{ id: 'all', label: 'All' }, { id: 'important', label: '★ Important' }, { id: 'tasks', label: 'Tasks' }, { id: 'creative', label: 'Creative' }] as const).map((item) =>
        <Pressable key={item.id} onPress={() => setFilter(item.id)} style={[s.filterChip, filter === item.id && s.filterActive]}>
          <Text style={[s.filterText, filter === item.id && s.filterTextActive]}>{item.label}</Text>
        </Pressable>)}
    </ScrollView>
    <View style={s.sectionHead}><Text style={s.sectionTitle}>Quick create</Text><Text style={s.sectionSub}>Start with a format</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickRow}>
      {TYPES.map((type) => <Pressable key={type.id} onPress={() => openNew(type.id)} style={({ pressed }) => [s.quickCard, { borderBottomColor: type.color }, pressed && s.pressed]}>
        <View style={[s.quickGlyph, { backgroundColor: type.color + '1D' }]}><Glyph type={type.id} size={23} /></View>
        <Text style={s.quickLabel}>{type.label}</Text>
      </Pressable>)}
    </ScrollView>
    <View style={s.sectionHead}><Text style={s.sectionTitle}>Your notes</Text><Text style={s.sectionSub}>{filtered.length} saved</Text></View>
    <ScrollView style={s.feed} contentContainerStyle={s.feedContent} showsVerticalScrollIndicator={false}>
      {!loaded ? <Text style={s.emptyText}>Loading your notes…</Text> : filtered.length === 0
        ? <View style={s.emptyState}><View style={s.emptyIcon}><FileText color={C.amber} size={29} /></View><Text style={s.emptyTitle}>{query ? 'Nothing found' : 'A little room for your next idea'}</Text><Text style={s.emptyText}>{query ? 'Try another search.' : 'Create a note, make a list or capture a thought.'}</Text><Button title="Create your first note" icon={<Plus color={C.bg} size={18} />} onPress={() => openNew()} /></View>
        : filtered.map(renderNote)}
      <View style={{ height: 100 }} />
    </ScrollView>
    <Pressable accessibilityLabel="Create new note" onPress={() => setTypePicker(true)} style={({ pressed }) => [s.fab, pressed && s.pressed]}><Plus color={C.bg} size={29} strokeWidth={2.4} /></Pressable>

    <Modal visible={typePicker} transparent animationType="slide" onRequestClose={() => setTypePicker(false)}>
      <Pressable style={s.sheetShade} onPress={() => setTypePicker(false)}><View style={s.sheet} onStartShouldSetResponder={() => true}>
        <View style={s.sheetHandle} /><View style={s.sheetHead}><Text style={s.sheetTitle}>Create something</Text><Pressable onPress={() => setTypePicker(false)}><X color={C.muted} size={22} /></Pressable></View>
        <View style={s.typeGrid}>{TYPES.map((type) => <Pressable key={type.id} onPress={() => openNew(type.id)} style={s.typeOption}>
          <View style={[s.typeOptionGlyph, { borderBottomColor: type.color }]}><Glyph type={type.id} size={23} /></View><Text style={s.typeOptionTitle}>{type.label}</Text><Text style={s.typeOptionDesc}>{type.id === 'shopping' ? 'Aisles & budget' : type.id === 'sketch' ? 'Draw an idea' : type.id === 'brainstorm' ? 'Explore connections' : type.id === 'lyrics' || type.id === 'poem' ? 'Write creatively' : type.id === 'checklist' || type.id === 'todo' ? 'Track progress' : 'Capture a thought'}</Text>
        </Pressable>)}</View>
      </View></Pressable>
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
            {draft.type === 'sketch' ? <View style={{ marginTop: 15 }}><View style={s.fieldHead}><Text style={s.fieldLabel}>SKETCHPAD</Text><Pressable onPress={() => patch({ sketchPaths: [] })}><Text style={s.clearText}>Clear</Text></Pressable></View><SketchPad paths={draft.sketchPaths} onChange={(sketchPaths) => patch({ sketchPaths })} /></View> : null}
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
  homeHeader: { paddingTop: 14, paddingHorizontal: 21, paddingBottom: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'flex-end' },
  brand: { color: C.cream, fontSize: 35, letterSpacing: -1.3, fontWeight: '700' },
  brandDot: { width: 8, height: 8, borderRadius: 5, backgroundColor: C.amber, marginLeft: 4, marginBottom: 8 },
  tagline: { color: C.muted, marginTop: 1, fontSize: 12 },
  headerBadge: { borderWidth: 1, borderColor: C.line, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 11, backgroundColor: C.panel },
  headerBadgeText: { color: C.cream, fontSize: 11, fontWeight: '600' },
  searchWrap: { marginHorizontal: 20, height: 49, borderRadius: 24, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  searchInput: { flex: 1, color: C.cream, fontSize: 14, paddingVertical: 0 },
  filters: { paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  filterChip: { height: 34, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel },
  filterActive: { backgroundColor: C.cream, borderColor: C.cream },
  filterText: { color: C.muted, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: C.bg },
  sectionHead: { paddingHorizontal: 21, marginTop: 6, marginBottom: 11, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { color: C.cream, fontSize: 17, fontWeight: '700', letterSpacing: -.2 },
  sectionSub: { color: C.muted, fontSize: 11 },
  quickRow: { paddingHorizontal: 20, paddingBottom: 17, gap: 9 },
  quickCard: { width: 79, minHeight: 83, borderRadius: 15, borderWidth: 1, borderColor: C.line, borderBottomWidth: 3, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, gap: 7 },
  quickGlyph: { width: 36, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { color: C.cream, fontSize: 11, fontWeight: '600' },
  feed: { flex: 1 },
  feedContent: { paddingHorizontal: 20, gap: 10, paddingTop: 2 },
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
});
