#version 430

in vec2 texCoord;

out vec4 cellData;

uniform uint nHeight;
uniform uint nWidth;

const uint bcCount = 4;
const int OFB_OFFSET = 1000; // large offset that leads to out-of-bounds

layout(binding = 0) uniform sampler2D bathymetry;

// init params
uniform float lowDepth;
uniform float highDepth;
uniform float highRatio;
uniform int depthMode;

const float PI = 3.14159265359;


/*
    Integers between -2048 and 2048 can be exactly represented (and also between −2048 and 0)
    Integers above or below that get rounded
*/
void unpackBCData(float src, out ivec2 offsets) {
    uint i32 = floatBitsToUint(src);
    vec2 v = unpackHalf2x16(i32);
    offsets = ivec2(v);
}

float packBCData(int offsetx, int offsety) {
    vec2 v = vec2(offsetx, offsety);
    uint i32 = packHalf2x16(v);
    float bcData = uintBitsToFloat(i32);
    return bcData;
}

// boundary offsets for near boundary cells
float getBCData(vec2 coord) {

    // move coords to inner domain
    coord -= bcCount;

    // default is out-of-bounds
    int ox = OFB_OFFSET;
    int oy = OFB_OFFSET;

    for(int i = 0; i < bcCount; i++) {
        int offset = 1 + 2 * i;
        if(coord.x == i)
            ox = -offset;
        if(coord.x == int(nWidth - i - 1))
            ox = offset;

        if(coord.y == i)
            oy = -offset;
        if(coord.y == int(nHeight - i - 1))
            oy = offset;
    }

    return packBCData(ox,oy);
}

// Compute initial values for simulation data texture
// depth based on parameters and boundary offsets
void main () {
    ivec2 coord = ivec2(gl_FragCoord.xy - 0.5);
    float terrain = texelFetch(bathymetry, coord, 0).r;

    float vx = 0;
    float vy = 0;
    float bcData = getBCData(coord);

    // ---------------------------------------------------------------------------------
    // DEPTH

    float depth = max(0, lowDepth - terrain);
    
    if (depthMode == 0) { // X wave
        if(coord.x < nWidth * highRatio)
            depth = max(0, highDepth - terrain);
    } 
    else if (depthMode == 1){ // Middle box
        if(coord.x > nWidth * highRatio 
            && coord.x < nWidth * (1-highRatio)
            && coord.y > nHeight * highRatio 
            && coord.y < nHeight * (1-highRatio)) {
            depth = max(0, highDepth - terrain);
        }
    }
    else if (depthMode == 2) { // Y Wave
        if(coord.y < nHeight * highRatio)
            depth = max(0, highDepth - terrain);
    }
    else if (depthMode == 3) { // Ramp
        if(coord.x > (nWidth * 0.5f)) {
            float ramp = (coord.x - (nWidth * 0.5f)) * 0.1 + lowDepth;

            depth = max(0, ramp - terrain);
        }
    }
    else if (depthMode == 4) { // Convex

        float halfDepth = highDepth - lowDepth;
        float wave = halfDepth + sin(coord.x / float(nWidth) * PI) * highDepth;
        depth = max(0, wave - terrain);
    }
    else if (depthMode == 5) { // Concave
        float wave = highDepth * 1.2 + sin(coord.x / float(nWidth) * PI + PI) * highDepth;
        depth = max(0, wave - terrain);
    }
    else if (depthMode == 6) { // Bubble

        depth = max(0, lowDepth - terrain);
        if(coord.x > nWidth * highRatio 
            && coord.x < nWidth * (1-highRatio)
            && coord.y > nHeight * highRatio 
            && coord.y < nHeight * (1-highRatio)) {

            float midRatio = (1 - 2 * highRatio);
            float xWave = sin((coord.x - highRatio * nWidth) / (midRatio * float(nWidth)) * PI);
            float yWave = sin((coord.y - highRatio * nHeight) / (midRatio * float(nHeight)) * PI);

            float halfDepth = highDepth - lowDepth;
            float wave = max((xWave + yWave) * halfDepth + lowDepth - halfDepth, lowDepth);

            depth = max(0, wave - terrain);
        }
    }

    cellData = vec4(depth, vx, vy, bcData);
}