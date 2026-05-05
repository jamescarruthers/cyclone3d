// Phase 4 fragment shader. Lambert with a single directional light + ambient.
// Phase 5 replaces water tinting with the depth-band shader.

precision highp float;

uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uAmbient;

varying vec3 vWorldPos;
varying vec3 vColor;
varying vec3 vNormal;

void main() {
    vec3 N = normalize(vNormal);
    // abs() so side walls light correctly from either face — they may flip
    // orientation as adjacent water cells animate independently.
    float NdotL = abs(dot(N, -normalize(uLightDir)));
    vec3 lit = vColor * (uAmbient + uLightColor * NdotL);
    gl_FragColor = vec4(lit, 1.0);
}
