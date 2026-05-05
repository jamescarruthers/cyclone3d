// Phase 4 vertex shader. Each vertex carries (XZ, role, wave-eval data).
// Y is overwritten by the shader from the wave function evaluated at the
// vertex's wave-eval centre — NOT at its world XZ. This preserves the
// flat-top per-cell property (SPEC §Three.js gotchas).

#define NUM_GERSTNER_WAVES 8
#define GRAVITY 9.81
#define PI 3.14159265358979

uniform float uTime;
uniform vec2 uWaveDir[NUM_GERSTNER_WAVES];
uniform float uWavelength[NUM_GERSTNER_WAVES];
uniform float uAmplitude[NUM_GERSTNER_WAVES];
uniform float uPhase[NUM_GERSTNER_WAVES];
uniform float uWaveAmpDeep;
uniform float uWaveAmpShore;
uniform float uDropoffDepth; // negative metres
uniform float uSeaLevel;
uniform float uWaveStepRatio;

// Phase 6 shadow / cliff field. R = shadow attenuation in [0, 1] (1 = full
// waves, 0 = full lee). G = cliff proximity. uShadowBounds is (minX, minZ,
// sizeX, sizeZ) in world space.
uniform sampler2D uShadowMap;
uniform vec4 uShadowBounds;
uniform float uCliffChopAmplitude;

attribute vec2 aWaveCentre;
attribute float aWaveSize;
attribute float aWaveDepth;   // static heightfield at wave centre
attribute float aIsBase;      // 1 if this vertex is at fixed base depth (boundary wall bottom)
attribute float aBaseDepth;
attribute vec3 aFaceNormal;

varying vec3 vWorldPos;
varying vec3 vColor;
varying vec3 vNormal;
varying float vWaveDepth;
varying float vWaveY;

vec2 sampleShadowField(vec2 p) {
    vec2 uv = (p - uShadowBounds.xy) / uShadowBounds.zw;
    uv = clamp(uv, 0.0, 1.0);
    // Use textureLod directly (GLSL3 builtin). Three.js's GLSL3 auto-conversion
    // injects `texture2DLod → textureLod` only in the fragment shader prefix,
    // not the vertex one — so writing texture2DLod here would fail to compile.
    return textureLod(uShadowMap, uv, 0.0).rg;
}

float waveHeight(vec2 p, float cellSize, float depth) {
    float ampMod = mix(
        uWaveAmpShore,
        uWaveAmpDeep,
        smoothstep(0.0, abs(uDropoffDepth), -depth)
    );

    float h = 0.0;
    for (int i = 0; i < NUM_GERSTNER_WAVES; i++) {
        // Nyquist: skip waves the cell can't represent.
        if (uWavelength[i] < 2.0 * cellSize) continue;
        float k = 2.0 * PI / uWavelength[i];
        float omega = sqrt(GRAVITY * k);
        h += uAmplitude[i] * sin(dot(uWaveDir[i], p) * k - omega * uTime + uPhase[i]);
    }

    h *= ampMod;

    vec2 sf = sampleShadowField(p);
    float shadow = sf.x;
    float cliff = sf.y;
    h *= shadow;

    if (cliff > 0.0) {
        // Standing-wave chop near cliffs: a fast cross-pattern oscillation
        // scaled by the local depth amplitude so deep cliffs ring louder
        // than shore-line cliffs (which are amplitude-suppressed anyway).
        float chop = sin(p.x * 0.45 + uTime * 3.2) * cos(p.y * 0.55 - uTime * 2.7);
        h += cliff * uCliffChopAmplitude * ampMod * chop;
    }

    if (uWaveStepRatio <= 0.0) return h;
    float step = cellSize * uWaveStepRatio;
    return floor(h / step + 0.5) * step;
}

void main() {
    float y;
    if (aIsBase > 0.5) {
        y = aBaseDepth;
    } else if (aWaveDepth > 0.0) {
        // Land cell: use the static heightfield value directly.
        y = aWaveDepth;
    } else {
        // Water cell: oscillate around sea level by the quantised wave height.
        y = uSeaLevel + waveHeight(aWaveCentre, aWaveSize, aWaveDepth);
    }

    vec3 worldPos = vec3(position.x, y, position.z);
    vWorldPos = worldPos;
    vColor = color;
    vNormal = aFaceNormal;
    vWaveDepth = aWaveDepth;
    vWaveY = y;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
}
