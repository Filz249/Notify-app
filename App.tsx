import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import Svg, { Path } from "react-native-svg";
import {
  AlarmClock,
  ArrowLeft,
  Check,
  FileText,
  ListChecks,
  Mic,
  Plus,
  Search,
  ShoppingBag,
  Star,
  Trash2,
  X,
  Settings,
  Palette,
  Download,
  ExternalLink,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Quote,
} from "lucide-react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { getSetting, loadNotes, saveNote, setSetting } from "./src/storage";
import {
  cancelReminder,
  prepareNotifications,
  subscribeToReminders,
  syncReminder,
} from "./src/notifications";
import { QuoteEditor, QuotePreview } from "./src/components/QuoteEditor";
import { PaperEditor } from "./src/components/PaperEditor";
import { ReminderPicker } from "./src/components/ReminderPicker";
import { SketchEditor } from "./src/components/SketchEditor";
import { DrawingPicker } from "./src/components/DrawingPicker";
import { createDrawingOverlay, supportsDrawings } from "./src/drawings";
import { DetailsNote } from "./src/components/DetailsNote";
import { LoadingScreen } from "./src/components/LoadingScreen";
import {
  VoiceInput,
  VoiceInputStatus,
  VoiceLanguage,
} from "./src/components/VoiceInput";
import { useDictation } from "./src/useDictation";
import { appendDictation } from "./src/dictation";
import { TitleField } from "./src/components/TitleField";
import { layout, pageInset } from "./src/layout";
import {
  loadDrafts,
  saveDraft,
  removeDraft,
  updateDrafts,
  flushDrafts,
  hasContent,
} from "./src/drafts";
import { agendaAt, matchesAgenda, occurrence } from "./src/recurrence";
import { prepareFocusStyles } from "./src/focus";
import { OrganizeSheet } from "./src/components/OrganizeSheet";
import { DataPanel } from "./src/components/DataPanel";
import {
  isImportant,
  withImportance,
  organizationChange,
  withDraftOrganization,
  libraryNotes,
  matchesCategory,
  type LibraryCategory,
} from "./src/organization";
import { Sheet, Action } from "./src/components/Sheet";
import type { ListItem, Note, NoteType } from "./src/types";

if (Platform.OS !== "web") {
  void SplashScreen.preventAutoHideAsync().catch(console.warn);
}

function revealStartup() {
  void SplashScreen.hideAsync().catch(console.warn);
}

const C = {
  bg: "#20130D",
  panel: "#2B1B12",
  panel2: "#352319",
  line: "#4B3425",
  cream: "#F5EBDD",
  muted: "#BBA995",
  amber: "#F2B23D",
  red: "#E77C70",
  white: "#FFFFFF",
};
const TYPES: { id: NoteType; label: string; color: string; glyph: string }[] = [
  // A pastel color wheel: yellow through the cool hues, then back to peach.
  { id: "note", label: "Note", color: "#F6D77E", glyph: "✎" },
  { id: "todo", label: "Tasks", color: "#B9D89A", glyph: "☑" },
  { id: "sketch", label: "Sketch", color: "#91D3C6", glyph: "⌁" },
  { id: "brainstorm", label: "Ideas", color: "#9CC7EB", glyph: "✳" },
  { id: "poem", label: "Poem", color: "#C5B3E6", glyph: "❝" },
  { id: "lyrics", label: "Lyrics", color: "#E9B2CF", glyph: "♫" },
  { id: "quote", label: "Quotes", color: "#F1ADA3", glyph: "❞" },
  { id: "shopping", label: "Shopping", color: "#F1C09B", glyph: "▧" },
];
type ThemeName =
  | "espresso"
  | "midnight"
  | "forest"
  | "riviera"
  | "daydream"
  | "strawberryClub";
const PALETTES: Record<
  ThemeName,
  {
    name: string;
    bg: string;
    panel: string;
    panel2: string;
    line: string;
    cream: string;
    muted: string;
    accent: string;
    light?: boolean;
  }
> = {
  espresso: {
    name: "Espresso",
    bg: "#20130D",
    panel: "#2B1B12",
    panel2: "#352319",
    line: "#4B3425",
    cream: "#F5EBDD",
    muted: "#BBA995",
    accent: "#F2B23D",
  },
  midnight: {
    name: "Midnight",
    bg: "#11151D",
    panel: "#1B222E",
    panel2: "#242D3B",
    line: "#394658",
    cream: "#F3F4F6",
    muted: "#A5B1C3",
    accent: "#83B8FF",
  },
  forest: {
    name: "Forest",
    bg: "#101A15",
    panel: "#1B2A20",
    panel2: "#24372B",
    line: "#375040",
    cream: "#F1F6E9",
    muted: "#ACBEA9",
    accent: "#B7D96C",
  },
  riviera: {
    name: "Riviera",
    bg: "#F5F1E5",
    panel: "#F7FAF2",
    panel2: "#E1EAE0",
    line: "#CBD8CE",
    cream: "#174F50",
    muted: "#5A716C",
    accent: "#087E83",
    light: true,
  },
  daydream: {
    name: "Daydream",
    bg: "#F3EFF8",
    panel: "#FFFCF7",
    panel2: "#E7DEF2",
    line: "#D4C8E4",
    cream: "#342B46",
    muted: "#695B76",
    accent: "#745091",
    light: true,
  },
  strawberryClub: {
    name: "Strawberry Club",
    bg: "#FBE1ED",
    panel: "#FFF8F1",
    panel2: "#F3BFD6",
    line: "#DC9EBB",
    cream: "#352746",
    muted: "#785169",
    accent: "#C42669",
    light: true,
  },
};
const THEME_NAMES = Object.keys(PALETTES) as ThemeName[];
const makeId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const emptyNote = (type: NoteType = "note"): Note => ({
  id: makeId(),
  title: "",
  body: "",
  paperStyle: "plain",
  type,
  important: false,
  color: TYPES.find((t) => t.id === type)?.color || TYPES[0].color,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  items: [],
  sketchPaths: [],
  sketchColor: C.amber,
  sketchBackground: C.panel,
  sketchWidth: 3,
  sketchStyle: "solid",
});
const typeInfo = (type: NoteType) => {
  if (type === "checklist" || type === "todo")
    return TYPES.find((t) => t.id === "todo")!;
  return TYPES.find((t) => t.id === type) || TYPES[0];
};
const noteName = (note: Note) =>
  note.title ||
  (note.type === "quote"
    ? note.quoteAuthor?.trim()
      ? `Quote by ${note.quoteAuthor.trim()}`
      : note.body.trim().slice(0, 60) || "Quote"
    : typeInfo(note.type).label);
const aisleFor = (name: string) => {
  const s = name.toLowerCase();
  if (
    /apple|banana|tomato|lettuce|potato|onion|fruit|vegetable|salad|carrot|pepper/.test(
      s,
    )
  )
    return "Produce";
  if (/milk|cheese|yogurt|yoghurt|butter|cream|egg/.test(s))
    return "Dairy & eggs";
  if (/bread|bun|bagel|croissant|bakery/.test(s)) return "Bakery";
  if (/chicken|beef|fish|pork|meat|salmon|shrimp/.test(s))
    return "Meat & seafood";
  if (/ice cream|frozen|pizza/.test(s)) return "Frozen";
  if (/soap|detergent|tissue|toilet paper|cleaner|sponge|shampoo/.test(s))
    return "Household";
  if (/rice|pasta|flour|sugar|oil|beans|cereal|coffee|tea|sauce|canned/.test(s))
    return "Pantry";
  return "Other";
};
const money = (n: number) => "€" + n.toFixed(2);

function Glyph({
  type,
  size = 22,
  color,
}: {
  type: NoteType;
  size?: number;
  color?: string;
}) {
  const meta = typeInfo(type);
  if (type === "quote")
    return <Quote size={size} color={color || meta.color} strokeWidth={1.8} />;
  return (
    <Text
      style={{
        fontSize: size,
        color: color || meta.color,
        fontWeight: "600",
        lineHeight: size + 5,
      }}
    >
      {meta.glyph}
    </Text>
  );
}
function Button({
  title,
  onPress,
  icon,
  subtle = false,
  danger = false,
}: {
  title: string;
  onPress: () => void;
  icon?: React.ReactNode;
  subtle?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        subtle && s.buttonSubtle,
        danger && s.buttonDanger,
        pressed && s.pressed,
      ]}
    >
      {icon}
      {
        <Text
          style={[
            s.buttonText,
            subtle && { color: C.cream },
            danger && { color: C.red },
          ]}
        >
          {title}
        </Text>
      }
    </Pressable>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <NotifyApp />
    </SafeAreaProvider>
  );
}

function NotifyApp() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const editorPadding = pageInset(Math.min(screenWidth, 760));
  const contentWidth = Math.min(screenWidth, 960);
  const sidePad = pageInset(contentWidth);
  const innerWidth = contentWidth - sidePad * 2;
  const quickColumns = innerWidth >= 640 ? 4 : 2;
  const cardWidth = (innerWidth - (quickColumns - 1) * 10) / quickColumns;
  const twoColumnNotes = innerWidth >= 640;
  const [themeName, setThemeName] = useState<ThemeName>("espresso");
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");
  const palette = PALETTES[themeName];
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [startupVisible, setStartupVisible] = useState(true);
  const finishStartup = useCallback(() => setStartupVisible(false), []);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryCategory>("all");
  const [editor, setEditor] = useState(false);
  const [draft, setDraft] = useState<Note>(emptyNote());
  const [newItem, setNewItem] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const shoppingPriceRef = useRef<TextInput>(null);
  const [homeSection, setHomeSection] = useState<"library" | "create">(
    "library",
  );
  const [reminderPicker, setReminderPicker] = useState(false);
  const [dueReminders, setDueReminders] = useState<Note[]>([]);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const [drafts, setDrafts] = useState<Note[]>([]),
    [draftStatus, setDraftStatus] = useState("");
  const [view, setView] = useState<"notes" | "today" | "upcoming">("notes");
  const [viewPicker, setViewPicker] = useState(false);
  const [organizing, setOrganizing] = useState(false),
    [dataPanel, setDataPanel] = useState(false);
  const [drawingPicker, setDrawingPicker] = useState(false);
  const [draggingDrawing, setDraggingDrawing] = useState(false);
  const [message, setMessage] = useState(""),
    [recentTrash, setRecentTrash] = useState<Note | null>(null),
    [showAllDrafts, setShowAllDrafts] = useState(false);
  const [now, setNow] = useState(Date.now());
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const draftVersion = useRef(0);
  const activeNotes = useMemo(
    () => libraryNotes(notes, drafts),
    [notes, drafts],
  );
  const reloadLibrary = async () => {
    const [saved, recovered] = await Promise.all([loadNotes(), loadDrafts()]);
    setNotes(saved);
    setDrafts(
      recovered.filter(
        (d) =>
          hasContent(d) && !saved.some((n) => n.id === d.id && !!n.deletedAt),
      ),
    );
  };
  useEffect(() => {
    prepareFocusStyles();
    const unsubscribe = subscribeToReminders((note) => {
      setNow(Date.now());
      setReminderPicker(false);
      setOrganizing(false);
      setDataPanel(false);
      setViewPicker(false);
      setDueReminders((current) => [
        ...current.filter((item) => item.id !== note.id),
        note,
      ]);
    });
    reloadLibrary()
      .catch((err) => setMessage("Could not load your library: " + String(err)))
      .finally(() => setLoaded(true));
    getSetting("theme", "espresso")
      .then((value) => {
        const next = value === "goldenHour" ? "daydream" : value;
        if (THEME_NAMES.includes(next as ThemeName))
          setThemeName(next as ThemeName);
        if (value === "goldenHour") return setSetting("theme", "daydream");
      })
      .catch(console.warn)
      .finally(() => setThemeLoaded(true));
    prepareNotifications().catch(console.warn);
    const clock = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      unsubscribe();
      clearInterval(clock);
    };
  }, []);

  const chooseTheme = (next: ThemeName) => {
    setThemeName(next);
    setSetting("theme", next).catch((err) =>
      console.warn("Could not save theme preference", err),
    );
  };
  const checkForUpdates = async () => {
    setUpdateMessage(
      "Opening Notify releases so you can check the latest build.",
    );
    try {
      await Linking.openURL("https://github.com/Filz249/Notify-app/releases");
    } catch {
      Alert.alert(
        "Could not open updates",
        "Please open the Notify GitHub releases page in your browser.",
      );
    }
  };
  const downloadLatest = async () => {
    setUpdateMessage(
      "Opening the latest Android APK download. Android will ask you to confirm installation.",
    );
    try {
      await Linking.openURL(
        "https://github.com/Filz249/Notify-app/releases/download/android-latest/app-release.apk",
      );
    } catch {
      Alert.alert(
        "Could not open download",
        "Please download the latest APK from the Notify GitHub releases page.",
      );
    }
  };

  const patch = (change: Partial<Note>) => {
    const updated = { ...draftRef.current, ...change, updatedAt: Date.now() };
    const next =
      change.important === undefined
        ? updated
        : withImportance(updated, change.important);
    draftRef.current = next;
    setDraft(next);
    const version = ++draftVersion.current;
    setDraftStatus("Saving draft…");
    setDrafts((all) =>
      hasContent(next)
        ? [next, ...all.filter((n) => n.id !== next.id)]
        : all.filter((n) => n.id !== next.id),
    );
    const write = saveDraft(next);
    void write
      .then(() => {
        if (draftVersion.current === version) setDraftStatus("Draft saved");
      })
      .catch(() => {
        if (draftVersion.current === version)
          setDraftStatus(
            "Draft could not be saved. Please keep this page open.",
          );
      });
    return write;
  };
  const canDictate = ["note", "brainstorm", "poem", "lyrics", "quote"].includes(
    draft.type,
  );
  const dictation = useDictation({
    noteId: draft.id,
    enabled: editor && canDictate,
    onText: (text, noteId) => {
      if (canDictate && draftRef.current.id === noteId) {
        void patch({ body: appendDictation(draftRef.current.body, text) });
      }
    },
  });
  const voiceInput = canDictate ? (
    <VoiceInput dictation={dictation} palette={palette} disabled={saving} />
  ) : null;
  const voiceStatus = canDictate ? (
    <VoiceInputStatus dictation={dictation} palette={palette} />
  ) : null;
  const openNew = async (type: NoteType = "note") => {
    if (saving) return;
    await dictation.stop();
    setHomeSection("create");
    const next = emptyNote(type);
    draftRef.current = next;
    setDraft(next);
    draftVersion.current++;
    setDraftStatus("");
    setSaveError("");
    setReminderPicker(false);
    setOrganizing(false);
    setNewItem("");
    setNewPrice("");
    setEditor(true);
  };
  const openEdit = async (note: Note, preferGiven = false) => {
    if (saving) return;
    await dictation.stop();
    const recovered = preferGiven
        ? undefined
        : editor && note.id === draftRef.current.id
          ? draftRef.current
          : drafts.find((n) => n.id === note.id),
      next = recovered || note;
    draftRef.current = {
      ...next,
      items: [...next.items],
      sketchPaths: [...next.sketchPaths],
    };
    setDraft(draftRef.current);
    draftVersion.current++;
    setDraftStatus(recovered ? "Draft restored" : "");
    setSaveError("");
    setReminderPicker(false);
    setOrganizing(false);
    setNewItem("");
    setNewPrice("");
    setEditor(true);
  };
  const closeEditor = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await dictation.stop();
      await flushDrafts();
      setEditor(false);
    } catch {
      setSaveError("Your draft could not be saved. Try Save before leaving.");
    } finally {
      setSaving(false);
    }
  };
  const pasteDrawing = async (chosen: Note | null) => {
    await dictation.stop();
    await flushDrafts();
    const source = draftRef.current;
    const target = chosen
      ? drafts.find((n) => n.id === chosen.id) || chosen
      : emptyNote("note");
    if (!supportsDrawings(target))
      throw new Error("Choose a writing note for this drawing.");
    if ((target.drawingOverlays?.length || 0) >= 20)
      throw new Error(
        "This note already has 20 drawings. Remove one before adding another.",
      );
    const overlay = createDrawingOverlay(
      source,
      makeId(),
      target.drawingOverlays?.length || 0,
    );
    const next = {
      ...target,
      drawingOverlays: [...(target.drawingOverlays || []), overlay],
      updatedAt: Date.now(),
    };
    await saveDraft(next);
    setDrafts((all) => [next, ...all.filter((n) => n.id !== next.id)]);
    await openEdit(next, true);
    setDraftStatus("Drawing pasted · long-press to move");
    setHomeSection("library");
    setView("notes");
    setFilter("all");
    setQuery("");
    setDrawingPicker(false);
  };

  const rememberInState = (note: Note) => {
    setNow(Date.now());
    setNotes((all) =>
      [note, ...all.filter((n) => n.id !== note.id)].sort(
        (a, b) => b.updatedAt - a.updatedAt,
      ),
    );
  };
  const applyOrganization = async (collection: string, tags: string[]) => {
    const change = organizationChange(draftRef.current, collection, tags);
    await patch(change);
    const source = draftRef.current;
    const saved = (await loadNotes()).find((note) => note.id === source.id);
    if (saved && !saved.deletedAt) {
      const organized = {
        ...withDraftOrganization(saved, source),
        updatedAt: Date.now(),
      };
      await saveNote(organized);
      rememberInState(organized);
    }
    setOrganizing(false);
  };
  const save = async () => {
    if (saving) return;
    setSaveError("");
    setSaving(true);
    try {
      await dictation.stop();
      const source = draftRef.current,
        version = draftVersion.current;
      if (source.type === "quote" && !source.body.trim()) {
        setSaveError("Add a quote before saving.");
        return;
      }
      if (!hasContent(source)) {
        setSaveError("Add a title, some text, a list item or a sketch first.");
        return;
      }
      if (
        source.reminderAt &&
        source.reminderAt <= Date.now() &&
        (!source.reminderRepeat || source.reminderRepeat === "none") &&
        !notes.some(
          (n) => n.id === source.id && n.reminderAt === source.reminderAt,
        )
      ) {
        setSaveError(
          "Your reminder time has passed. Choose a later time before saving.",
        );
        return;
      }
      await flushDrafts();
      const base = {
        ...source,
        important: isImportant(source),
        title: source.title.trim(),
        ...(source.type === "quote"
          ? { quoteAuthor: source.quoteAuthor?.trim() }
          : {}),
        updatedAt: Date.now(),
        notificationId:
          notes.find((n) => n.id === source.id)?.notificationId ||
          source.notificationId,
      };
      const notificationId = await syncReminder(base),
        finalNote = { ...base, notificationId };
      await saveNote(finalNote);
      rememberInState(finalNote);
      if (version === draftVersion.current) {
        await removeDraft(finalNote.id);
        setDrafts((all) => all.filter((n) => n.id !== finalNote.id));
        setEditor(false);
        if (homeSection === "create") {
          setHomeSection("library");
          setView("notes");
          setFilter("all");
          setQuery("");
        }
      } else
        setSaveError(
          "Saved the earlier version. Your latest changes are still a draft.",
        );
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Could not save your note.",
      );
    } finally {
      setSaving(false);
    }
  };
  const remove = async (note: Note) => {
    if (saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await dictation.stop();
      if (editor && note.id === draftRef.current.id) note = draftRef.current;
      await flushDrafts();
      await cancelReminder(
        notes.find((n) => n.id === note.id)?.notificationId ||
          note.notificationId,
      );
      const deleted = {
        ...note,
        deletedAt: Date.now(),
        updatedAt: Date.now(),
        notificationId: undefined,
      };
      await saveNote(deleted);
      await removeDraft(note.id);
      rememberInState(deleted);
      setDrafts((all) => all.filter((n) => n.id !== note.id));
      setRecentTrash(deleted);
      setMessage("Moved to Trash.");
      setEditor(false);
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "Could not move this note to Trash.",
      );
    } finally {
      setSaving(false);
    }
  };
  const restore = async (note: Note) => {
    const restored: Note = {
      ...note,
      deletedAt: undefined,
      notificationId: undefined,
      updatedAt: Date.now(),
    };
    restored.notificationId = await syncReminder(restored);
    await saveNote(restored);
    rememberInState(restored);
    setRecentTrash(null);
    setMessage("Note restored.");
  };
  const toggleImportant = async (note: Note) => {
    const next = {
      ...withImportance(note, !isImportant(note)),
      updatedAt: Date.now(),
    };
    try {
      if (notes.some((saved) => saved.id === next.id)) {
        await saveNote(next);
        rememberInState(next);
      }
      const updateStar = (all: Note[]) =>
        all.map((item) =>
          item.id === next.id ? withImportance(item, next.important) : item,
        );
      await updateDrafts(updateStar);
      setDrafts(updateStar);
    } catch {
      setMessage("Could not update this note.");
    }
  };
  const snooze = async (note: Note, minutes: number) => {
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      const current = (await loadNotes()).find(
        (n) => n.id === note.id && !n.deletedAt,
      );
      if (!current) {
        setDueReminders((all) => all.filter((n) => n.id !== note.id));
        return;
      }
      const next = {
        ...current,
        snoozedUntil: Date.now() + minutes * 60000,
        reminderCompletedAt: Date.now(),
        updatedAt: Date.now(),
      };
      next.notificationId = await syncReminder(next);
      await saveNote(next);
      rememberInState(next);
      setDueReminders((all) => all.filter((n) => n.id !== note.id));
      setMessage(
        `Snoozed for ${minutes === 60 ? "1 hour" : minutes + " minutes"}.`,
      );
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not snooze this reminder.",
      );
    } finally {
      setSaving(false);
    }
  };
  const dismissReminder = async (note: Note) => {
    try {
      const current = (await loadNotes()).find(
        (n) => n.id === note.id && !n.deletedAt,
      );
      if (current) {
        const next = {
          ...current,
          snoozedUntil: undefined,
          reminderCompletedAt: Date.now(),
        };
        next.notificationId = await syncReminder(next);
        await saveNote(next);
        rememberInState(next);
      }
      setDueReminders((all) => all.filter((n) => n.id !== note.id));
    } catch {
      setMessage("Could not dismiss the reminder.");
    }
  };
  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    const item: ListItem = {
      id: makeId(),
      text,
      checked: false,
      ...(draft.type === "shopping"
        ? {
            category: aisleFor(text),
            price: Math.max(0, Number(newPrice.replace(",", ".")) || 0),
            quantity: 1,
          }
        : {}),
    };
    patch({ items: [...draft.items, item] });
    setNewItem("");
    setNewPrice("");
  };
  const patchItem = (id: string, change: Partial<ListItem>) =>
    patch({
      items: draft.items.map((it) =>
        it.id === id ? { ...it, ...change } : it,
      ),
    });
  const groupedItems = useMemo(() => {
    const groups: Record<string, ListItem[]> = {};
    draft.items.forEach((it) => {
      const key = draft.type === "shopping" ? it.category || "Other" : "Items";
      (groups[key] ||= []).push(it);
    });
    return groups;
  }, [draft.items, draft.type]);
  const shoppingTotal = draft.items.reduce(
    (sum, it) => sum + (it.price || 0) * (it.quantity || 1),
    0,
  );
  const matchesLibrary = (n: Note) => {
    if (n.deletedAt) return false;
    const haystack = [
      n.title,
      n.body,
      n.quoteAuthor || "",
      n.collection || "",
      ...(n.tags || []),
      ...n.items.map((i) => i.text),
    ]
      .join(" ")
      .toLowerCase();
    if (query.trim() && !haystack.includes(query.toLowerCase().trim()))
      return false;
    return matchesCategory(n, filter);
  };
  const visibleDrafts = drafts.filter(matchesLibrary);
  const filtered = useMemo(
    () =>
      activeNotes
        .filter(
          (n) =>
            matchesLibrary(n) &&
            (view === "notes" ||
              (notes.some((saved) => saved.id === n.id) &&
                matchesAgenda(n, view, now))),
        )
        .sort((a, b) =>
          view === "notes"
            ? Number(isImportant(b)) - Number(isImportant(a)) ||
              b.updatedAt - a.updatedAt
            : (agendaAt(a, now) || Infinity) - (agendaAt(b, now) || Infinity),
        ),
    [activeNotes, notes, query, filter, view, now],
  );

  const renderNote = (note: Note) => {
    const info = typeInfo(note.type);
    const checked = note.items.filter((i) => i.checked).length;
    const isDraft = !notes.some((saved) => saved.id === note.id);
    return (
      <View
        key={note.id}
        style={{ width: twoColumnNotes ? (innerWidth - 16) / 2 : "100%" }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Open " + noteName(note)}
          onPress={() => openEdit(note)}
          style={({ pressed }) => [
            s.noteCard,
            {
              width: "100%",
              backgroundColor: palette.panel,
              borderColor: palette.line,
            },
            pressed && s.pressed,
          ]}
        >
          <View style={[s.noteStripe, { backgroundColor: info.color }]} />
          <View style={s.noteContent}>
            <View style={[s.noteTop, { paddingRight: 38 }]}>
              <View
                style={[
                  s.noteGlyph,
                  {
                    backgroundColor: palette.panel2,
                    borderColor: info.color + "66",
                  },
                ]}
              >
                <Glyph type={note.type} size={21} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={[s.noteTitle, { color: palette.cream }]}
                >
                  {note.title || info.label}
                </Text>
                <Text style={[s.noteMeta, { color: palette.muted }]}>
                  {isDraft ? "Draft · " : ""}
                  {info.label} · {new Date(note.updatedAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
            {note.collection || note.tags?.length ? (
              <Text
                numberOfLines={1}
                style={[s.noteOrganization, { color: palette.accent }]}
              >
                {[note.collection, ...(note.tags || []).map((t) => "#" + t)]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : null}
            {agendaAt(note, now) ? (
              <Text style={[s.noteDue, { color: palette.accent }]}>
                {(agendaAt(note, now)! < now ? "Overdue · " : "") +
                  new Date(agendaAt(note, now)!).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                {note.reminderRepeat && note.reminderRepeat !== "none"
                  ? " · " + note.reminderRepeat
                  : ""}
              </Text>
            ) : note.reminderAt && !note.notificationId ? (
              <Text style={[s.noteDue, { color: palette.muted }]}>
                Reminder paused
              </Text>
            ) : null}
            {note.type === "quote" ? (
              <QuotePreview
                value={note.body}
                author={note.quoteAuthor}
                palette={palette}
              />
            ) : note.type === "checklist" ||
              note.type === "todo" ||
              note.type === "shopping" ? (
              <Text style={[s.preview, { color: palette.muted }]}>
                {checked}/{note.items.length} completed
                {note.type === "shopping"
                  ? " · " +
                    money(
                      note.items.reduce(
                        (sum, item) =>
                          sum + (item.price || 0) * (item.quantity || 1),
                        0,
                      ),
                    )
                  : ""}
              </Text>
            ) : (
              <Text
                numberOfLines={3}
                style={[s.preview, { color: palette.muted }]}
              >
                {note.body ||
                  (note.type === "sketch"
                    ? "A little drawing saved here"
                    : "Tap to add your thoughts…")}
              </Text>
            )}
            {note.drawingOverlays?.length ? (
              <Text style={[s.noteOrganization, { color: palette.muted }]}>
                {note.drawingOverlays.length}{" "}
                {note.drawingOverlays.length === 1
                  ? "drawing overlay"
                  : "drawing overlays"}
              </Text>
            ) : null}
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            (isImportant(note) ? "Unmark " : "Mark ") +
            noteName(note) +
            " important"
          }
          hitSlop={10}
          onPress={(e) => {
            e.stopPropagation();
            void toggleImportant(note);
          }}
          style={[
            s.starHit,
            {
              position: "absolute",
              top: 12,
              right: 10,
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            },
          ]}
        >
          <Star
            size={19}
            color={isImportant(note) ? C.amber : C.muted}
            fill={isImportant(note) ? C.amber : "transparent"}
          />
        </Pressable>
      </View>
    );
  };

  const reminderAlert = dueReminders.length ? (
    <Modal
      visible={dueReminders.length > 0}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (dueReminders[0]) void dismissReminder(dueReminders[0]);
      }}
    >
      <View style={s.reminderAlertShade}>
        <View
          accessibilityRole="alert"
          style={[
            s.reminderAlert,
            { backgroundColor: palette.panel, borderColor: palette.accent },
          ]}
        >
          <AlarmClock color={palette.accent} size={26} />
          <Text style={[s.sectionTitle, { color: palette.cream }]}>
            A little reminder
          </Text>
          <Text style={[s.reminderAlertBody, { color: palette.cream }]}>
            {dueReminders[0]?.title ||
              dueReminders[0]?.body ||
              "You saved a reminder."}
          </Text>
          {message ? (
            <Text style={[s.noteMeta, { color: palette.muted }]}>
              {message}
            </Text>
          ) : null}
          <View style={s.snoozeRow}>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void snooze(dueReminders[0], 10)}
              style={[s.snoozeButton, { backgroundColor: palette.panel2 }]}
            >
              <Text style={[s.buttonText, { color: palette.cream }]}>
                Snooze 10 min
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void snooze(dueReminders[0], 60)}
              style={[s.snoozeButton, { backgroundColor: palette.panel2 }]}
            >
              <Text style={[s.buttonText, { color: palette.cream }]}>
                Snooze 1 hour
              </Text>
            </Pressable>
          </View>
          <Button
            title={
              dueReminders.length > 1
                ? `Next (${dueReminders.length - 1} more)`
                : "Got it"
            }
            onPress={() => void dismissReminder(dueReminders[0])}
          />
        </View>
      </View>
    </Modal>
  ) : null;

  if (startupVisible) {
    return (
      <LoadingScreen
        ready={loaded && themeLoaded}
        palette={palette}
        statusBarStyle={palette.light ? "dark" : "light"}
        onFinish={finishStartup}
        onLayout={revealStartup}
      />
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: palette.bg }]}>
      <StatusBar style={palette.light ? "dark" : "light"} />
      <ScrollView
        key={homeSection}
        style={s.homeScroll}
        contentContainerStyle={s.homeScrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[s.homeShell, { paddingHorizontal: sidePad }]}>
          <View style={s.homeHeader}>
            <View>
              <View style={s.brandRow}>
                <Svg
                  width={31}
                  height={34}
                  viewBox="0 0 34 38"
                  style={{ marginRight: 6 }}
                >
                  <Path
                    d="M7 2h18a5 5 0 0 1 5 5v24a4 4 0 0 1-4 4H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z"
                    fill={palette.accent}
                  />
                  <Path
                    d="M8 10h14M8 15h11M8 20h8"
                    stroke={palette.bg}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <Path
                    d="m17 28 8-8 4 4-8 8-5 1Z"
                    fill={palette.cream}
                    stroke={palette.bg}
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={[s.brand, { color: palette.cream }]}>Notify</Text>
                <View
                  style={[s.brandDot, { backgroundColor: palette.accent }]}
                />
              </View>
              <Text style={[s.tagline, { color: palette.muted }]}>
                Your ideas, remembered.
              </Text>
            </View>
            <View style={s.headerActions}>
              <View
                accessibilityLabel={`${activeNotes.filter(isImportant).length} important notes`}
                style={[
                  s.headerBadge,
                  { backgroundColor: palette.panel, borderColor: palette.line },
                ]}
              >
                <Star color={palette.accent} size={16} />
                <Text style={[s.headerBadgeText, { color: palette.cream }]}>
                  {activeNotes.filter(isImportant).length}
                  {screenWidth >= 440 ? " important" : ""}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open settings"
                onPress={() => setSettingsVisible(true)}
                style={({ pressed }) => [
                  s.settingsButton,
                  { backgroundColor: palette.panel, borderColor: palette.line },
                  pressed && s.pressed,
                ]}
              >
                <Settings color={palette.cream} size={20} />
              </Pressable>
            </View>
          </View>
          {homeSection === "library" ? (
            <>
              <View
                style={[
                  s.searchWrap,
                  { backgroundColor: palette.panel, borderColor: palette.line },
                ]}
              >
                <Search color={palette.muted} size={19} />
                <TextInput
                  accessibilityLabel="Search notes"
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search notes, lists, ideas…"
                  placeholderTextColor={palette.muted}
                  style={[
                    s.searchInput,
                    {
                      color: palette.cream,
                      outlineWidth: 0,
                      outlineStyle: "solid",
                    },
                  ]}
                />
              </View>

              {message ? (
                <View style={[s.notice, { backgroundColor: palette.panel }]}>
                  <Text
                    accessibilityLiveRegion="polite"
                    style={[s.noticeText, { color: palette.cream }]}
                  >
                    {message}
                  </Text>
                  {recentTrash ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        void restore(recentTrash).catch((e) =>
                          setMessage(String(e)),
                        )
                      }
                    >
                      <Text
                        style={{ color: palette.accent, fontWeight: "600" }}
                      >
                        Undo
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Dismiss message"
                      onPress={() => setMessage("")}
                    >
                      <X size={16} color={palette.muted} />
                    </Pressable>
                  )}
                </View>
              ) : null}
              {view === "notes" && visibleDrafts.length ? (
                <View style={s.draftShelf}>
                  <View style={s.draftHead}>
                    <Text style={[s.sectionTitle, { color: palette.cream }]}>
                      Continue writing
                    </Text>
                    <Text style={[s.sectionSub, { color: palette.muted }]}>
                      {visibleDrafts.length}{" "}
                      {visibleDrafts.length === 1 ? "draft" : "drafts"}
                    </Text>
                  </View>
                  {(showAllDrafts
                    ? visibleDrafts
                    : visibleDrafts.slice(0, 3)
                  ).map((item) => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={"Resume draft " + noteName(item)}
                      key={item.id}
                      onPress={() => openEdit(item)}
                      style={[s.draftCard, { backgroundColor: palette.panel }]}
                    >
                      <Glyph type={item.type} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          numberOfLines={1}
                          style={[s.draftTitle, { color: palette.cream }]}
                        >
                          {item.type === "quote"
                            ? noteName(item)
                            : item.title ||
                              "Untitled " +
                                typeInfo(item.type).label.toLowerCase()}
                        </Text>
                        <Text style={[s.noteMeta, { color: palette.muted }]}>
                          Saved draft · tap to resume
                        </Text>
                      </View>
                      <ChevronRight size={18} color={palette.muted} />
                    </Pressable>
                  ))}
                  {visibleDrafts.length > 3 ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setShowAllDrafts(!showAllDrafts)}
                    >
                      <Text style={{ color: palette.accent }}>
                        {showAllDrafts
                          ? "Show fewer drafts"
                          : "Show all drafts"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              <View style={s.sectionHead}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose library view"
                  onPress={() => setViewPicker(true)}
                  style={s.viewMenu}
                >
                  <Text style={[s.sectionTitle, { color: palette.cream }]}>
                    {view === "today"
                      ? "Today"
                      : view === "upcoming"
                        ? "Coming up"
                        : "Your notes"}
                  </Text>
                  <ChevronDown size={18} color={palette.muted} />
                </Pressable>
                <Text style={[s.sectionSub, { color: palette.muted }]}>
                  {filtered.length}{" "}
                  {view === "notes"
                    ? filtered.length === 1
                      ? "note"
                      : "notes"
                    : "to remember"}
                </Text>
              </View>
              <View style={s.filters}>
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "important", label: "★ Important" },
                    { id: "tasks", label: "Tasks" },
                    { id: "personal", label: "Personal" },
                    { id: "creative", label: "Creative" },
                  ] as const
                ).map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: filter === item.id }}
                    onPress={() => setFilter(item.id)}
                    style={({ pressed }) => [
                      s.filterChip,
                      {
                        paddingHorizontal:
                          innerWidth < 340 ? 5 : innerWidth < 370 ? 8 : 10,
                        backgroundColor: palette.panel,
                        borderColor: palette.line,
                      },
                      filter === item.id && {
                        backgroundColor: palette.accent,
                        borderColor: palette.accent,
                      },
                      pressed && s.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        s.filterText,
                        {
                          color: palette.muted,
                          fontSize: innerWidth < 340 ? 11 : 12,
                        },
                        filter === item.id && { color: palette.bg },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {!loaded ? (
                <Text style={s.emptyText}>Loading your notes…</Text>
              ) : filtered.length === 0 ? (
                <View
                  style={[
                    s.emptyState,
                    {
                      backgroundColor: palette.panel,
                      borderColor: palette.line,
                    },
                  ]}
                >
                  <View
                    style={[
                      s.emptyIcon,
                      {
                        backgroundColor: palette.panel2,
                        borderColor: palette.line,
                      },
                    ]}
                  >
                    <FileText color={palette.accent} size={26} />
                  </View>
                  <Text style={[s.emptyTitle, { color: palette.cream }]}>
                    {view === "today"
                      ? "A little breathing room"
                      : view === "upcoming"
                        ? "Nothing coming up yet"
                        : query || filter !== "all"
                          ? "No notes here yet"
                          : "Room for your next idea"}
                  </Text>
                  <Text style={[s.emptyText, { color: palette.muted }]}>
                    {view === "today"
                      ? "No reminders or unfinished tasks for today."
                      : view === "upcoming"
                        ? "Set a reminder in a note to see it here."
                        : query
                          ? "Try a different word or a shorter search."
                          : filter === "personal"
                            ? "Open a note, tap Organize, and choose Personal."
                            : filter !== "all"
                              ? "Try another filter, or create something new."
                              : "A thought, a list, a little inspiration.\nGive it a place to stay."}
                  </Text>
                  <Button
                    title={
                      activeNotes.length
                        ? "Create a note"
                        : "Create your first note"
                    }
                    icon={<Plus color={C.bg} size={18} />}
                    onPress={() => openNew()}
                  />
                </View>
              ) : (
                <View style={s.noteGrid}>{filtered.map(renderNote)}</View>
              )}
            </>
          ) : null}
          {homeSection === "create" ? (
            <>
              <View style={[s.sectionHead, { marginTop: 0 }]}>
                <Text style={[s.sectionTitle, { color: palette.cream }]}>
                  Quick create
                </Text>
                <Text style={[s.sectionSub, { color: palette.muted }]}>
                  Choose a format
                </Text>
              </View>
              <View style={s.quickRow}>
                {TYPES.map((type) => (
                  <Pressable
                    key={type.id}
                    accessibilityRole="button"
                    accessibilityLabel={"Create " + type.label.toLowerCase()}
                    onPress={() => openNew(type.id)}
                    style={({ pressed }) => [
                      s.quickCard,
                      {
                        width: cardWidth,
                        backgroundColor: palette.panel,
                        borderColor: palette.line,
                        borderBottomColor: type.color,
                      },
                      pressed && s.pressed,
                    ]}
                  >
                    <View
                      style={[
                        s.quickGlyph,
                        { backgroundColor: type.color + "1D" },
                      ]}
                    >
                      <Glyph type={type.id} size={25} />
                    </View>
                    <Text style={[s.quickLabel, { color: palette.cream }]}>
                      {type.label}
                    </Text>
                    <Text style={[s.createHint, { color: palette.muted }]}>
                      {type.id === "shopping"
                        ? "Plan your next trip"
                        : type.id === "sketch"
                          ? "Draw an idea"
                          : type.id === "brainstorm"
                            ? "Explore a possibility"
                            : type.id === "lyrics"
                              ? "Find your next verse"
                              : type.id === "poem"
                                ? "Let the words arrive"
                                : type.id === "quote"
                                  ? "Keep words you love"
                                  : type.id === "todo"
                                    ? "One thing at a time"
                                    : "Capture a thought"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
      <View
        accessibilityRole="tablist"
        accessibilityLabel="App sections"
        style={[s.mainNavigation, { backgroundColor: palette.bg }]}
      >
        {(["library", "create"] as const).map((section) => (
          <Pressable
            key={section}
            accessibilityRole="tab"
            accessibilityLabel={
              section === "library" ? "Library section" : "Create section"
            }
            accessibilityState={{ selected: homeSection === section }}
            onPress={() => setHomeSection(section)}
            style={[
              s.navItem,
              homeSection === section && { backgroundColor: palette.panel },
            ]}
          >
            {section === "library" ? (
              <FileText
                size={19}
                color={homeSection === section ? palette.accent : palette.muted}
              />
            ) : (
              <Plus
                size={20}
                color={homeSection === section ? palette.accent : palette.muted}
              />
            )}
            <Text
              style={[
                s.navLabel,
                {
                  color:
                    homeSection === section ? palette.accent : palette.muted,
                },
              ]}
            >
              {section === "library" ? "Library" : "Create"}
            </Text>
          </Pressable>
        ))}
      </View>

      {viewPicker ? (
        <Sheet
          title="Show in your library"
          palette={palette}
          onClose={() => setViewPicker(false)}
        >
          {(["notes", "today", "upcoming"] as const).map((choice) => (
            <Action
              key={choice}
              label={
                choice === "notes"
                  ? "All notes"
                  : choice === "today"
                    ? "Today"
                    : "Upcoming"
              }
              palette={palette}
              secondary={view !== choice}
              onPress={() => {
                setView(choice);
                setFilter("all");
                setViewPicker(false);
              }}
            />
          ))}
        </Sheet>
      ) : null}
      <Modal
        visible={settingsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={s.settingsShade}>
          <View
            style={[
              s.settingsPanel,
              {
                backgroundColor: palette.panel,
                borderColor: palette.line,
                maxHeight: Math.min(screenHeight * 0.88, 720),
              },
            ]}
          >
            <View style={s.sheetHandle} />
            <View style={s.sheetHead}>
              <View>
                <Text style={[s.sheetTitle, { color: palette.cream }]}>
                  Settings
                </Text>
                <Text style={[s.settingsIntro, { color: palette.muted }]}>
                  Make Notify feel like yours
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close settings"
                onPress={() => setSettingsVisible(false)}
                style={s.dialogClose}
              >
                <X color={palette.muted} size={22} />
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 12 }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open Trash and backups"
                onPress={() => setDataPanel(true)}
                style={[
                  s.settingsAction,
                  { backgroundColor: palette.panel2, marginBottom: 16 },
                ]}
              >
                <Trash2 size={18} color={palette.accent} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[s.settingsActionTitle, { color: palette.cream }]}
                  >
                    Trash & backups
                  </Text>
                  <Text style={[s.settingsActionSub, { color: palette.muted }]}>
                    {notes.filter((n) => n.deletedAt).length} in Trash · export
                    or restore your library
                  </Text>
                </View>
                <ChevronRight size={18} color={palette.muted} />
              </Pressable>
              <View style={s.settingsSectionHead}>
                <Palette color={palette.accent} size={18} />
                <Text
                  style={[s.settingsSectionTitle, { color: palette.cream }]}
                >
                  Appearance
                </Text>
              </View>
              <Text style={[s.settingsHint, { color: palette.muted }]}>
                Choose a color theme. Your choice is saved on this device.
              </Text>
              <View style={s.themeChoices}>
                {THEME_NAMES.map((key) => {
                  const p = PALETTES[key];
                  const active = themeName === key;
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel={`${p.name} theme`}
                      accessibilityState={{ selected: active }}
                      onPress={() => chooseTheme(key)}
                      style={[
                        s.themeChoice,
                        {
                          backgroundColor: p.bg,
                          borderColor: active ? p.accent : p.line,
                        },
                      ]}
                    >
                      <View
                        style={[
                          s.themePreview,
                          { backgroundColor: p.panel, borderColor: p.line },
                        ]}
                      >
                        <View
                          style={[
                            s.themePreviewLine,
                            { backgroundColor: p.accent },
                          ]}
                        />
                        <View
                          style={[
                            s.themePreviewLine,
                            { backgroundColor: p.muted, width: "65%" },
                          ]}
                        />
                        <View
                          style={[
                            s.themePreviewChip,
                            { backgroundColor: p.panel2 },
                          ]}
                        />
                        {active ? (
                          <CheckCircle2
                            style={s.themeCheck}
                            size={15}
                            color={p.accent}
                            fill={p.bg}
                          />
                        ) : null}
                      </View>
                      <View style={s.themeChoiceFooter}>
                        <Text style={[s.themeChoiceLabel, { color: p.cream }]}>
                          {p.name}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <View
                style={[s.settingsDivider, { backgroundColor: palette.line }]}
              />
              <View style={s.settingsSectionHead}>
                <Mic color={palette.accent} size={18} />
                <Text
                  style={[s.settingsSectionTitle, { color: palette.cream }]}
                >
                  Dictation language
                </Text>
              </View>
              <VoiceLanguage dictation={dictation} palette={palette} />
              <View
                style={[s.settingsDivider, { backgroundColor: palette.line }]}
              />
              <View style={s.settingsSectionHead}>
                <Download color={palette.accent} size={18} />
                <Text
                  style={[s.settingsSectionTitle, { color: palette.cream }]}
                >
                  Updates
                </Text>
              </View>
              <Text style={[s.settingsHint, { color: palette.muted }]}>
                Check the latest release or open the APK download. Android
                requires you to confirm installing an update.
              </Text>
              <Pressable
                onPress={checkForUpdates}
                style={[
                  s.settingsAction,
                  {
                    borderColor: palette.line,
                    backgroundColor: palette.panel2,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[s.settingsActionTitle, { color: palette.cream }]}
                  >
                    Check for updates
                  </Text>
                  <Text style={[s.settingsActionSub, { color: palette.muted }]}>
                    Open Notify releases in your browser
                  </Text>
                </View>
                <ExternalLink color={palette.muted} size={18} />
              </Pressable>
              <Pressable
                onPress={downloadLatest}
                style={[
                  s.settingsAction,
                  {
                    borderColor: palette.accent,
                    backgroundColor: palette.accent,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.settingsActionTitle, { color: palette.bg }]}>
                    Download latest APK
                  </Text>
                  <Text
                    style={[
                      s.settingsActionSub,
                      { color: palette.bg, opacity: 0.8 },
                    ]}
                  >
                    Install manually after downloading
                  </Text>
                </View>
                <Download color={palette.bg} size={18} />
              </Pressable>
              {updateMessage ? (
                <Text
                  style={[
                    s.settingsHint,
                    { color: palette.muted, marginTop: 9 },
                  ]}
                >
                  {updateMessage}
                </Text>
              ) : null}
              <View
                style={[s.settingsDivider, { backgroundColor: palette.line }]}
              />
              <Text style={[s.settingsFooter, { color: palette.muted }]}>
                Notify · version 0.2.0
              </Text>
              <Text style={[s.settingsHint, { color: palette.muted }]}>
                Updates are installed with your approval; this app cannot
                silently replace its own APK.
              </Text>
            </ScrollView>
          </View>
          {settingsVisible && !editor ? reminderAlert : null}
          {dataPanel ? (
            <DataPanel
              notes={notes}
              palette={palette}
              onClose={() => setDataPanel(false)}
              onChanged={reloadLibrary}
              onRestore={restore}
            />
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={editor}
        animationType="slide"
        onRequestClose={() => void closeEditor()}
      >
        <SafeAreaView style={[s.editorSafe, { backgroundColor: palette.bg }]}>
          <KeyboardAvoidingView
            style={s.editorShell}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View
              style={[
                s.editorHeader,
                {
                  backgroundColor: palette.bg,
                  borderBottomColor: palette.line,
                  paddingHorizontal: editorPadding,
                },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to notes"
                onPress={() => void closeEditor()}
                style={[
                  s.headerAction,
                  { backgroundColor: palette.panel, borderColor: palette.line },
                ]}
              >
                <ArrowLeft color={palette.cream} size={22} />
              </Pressable>
              <View style={s.editorHeaderTitle}>
                <Glyph type={draft.type} size={21} />
                <Text
                  numberOfLines={1}
                  style={[s.editorType, { color: palette.muted }]}
                >
                  {typeInfo(draft.type).label}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isImportant(draft) ? "Unmark important" : "Mark important"
                }
                onPress={() => patch({ important: !isImportant(draft) })}
                style={[
                  s.headerAction,
                  {
                    backgroundColor: isImportant(draft)
                      ? palette.panel2
                      : palette.panel,
                    borderColor: palette.line,
                  },
                  isImportant(draft) && s.starActive,
                ]}
              >
                <Star
                  color={isImportant(draft) ? palette.accent : palette.muted}
                  fill={isImportant(draft) ? palette.accent : "transparent"}
                  size={20}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={save}
                style={[
                  s.saveButton,
                  {
                    backgroundColor: palette.accent,
                    opacity: saving ? 0.65 : 1,
                  },
                ]}
              >
                <Check color={palette.bg} size={18} />
                <Text style={[s.saveButtonText, { color: palette.bg }]}>
                  {saving ? "Saving…" : "Save"}
                </Text>
              </Pressable>
            </View>
            <ScrollView
              testID="editor-scroll"
              scrollEnabled={!draggingDrawing}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                s.editorScroll,
                { paddingHorizontal: editorPadding },
              ]}
            >
              <View testID="title-section" style={s.titleSection}>
                <View style={s.titleRow}>
                  {draft.type === "quote" ? (
                    <Text style={[s.quoteHeading, { color: palette.cream }]}>
                      Your quote
                    </Text>
                  ) : (
                    <TitleField
                      value={draft.title}
                      onChange={(title) => patch({ title })}
                      placeholder={
                        draft.type === "shopping"
                          ? "Shopping for…"
                          : draft.type === "todo" || draft.type === "checklist"
                            ? "What’s on your list?"
                            : draft.type === "sketch"
                              ? "Name your sketch"
                              : "Give this a title"
                      }
                      color={palette.cream}
                      muted={palette.muted}
                    />
                  )}
                  {hasContent(draft) ? (
                    <Pressable
                      disabled={saving}
                      accessibilityRole="button"
                      accessibilityLabel="Move note to Trash"
                      onPress={() => void remove(draft)}
                      style={s.titleAction}
                    >
                      <Trash2 size={18} color={palette.muted} />
                    </Pressable>
                  ) : null}
                </View>
                <View style={s.editorMeta}>
                  <Text
                    accessibilityLiveRegion="polite"
                    style={[s.draftStatus, { color: palette.muted }]}
                  >
                    {draftStatus || "Drafts save automatically"}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Organize note"
                    onPress={() => setOrganizing(true)}
                    style={[
                      s.organizeButton,
                      { backgroundColor: palette.panel2 },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[s.organizeText, { color: palette.accent }]}
                    >
                      {draft.collection || "Organize"}
                      {draft.tags?.length
                        ? " · " + draft.tags.length + " tags"
                        : ""}
                    </Text>
                  </Pressable>
                </View>
                {saveError ? (
                  <Text accessibilityRole="alert" style={s.saveError}>
                    {saveError}
                  </Text>
                ) : null}
                {isImportant(draft) ? (
                  <View style={s.importantPill}>
                    <Star color={C.bg} fill={C.bg} size={13} />
                    <Text style={s.importantPillText}>Marked important</Text>
                  </View>
                ) : null}
              </View>
              {["checklist", "todo", "shopping"].includes(draft.type) ? (
                <View
                  testID="checklist-section"
                  style={[
                    s.listSection,
                    {
                      backgroundColor: palette.panel,
                      borderColor: palette.line,
                    },
                  ]}
                >
                  <View style={s.listHeading}>
                    <View style={s.listHeadingTitle}>
                      {draft.type === "shopping" ? (
                        <ShoppingBag
                          size={18}
                          color={typeInfo("shopping").color}
                        />
                      ) : (
                        <ListChecks size={19} color={typeInfo("todo").color} />
                      )}
                      <Text style={[s.listTitle, { color: palette.cream }]}>
                        {draft.type === "shopping"
                          ? "Shopping list"
                          : "Checklist"}
                      </Text>
                    </View>
                    <View
                      style={[
                        s.progressBadge,
                        { backgroundColor: palette.panel2 },
                      ]}
                    >
                      <Text style={[s.progressText, { color: palette.muted }]}>
                        {draft.items.filter((i) => i.checked).length} /{" "}
                        {draft.items.length}
                      </Text>
                    </View>
                  </View>
                  {draft.type === "shopping" ? (
                    <View style={s.totalRow}>
                      <Text style={[s.totalLabel, { color: palette.muted }]}>
                        Estimated total
                      </Text>
                      <Text style={[s.totalAmount, { color: palette.cream }]}>
                        {money(shoppingTotal)}
                      </Text>
                    </View>
                  ) : null}
                  {draft.items.length > 0 ? (
                    <View
                      style={[
                        s.progressTrack,
                        { backgroundColor: palette.line },
                      ]}
                    >
                      <View
                        style={{
                          height: 3,
                          borderRadius: 3,
                          backgroundColor: typeInfo(draft.type).color,
                          width: `${(draft.items.filter((i) => i.checked).length / draft.items.length) * 100}%`,
                        }}
                      />
                    </View>
                  ) : (
                    <View style={s.listEmpty}>
                      <Text
                        style={[s.listEmptyTitle, { color: palette.cream }]}
                      >
                        {draft.type === "shopping"
                          ? "A little list for your next trip."
                          : "One thing at a time."}
                      </Text>
                      <Text style={[s.listEmptyHint, { color: palette.muted }]}>
                        {draft.type === "shopping"
                          ? "Add what you need below."
                          : "Add a task, then enjoy checking it off."}
                      </Text>
                    </View>
                  )}
                  {Object.entries(groupedItems).map(([category, items]) => (
                    <View key={category}>
                      {draft.type === "shopping" ? (
                        <Text style={s.aisleTitle}>
                          {category.toUpperCase()}
                        </Text>
                      ) : null}
                      {items.map((item) => (
                        <View
                          key={item.id}
                          style={[
                            s.itemRow,
                            { borderBottomColor: palette.line },
                          ]}
                        >
                          <Pressable
                            accessibilityRole="checkbox"
                            accessibilityLabel={item.text}
                            accessibilityState={{ checked: item.checked }}
                            onPress={() =>
                              patchItem(item.id, { checked: !item.checked })
                            }
                            style={s.checkHit}
                          >
                            <View
                              style={[
                                s.checkBox,
                                { borderColor: palette.muted },
                                item.checked && s.checkBoxOn,
                              ]}
                            >
                              {item.checked ? (
                                <Check color={C.bg} size={14} />
                              ) : null}
                            </View>
                          </Pressable>
                          <Text
                            style={[
                              s.itemText,
                              {
                                color: item.checked
                                  ? palette.muted
                                  : palette.cream,
                              },
                              item.checked && s.itemDone,
                            ]}
                          >
                            {item.text}
                          </Text>
                          {draft.type === "shopping" ? (
                            <Text
                              style={[s.itemPrice, { color: palette.muted }]}
                            >
                              {item.price ? money(item.price) : "—"}
                            </Text>
                          ) : null}
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${item.text}`}
                            onPress={() =>
                              patch({
                                items: draft.items.filter(
                                  (i) => i.id !== item.id,
                                ),
                              })
                            }
                            style={s.removeItem}
                          >
                            <X color={palette.muted} size={16} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ))}
                  {draft.type === "shopping" ? (
                    <View testID="shopping-entry" style={s.shoppingEntry}>
                      <View style={s.shoppingFields}>
                        <View style={s.shoppingNameField}>
                          <Text
                            style={[
                              s.shoppingInputLabel,
                              { color: palette.muted },
                            ]}
                          >
                            Item
                          </Text>
                          <TextInput
                            accessibilityLabel="New shopping item"
                            value={newItem}
                            onChangeText={setNewItem}
                            onSubmitEditing={() =>
                              shoppingPriceRef.current?.focus()
                            }
                            returnKeyType="next"
                            blurOnSubmit={false}
                            placeholder="e.g. Apples"
                            placeholderTextColor={palette.muted}
                            style={[
                              s.shoppingInput,
                              {
                                backgroundColor: palette.bg,
                                color: palette.cream,
                              },
                            ]}
                          />
                        </View>
                        <View
                          style={[
                            s.shoppingPriceField,
                            { width: screenWidth < 360 ? 96 : 112 },
                          ]}
                        >
                          <Text
                            style={[
                              s.shoppingInputLabel,
                              { color: palette.muted },
                            ]}
                          >
                            Price (€)
                          </Text>
                          <TextInput
                            ref={shoppingPriceRef}
                            accessibilityLabel="Item price in euros"
                            value={newPrice}
                            onChangeText={setNewPrice}
                            placeholder="0.00"
                            placeholderTextColor={palette.muted}
                            keyboardType="decimal-pad"
                            inputMode="decimal"
                            onSubmitEditing={addItem}
                            returnKeyType="done"
                            style={[
                              s.shoppingInput,
                              s.priceInput,
                              {
                                backgroundColor: palette.bg,
                                color: palette.cream,
                              },
                            ]}
                          />
                        </View>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Add item"
                        disabled={!newItem.trim()}
                        onPress={addItem}
                        style={[
                          s.shoppingAddButton,
                          {
                            backgroundColor: palette.accent,
                            opacity: newItem.trim() ? 1 : 0.5,
                          },
                        ]}
                      >
                        <Plus size={18} color={palette.bg} />
                        <Text
                          style={[s.shoppingAddText, { color: palette.bg }]}
                        >
                          Add item
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View
                      style={[
                        s.addItemRow,
                        {
                          backgroundColor: palette.bg,
                          borderColor: palette.line,
                        },
                      ]}
                    >
                      <TextInput
                        accessibilityLabel="New task"
                        value={newItem}
                        onChangeText={setNewItem}
                        onSubmitEditing={addItem}
                        placeholder="Add a task…"
                        placeholderTextColor={palette.muted}
                        style={[s.addItemInput, { color: palette.cream }]}
                        returnKeyType="done"
                        blurOnSubmit={false}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Add task"
                        disabled={!newItem.trim()}
                        onPress={addItem}
                        style={[
                          s.addItemButton,
                          {
                            backgroundColor: palette.accent,
                            opacity: newItem.trim() ? 1 : 0.5,
                          },
                        ]}
                      >
                        <Plus color={palette.bg} size={20} />
                      </Pressable>
                    </View>
                  )}
                </View>
              ) : null}
              {draft.type === "sketch" ? (
                <SketchEditor
                  key={`${draft.id}:sketch`}
                  note={draft}
                  onChange={patch}
                  palette={palette}
                  onPasteIntoNote={() => setDrawingPicker(true)}
                />
              ) : null}
              {draft.type === "quote" ? (
                <QuoteEditor
                  key={draft.id}
                  value={draft.body}
                  author={draft.quoteAuthor || ""}
                  onChange={(body) => patch({ body })}
                  onAuthorChange={(quoteAuthor) => patch({ quoteAuthor })}
                  palette={palette}
                  accent={typeInfo("quote").color}
                  voiceInput={voiceInput}
                  voiceStatus={voiceStatus}
                />
              ) : ["checklist", "todo", "shopping", "sketch"].includes(
                  draft.type,
                ) ? (
                <DetailsNote
                  key={`${draft.id}:details`}
                  value={draft.body}
                  onChange={(body) => patch({ body })}
                  palette={palette}
                />
              ) : (
                <View testID="writing-section" style={s.writingSection}>
                  <Text style={[s.fieldLabel, { color: palette.cream }]}>
                    {draft.type === "lyrics"
                      ? "Lyrics"
                      : draft.type === "poem"
                        ? "Your poem"
                        : draft.type === "brainstorm"
                          ? "Your ideas"
                          : "Note"}
                  </Text>
                  {draft.type === "brainstorm" ? (
                    <View testID="idea-prompts" style={s.promptRow}>
                      {[
                        { label: "What if…", text: "What if " },
                        { label: "Why does…", text: "Why does " },
                        { label: "Next step", text: "Next step: " },
                      ].map((prompt) => (
                        <Pressable
                          key={prompt.label}
                          accessibilityRole="button"
                          onPress={() =>
                            patch({
                              body:
                                draft.body +
                                (draft.body && !draft.body.endsWith("\n")
                                  ? "\n\n"
                                  : "") +
                                prompt.text,
                            })
                          }
                          style={[
                            s.promptChip,
                            {
                              borderColor: palette.line,
                              backgroundColor: palette.panel2,
                            },
                          ]}
                        >
                          <Text
                            style={[s.promptText, { color: palette.cream }]}
                          >
                            {prompt.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  <PaperEditor
                    key={draft.id}
                    voiceInput={voiceInput}
                    voiceStatus={voiceStatus}
                    value={draft.body}
                    onChange={(body) => patch({ body })}
                    paperStyle={draft.paperStyle}
                    onStyleChange={(paperStyle) => patch({ paperStyle })}
                    palette={palette}
                    overlays={draft.drawingOverlays}
                    onOverlaysChange={(drawingOverlays) =>
                      patch({ drawingOverlays })
                    }
                    onDrawingDragChange={setDraggingDrawing}
                    minHeight={Math.max(
                      340,
                      Math.min(
                        720,
                        screenHeight -
                          (draft.type === "brainstorm" ? 508 : 456),
                      ),
                    )}
                    placeholder={
                      draft.type === "lyrics"
                        ? "Verse, chorus, a line you don’t want to lose…"
                        : draft.type === "poem"
                          ? "Begin anywhere. Let the words arrive…"
                          : draft.type === "brainstorm"
                            ? "Capture an idea, question or possibility…"
                            : "Write anything worth remembering…"
                    }
                  />
                </View>
              )}
              <Pressable
                testID="reminder-card"
                accessibilityRole="button"
                accessibilityLabel="Remember this later"
                onPress={() => setReminderPicker(true)}
                style={({ pressed }) => [
                  s.reminderCard,
                  { backgroundColor: palette.panel, borderColor: palette.line },
                  pressed && s.pressed,
                ]}
              >
                <View
                  style={[s.reminderIcon, { backgroundColor: palette.panel2 }]}
                >
                  <AlarmClock color={palette.accent} size={22} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.reminderTitle, { color: palette.cream }]}>
                    {draft.reminderAt
                      ? draft.reminderRepeat && draft.reminderRepeat !== "none"
                        ? "Repeating reminder"
                        : draft.reminderAt <= Date.now()
                          ? "Reminder passed"
                          : "Remind me"
                      : "Remember this later"}
                  </Text>
                  <Text style={[s.reminderSub, { color: palette.muted }]}>
                    {draft.reminderAt
                      ? new Date(
                          occurrence(draft, now) || draft.reminderAt,
                        ).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }) +
                        (draft.reminderRepeat && draft.reminderRepeat !== "none"
                          ? " · " + draft.reminderRepeat
                          : "") +
                        (draft.reminderDelivery === "in-app"
                          ? " · In-app alert"
                          : "")
                      : "Choose a date and time"}
                  </Text>
                </View>
                <ChevronRight color={palette.muted} size={19} />
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
          {editor ? reminderAlert : null}
          {drawingPicker ? (
            <DrawingPicker
              notes={activeNotes.map(
                (n) => drafts.find((d) => d.id === n.id) || n,
              )}
              palette={palette}
              onClose={() => setDrawingPicker(false)}
              onPick={pasteDrawing}
            />
          ) : null}
          {organizing ? (
            <OrganizeSheet
              note={draft}
              notes={activeNotes}
              palette={palette}
              onClose={() => setOrganizing(false)}
              onApply={applyOrganization}
            />
          ) : null}
          {reminderPicker ? (
            <ReminderPicker
              value={draft.reminderAt}
              initialRepeat={draft.reminderRepeat}
              palette={palette}
              onClose={() => setReminderPicker(false)}
              onSet={(reminderAt, reminderDelivery, reminderRepeat) => {
                patch({
                  reminderAt,
                  reminderDelivery,
                  reminderRepeat,
                  reminderCompletedAt: undefined,
                  snoozedUntil: undefined,
                });
                setReminderPicker(false);
              }}
              onRemove={() => {
                patch({
                  reminderAt: undefined,
                  reminderDelivery: undefined,
                  reminderRepeat: "none",
                  snoozedUntil: undefined,
                });
                setReminderPicker(false);
              }}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
      {!editor && !settingsVisible ? reminderAlert : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  quoteHeading: {
    flex: 1,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "700",
    paddingVertical: 8,
  },
  mainNavigation: {
    width: "100%",
    maxWidth: 960,
    alignSelf: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navItem: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  navLabel: { fontSize: 13, fontWeight: "600" },
  createHint: { fontSize: 11, lineHeight: 16, textAlign: "center" },
  viewMenu: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notice: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  draftShelf: { marginTop: layout.sectionGap, gap: 10 },
  draftHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  draftCard: {
    padding: 14,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  draftTitle: { fontSize: 14, fontWeight: "600" },
  noteOrganization: { fontSize: 11, lineHeight: 17, marginTop: 12 },
  noteDue: { fontSize: 11, lineHeight: 18, marginTop: 8 },
  editorMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  draftStatus: { fontSize: 11, lineHeight: 17, flex: 1 },
  organizeButton: {
    maxWidth: "55%",
    paddingHorizontal: 10,
    minHeight: 32,
    borderRadius: 10,
    justifyContent: "center",
  },
  organizeText: { fontSize: 11, fontWeight: "600" },
  snoozeRow: { flexDirection: "row", gap: 8 },
  snoozeButton: {
    flex: 1,
    minHeight: 44,
    padding: 8,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  safe: { flex: 1, backgroundColor: C.bg },
  homeScroll: { flex: 1 },
  homeScrollContent: { flexGrow: 1 },
  homeShell: {
    width: "100%",
    maxWidth: 960,
    alignSelf: "center",
    paddingTop: 24,
    paddingBottom: 28,
  },
  homeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 24,
  },
  brandRow: { flexDirection: "row", alignItems: "flex-end" },
  brand: {
    color: C.cream,
    fontSize: 32,
    letterSpacing: -1.3,
    fontWeight: "700",
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 5,
    backgroundColor: C.amber,
    marginLeft: 4,
    marginBottom: 8,
  },
  tagline: { color: C.muted, marginTop: 5, fontSize: 12, lineHeight: 18 },
  headerBadge: {
    minHeight: 36,
    borderWidth: 0,
    borderColor: C.line,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    backgroundColor: C.panel,
  },
  headerBadgeText: { color: C.cream, fontSize: 12, fontWeight: "600" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    minHeight: 50,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 0,
    borderColor: C.line,
    backgroundColor: C.panel,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: C.cream,
    fontSize: 14,
    paddingVertical: 12,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: layout.contentGap,
  },
  filterChip: {
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 0,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.panel,
  },
  filterActive: { backgroundColor: C.cream, borderColor: C.cream },
  filterText: { color: C.muted, fontSize: 12, fontWeight: "600" },
  filterTextActive: { color: C.bg },
  sectionHead: {
    marginTop: layout.sectionGap,
    marginBottom: layout.contentGap,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: C.cream,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  sectionSub: { color: C.muted, fontSize: 12, lineHeight: 18 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickCard: {
    height: 126,
    borderRadius: 17,
    borderWidth: 0,
    borderColor: C.line,
    borderBottomWidth: 3,
    backgroundColor: C.panel,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    paddingVertical: 10,
    gap: 8,
  },
  quickGlyph: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    color: C.cream,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  noteGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 16,
  },
  noteCard: {
    backgroundColor: C.panel,
    borderWidth: 0,
    borderColor: C.line,
    borderRadius: 18,
    overflow: "hidden",
    minHeight: 128,
    flexDirection: "row",
  },
  noteStripe: { width: 4 },
  noteContent: { flex: 1, minWidth: 0, padding: 16 },
  noteTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  noteGlyph: {
    width: 39,
    height: 39,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.panel2,
    borderWidth: 0,
  },
  noteTitle: {
    color: C.cream,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  noteMeta: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  starHit: { padding: 5 },
  preview: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: layout.contentGap,
  },
  emptyState: {
    alignItems: "center",
    borderWidth: 0,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: C.panel,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    borderColor: C.line,
    marginBottom: 16,
  },
  emptyTitle: {
    color: C.cream,
    fontWeight: "700",
    fontSize: 18,
    lineHeight: 25,
    textAlign: "center",
  },
  emptyText: {
    color: C.muted,
    fontSize: 13,
    marginTop: 8,
    marginBottom: 20,
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    minHeight: 44,
    borderRadius: 13,
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: C.amber,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  buttonSubtle: {
    backgroundColor: C.panel2,
    borderWidth: 0,
    borderColor: C.line,
  },
  buttonDanger: {
    backgroundColor: C.panel,
    borderWidth: 0,
    borderColor: C.line,
    marginTop: 16,
  },
  buttonText: { color: C.bg, fontSize: 13, fontWeight: "700" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    height: 56,
    width: 56,
    borderRadius: 19,
    backgroundColor: C.amber,
    alignItems: "center",
    justifyContent: "center",
    elevation: 7,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  sheetShade: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(7,4,2,.72)",
  },
  sheet: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    backgroundColor: C.panel,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderWidth: 0,
    borderColor: C.line,
  },
  sheetHandle: {
    alignSelf: "center",
    height: 4,
    width: 40,
    borderRadius: 3,
    backgroundColor: C.line,
    marginBottom: 16,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitle: { color: C.cream, fontSize: 20, fontWeight: "700" },
  dialogClose: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  typeOption: {
    width: "48%",
    borderWidth: 0,
    borderColor: C.line,
    backgroundColor: C.panel2,
    borderRadius: 15,
    padding: 12,
    minHeight: 107,
  },
  typeOptionGlyph: {
    width: 37,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.bg,
    borderWidth: 0,
    borderColor: C.line,
    borderBottomWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  typeOptionTitle: { color: C.cream, fontSize: 14, fontWeight: "700" },
  typeOptionDesc: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  editorSafe: { flex: 1, backgroundColor: C.bg },
  editorShell: { flex: 1, width: "100%", maxWidth: 760, alignSelf: "center" },
  editorHeader: {
    height: 72,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: layout.controlGap,
    borderBottomWidth: 0,
    borderBottomColor: C.line,
  },
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.panel,
    borderWidth: 0,
    borderColor: C.line,
  },
  starActive: { backgroundColor: "#493116", borderColor: "#8E6428" },
  editorHeaderTitle: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  editorType: {
    flexShrink: 1,
    color: C.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  saveButton: {
    height: 44,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    backgroundColor: C.amber,
  },
  saveButtonText: { color: C.bg, fontWeight: "700", fontSize: 13 },
  editorScroll: {
    paddingHorizontal: 20,
    paddingVertical: layout.sectionGap,
    gap: layout.sectionGap,
  },
  titleSection: { gap: 12 },
  writingSection: { gap: layout.contentGap },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  titleAction: {
    width: 36,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  saveError: { color: C.red, fontSize: 13, lineHeight: 19 },
  importantPill: {
    alignSelf: "flex-start",
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: C.amber,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  importantPillText: { color: C.bg, fontSize: 10, fontWeight: "800" },
  listSection: {
    borderWidth: 0,
    borderColor: C.line,
    borderRadius: 18,
    backgroundColor: C.panel,
    padding: layout.cardInset,
  },
  listHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  listHeadingTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  listTitle: { fontSize: 16, fontWeight: "700" },
  progressBadge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  progressText: { fontSize: 11, fontWeight: "600" },
  progressTrack: {
    height: 3,
    borderRadius: 3,
    marginTop: 16,
    marginBottom: 5,
    overflow: "hidden",
  },
  listEmpty: { paddingVertical: 24, gap: 6 },
  listEmptyTitle: { fontSize: 15, fontWeight: "600", lineHeight: 21 },
  listEmptyHint: { fontSize: 12, lineHeight: 18 },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  totalLabel: { fontSize: 12 },
  totalAmount: { fontSize: 22, fontWeight: "700" },
  fieldLabel: { fontSize: 16, lineHeight: 24, fontWeight: "700" },
  aisleTitle: {
    color: typeInfo("shopping").color,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: 54,
    paddingVertical: 4,
    borderBottomWidth: 0,
    borderBottomColor: C.line,
  },
  checkHit: {
    minHeight: 44,
    width: 26,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  removeItem: {
    minHeight: 40,
    width: 26,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  checkBox: {
    height: 21,
    width: 21,
    borderRadius: 7,
    borderWidth: 1.3,
    borderColor: C.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxOn: {
    backgroundColor: typeInfo("todo").color,
    borderColor: typeInfo("todo").color,
  },
  itemText: {
    color: C.cream,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
    minWidth: 0,
  },
  itemDone: { textDecorationLine: "line-through", color: C.muted },
  itemPrice: { color: C.cream, fontSize: 11, width: 57, textAlign: "right" },
  addItemRow: {
    marginTop: 12,
    borderRadius: 13,
    borderWidth: 0,
    borderColor: C.line,
    backgroundColor: C.bg,
    paddingLeft: 12,
    paddingRight: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  addItemInput: {
    color: C.cream,
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingVertical: 12,
    fontSize: 14,
    outlineWidth: 0,
    outlineStyle: "solid",
  },
  shoppingEntry: { marginTop: 16, gap: 12 },
  shoppingFields: { flexDirection: "row", gap: 12, alignItems: "flex-end" },
  shoppingNameField: { flex: 1, minWidth: 0, gap: 8 },
  shoppingPriceField: { gap: 8 },
  shoppingInputLabel: { fontSize: 12, fontWeight: "600" },
  shoppingInput: {
    minHeight: 50,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    outlineWidth: 0,
    outlineStyle: "solid",
  },
  priceInput: { fontSize: 17, fontWeight: "600", textAlign: "right" },
  shoppingAddButton: {
    minHeight: 44,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  shoppingAddText: { fontSize: 13, fontWeight: "700" },
  addItemButton: {
    height: 38,
    width: 38,
    borderRadius: 10,
    backgroundColor: C.amber,
    alignItems: "center",
    justifyContent: "center",
  },
  promptRow: { flexDirection: "row", flexWrap: "wrap", gap: layout.controlGap },
  promptChip: {
    minHeight: 36,
    justifyContent: "center",
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  promptText: { fontSize: 12, lineHeight: 18, fontWeight: "600" },
  reminderCard: {
    borderWidth: 0,
    borderColor: C.line,
    backgroundColor: C.panel,
    borderRadius: 16,
    padding: layout.cardInset,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  reminderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#493116",
    alignItems: "center",
    justifyContent: "center",
  },
  reminderTitle: { color: C.cream, fontWeight: "700", fontSize: 14 },
  reminderSub: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  reminderAlertShade: {
    flex: 1,
    padding: 24,
    backgroundColor: "rgba(7,4,2,.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  reminderAlert: {
    width: "100%",
    maxWidth: 360,
    padding: 24,
    borderWidth: 0,
    borderRadius: 22,
    gap: 16,
  },
  reminderAlertBody: { fontSize: 16, lineHeight: 24 },
  settingsShade: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(7,4,2,.75)",
  },
  settingsPanel: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 0,
    paddingHorizontal: layout.dialogInset,
    paddingTop: 12,
    paddingBottom: layout.sectionGap,
  },
  settingsIntro: { fontSize: 13, lineHeight: 20, marginTop: 6 },
  settingsSectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    marginBottom: 6,
  },
  settingsSectionTitle: { fontSize: 14, fontWeight: "800" },
  settingsHint: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  themeChoices: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  themeChoice: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 0,
    padding: 8,
    borderRadius: 13,
    borderWidth: 0,
  },
  themePreview: {
    height: 55,
    borderRadius: 8,
    borderWidth: 0,
    padding: 7,
    justifyContent: "center",
    gap: 5,
  },
  themePreviewLine: { height: 4, width: "80%", borderRadius: 3 },
  themePreviewChip: { height: 9, width: "40%", borderRadius: 4, marginTop: 2 },
  themeCheck: { position: "absolute", top: 3, right: 3 },
  themeChoiceFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 7,
  },
  themeChoiceLabel: { flexShrink: 1, fontSize: 12, fontWeight: "700" },
  settingsDivider: { height: 1, marginTop: 14, marginBottom: 3 },
  settingsAction: {
    minHeight: 57,
    borderWidth: 0,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 7,
  },
  settingsActionTitle: { fontSize: 14, fontWeight: "700" },
  settingsActionSub: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  settingsFooter: { fontSize: 11, fontWeight: "800", marginBottom: 4 },
});
