export const getAbbr = (full) => {
  if (!full) return '';
  const parts = full.trim().split(/\s+/);
  return parts.length < 2 ? full : `${parts[0]} ${parts[parts.length - 1].slice(-3)}`;
};

export const subVars = (text, vars) =>
  text?.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || `{{${k}}}`) || '';
