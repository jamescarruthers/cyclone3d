// Phase 5 fragment shader. Land vertices use the per-cell vColor; water
// vertices compute a depth-banded tint (SHALLOW → MID → DEEP) and overlay
// caustics on the shallow band plus foam where the wave surface rises near
// shore. Lighting is Lambert with abs(NdotL) so side walls render correctly
// regardless of orientation.

precision highp float;

uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uAmbient;
uniform float uTime;

uniform vec3 uShallowTint;
uniform vec3 uMidTint;
uniform vec3 uDeepTint;
uniform vec3 uFoamTint;
uniform float uShallowBand;     // metres
uniform float uMidBand;         // metres
uniform float uCausticScale;
uniform float uCausticSpeed;
uniform float uCausticIntensity;
uniform float uFoamAmpThreshold;
uniform float uFoamDepthThreshold;
uniform float uSeaLevel;

varying vec3 vWorldPos;
varying vec3 vColor;
varying vec3 vNormal;
varying float vWaveDepth;
varying float vWaveY;

vec3 waterTint(float depth) {
    float t1 = smoothstep(uShallowBand - 1.0, uShallowBand + 1.0, depth);
    float t2 = smoothstep(uMidBand - 5.0, uMidBand + 5.0, depth);
    vec3 c = mix(uShallowTint, uMidTint, t1);
    return mix(c, uDeepTint, t2);
}

float caustic(vec2 p, float t) {
    vec2 q1 = p * uCausticScale + vec2(t * uCausticSpeed, t * uCausticSpeed * 0.7);
    vec2 q2 = p * uCausticScale * 1.3 - vec2(t * uCausticSpeed * 0.5, t * uCausticSpeed * 0.6);
    float c = sin(q1.x) + cos(q1.y) + sin(q2.x + q2.y);
    return pow(max(c / 3.0, 0.0), 3.0);
}

void main() {
    vec3 N = normalize(vNormal);
    float NdotL = abs(dot(N, -normalize(uLightDir)));

    vec3 base;
    if (vWaveDepth > 0.0) {
        // Land vertex: use the per-cell tag colour.
        base = vColor;
    } else {
        float depth = -vWaveDepth;
        base = waterTint(depth);

        // Caustics — additive, gated to the shallow band only.
        float shallowMask = 1.0 - smoothstep(0.0, uShallowBand, depth);
        if (shallowMask > 0.0) {
            float c = caustic(vWorldPos.xz, uTime);
            base += uCausticIntensity * shallowMask * c * uShallowTint;
        }

        // Foam where the wave surface rises above sea level on a near-shore cell.
        float aboveSea = vWaveY - uSeaLevel;
        float foamFromY = smoothstep(uFoamAmpThreshold, uFoamAmpThreshold + 0.3, aboveSea);
        float foamFromDepth = 1.0 - smoothstep(0.0, uFoamDepthThreshold, depth);
        float foam = foamFromY * foamFromDepth;
        base = mix(base, uFoamTint, clamp(foam * 0.85, 0.0, 1.0));
    }

    vec3 lit = base * (uAmbient + uLightColor * NdotL);
    gl_FragColor = vec4(lit, 1.0);
}
