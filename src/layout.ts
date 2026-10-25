export const layout = {
  sectionGap: 24,
  contentGap: 16,
  controlGap: 8,
  cardInset: 16,
  dialogInset: 20,
} as const;

export const pageInset = (width: number) =>
  width < 360 ? 16 : width >= 720 ? 28 : 20;
