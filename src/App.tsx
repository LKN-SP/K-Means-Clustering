import React, { useState, useRef, useEffect } from "react";
import { 
  ChevronRight, 
  RotateCcw, 
  Check, 
  Move, 
  Sparkles, 
  Layers, 
  Target, 
  MousePointer, 
  Info,
  Play
} from "lucide-react";
import { Point, Centroid, PageId } from "./types";
import { 
  getDistance, 
  generatePoints, 
  updateCorrectAssignments, 
  calculateRealCentroids, 
  checkMembershipChanged, 
  CENTROID_TEMPLATES 
} from "./utils";

export default function App() {
  // Page state
  const [page, setPage] = useState<PageId>(1);
  
  // Game parameters
  const [k, setK] = useState<number>(3);
  const [n, setN] = useState<number>(15);
  
  // Interactive entities
  const [points, setPoints] = useState<Point[]>([]);
  const [centroids, setCentroids] = useState<Centroid[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  
  // Game progression & check state
  const [previousAssignments, setPreviousAssignments] = useState<(number | null)[]>([]);
  const [iteration, setIteration] = useState<number>(1);
  const [showHints, setShowHints] = useState<boolean>(true);
  
  // Dragging/animation state
  const [draggingCentroidId, setDraggingCentroidId] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Find min/max values of the points to determine a flexible but visually fair uniform scale
  const xValues = points.length > 0 ? points.map(p => p.x) : [8, 92];
  const yValues = points.length > 0 ? points.map(p => p.y) : [8, 92];
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

  const xSpan = maxX - minX;
  const ySpan = maxY - minY;
  
  // Calculate a common span S to ensure both axes have the exact same scale interval
  // We use the maximum span of the data, add 20% margin, and ensure a minimum span of 10
  const maxSpan = Math.max(xSpan, ySpan);
  const S = Math.min(100, Math.max(10, maxSpan * 1.25));

  const midX = points.length > 0 ? (minX + maxX) / 2 : 50;
  const midY = points.length > 0 ? (minY + maxY) / 2 : 50;

  // Center the scale windows on the midpoints of the points
  let tempMinX = midX - S / 2;
  let tempMaxX = midX + S / 2;
  let tempMinY = midY - S / 2;
  let tempMaxY = midY + S / 2;

  // Shift scale windows to stay entirely within the [0, 100] coordinate space
  if (tempMinX < 0) {
    tempMaxX += -tempMinX;
    tempMinX = 0;
  }
  if (tempMaxX > 100) {
    tempMinX -= (tempMaxX - 100);
    tempMaxX = 100;
  }

  if (tempMinY < 0) {
    tempMaxY += -tempMinY;
    tempMinY = 0;
  }
  if (tempMaxY > 100) {
    tempMinY -= (tempMaxY - 100);
    tempMaxY = 100;
  }

  const dataMinX = Math.max(0, tempMinX);
  const dataMaxX = Math.min(100, tempMaxX);
  const dataMinY = Math.max(0, tempMinY);
  const dataMaxY = Math.min(100, tempMaxY);

  const toDisplayX = (x: number) => {
    if (dataMaxX === dataMinX) return 50;
    return ((x - dataMinX) / (dataMaxX - dataMinX)) * 100;
  };

  const toDisplayY = (y: number) => {
    if (dataMaxY === dataMinY) return 50;
    return ((y - dataMinY) / (dataMaxY - dataMinY)) * 100;
  };

  const fromDisplayX = (dx: number) => {
    if (dataMaxX === dataMinX) return dataMinX;
    const raw = dataMinX + (dx / 100) * (dataMaxX - dataMinX);
    return Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
  };

  const fromDisplayY = (dy: number) => {
    if (dataMaxY === dataMinY) return dataMinY;
    const raw = dataMinY + (dy / 100) * (dataMaxY - dataMinY);
    return Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
  };

  // Initialize centroids templates based on K
  const initCentroids = (clusterCount: number): Centroid[] => {
    return Array.from({ length: clusterCount }, (_, i) => {
      const template = CENTROID_TEMPLATES[i];
      return {
        id: i,
        x: 0,
        y: 0,
        color: template.color,
        bgClass: template.bgClass,
        textClass: template.textClass,
        borderClass: template.borderClass,
        lightBgClass: template.lightBgClass,
        isPlaced: false,
      };
    });
  };

  // Start the game with current K and N parameters
  const handleStartGame = () => {
    const generatedPoints = generatePoints(n, k);
    const initialCentroids = initCentroids(k);
    
    setPoints(generatedPoints);
    setCentroids(initialCentroids);
    setSelectedPointId(null);
    setPreviousAssignments([]);
    setIteration(1);
    setPage(2);
  };

  // Reset/Restart the game completely
  const handleRestart = () => {
    setPage(1);
  };

  // Direct click placement for centroids on Page 2
  const handlePlaceCentroidDirectly = (centroidId: number) => {
    // Spread them out nicely on the grid depending on ID (in display percentages)
    let displayX = 50;
    let displayY = 50;
    
    if (k === 2) {
      displayX = centroidId === 0 ? 30 : 70;
      displayY = 50;
    } else if (k === 3) {
      displayX = centroidId === 0 ? 30 : centroidId === 1 ? 70 : 50;
      displayY = centroidId === 2 ? 70 : 30;
    } else if (k === 4) {
      displayX = centroidId === 0 || centroidId === 2 ? 30 : 70;
      displayY = centroidId === 0 || centroidId === 1 ? 30 : 70;
    } else { // k === 5
      displayX = centroidId === 0 ? 25 : centroidId === 1 ? 75 : centroidId === 2 ? 25 : centroidId === 3 ? 75 : 50;
      displayY = centroidId === 0 || centroidId === 1 ? 25 : centroidId === 2 || centroidId === 3 ? 75 : 50;
    }

    // Map display percentage coordinates back to the original coordinate space of the points
    const x = fromDisplayX(displayX);
    const y = fromDisplayY(displayY);

    setCentroids(prev => 
      prev.map(c => c.id === centroidId ? { ...c, x, y, isPlaced: true } : c)
    );
  };

  // Update centroid coordinate position with clamping
  const updateCentroidPosition = (id: number, x: number, y: number) => {
    setCentroids(prev => 
      prev.map(c => c.id === id ? { ...c, x, y, isPlaced: true } : c)
    );
  };

  // Pointer down handler for centroid dragging
  const handleCentroidPointerDown = (centroidId: number, e: React.PointerEvent) => {
    e.preventDefault();
    setDraggingCentroidId(centroidId);
    
    // Set pointer capture to the dragging element so events are captured even outside boundaries
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    
    // If it was not placed yet, mark it as placed and put it at pointer coordinate
    const centroid = centroids.find(c => c.id === centroidId);
    if (centroid && !centroid.isPlaced) {
      handlePointerMove(e, centroidId);
    }
  };

  // Main pointer move calculation for coordinate mapping
  const handlePointerMove = (e: React.PointerEvent, overrideId?: number) => {
    const activeId = overrideId !== undefined ? overrideId : draggingCentroidId;
    if (activeId === null) return;
    
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Calculate percentage coords inside grid
    // Origin (0,0) is bottom-left
    const displayX = ((e.clientX - rect.left) / rect.width) * 100;
    const displayY = ((rect.bottom - e.clientY) / rect.height) * 100;

    // Map display percentage coordinates back to the original coordinate space of the points
    const x = fromDisplayX(displayX);
    const y = fromDisplayY(displayY);

    updateCentroidPosition(activeId, x, y);
  };

  // Release pointer capture on dragging finished
  const handleCentroidPointerUp = (centroidId: number, e: React.PointerEvent) => {
    if (draggingCentroidId === centroidId) {
      const target = e.currentTarget as HTMLElement;
      target.releasePointerCapture(e.pointerId);
      setDraggingCentroidId(null);
    }
  };

  // Trigger correct assignments update when centroids or points change
  useEffect(() => {
    if (centroids.length > 0 && points.length > 0) {
      setPoints(prev => {
        const updated = updateCorrectAssignments(prev, centroids);
        // Retain current user assignments unless first generation
        return prev.map((p, idx) => ({
          ...p,
          correctCentroidId: updated[idx].correctCentroidId
        }));
      });
    }
  }, [centroids]);

  // Point assignment on Page 3
  const handleAssignPoint = (centroidId: number) => {
    if (selectedPointId === null) return;
    
    setPoints(prev => 
      prev.map(p => p.id === selectedPointId ? { ...p, assignedCentroidId: centroidId } : p)
    );

    // Auto-select the next unassigned point or incorrect point to make UX extremely flowy and satisfying
    const currentIndex = points.findIndex(p => p.id === selectedPointId);
    const nextUnassigned = points.slice(currentIndex + 1).concat(points.slice(0, currentIndex))
      .find(p => p.assignedCentroidId === null || p.assignedCentroidId !== p.correctCentroidId);
    
    if (nextUnassigned && nextUnassigned.id !== selectedPointId) {
      setSelectedPointId(nextUnassigned.id);
    } else {
      setSelectedPointId(null); // Deselect if everything is assigned or no unassigned remains
    }
  };

  // Grid background clicks to deselect selected point
  const handleGridBackgroundClick = (e: React.MouseEvent) => {
    // Only deselect if they didn't click on an actual interactive point or centroid
    const target = e.target as HTMLElement;
    if (target.closest(".point-node") || target.closest(".centroid-node")) {
      return;
    }
    setSelectedPointId(null);
  };

  // Page 2 Placed verification
  const allCentroidsPlaced = centroids.length > 0 && centroids.every(c => c.isPlaced);

  // Page 3 Assignments validation
  const allPointsAssigned = points.length > 0 && points.every(p => p.assignedCentroidId !== null);
  const allAssignmentsCorrect = points.length > 0 && points.every(p => p.assignedCentroidId === p.correctCentroidId);
  const correctCount = points.filter(p => p.assignedCentroidId === p.correctCentroidId).length;

  const currentMembership = points.map(p => p.assignedCentroidId);
  const isFirstIteration = iteration === 1;
  const hasMembershipChanged = isFirstIteration || checkMembershipChanged(previousAssignments, currentMembership);

  // Handle Page 3 "Next" transition
  const handlePage3Next = () => {
    if (!allAssignmentsCorrect) return;

    if (hasMembershipChanged) {
      setPreviousAssignments(currentMembership);
      setPage(4);
    } else {
      setPage(5); // Converged! No change in membership
    }
  };

  // Calculations for Page 4 (Centroid Re-positioning)
  const targetCentroidPositions = calculateRealCentroids(points, k, centroids);
  
  // Check if all centroids are close enough to target positions (within 3.0 units)
  const isCentroidInTargetPosition = (centroid: Centroid) => {
    const targetPos = targetCentroidPositions[centroid.id];
    if (!targetPos) return false;
    const dist = getDistance(centroid, targetPos);
    return dist <= 3.0;
  };
  
  const allCentroidsAligned = centroids.length > 0 && centroids.every(c => isCentroidInTargetPosition(c));

  // Slow animated movement of centroids to target cluster positions
  const handleAnimateCentroids = () => {
    if (isAnimating) return;
    setIsAnimating(true);

    const startTime = performance.now();
    const duration = 1500; // 1.5 seconds

    // Capture starting positions of all centroids
    const startPositions = centroids.map(c => ({ x: c.x, y: c.y }));

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function: ease-in-out cubic
      const ease = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      setCentroids(prev => 
        prev.map((c, idx) => {
          const start = startPositions[idx];
          const target = targetCentroidPositions[idx];
          if (!start || !target) return c;

          const nextX = start.x + (target.x - start.x) * ease;
          const nextY = start.y + (target.y - start.y) * ease;
          
          return {
            ...c,
            x: Math.round(nextX * 10) / 10,
            y: Math.round(nextY * 10) / 10,
          };
        })
      );

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Snap exactly to targets at completion
        setCentroids(prev => 
          prev.map((c, idx) => {
            const target = targetCentroidPositions[idx];
            return target ? { ...c, x: target.x, y: target.y, isPlaced: true } : c;
          })
        );
        setIsAnimating(false);
      }
    };

    requestAnimationFrame(animate);
  };

  // Snap centroids to their mathematically exact targets
  const handleSnapToTargets = () => {
    setCentroids(prev => 
      prev.map(c => {
        const target = targetCentroidPositions[c.id];
        return target ? { ...c, x: target.x, y: target.y, isPlaced: true } : c;
      })
    );
  };

  // Handle Page 4 "Next" transition (back to Page 3 for reassignment)
  const handlePage4Next = () => {
    if (!allCentroidsAligned) return;
    
    // Increment iteration counter
    setIteration(prev => prev + 1);
    
    // Save current point assignments so we can compare them with the user's new assignments
    setPreviousAssignments(points.map(p => p.assignedCentroidId));
    
    // Go to Page 3
    setPage(3);
  };

  // Helper to render coordinate grid layout
  const renderCoordinateGrid = (interactive: boolean = true) => {
    return (
      <div 
        ref={gridRef}
        id="coordinate-grid"
        className="relative w-full max-w-lg aspect-square bg-white border border-gray-200 rounded-xl relative shadow-sm overflow-hidden select-none touch-none cursor-crosshair"
        onClick={page === 3 ? handleGridBackgroundClick : undefined}
        onPointerMove={draggingCentroidId !== null ? (e) => handlePointerMove(e) : undefined}
      >
        {/* Radial dots matrix background */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-90"
          style={{ 
            backgroundImage: "radial-gradient(#E5E7EB 1.5px, transparent 1.5px)", 
            backgroundSize: "32px 32px" 
          }} 
        />

        {/* Dynamic Vector Overlay for Point Assignment (Lines and labels) */}
        {page === 3 && selectedPointId && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
            {(() => {
              const selectedPoint = points.find(p => p.id === selectedPointId);
              if (!selectedPoint) return null;
              
              return centroids.filter(c => c.isPlaced).map((centroid) => {
                const dist = parseFloat(getDistance(selectedPoint, centroid).toFixed(1));
                const isClosest = centroid.id === selectedPoint.correctCentroidId;
                
                // Coordinates for line
                const x1 = toDisplayX(selectedPoint.x);
                const y1 = 100 - toDisplayY(selectedPoint.y);
                const x2 = toDisplayX(centroid.x);
                const y2 = 100 - toDisplayY(centroid.y);
                
                // Vector calculation to place label opposite to the selected point
                const dx = x2 - x1;
                const dy = y2 - y1;
                const lineLength = Math.sqrt(dx * dx + dy * dy);
                
                let lx = x2;
                let ly = y2;
                if (lineLength > 0) {
                  const labelOffset = 6.5;
                  lx = x2 + (dx / lineLength) * labelOffset;
                  ly = y2 + (dy / lineLength) * labelOffset;
                }
                
                // Clamp to keep labels nicely within grid boundaries
                lx = Math.max(3, Math.min(97, lx));
                ly = Math.max(3, Math.min(97, ly));
                
                return (
                  <g key={centroid.id}>
                    {/* Dashed line to centroid */}
                    <line 
                      x1={x1} 
                      y1={y1} 
                      x2={x2} 
                      y2={y2} 
                      stroke={centroid.color} 
                      strokeWidth={isClosest ? 0.6 : 0.3} 
                      strokeDasharray={isClosest ? "1,1" : "2,2"}
                      className="transition-all"
                    />
                    
                    {/* Distance pill tag on the opposite side of centroid */}
                    <g transform={`translate(${lx}, ${ly})`}>
                      <rect 
                        x="-6" 
                        y="-3.5" 
                        width="12" 
                        height="7" 
                        rx="1.5" 
                        fill="white" 
                        stroke={centroid.color} 
                        strokeWidth="0.3"
                        className="shadow-sm"
                      />
                      <text 
                        fill="#374151" 
                        fontSize="2.5" 
                        fontWeight={isClosest ? "bold" : "normal"}
                        textAnchor="middle" 
                        dominantBaseline="central"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        d={dist}
                      </text>
                    </g>
                  </g>
                );
              });
            })()}
          </svg>
        )}

        {/* Vector lines showing final cluster assignments on Page 5 */}
        {page === 5 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
            {points.map((point) => {
              const centroid = centroids.find(c => c.id === point.assignedCentroidId);
              if (!centroid) return null;
              return (
                <line 
                  key={point.id}
                  x1={toDisplayX(point.x)} 
                  y1={100 - toDisplayY(point.y)} 
                  x2={toDisplayX(centroid.x)} 
                  y2={100 - toDisplayY(centroid.y)} 
                  stroke={centroid.color} 
                  strokeWidth="0.25" 
                  opacity="0.35"
                />
              );
            })}
          </svg>
        )}

        {/* Render Points */}
        {points.map((point) => {
          // Hide other points on Page 3 when one is selected
          if (page === 3 && selectedPointId && point.id !== selectedPointId) {
            return null;
          }

          // Point styling depending on page state
          const isSelected = selectedPointId === point.id;
          const isAssigned = point.assignedCentroidId !== null;
          
          // Color based on active cluster assignment or grey initially
          let pointColorClass = "bg-gray-300 border-white";
          
          if (page === 3) {
            if (isAssigned) {
              const matchedCentroid = centroids.find(c => c.id === point.assignedCentroidId);
              if (matchedCentroid) {
                pointColorClass = `${matchedCentroid.bgClass} border-white`;
              }
            } else {
              pointColorClass = "bg-gray-300 border-white";
            }
          } else if (page >= 4) {
            // In pages 4 and 5 we lock/show the assigned colors
            const matchedCentroid = centroids.find(c => c.id === point.assignedCentroidId);
            if (matchedCentroid) {
              pointColorClass = `${matchedCentroid.bgClass} border-white`;
            }
          }

          const isWrong = page === 3 && showHints && isAssigned && point.assignedCentroidId !== point.correctCentroidId;
          const isRight = page === 3 && showHints && isAssigned && point.assignedCentroidId === point.correctCentroidId;

          return (
            <button
              key={point.id}
              className={`point-node absolute rounded-full border-2 transition-all duration-300 flex items-center justify-center z-20
                ${pointColorClass}
                ${page === 3 ? "hover:scale-130 hover:shadow-md cursor-pointer" : "pointer-events-none"}
                ${isSelected ? "ring-2 ring-slate-950 ring-offset-1 scale-125 z-30" : ""}
                ${isWrong ? "ring-2 ring-red-500 ring-offset-1 animate-bounce" : ""}
                ${isSelected ? "w-4.5 h-4.5" : "w-3.5 h-3.5"}
              `}
              style={{ left: `${toDisplayX(point.x)}%`, bottom: `${toDisplayY(point.y)}%`, transform: `translate(-50%, 50%)` }}
              onClick={() => page === 3 && setSelectedPointId(point.id)}
              title={`Point (${point.x}, ${point.y})`}
            >
              {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
              {isRight && showHints && <Check className="w-2 h-2 text-white stroke-[4]" />}
              {isWrong && showHints && <span className="text-white text-[8px] font-black leading-none">!</span>}
            </button>
          );
        })}

        {/* Render Centroids (Draggable Minimalist Crosses) */}
        {centroids.filter(c => c.isPlaced).map((centroid) => {
          const isBeingDragged = draggingCentroidId === centroid.id;
          const isAligned = page === 4 && isCentroidInTargetPosition(centroid);
          
          return (
            <div
              key={centroid.id}
              className={`centroid-node absolute z-40 select-none -translate-x-1/2 translate-y-1/2 transition-all duration-300
                ${page === 3 && selectedPointId ? "pointer-events-auto cursor-pointer hover:scale-130 active:scale-110" : interactive ? "pointer-events-auto cursor-grab active:cursor-grabbing" : "pointer-events-none"}
                ${isBeingDragged ? "scale-115 z-50" : ""}
                ${isAligned ? "ring-4 ring-emerald-400/30 rounded-full" : ""}
              `}
              style={{ left: `${toDisplayX(centroid.x)}%`, bottom: `${toDisplayY(centroid.y)}%` }}
              onPointerDown={interactive ? (e) => handleCentroidPointerDown(centroid.id, e) : undefined}
              onPointerUp={interactive ? (e) => handleCentroidPointerUp(centroid.id, e) : undefined}
              onClick={page === 3 && selectedPointId ? () => {
                setPoints(prev => 
                  prev.map(p => p.id === selectedPointId ? { ...p, assignedCentroidId: centroid.id } : p)
                );
                setSelectedPointId(null);
              } : undefined}
            >
              {/* Custom Minimalist Clean Cross Mark */}
              <div className="relative flex items-center justify-center w-10 h-10 group">
                <div className="absolute inset-0 rounded-full bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                {/* Clean 3px width/height lines */}
                <div className="absolute w-5 h-0.75 rounded-sm" style={{ backgroundColor: centroid.color }} />
                <div className="absolute h-5 w-0.75 rounded-sm" style={{ backgroundColor: centroid.color }} />
                
                {/* Central pin */}
                <div className="absolute w-1.5 h-1.5 bg-white rounded-full border border-gray-400 shadow-xs" />

                {/* Floating Centroid Index */}
                <span className="absolute -top-3.5 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-white border border-gray-200 text-gray-700 shadow-xs pointer-events-none">
                  C{centroid.id + 1}
                </span>

                {/* Aligned Badge on Page 4 */}
                {page === 4 && isAligned && (
                  <span className="absolute -bottom-4 px-1 py-0.2 text-[8px] font-sans font-bold bg-emerald-500 text-white border border-emerald-600 rounded shadow-xs animate-bounce pointer-events-none whitespace-nowrap z-50">
                    aligned
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Interactive Coordinate Axis Labels */}
        <div className="absolute left-3 top-3 pointer-events-none text-[9px] font-mono font-bold text-gray-400">
          Y-Axis
        </div>
        <div className="absolute right-3 bottom-3 pointer-events-none text-[9px] font-mono font-bold text-gray-400">
          X-Axis
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111827] font-sans flex flex-col overflow-hidden select-none">
      
      {/* 1. TOP HEADER */}
      <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white rounded-full" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight font-display">
            K-Means Processor <span className="text-gray-400 font-normal ml-2 text-sm">v1.0.5</span>
          </h1>
        </div>
        {page > 1 && (
          <div className="flex gap-2">
            <div className="px-3 py-1 bg-gray-50 rounded text-xs font-mono border border-gray-200 font-semibold text-gray-600">
              K: {k}
            </div>
            <div className="px-3 py-1 bg-gray-50 rounded text-xs font-mono border border-gray-200 font-semibold text-gray-600">
              N: {n}
            </div>
            <div className="px-3 py-1 bg-black text-white rounded text-xs font-mono font-bold">
              Iter: {iteration}
            </div>
          </div>
        )}
      </header>

      {/* 2. MAIN WORKSPACE */}
      {page === 1 ? (
        // Mode 1: Configuration view centered
        <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 overflow-y-auto">
          <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl p-8 shadow-sm space-y-6">
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                <Layers className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold tracking-tight font-display text-gray-900">Configure Processor</h2>
              <p className="text-xs text-gray-500">
                Set the hyperparameters to generate your custom clustering problem space.
              </p>
            </div>

            <div className="h-px bg-gray-100" />

            {/* K clusters */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs uppercase tracking-wider text-gray-400 font-bold font-mono">Clusters (k)</label>
                <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-xs font-mono font-bold border border-gray-200">
                  {k}
                </span>
              </div>
              <input 
                type="range" 
                min="2" 
                max="5" 
                value={k}
                onChange={(e) => setK(parseInt(e.target.value))}
                className="w-full accent-black h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer animate-none"
              />
              <div className="flex justify-between text-[10px] font-mono text-gray-400">
                <span>2 clusters</span>
                <span>3</span>
                <span>4</span>
                <span>5 clusters</span>
              </div>
            </div>

            {/* N points */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs uppercase tracking-wider text-gray-400 font-bold font-mono">Data Points (n)</label>
                <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-xs font-mono font-bold border border-gray-200">
                  {n}
                </span>
              </div>
              <input 
                type="range" 
                min="10" 
                max="30" 
                value={n}
                onChange={(e) => setN(parseInt(e.target.value))}
                className="w-full accent-black h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer animate-none"
              />
              <div className="flex justify-between text-[10px] font-mono text-gray-400">
                <span>10 points</span>
                <span>20</span>
                <span>30 points</span>
              </div>
            </div>

            <button 
              id="start-lab-btn"
              onClick={handleStartGame}
              className="w-full bg-black hover:bg-gray-800 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors text-sm shadow-sm font-display mt-6"
            >
              <span>Initialize Dataset</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        // Mode 2: Sidebar + Center coordinate plot split view
        <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT SIDEBAR */}
          <aside className="w-80 border-r border-gray-200 bg-white p-6 flex flex-col justify-between shrink-0 overflow-y-auto">
            <div className="space-y-6">
              
              {/* Stepper tracking */}
              <div className="space-y-4">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-4 font-mono">Process Status</p>
                <div className="space-y-3.5">
                  {[
                    { id: 1, name: "Configuration" },
                    { id: 2, name: "Centroid Init" },
                    { id: 3, name: "Point Assignment" },
                    { id: 4, name: "Centroid Update" },
                    { id: 5, name: "Result / Converged" }
                  ].map((step) => {
                    const isCompleted = page > step.id || (step.id === 5 && page === 5);
                    const isActive = page === step.id;
                    return (
                      <div 
                        key={step.id} 
                        className={`flex items-center gap-3 transition-opacity duration-300 ${isActive ? "" : "opacity-45"}`}
                      >
                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-mono font-bold transition-all
                          ${isCompleted ? "bg-emerald-500 border-emerald-500 text-white" : ""}
                          ${isActive ? "bg-black border-black text-white" : "border-gray-300 text-gray-500"}
                        `}>
                          {isCompleted && step.id !== 5 ? "✓" : `0${step.id}`}
                        </div>
                        <span className={`text-sm ${isActive ? "font-bold text-gray-900" : "font-medium text-gray-600"}`}>
                          {step.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DYNAMIC SIDEBAR INTERACTIVE CONTENT PANEL */}
              {page === 2 && (
                <div className="pt-6 border-t border-gray-100">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-3 font-mono">Centroids Initializer</p>
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                    {centroids.map((centroid) => (
                      <div 
                        key={centroid.id}
                        className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <div className="relative w-4 h-4 flex items-center justify-center">
                            <div className="absolute w-3.5 h-0.75" style={{ backgroundColor: centroid.color }} />
                            <div className="absolute h-3.5 w-0.75" style={{ backgroundColor: centroid.color }} />
                          </div>
                          <span className="text-xs font-bold text-gray-800 font-mono">C{centroid.id + 1}</span>
                        </div>
                        {centroid.isPlaced ? (
                          <span className="text-emerald-600 bg-emerald-50 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                            ({centroid.x}, {centroid.y})
                          </span>
                        ) : (
                          <button 
                            onClick={() => handlePlaceCentroidDirectly(centroid.id)}
                            className="text-[10px] font-bold px-2 py-1 rounded bg-white hover:bg-gray-50 border border-gray-200 cursor-pointer text-gray-700 transition-colors"
                          >
                            Place Centroid
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {page === 3 && (
                <div className="pt-6 border-t border-gray-100">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold font-mono">Selected Point</p>
                    <button 
                      onClick={() => setShowHints(!showHints)}
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors cursor-pointer
                        ${showHints ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-500 border-gray-200"}
                      `}
                    >
                      {showHints ? "Hints On" : "Hints Off"}
                    </button>
                  </div>
                  {selectedPointId ? (
                    (() => {
                      const point = points.find(p => p.id === selectedPointId);
                      if (!point) return null;
                      return (
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500 font-mono">Coordinates</span>
                            <span className="text-xs font-mono font-bold">X: {point.x}, Y: {point.y}</span>
                          </div>
                          <div className="h-px bg-gray-200 my-1" />
                          <div className="space-y-1.5">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 font-mono block">Distances:</span>
                            {centroids.filter(c => c.isPlaced).map((centroid) => {
                              const dist = parseFloat(getDistance(point, centroid).toFixed(2));
                              const isClosest = centroid.id === point.correctCentroidId;
                              const isAssigned = point.assignedCentroidId === centroid.id;
                              
                              return (
                                <button
                                  key={centroid.id}
                                  onClick={() => handleAssignPoint(centroid.id)}
                                  className={`w-full flex items-center justify-between p-1.5 rounded text-[10px] font-mono border transition-all cursor-pointer text-left
                                    ${isAssigned 
                                      ? "bg-slate-900 border-slate-900 text-white" 
                                      : isClosest 
                                        ? "bg-gray-100 border-gray-300 text-gray-900 font-bold animate-pulse" 
                                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                                    }
                                  `}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: centroid.color }} />
                                    <span>Cluster C{centroid.id + 1}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span>d={dist}</span>
                                    {isClosest && !isAssigned && (
                                      <span className="text-[8px] uppercase font-bold bg-emerald-500 text-white px-1 py-0.2 rounded font-sans ml-1">
                                        Closest
                                      </span>
                                    )}
                                    {isAssigned && (
                                      <span className="text-[8px] uppercase font-bold bg-white text-slate-950 px-1 py-0.2 rounded font-sans ml-1">
                                        Assigned
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 border border-dashed border-gray-300 text-center text-xs text-gray-400 py-6">
                      <MousePointer className="w-4 h-4 mx-auto text-gray-300 mb-1.5" />
                      <span>No point selected</span>
                      <span className="block text-[10px] text-gray-400 mt-1">Click a gray or colored circular dot on the grid coordinates.</span>
                    </div>
                  )}

                  {/* Membership Convergence Status Card */}
                  {allAssignmentsCorrect && (
                    <div className={`p-3 rounded-lg border flex flex-col gap-1 transition-all
                      ${hasMembershipChanged 
                        ? "bg-amber-50/50 border-amber-200" 
                        : "bg-emerald-50/50 border-emerald-200"
                      }
                    `}>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 font-mono">
                        Convergence Check
                      </span>
                      <p className={`text-xs font-bold
                        ${hasMembershipChanged ? "text-amber-800" : "text-emerald-800"}
                      `}>
                        {hasMembershipChanged 
                          ? "there is a change in cluster membership" 
                          : "there is no change in cluster membership"
                        }
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {hasMembershipChanged 
                          ? "Because cluster memberships have changed since the previous iteration, we must update the centroid positions again."
                          : "No memberships changed! This means the algorithm has converged and successfully found the optimal clustering."
                        }
                      </p>
                    </div>
                  )}
                </div>
              )}

              {page === 4 && (
                <div className="pt-6 border-t border-gray-100">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold font-mono">Update Means</p>
                    <button 
                      onClick={handleSnapToTargets}
                      disabled={isAnimating}
                      className="text-[9px] font-mono font-bold bg-gray-100 text-gray-800 border border-gray-300 hover:bg-gray-200 disabled:opacity-50 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      Perfect Align
                    </button>
                  </div>

                  {/* Centroid Update Initiation Action Button */}
                  <button
                    onClick={handleAnimateCentroids}
                    disabled={isAnimating}
                    className={`w-full py-2.5 px-4 mb-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all border cursor-pointer shadow-sm
                      ${isAnimating
                        ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse cursor-not-allowed"
                        : allCentroidsAligned
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : "bg-amber-500 text-white border-amber-600 hover:bg-amber-600 active:scale-[0.98]"
                      }
                    `}
                  >
                    <Play className={`w-3.5 h-3.5 ${isAnimating ? "animate-spin" : ""}`} />
                    {isAnimating ? "Updating Positions..." : allCentroidsAligned ? "Centroids Updated" : "Initiate Centroid Update"}
                  </button>

                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    {centroids.map((centroid) => {
                      const target = targetCentroidPositions[centroid.id];
                      const dist = target ? getDistance(centroid, target) : 0;
                      const isAligned = isCentroidInTargetPosition(centroid);
                      return (
                        <div 
                          key={centroid.id}
                          className={`p-2 rounded-lg border flex items-center justify-between text-xs transition-colors
                            ${isAligned ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-gray-50 border-gray-200 text-gray-700"}
                          `}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: centroid.color }} />
                            <span className="font-bold font-mono">C{centroid.id + 1}</span>
                          </div>
                          <div className="text-right text-[10px] font-mono">
                            {isAligned ? (
                              <span className="text-emerald-700 font-bold font-sans">✓ Aligned</span>
                            ) : (
                              <span>Dist: {dist.toFixed(1)}u</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {page === 5 && (
                <div className="pt-6 border-t border-gray-100">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-3 font-mono">Clustering Stats</p>
                  <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                    <div className="bg-white p-2 rounded border border-gray-150">
                      <span className="block text-[8px] font-semibold text-gray-400 uppercase font-mono">Clusters (k)</span>
                      <span className="text-sm font-bold text-gray-800 font-mono">{k}</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-gray-150">
                      <span className="block text-[8px] font-semibold text-gray-400 uppercase font-mono">Points (n)</span>
                      <span className="text-sm font-bold text-gray-800 font-mono">{n}</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-gray-150">
                      <span className="block text-[8px] font-semibold text-gray-400 uppercase font-mono">Iterations</span>
                      <span className="text-sm font-bold text-gray-800 font-mono">{iteration}</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-gray-150">
                      <span className="block text-[8px] font-semibold text-gray-400 uppercase font-mono">Status</span>
                      <span className="text-xs font-bold text-emerald-600 font-mono">Converged</span>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* PROGRESS / FOOTNOTE SECTION IN SIDEBAR */}
            <div className="mt-auto pt-4 border-t border-gray-100 space-y-3">
              {page === 2 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400 font-mono">Initialization Status</p>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-black transition-all duration-300" 
                      style={{ width: `${(centroids.filter(c => c.isPlaced).length / k) * 100}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-gray-400 font-mono">
                    {centroids.filter(c => c.isPlaced).length} of {k} centroids initialized on grid coordinates.
                  </p>
                </div>
              )}

              {page === 3 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                    <span>Assignments Accuracy</span>
                    <span>{correctCount} / {n}</span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-black transition-all duration-300" 
                      style={{ width: `${(correctCount / n) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {page === 4 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400 font-mono">Update Alignment</p>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-black transition-all duration-300" 
                      style={{ width: `${(centroids.filter(c => isCentroidInTargetPosition(c)).length / k) * 100}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-gray-400 font-mono">
                    {centroids.filter(c => isCentroidInTargetPosition(c)).length} of {k} centroids in target mean center.
                  </p>
                </div>
              )}

              {page === 5 && (
                <p className="text-[10px] text-gray-500 leading-tight italic">
                  Mathematical centroid locations match cluster averages. Stable clustering partition reached.
                </p>
              )}
            </div>
          </aside>

          {/* MAIN COORDINATE PLOT PANEL */}
          <div className="flex-1 bg-gray-50 relative flex flex-col items-center justify-center p-8 overflow-hidden">
            {renderCoordinateGrid(page === 2 || page === 4)}
            
            {/* Horizontal coordinate axis marker */}
            <div className="w-full max-w-lg flex justify-between px-2.5 text-[9px] font-mono text-gray-400 font-bold mt-2.5">
              <span>({dataMinX.toFixed(1)}, {dataMinY.toFixed(1)})</span>
              <span>X: {(dataMinX + (dataMaxX - dataMinX) * 0.25).toFixed(1)}</span>
              <span>X: {(dataMinX + (dataMaxX - dataMinX) * 0.5).toFixed(1)}</span>
              <span>X: {(dataMinX + (dataMaxX - dataMinX) * 0.75).toFixed(1)}</span>
              <span>({dataMaxX.toFixed(1)}, {dataMaxY.toFixed(1)})</span>
            </div>
          </div>

        </div>
      )}

      {/* 3. DYNAMIC FOOTER CONTROL PANEL */}
      {page > 1 && (
        <footer className="h-20 border-t border-gray-200 bg-white flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-2">
            {page === 2 && (
              <>
                <div className={`w-2 h-2 rounded-full ${allCentroidsPlaced ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
                <span className="text-xs text-gray-500">
                  {allCentroidsPlaced 
                    ? "Initialization verified. Centroids placed." 
                    : `Drag or place all remaining ${k - centroids.filter(c => c.isPlaced).length} centroid crosses.`
                  }
                </span>
              </>
            )}
            {page === 3 && (
              <>
                <div className={`w-2 h-2 rounded-full ${allAssignmentsCorrect ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
                <span className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                  {allAssignmentsCorrect ? (
                    <>
                      <span>Point partition accuracy: 100% correct assignments.</span>
                      <span className={`font-mono font-semibold px-2 py-0.5 rounded text-[10px]
                        ${hasMembershipChanged 
                          ? "bg-amber-100 text-amber-800 border border-amber-200" 
                          : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        }
                      `}>
                        {hasMembershipChanged 
                          ? "there is a change in cluster membership" 
                          : "there is no change in cluster membership"
                        }
                      </span>
                    </>
                  ) : (
                    `Please assign all points correctly to closest centroids. (${correctCount}/${n} correct)`
                  )}
                </span>
              </>
            )}
            {page === 4 && (
              <>
                <div className={`w-2 h-2 rounded-full ${allCentroidsAligned ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
                <span className="text-xs text-gray-500">
                  {allCentroidsAligned 
                    ? "Centroids located at center of gravity (true cluster mean)." 
                    : "Update centroid positions by clicking 'Initiate Centroid Update' to animate them."
                  }
                </span>
              </>
            )}
            {page === 5 && (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-gray-500">
                  Converged clustering solution reached in {iteration} steps.
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleRestart}
              className="px-6 py-2 text-gray-500 hover:text-gray-950 font-medium text-sm cursor-pointer transition-colors"
            >
              Restart
            </button>
            
            {page === 2 && (
              <button 
                id="page2-next-btn"
                disabled={!allCentroidsPlaced}
                onClick={() => setPage(3)}
                className={`px-8 py-2 font-bold text-sm rounded-lg border transition-all cursor-pointer
                  ${allCentroidsPlaced 
                    ? "bg-black text-white hover:bg-gray-800 shadow-sm border-black" 
                    : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"}
                `}
              >
                Next Step
              </button>
            )}

            {page === 3 && (
              <button 
                id="page3-next-btn"
                disabled={!allAssignmentsCorrect}
                onClick={handlePage3Next}
                className={`px-8 py-2 font-bold text-sm rounded-lg border transition-all cursor-pointer
                  ${allAssignmentsCorrect 
                    ? "bg-black text-white hover:bg-gray-800 shadow-sm border-black animate-bounce" 
                    : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"}
                `}
              >
                {hasMembershipChanged ? "Next" : "Finish"}
              </button>
            )}

            {page === 4 && (
              <button 
                id="page4-next-btn"
                disabled={!allCentroidsAligned}
                onClick={handlePage4Next}
                className={`px-8 py-2 font-bold text-sm rounded-lg border transition-all cursor-pointer
                  ${allCentroidsAligned 
                    ? "bg-black text-white hover:bg-gray-800 shadow-sm border-black" 
                    : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"}
                `}
              >
                Next Step
              </button>
            )}

            {page === 5 && (
              <button 
                id="restart-lab-btn"
                onClick={handleRestart}
                className="px-8 py-2 bg-black text-white hover:bg-gray-800 font-bold text-sm rounded-lg shadow-sm cursor-pointer transition-all border border-black"
              >
                Play Again
              </button>
            )}
          </div>
        </footer>
      )}

    </div>
  );
}
