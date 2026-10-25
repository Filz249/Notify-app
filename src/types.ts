export type NoteType =
  | 'note' | 'checklist' | 'todo' | 'shopping'
  | 'lyrics' | 'poem' | 'sketch' | 'brainstorm';

export type SketchStroke = {
  path: string;
  color: string;
  width: number;
  style?: 'solid' | 'dashed' | 'dotted';
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
  type: NoteType;
  important: boolean;
  color: string;
  createdAt: number;
  updatedAt: number;
  reminderAt?: number;
  notificationId?: string;
  items: ListItem[];
  sketchPaths: Array<string | SketchStroke>;
  sketchColor?: string;
  sketchBackground?: string;
  sketchWidth?: number;
  sketchStyle?: 'solid' | 'dashed' | 'dotted';
};
