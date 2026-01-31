// Returns extra top margin class if this call starts a new group
export function getSpacingClass(call, prevCall) {
  if (!prevCall) return '';
  if (call.block !== prevCall.block) return '';
  if (call.group && prevCall.group && call.group !== prevCall.group) {
    return 'mt-6';
  }
  return 'mt-1';
}
