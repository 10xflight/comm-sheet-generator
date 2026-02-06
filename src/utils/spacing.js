// Returns margin class based on grouping
// Same explicit group = very tight (single-spaced), different/no group = more space (double-spaced)
export function getSpacingClass(call, prevCall) {
  if (!prevCall) return '';
  if (call.block !== prevCall.block) return '';

  // Same explicit group = very tight (single-spaced, ~1/3 of normal)
  if (call.group && prevCall.group && call.group === prevCall.group) {
    return 'mt-0.5'; // 2px - very tight for related calls
  }

  // Default: double-spaced (more breathing room between unrelated calls)
  return 'mt-4'; // 16px - comfortable spacing
}
