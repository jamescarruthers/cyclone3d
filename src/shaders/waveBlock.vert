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

attribute vec2 aWaveCentre;
attribute float aWaveSize;
attribute float aWaveDepth;   // static heightfield at wave centre
attribute float aIsBase;      // 1 if this vertex is at fixed base depth (boundary wall bottom)
attribute float aBaseDepth;
attribute vec3 aFaceNormal;

varying vec3 vWorldPos;
varying vec3 vColor;
varying vec3 vNormal;

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
    float step = max(cellSize * uWaveStepRatio, 0.001);
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

    gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
}
