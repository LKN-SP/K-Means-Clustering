export interface Point {
  id: string;
  x: number; // 0 to 100
  y: number; // 0 to 100
  assignedCentroidId: number | null; // 0 to k-1
  correctCentroidId: number | null; // calculated closest centroid
}

export interface Centroid {
  id: number;
  x: number; // 0 to 100
  y: number; // 0 to 100
  color: string; // hex or display colour
  bgClass: string;
  textClass: string;
  borderClass: string;
  lightBgClass: string;
  isPlaced: boolean;
}

export type PageId = 1 | 2 | 3 | 4 | 5;
