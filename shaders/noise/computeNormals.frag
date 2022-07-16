#version 430

layout(binding = 0) uniform sampler2D noiseTex;

in vec2 texCoord;

out vec3 outColor;

uniform uint texWidth;
uniform uint texHeight;

void main() {

    ivec2 texCoords = ivec2(texCoord.x * texWidth, texCoord.y * texHeight);

    // computes gradient/normal using central differences
    float h1, h2;
    if (texCoords.x == 0 || texCoords.x == texWidth - 1)
		h1 = 0;
    else
        h1 = texelFetchOffset(noiseTex, texCoords, 0, ivec2( 1, 0)).r  - texelFetchOffset(noiseTex, texCoords, 0, ivec2(-1, 0)).r;
    if (texCoords.y == 0 || texCoords.y == texHeight - 1)
        h2 = 0;
    else
        h2 = texelFetchOffset(noiseTex, texCoords, 0, ivec2( 0,  1)).r - texelFetchOffset(noiseTex, texCoords, 0, ivec2( 0, -1)).r;

    vec3 normal;
    normal.x = -h1;
    normal.y = h2;
    normal.z = 1.0/float(texWidth) * 50; // roughly match scale with Perlin
    normal = normalize(normal);

    outColor = (normal + 1) / 2;  // [-1, 1] -> [0, 1]

    //outColor = texelFetch(noiseTex, texCoords, 0).rgb;
}