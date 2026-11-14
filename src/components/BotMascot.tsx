import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

export const BotMascot = ({ size = 24, color }: { size?: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Line x1="16" y1="4" x2="16" y2="8" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    <Circle cx="16" cy="3" r="1.5" fill={color} />
    <Rect x="6" y="8" width="20" height="20" rx="6" stroke={color} strokeWidth={1.5} />
    <Circle cx="12" cy="16" r="1.8" fill={color} />
    <Circle cx="20" cy="16" r="1.8" fill={color} />
    <Path d="M12 22c1.2 1 2.8 1.5 4 1.5s2.8-.5 4-1.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" fill="none" />
    <Circle cx="9" cy="20" r="1" fill={color} opacity={0.3} />
    <Circle cx="23" cy="20" r="1" fill={color} opacity={0.3} />
  </Svg>
);

export default BotMascot;
