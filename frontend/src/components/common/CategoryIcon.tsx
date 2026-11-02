import {
  BookOpen, Briefcase, Brain, Code2, Coins, Dumbbell, GraduationCap, Heart, Leaf, Music, Palette, Rocket, Sparkles,
  Target, Trophy, FlaskConical, Bike, Camera, Globe, Lightbulb, type LucideIcon,
} from 'lucide-react';

export const ICONS: Record<string, LucideIcon> = {
  dumbbell: Dumbbell, briefcase: Briefcase, 'graduation-cap': GraduationCap, 'book-open': BookOpen, brain: Brain,
  'flask-conical': FlaskConical, heart: Heart, coins: Coins, code: Code2, music: Music, palette: Palette, rocket: Rocket,
  target: Target, trophy: Trophy, leaf: Leaf, bike: Bike, camera: Camera, globe: Globe, lightbulb: Lightbulb, sparkles: Sparkles,
};

export const ICON_NAMES = Object.keys(ICONS);

export function CategoryIcon({ name, className = 'h-5 w-5' }: { name?: string | null; className?: string }) {
  const I = (name && ICONS[name]) || Target;
  return <I className={className} />;
}
