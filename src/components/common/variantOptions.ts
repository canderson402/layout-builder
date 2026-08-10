/**
 * Switch paths a slot list can vary its template on.
 *
 * A slot list normally draws one template N times. When `variantPath` is set it
 * reads that path from game data and uses the template assigned to the matching
 * value instead — so a trivia list can show option rows for a multiple-choice
 * question and an "answer on your phone" panel for a typed one, with no
 * visibility conditions to maintain.
 *
 * Values are enumerated here because the property panel needs to offer a row
 * per possible value. Adding a switch path is adding an entry to this list.
 */
export interface VariantValue {
  value: string;
  label: string;
}

export interface VariantPathOption {
  path: string;
  label: string;
  values: VariantValue[];
}

export const VARIANT_PATH_OPTIONS: VariantPathOption[] = [
  {
    path: 'trivia.questionKind',
    label: 'Trivia Question Type',
    values: [
      { value: 'true_false', label: 'True / False' },
      { value: 'multiple_choice', label: 'Multiple Choice' },
      { value: 'multiple_select', label: 'Multiple Choice (Select Many)' },
      { value: 'text_input', label: 'Text Answer' },
      { value: 'number_input', label: 'Number Answer' },
    ],
  },
];

export const findVariantPath = (path: string | undefined): VariantPathOption | undefined =>
  VARIANT_PATH_OPTIONS.find(option => option.path === path);
