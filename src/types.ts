export type NoteType =
  | "note"
  | "checklist"
  | "todo"
  | "shopping"
  | "lyrics"
  | "poem"
  | "sketch"
  | "brainstorm"
  | "quote";
export type ReminderRepeat = "none" | "daily" | "weekly";

export type SketchStroke = {
  path: string;
  color: string;
  width: number;
  style?: "solid" | "dashed" | "dotted";
};

export type ListItem = {
  id: string;
  text: string;
  checked: boolean;
  category?: string;
  price?: number;
  quantity?: number;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  quoteAuthor?: string;
  paperStyle?: "plain" | "lines" | "dots";
  type: NoteType;
  important: boolean;
  color: string;
  createdAt: number;
  updatedAt: number;
  reminderAt?: number;
  notificationId?: string;
  reminderDelivery?: "system" | "in-app";
  reminderRepeat?: ReminderRepeat;
  reminderCompletedAt?: number;
  snoozedUntil?: number;
  collection?: string;
  tags?: string[];
  deletedAt?: number;
  items: ListItem[];
  sketchPaths: Array<string | SketchStroke>;
  sketchColor?: string;
  sketchBackground?: string;
  sketchWidth?: number;
  sketchStyle?: "solid" | "dashed" | "dotted";
  sketchSize?: { width: number; height: number };
};
