import { Point, Centroid } from "./types";

// Calculates Euclidean distance between two 2D points
export function getDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

// Generate natural clusters to make the game satisfying and clear
export function generatePoints(n: number, k: number): Point[] {
  // We can create a few "seed centers" to form natural clusters
  const numSeeds = Math.min(k, 3) + Math.floor(Math.random() * 2); // 2 to 4 seeds
  const seeds = Array.from({ length: numSeeds }, () => ({
    x: 25 + Math.random() * 50,
    y: 25 + Math.random() * 50,
  }));

  const generatedPoints: Point[] = [];
  for (let i = 0; i < n; i++) {
    // Pick a random seed center
    const seed = seeds[Math.floor(Math.random() * seeds.length)];
    
    // Add offset with a normal-like distribution
    const r = Math.random() * 18;
    const theta = Math.random() * 2 * Math.PI;
    let x = seed.x + r * Math.cos(theta);
    let y = seed.y + r * Math.sin(theta);

    // Constrain to nice safe zone [8, 92] to avoid the very edge
    x = Math.max(8, Math.min(92, Math.round(x * 10) / 10));
    y = Math.max(8, Math.min(92, Math.round(y * 10) / 10));

    generatedPoints.push({
      id: `point-${i}`,
      x,
      y,
      assignedCentroidId: null,
      correctCentroidId: null,
    });
  }
  return generatedPoints;
}

// Calculates the closest centroid for each point based on current centroid positions
export function updateCorrectAssignments(points: Point[], centroids: Centroid[]): Point[] {
  const placedCentroids = centroids.filter((c) => c.isPlaced);
  if (placedCentroids.length === 0) {
    return points.map((p) => ({ ...p, correctCentroidId: null }));
  }

  return points.map((p) => {
    let minDistance = Infinity;
    let closestCentroidId = -1;

    placedCentroids.forEach((c) => {
      const dist = getDistance(p, c);
      if (dist < minDistance) {
        minDistance = dist;
        closestCentroidId = c.id;
      }
    });

    return {
      ...p,
      correctCentroidId: closestCentroidId,
    };
  });
}

// Calculates the mathematical mean (center of gravity) of assigned points for each centroid
export function calculateRealCentroids(points: Point[], k: number, currentCentroids: Centroid[]): { x: number; y: number }[] {
  const means: { x: number; y: number }[] = [];

  for (let i = 0; i < k; i++) {
    const assignedPoints = points.filter((p) => p.assignedCentroidId === i);
    
    if (assignedPoints.length === 0) {
      // If no points are assigned, fallback to its current position so it doesn't break
      const current = currentCentroids.find((c) => c.id === i);
      means.push({
        x: current ? current.x : 50,
        y: current ? current.y : 50,
      });
    } else {
      const sumX = assignedPoints.reduce((sum, p) => sum + p.x, 0);
      const sumY = assignedPoints.reduce((sum, p) => sum + p.y, 0);
      means.push({
        x: Math.round((sumX / assignedPoints.length) * 10) / 10,
        y: Math.round((sumY / assignedPoints.length) * 10) / 10,
      });
    }
  }

  return means;
}

// Checks if two sets of cluster memberships are different
export function checkMembershipChanged(prev: (number | null)[], current: (number | null)[]): boolean {
  if (prev.length !== current.length) return true;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== current[i]) return true;
  }
  return false;
}

// List of vibrant, clean colours for centroids and points
export const CENTROID_TEMPLATES = [
  {
    id: 0,
    color: "#ef4444", // Red/Rose
    bgClass: "bg-rose-500",
    textClass: "text-rose-600",
    borderClass: "border-rose-500",
    lightBgClass: "bg-rose-50",
  },
  {
    id: 1,
    color: "#3b82f6", // Blue/Sky
    bgClass: "bg-sky-500",
    textClass: "text-sky-600",
    borderClass: "border-sky-500",
    lightBgClass: "bg-sky-50",
  },
  {
    id: 2,
    color: "#10b981", // Emerald Green
    bgClass: "bg-emerald-500",
    textClass: "text-emerald-600",
    borderClass: "border-emerald-500",
    lightBgClass: "bg-emerald-50",
  },
  {
    id: 3,
    color: "#8b5cf6", // Purple/Violet
    bgClass: "bg-violet-500",
    textClass: "text-violet-600",
    borderClass: "border-violet-500",
    lightBgClass: "bg-violet-50",
  },
  {
    id: 4,
    color: "#f59e0b", // Amber/Orange
    bgClass: "bg-amber-500",
    textClass: "text-amber-600",
    borderClass: "border-amber-500",
    lightBgClass: "bg-amber-50",
  },
];
