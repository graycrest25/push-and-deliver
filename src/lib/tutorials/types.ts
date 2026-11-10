export interface TutorialStep {
  title: string;
  description: string;
}

export interface Tutorial {
  title: string;
  steps: TutorialStep[];
}

export interface FeatureHelp {
  path: string;
  page: Tutorial;
  detail?: Tutorial;
  sections?: Record<string, Tutorial>;
}
