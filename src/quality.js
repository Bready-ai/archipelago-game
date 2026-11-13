export function chooseQuality({ touch = false, memory = 8, cores = 8 } = {}) {
  const low = memory <= 2 || cores <= 4;
  return {
    low, touch,
    pixelRatio: low ? 1 : touch ? 1.25 : 1.75,
    pixelBudget: low ? 800000 : touch ? 1300000 : 2800000,
    shadowSize: low ? 512 : touch ? 1024 : 1536,
    particleLimit: low ? 24 : touch ? 48 : 80,
    dustCount: low ? 0 : touch ? 18 : 45,
  };
}

export function renderRatio(profile, width, height, deviceRatio = 1, scale = 1) {
  return Math.max(.25, Math.min(deviceRatio, profile.pixelRatio * scale,
    Math.sqrt(profile.pixelBudget * scale * scale / Math.max(1, width * height))));
}
