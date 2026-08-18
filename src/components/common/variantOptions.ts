import { PathValueOption, TRIVIA_QUESTION_KIND_VALUES } from './dataPathOptions';

/**
 * Switch paths a slot list can vary its template on.
 *
 * A slot list normally draws one template N times. When `variantPath` is set it
 * reads that path from game data and uses the template assigned to the matching
 * value instead — so a trivia list can show option rows for a multiple-choice
 * question and an "answer on your phone" panel for a typed one, with no
 * visibility conditions to maintain.
 *
 * Values come from the path's enum in dataPathOptions, the single source of
 * truth for enumerated path domains — the property panel offers a row per
 * possible value. Adding a switch path is adding an entry to this list.
 */

export type VariantValue = PathValueOption;

export interface VariantPathOption {
  path: string;
  label: string;
  values: VariantValue[];
}

export const VARIANT_PATH_OPTIONS: VariantPathOption[] = [
  {
    path: 'trivia.questionKind',
    label: 'Trivia Question Type',
    values: TRIVIA_QUESTION_KIND_VALUES,
  },
];

export const findVariantPath = (path: string | undefined): VariantPathOption | undefined =>
  VARIANT_PATH_OPTIONS.find(option => option.path === path);
