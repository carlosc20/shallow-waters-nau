#version 420


//=======================================================================================
// in out
in vec4 position;  // bathymetry
// already has + bcCount shift for inner domain

out Data {
	vec3 eye;
	vec3 lightDir;
    vec3 position;
    mat3 tbn;
    vec3 debug;
    float depth;
} DataOut;

//=======================================================================================
// transform
uniform mat4 m_view;
uniform	mat4 m_pvm;
uniform mat4 m_model;
uniform mat4 m_viewModel;

uniform vec3 cameraPos;


// lighting
uniform	vec4 lightDir;

// simulation
const int bcCount = 4;
uniform float dx;
uniform float threshold;

uniform uint nHeight;
uniform uint nWidth;

uniform int wetDryFix;

uniform float test;

// textures
layout(binding = 0) uniform sampler2D bathymetry;   
layout(binding = 1) uniform sampler2D simData1;  
layout(binding = 2) uniform sampler2D simData2;  
layout(binding = 8) uniform sampler2D normalAndHeight;  
uniform int activeTex;

// debug
layout(binding = 5) uniform sampler2D normalTex;

//=======================================================================================
void main() {

    ivec2 texCoords = ivec2(position.x + bcCount, position.z + bcCount);

    vec3 normal = texelFetch(normalAndHeight, texCoords, 0).xyz;
    float height = texelFetch(normalAndHeight, texCoords, 0).w;

    float depth = height - position.y;
    float terrain = position.y;
    vec4 pos = position;

    // ---------------------------------------------------------------------------------------
    // normals

    vec3 t1 = cross(normal, vec3(0,1,0));
    vec3 t2 = cross(normal, vec3(0,0,1));

    vec3 tangent = length(t1) > length(t2) ? t1 : t2;
    tangent = normalize(tangent);
        	
    vec3 bitangent = normalize(cross(normal, tangent));
    mat3 tbn = mat3(tangent, bitangent, normal);
	DataOut.tbn = tbn;

    // ---------------------------------------------------------------------------------------
    // wet/dry boundary

    bool isWet = depth > threshold;
    // if cell is dry, height is set to slightly below terrain
    if(!isWet) { 

        pos.y = terrain - 0.1;

        // if dry cell is adjacent to wet cells, it is set to the minimum height of them
        if(wetDryFix == 1){
            
            // get neighbors bathymetry
            float tb = texelFetchOffset(bathymetry, texCoords, 0, ivec2( 0,	 1)).r;
            float bb = texelFetchOffset(bathymetry, texCoords, 0, ivec2( 0,	-1)).r;
            float lb = texelFetchOffset(bathymetry, texCoords, 0, ivec2(-1,	 0)).r;
            float rb = texelFetchOffset(bathymetry, texCoords, 0, ivec2( 1,  0)).r;
            float tlb = texelFetchOffset(bathymetry, texCoords, 0, ivec2(-1,  1)).r;
            float trb = texelFetchOffset(bathymetry, texCoords, 0, ivec2( 1, -1)).r;
            float blb = texelFetchOffset(bathymetry, texCoords, 0, ivec2(-1, -1)).r;
            float brb = texelFetchOffset(bathymetry, texCoords, 0, ivec2( 1, -1)).r;

            // get neighbors depth
            float td, bd, ld, rd, tld, trd, bld, brd;
            if(activeTex == 1) {
                td = texelFetchOffset(simData1, texCoords, 0, ivec2( 0,  1)).r;
                bd = texelFetchOffset(simData1, texCoords, 0, ivec2( 0, -1)).r;
                ld = texelFetchOffset(simData1, texCoords, 0, ivec2(-1,	 0)).r;
                rd = texelFetchOffset(simData1, texCoords, 0, ivec2( 1,	 0)).r;
                tld = texelFetchOffset(simData1, texCoords, 0, ivec2(-1,  1)).r;
                trd = texelFetchOffset(simData1, texCoords, 0, ivec2( 1, -1)).r;
                bld = texelFetchOffset(simData1, texCoords, 0, ivec2(-1, -1)).r;
                brd = texelFetchOffset(simData1, texCoords, 0, ivec2( 1, -1)).r;
            } else {
                td = texelFetchOffset(simData2, texCoords, 0, ivec2( 0,  1)).r;
                bd = texelFetchOffset(simData2, texCoords, 0, ivec2( 0, -1)).r;
                ld = texelFetchOffset(simData2, texCoords, 0, ivec2(-1,	 0)).r;
                rd = texelFetchOffset(simData2, texCoords, 0, ivec2( 1,	 0)).r;
                tld = texelFetchOffset(simData2, texCoords, 0, ivec2(-1, 1)).r;
                trd = texelFetchOffset(simData2, texCoords, 0, ivec2( 1, -1)).r;
                bld = texelFetchOffset(simData2, texCoords, 0, ivec2(-1, -1)).r;
                brd = texelFetchOffset(simData2, texCoords, 0, ivec2( 1, -1)).r;
            }

        
            // if neighbor is wet set mind to minimum depth
            float mind = 1000;
    	    mind = (td > threshold) ? min(td + tb, mind) : mind;
            mind = (ld > threshold) ? min(ld + lb, mind) : mind;
            mind = (rd > threshold) ? min(rd + rb, mind) : mind;
            mind = (bd > threshold) ? min(bd + bb, mind) : mind;
            mind = (trd > threshold) ? min(trd + trb, mind) : mind;
            mind = (tld > threshold) ? min(tld + tlb, mind) : mind;
            mind = (brd > threshold) ? min(brd + brb, mind) : mind;
            mind = (bld > threshold) ? min(bld + blb, mind) : mind;

            if(mind != 1000) {
                pos.y = min(mind, terrain);
            }
        }
        
    } else {
        // cell is wet
        pos.y = height;
    }

    // ---------------------------------------------------------------------------------------
    // DEBUG

    // vec2 nposData = worldToTexInnerData(DataIn.position);
	// mat3 m_normal = mat3(transpose(inverse(m_model)));
	// vec3 bottomNormal = normalize(m_normal * texture(normalTex, nposData).xyz);

    // DEBUG normal
    // if (test > 3) {
    //     // tamanho igual mas dá shift para dentro
    //     vec2 nposData = worldToTexInnerData(vec3(position * m_model));
    //     DataOut.debug = texture(normalTex, nposData, 0).xyz;
    // } else if (test > 1) {
    //     // igual
    //     DataOut.debug = texelFetch(normalTex, texCoords - bcCount, 0).xyz;
    // } else {
    //     DataOut.debug = normal2;
    // }

    // DEBUG bathymetry
    // if (test > 3) {
    //     vec2 nposData = worldToTexData(vec3(position * m_model));
    //     pos.y = texture(bathymetry, nposData, 0).x;
    // } else if (test > 1) {
    //     pos.y = texelFetch(bathymetry, texCoords, 0).x;
    // } else {
    //     pos = position;
    // }


    // ---------------------------------------------------------------------------------------
    // output

    // world space
    DataOut.position = vec3(m_model * pos);

    DataOut.eye = normalize(DataOut.position - cameraPos); // Camera -> Position
    DataOut.lightDir = normalize(vec3(-lightDir));
    DataOut.depth = depth;

    // view space
    /*
    DataOut.eye = normalize(-(mViewModel * position));
    DataOut.normal = normalize(m_normal * normal); // view space 
    DataOut.lightDir = normalize(vec3(m_view * -lightDir)); // view space
    */

	gl_Position = m_pvm * pos;
}