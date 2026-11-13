import { request } from '../../api';
export interface RecommendationSettings {
  configured: boolean;
  enabled: boolean;
  eligible: boolean;
  leads: number;
  minimum: number;
  minimumCohort: number;
  version: number;
}
export interface RecommendationPreview {
  text: string;
  usesHistory: boolean;
  cohortSize: number;
  simulation: boolean;
}
export const getSettings = () => request<RecommendationSettings>('/agent/recommendations/settings');
export const saveSettings = (enabled: boolean, version: number) =>
  request<RecommendationSettings>('/agent/recommendations/settings', 'PATCH', { enabled, version });
export const preview = (data: {
  career: string;
  availability: string;
  budget: number;
  simulation: boolean;
}) => request<RecommendationPreview>('/agent/recommendations/preview', 'POST', data);
