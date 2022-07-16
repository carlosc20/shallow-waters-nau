#version 430

in vec2 texCoord;

out vec4 cellData;

layout(binding = 0) uniform sampler2D bathymetry;
layout(binding = 1) uniform sampler2D simData;

uniform float oodx;

// computes normal and water surface height
void main () {
    ivec2 coord = ivec2(gl_FragCoord.xy - 0.5);

    float terrain = texelFetch(bathymetry, coord, 0).r; 
    float depth = texelFetch(simData, coord, 0).r;

    // ---------------------------------------------------------------------------------
    // normal

    float td = texelFetchOffset(simData, coord, 0, ivec2( 0,  1)).r;
    float bd = texelFetchOffset(simData, coord, 0, ivec2( 0, -1)).r;
    float ld = texelFetchOffset(simData, coord, 0, ivec2(-1,  0)).r;
    float rd = texelFetchOffset(simData, coord, 0, ivec2( 1,  0)).r;

    float ttd = texelFetchOffset(bathymetry, coord, 0, ivec2( 0,  1)).r;
    float tbd = texelFetchOffset(bathymetry, coord, 0, ivec2( 0, -1)).r;
    float tld = texelFetchOffset(bathymetry, coord, 0, ivec2(-1,  0)).r;
    float trd = texelFetchOffset(bathymetry, coord, 0, ivec2( 1,  0)).r;

    float h1 = ((rd + trd) - (ld + tld));
    float h2 = ((td + ttd) - (bd + tbd));
	vec3 normal;
    normal.x = -h1 * oodx;
    normal.y = 2;
    normal.z = -h2 * oodx;
    normal = normalize(normal);

    // ---------------------------------------------------------------------------------
    // height

    float height = depth + terrain;

	cellData = vec4(normal, height);
}