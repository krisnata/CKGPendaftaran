import {
  UNCHECK_KEYWORDS,
  UNCHECK_PARTIAL,
  UNCHECK_CONDITIONAL_EXCLUSIONS
} from "./uncheckConfig.js";
import { FIELD_CONFIG } from "./fieldConfig.js";

export async function getUncheckConfig() {
  return {
    keywords: UNCHECK_KEYWORDS,
    partial: UNCHECK_PARTIAL,
    conditionalExclusions: UNCHECK_CONDITIONAL_EXCLUSIONS
  };
}

export async function getFieldConfig() {
  return FIELD_CONFIG;
}

export async function warmRemoteConfigCache() {
  // no-op
}

export async function invalidateRemoteConfigCache() {
  // no-op
}