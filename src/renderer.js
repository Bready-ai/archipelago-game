function errorInfo(error) {
  return { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack || '' };
}
function releaseContext(gl) {
  try { gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* Cleanup must preserve the startup error. */ }
}
function shaderPrecision(gl) {
  for (const name of ['highp', 'mediump']) {
    const type = name === 'highp' ? gl.HIGH_FLOAT : gl.MEDIUM_FLOAT;
    const vertex = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, type);
    const fragment = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, type);
    if (vertex?.precision > 0 && fragment?.precision > 0) return name;
  }
  throw new Error('WebGL 2 создан, но драйвер не вернул доступную точность шейдеров.');
}

// A working WebGL 2 API does not imply that every attribute profile can be created.
// Use the browser's GPU choice; never test WebGL 1 on the game canvas.
export function createGameRenderer({ WebGLRenderer, createCanvas, touch = false, diagnostics }) {
  const profiles = [
    { name: 'browser-gpu', attributes: { alpha: false, depth: true, stencil: false, antialias: !touch,
      premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'default', failIfMajorPerformanceCaveat: false } },
    { name: 'minimal-webgl2', attributes: { antialias: false, powerPreference: 'default', failIfMajorPerformanceCaveat: false } },
    { name: 'browser-defaults', attributes: undefined },
  ];
  let lastError;
  for (const profile of profiles) {
    const canvas = createCanvas(); // A rejected/partially initialized canvas is never reused.
    canvas.width = canvas.height = 1;
    const attempt = { profile: profile.name, requested: profile.attributes || 'browser defaults', phase: 'webgl2-context', status: 'pending' };
    diagnostics?.setStage(attempt.phase);
    const creationError = event => { attempt.statusMessage = event.statusMessage || 'No browser status message'; };
    canvas.addEventListener('webglcontextcreationerror', creationError);
    let gl;
    try {
      gl = profile.attributes ? canvas.getContext('webgl2', profile.attributes) : canvas.getContext('webgl2');
      if (!gl) throw new Error(attempt.statusMessage || `canvas.getContext('webgl2') returned null (${profile.name})`);
      if (gl.isContextLost()) throw new Error('Контекст WebGL 2 потерян до инициализации Three.js.');
      attempt.contextCreated = true;
      attempt.phase = 'webgl2-capabilities'; diagnostics?.setStage(attempt.phase);
      const precision = shaderPrecision(gl);
      attempt.actual = gl.getContextAttributes();
      attempt.capabilities = { version: gl.getParameter(gl.VERSION), shadingLanguage: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER), maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE), precision };
      if (!attempt.actual) throw new Error('WebGL 2 context attributes are null; the context may be lost.');
      attempt.phase = 'three-renderer'; diagnostics?.setStage(attempt.phase);
      const renderer = new WebGLRenderer({ canvas, context: gl, precision, powerPreference: 'default',
        antialias: attempt.actual.antialias, alpha: attempt.actual.alpha });
      if (gl.isContextLost()) { renderer.dispose(); throw new Error('Контекст WebGL 2 потерян при инициализации Three.js.'); }
      attempt.status = 'success';
      diagnostics?.recordAttempt(attempt);
      diagnostics?.setContext({ profile: profile.name, ...attempt.capabilities, attributes: attempt.actual });
      canvas.removeEventListener('webglcontextcreationerror', creationError);
      return renderer;
    } catch (error) {
      lastError = error; attempt.status = 'failed'; attempt.error = errorInfo(error);
      try { attempt.contextLost = gl ? gl.isContextLost() : null; } catch { /* Keep the original exception. */ }
      diagnostics?.recordAttempt(attempt);
      releaseContext(gl);
      // A JavaScript/capability error in Three.js is not a failed context negotiation.
      // Preserve the original exception instead of repeatedly hiding it behind retries.
      if (attempt.contextCreated) throw error;
    } finally {
      canvas.removeEventListener('webglcontextcreationerror', creationError);
    }
  }
  throw lastError;
}
