import featureFlags from '../../features.json'

type FeatureFlags = typeof featureFlags

/**
 * @description Union of all known feature flag names, derived from features.json keys.
 */
export type FeatureFlag = keyof FeatureFlags

/**
 * @description Check whether a feature flag is enabled.
 * @param flag The feature flag name to check
 * @returns true if the feature is enabled, false otherwise
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag]
}
