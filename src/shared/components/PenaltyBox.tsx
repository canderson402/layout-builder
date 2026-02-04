import React from 'react';

interface Penalty {
  duration: number;
  startdeci: number;
  enddeci: number;
  eventUuid: string;
  penaltyUuid: string | null;
  playerUuid: string;
  team: 'home' | 'away';
  jersey: number;
  jersey_string?: string;
}

interface SlotPosition {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

interface PenaltyBoxProps {
  team: 'home' | 'away';
  penalties?: Penalty[];
  maxSlots?: number;
  width?: number;
  height?: number;

  // Legacy slot-based rendering (colored boxes)
  slotWidth?: number;
  slotHeight?: number;
  slotGap?: number;
  slotBackgroundColor?: string;
  slotBackgrounds?: string[];

  // Image-based rendering (multi-state backgrounds)
  backgroundImages?: Record<string, string>;
  colorOverlayImages?: Record<string, string>;
  useTeamColorOverlay?: boolean;
  teamColor?: string;
  slotPositions?: SlotPosition[];  // Legacy: single set of positions

  // Per-count slot positions - where slots are in each background image
  // e.g., { '1': [{x, y, w, h}], '2': [{...}, {...}], '3': [{...}, {...}, {...}] }
  slotPositionsByCount?: Record<string, SlotPosition[]>;

  // Common styling
  backgroundColor?: string;
  textColor?: string;
  jerseyTextColor?: string;
  timeTextColor?: string;
  jerseyFontSize?: number;
  timeFontSize?: number;

  // Preview mode - override penalty count for layout builder
  previewPenaltyCount?: number;
}

// Mock penalties for layout builder preview (3 per team for full preview)
const mockPenalties: Penalty[] = [
  {
    duration: 1200,
    startdeci: 9000,
    enddeci: 7800,
    eventUuid: 'mock-1',
    penaltyUuid: null,
    playerUuid: 'mock-player-1',
    team: 'home',
    jersey: 90,
  },
  {
    duration: 600,
    startdeci: 8983,
    enddeci: 8383,
    eventUuid: 'mock-2',
    penaltyUuid: null,
    playerUuid: 'mock-player-2',
    team: 'home',
    jersey: 3,
  },
  {
    duration: 900,
    startdeci: 9000,
    enddeci: 8100,
    eventUuid: 'mock-5',
    penaltyUuid: null,
    playerUuid: 'mock-player-5',
    team: 'home',
    jersey: 17,
  },
  {
    duration: 1800,
    startdeci: 9000,
    enddeci: 7200,
    eventUuid: 'mock-3',
    penaltyUuid: null,
    playerUuid: 'mock-player-3',
    team: 'away',
    jersey: 14,
  },
  {
    duration: 900,
    startdeci: 9000,
    enddeci: 8100,
    eventUuid: 'mock-4',
    penaltyUuid: null,
    playerUuid: 'mock-player-4',
    team: 'away',
    jersey: 22,
  },
  {
    duration: 1500,
    startdeci: 9000,
    enddeci: 7500,
    eventUuid: 'mock-6',
    penaltyUuid: null,
    playerUuid: 'mock-player-6',
    team: 'away',
    jersey: 8,
  },
];

// Mock game clock for preview (14:59 = 8990 deciseconds)
const mockClockDeciseconds = 8990;

// Format deciseconds to MM:SS
const formatPenaltyTime = (deciseconds: number): string => {
  if (deciseconds <= 0) return '0:00';
  const totalSeconds = Math.ceil(deciseconds / 10);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Helper to resolve image paths with BASE_URL
const resolveImagePath = (path: string): string => {
  if (!path) return path;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const baseUrl = import.meta.env.BASE_URL || '/';
  if (path.startsWith('/')) {
    return `${baseUrl}${path.slice(1)}`;
  }
  return `${baseUrl}${path}`;
};

function PenaltySlot({
  jersey,
  timeRemaining,
  isEmpty,
  width,
  height,
  backgroundColor,
  backgroundImage,
  jerseyTextColor,
  timeTextColor,
  jerseyFontSize,
  timeFontSize,
}: {
  jersey?: number | string;
  timeRemaining?: number;
  isEmpty: boolean;
  width: number;
  height: number;
  backgroundColor: string;
  backgroundImage?: string;
  jerseyTextColor: string;
  timeTextColor: string;
  jerseyFontSize: number;
  timeFontSize: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        backgroundColor: backgroundImage ? 'transparent' : backgroundColor,
        backgroundImage: backgroundImage ? `url(${resolveImagePath(backgroundImage)})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {!isEmpty && (
        <>
          <span
            style={{
              color: jerseyTextColor,
              fontSize: jerseyFontSize,
              fontWeight: 'bold',
              textAlign: 'center',
            }}
          >
            {jersey}
          </span>
          <div
            style={{
              width: '60%',
              height: 1,
              backgroundColor: '#666',
              margin: '2px 0',
              borderTop: '1px dotted #888',
            }}
          />
          <span
            style={{
              color: timeTextColor,
              fontSize: timeFontSize,
              fontWeight: 'bold',
              textAlign: 'center',
            }}
          >
            {formatPenaltyTime(timeRemaining || 0)}
          </span>
        </>
      )}
    </div>
  );
}

function PenaltyTextOverlay({
  jersey,
  timeRemaining,
  position,
  jerseyTextColor,
  timeTextColor,
  jerseyFontSize,
  timeFontSize,
}: {
  jersey: number | string;
  timeRemaining: number;
  position: SlotPosition;
  jerseyTextColor: string;
  timeTextColor: string;
  jerseyFontSize: number;
  timeFontSize: number;
}) {
  const slotWidth = position.width || 100;
  const slotHeight = position.height || 80;

  return (
    <div
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: slotWidth,
        height: slotHeight,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <span
        style={{
          color: jerseyTextColor,
          fontSize: jerseyFontSize,
          fontWeight: 'bold',
          textAlign: 'center',
        }}
      >
        {jersey}
      </span>
      <div
        style={{
          width: '60%',
          height: 1,
          backgroundColor: '#666',
          margin: '2px 0',
          borderTop: '1px dotted #888',
        }}
      />
      <span
        style={{
          color: timeTextColor,
          fontSize: timeFontSize,
          fontWeight: 'bold',
          textAlign: 'center',
        }}
      >
        {formatPenaltyTime(timeRemaining)}
      </span>
    </div>
  );
}

export default function PenaltyBox({
  team,
  penalties,
  maxSlots = 3,
  width = 300,
  height = 80,
  slotWidth = 90,
  slotHeight = 70,
  slotGap = 8,
  backgroundColor = 'transparent',
  slotBackgroundColor = '#1a1a1a',
  slotBackgrounds,
  backgroundImages,
  colorOverlayImages,
  useTeamColorOverlay = false,
  teamColor,
  slotPositions,
  slotPositionsByCount,
  textColor = '#ffffff',
  jerseyTextColor,
  timeTextColor,
  jerseyFontSize = 28,
  timeFontSize = 20,
  previewPenaltyCount,
}: PenaltyBoxProps) {
  // Use mock penalties if none provided (for layout builder preview)
  const effectivePenalties = penalties || mockPenalties;

  // Ensure font sizes are valid numbers
  const effectiveJerseyFontSize = typeof jerseyFontSize === 'number' && jerseyFontSize > 0 ? jerseyFontSize : 28;
  const effectiveTimeFontSize = typeof timeFontSize === 'number' && timeFontSize > 0 ? timeFontSize : 20;

  // Use individual text colors or fall back to textColor
  const effectiveJerseyColor = jerseyTextColor || textColor || '#ffffff';
  const effectiveTimeColor = timeTextColor || textColor || '#ffffff';

  // Filter penalties for this team and calculate remaining time
  const activePenalties = effectivePenalties
    .filter(p => p.team === team)
    .map(p => ({
      ...p,
      timeRemaining: mockClockDeciseconds - p.enddeci,
    }))
    .filter(p => p.timeRemaining > 0)
    .sort((a, b) => a.timeRemaining - b.timeRemaining);

  // Count of visible penalties (capped at maxSlots)
  // Use previewPenaltyCount if provided (for layout builder preview cycling)
  const visibleCount = previewPenaltyCount !== undefined
    ? Math.min(previewPenaltyCount, maxSlots)
    : Math.min(activePenalties.length, maxSlots);

  // Check if we're using image-based rendering
  const useImageMode = backgroundImages && Object.keys(backgroundImages).length > 0;

  // Get all slot positions (fixed positions for all 3 slots)
  const getAllSlotPositions = (): SlotPosition[] => {
    if (slotPositions && slotPositions.length > 0) {
      return slotPositions;
    }

    // Auto-calculate slot dimensions based on box size
    // Slots take up ~80% of width with gaps, maintaining aspect ratio
    const availableWidth = width * 0.9;
    const gap = slotGap || 8;
    const totalGaps = (maxSlots - 1) * gap;
    const slotW = Math.floor((availableWidth - totalGaps) / maxSlots);
    const slotH = Math.floor(height * 0.85);

    const totalSlotsWidth = maxSlots * slotW + totalGaps;
    const startX = (width - totalSlotsWidth) / 2;
    const startY = (height - slotH) / 2;

    return Array.from({ length: maxSlots }, (_, i) => ({
      x: startX + i * (slotW + gap),
      y: startY,
      width: slotW,
      height: slotH,
    }));
  };

  const allSlotPositions = getAllSlotPositions();

  // Which slot indices to use for each count (0-indexed)
  // Default: rightmost slots (1 penalty = last slot, 2 = last two, etc.)
  const getSlotIndicesForCount = (count: number): number[] => {
    if (count === 0) return [];
    // Use rightmost slots by default
    const indices: number[] = [];
    for (let i = maxSlots - count; i < maxSlots; i++) {
      indices.push(i);
    }
    return indices;
  };

  const activeSlotIndices = getSlotIndicesForCount(visibleCount);
  const currentSlotPositions = activeSlotIndices.map(i => allSlotPositions[i]).filter(Boolean);

  if (useImageMode) {
    // Image-based rendering mode
    const bgImage = backgroundImages[String(visibleCount)] || backgroundImages['0'];
    const colorOverlay = colorOverlayImages?.[String(visibleCount)];

    return (
      <div
        style={{
          width,
          height,
          backgroundColor,
          position: 'relative',
        }}
      >
        {/* Background image based on penalty count */}
        {bgImage && (
          <img
            src={resolveImagePath(bgImage)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
            alt=""
          />
        )}

        {/* Team color overlay - CSS filter for tinting */}
        {useTeamColorOverlay && colorOverlay && teamColor && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: teamColor,
              maskImage: `url(${resolveImagePath(colorOverlay)})`,
              WebkitMaskImage: `url(${resolveImagePath(colorOverlay)})`,
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskPosition: 'center',
            }}
          />
        )}

        {/* Text overlays for each penalty - uses positions defined for this count */}
        {activePenalties.slice(0, visibleCount).map((penalty, index) => {
          const position = currentSlotPositions[index];
          if (!position) return null;

          return (
            <PenaltyTextOverlay
              key={penalty.eventUuid}
              jersey={penalty.jersey_string || penalty.jersey}
              timeRemaining={penalty.timeRemaining}
              position={position}
              jerseyTextColor={effectiveJerseyColor}
              timeTextColor={effectiveTimeColor}
              jerseyFontSize={effectiveJerseyFontSize}
              timeFontSize={effectiveTimeFontSize}
            />
          );
        })}
      </div>
    );
  }

  // Legacy slot-based rendering mode
  const slots: Array<{ penalty: typeof activePenalties[0] } | null> = [];
  for (let i = 0; i < maxSlots; i++) {
    if (i < activePenalties.length) {
      slots.push({ penalty: activePenalties[i] });
    } else {
      slots.push(null);
    }
  }

  return (
    <div
      style={{
        width,
        height,
        backgroundColor,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: slotGap,
        }}
      >
        {slots.map((slot, index) => (
          <PenaltySlot
            key={slot?.penalty.eventUuid || `empty-${index}`}
            jersey={slot?.penalty.jersey_string || slot?.penalty.jersey}
            timeRemaining={slot?.penalty.timeRemaining}
            isEmpty={!slot}
            width={slotWidth}
            height={slotHeight}
            backgroundColor={slotBackgroundColor}
            backgroundImage={slotBackgrounds?.[index]}
            jerseyTextColor={effectiveJerseyColor}
            timeTextColor={effectiveTimeColor}
            jerseyFontSize={effectiveJerseyFontSize}
            timeFontSize={effectiveTimeFontSize}
          />
        ))}
      </div>
    </div>
  );
}
