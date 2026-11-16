import type { ImageSourcePropType } from 'react-native';
import { CATEGORY_ART, TEMPLATE_ART } from './artAssets';
import { HABIT_TEMPLATES } from './templates';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

// Template title -> template id (e.g. "drink water" -> "drink_water")
const TITLE_TO_TEMPLATE = new Map(HABIT_TEMPLATES.map((t) => [norm(t.title), t.id]));

// Keyword fallbacks for habits the user named themselves
const KEYWORDS: [RegExp, string][] = [
  [/water|drink|hydrat/i, 'drink_water'],
  [/vitamin|pill|supplement|medicine/i, 'take_vitamins'],
  [/sleep|bed\b|nap/i, 'sleep_early'],
  [/junk|sugar|diet|eat|food|fruit|veg|nutrition/i, 'no_junk_food'],
  [/step|walk|run|jog/i, 'walk_steps'],
  [/stretch|yoga/i, 'stretching'],
  [/gym|workout|exercise|lift|push.?up|strength|training/i, 'strength_training'],
  [/medita|mindful/i, 'meditation'],
  [/breath/i, 'deep_breathing'],
  [/gratitude|thankful/i, 'gratitude_journal'],
  [/journal|diary|write|writing/i, 'write_journal'],
  [/phone|screen|social media|scroll/i, 'no_phone_morning'],
  [/read|book/i, 'read_book'],
  [/language|spanish|french|english|hindi|german/i, 'learn_language'],
  [/course|class|lecture|study/i, 'online_course'],
  [/practice|skill|guitar|piano|code|coding|program/i, 'practice_skill'],
  [/plan|todo|to-do|schedule/i, 'plan_day'],
  [/deep work|focus|work/i, 'deep_work'],
  [/inbox|email|mail/i, 'inbox_zero'],
  [/goal|review/i, 'review_goals'],
  [/call|family|friend|mom|dad/i, 'call_family'],
  [/kind|help|volunteer/i, 'random_kindness'],
  [/draw|paint|art|music|creative|hobby/i, 'creative_hobby'],
  [/photo|camera/i, 'photography'],
];

/**
 * Picture for a habit: its template's art when the name matches a template,
 * else a keyword match, else its category's art, else a generic sparkle.
 */
export function habitArt(habit: { title: string; category?: string | null }): ImageSourcePropType {
  const templateId = TITLE_TO_TEMPLATE.get(norm(habit.title));
  if (templateId && TEMPLATE_ART[templateId]) return TEMPLATE_ART[templateId];

  for (const [re, id] of KEYWORDS) {
    if (re.test(habit.title) && TEMPLATE_ART[id]) return TEMPLATE_ART[id];
  }

  const category = (habit.category || '').toLowerCase();
  return CATEGORY_ART[category] ?? TEMPLATE_ART.default ?? CATEGORY_ART.other;
}

/** Art for a template card (falls back to the generic sparkle). */
export function templateArt(templateId: string): ImageSourcePropType {
  return TEMPLATE_ART[templateId] ?? TEMPLATE_ART.default;
}
