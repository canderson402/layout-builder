import {
  ShapeData,
  generatePath,
  normalizeColor,
  gradientCoords,
  sanitizeGradient,
  resolveStopColor,
} from '../shared/utils/shapePath';

export interface ShapeSvgProps {
  id: string; // component id — used for unique gradient defs ids
  shape: ShapeData;
  width: number;
  height: number;
  fillType?: 'solid' | 'gradient' | 'none';
  fillColor?: string;
  gradient?: unknown;
  fillOpacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  strokeDash?: number[];
  strokeCap?: 'butt' | 'round';
  useTeamColor?: boolean;
  teamColorSide?: 'home' | 'away';
  gameData?: { home_team_color?: string; away_team_color?: string };
}

export default function ShapeSvg(props: ShapeSvgProps) {
  const { id, shape, width, height, gameData } = props;
  const d = Array.isArray(shape.vertices) && shape.vertices.length >= 2
    ? generatePath(shape.vertices, shape.closed !== false, width, height)
    : shape.pathData || generatePath([], true, width, height);

  const teamColor = props.useTeamColor
    ? normalizeColor(
        props.teamColorSide === 'away' ? gameData?.away_team_color : gameData?.home_team_color,
        '#888888'
      )
    : undefined;

  const gradient = props.fillType === 'gradient' && !teamColor ? sanitizeGradient(props.gradient) : null;
  const gradientId = `shape-fill-${id}`;

  let fill = 'none';
  if (props.fillType !== 'none') {
    if (teamColor) fill = teamColor;
    else if (gradient) fill = `url(#${gradientId})`;
    else fill = normalizeColor(props.fillColor, '#4CAF50');
  }

  const strokeWidth = props.strokeWidth ?? 0;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {gradient && (
        <defs>
          {gradient.type === 'linear' ? (
            <linearGradient id={gradientId} {...gradientCoords(gradient.angle)}>
              {gradient.stops.map((s, i) => (
                <stop
                  key={i}
                  offset={s.offset}
                  stopColor={resolveStopColor(s, gameData?.home_team_color, gameData?.away_team_color)}
                />
              ))}
            </linearGradient>
          ) : (
            <radialGradient id={gradientId} cx="0.5" cy="0.5" r="0.5">
              {gradient.stops.map((s, i) => (
                <stop
                  key={i}
                  offset={s.offset}
                  stopColor={resolveStopColor(s, gameData?.home_team_color, gameData?.away_team_color)}
                />
              ))}
            </radialGradient>
          )}
        </defs>
      )}
      <path
        d={d}
        fill={fill}
        fillOpacity={props.fillOpacity ?? 1}
        stroke={strokeWidth > 0 ? normalizeColor(props.strokeColor, '#ffffff') : 'none'}
        strokeWidth={strokeWidth}
        strokeOpacity={props.strokeOpacity ?? 1}
        strokeDasharray={props.strokeDash && props.strokeDash.length > 0 ? props.strokeDash.join(' ') : undefined}
        strokeLinecap={props.strokeCap || 'butt'}
        strokeLinejoin="round"
      />
    </svg>
  );
}
