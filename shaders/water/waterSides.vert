#version 420


//=======================================================================================
// in out
in vec4 position;  // bathymetry
in vec4 normal;    // water side

out Data {
	vec3 eye;
	vec3 normal;
	vec3 lightDir;
    vec3 position;
    bool isWet;
} DataOut;


//=======================================================================================
// transform
uniform	mat4 m_pvm;
uniform mat4 m_model;

uniform vec3 cameraPos;


// lighting
uniform	vec4 lightDir;

// simulation
const int bcCount = 4;
uniform float threshold;

// textures
layout(binding = 8) uniform sampler2D normalAndHeight;  

//=======================================================================================
void main() {

    ivec2 texCoords = ivec2(position.x + bcCount, position.z + bcCount);

    float height = texelFetch(normalAndHeight, texCoords, 0).w;
    float depth = height - position.y;
    
    // ---------------------------------------------------------------------------------------
    // wet/dry boundary

    bool isWet = depth > threshold;
    if(!isWet) {
        depth = 0;
    }

    // ---------------------------------------------------------------------------------------
    // output
    vec4 pos = position;

    // if water surface vertex
    if(position.w == 0) {
        pos.y = height;
    }
    pos.w = 1;

    DataOut.isWet = isWet;

    // world space
    DataOut.position = vec3(m_model * pos);
    DataOut.eye = normalize(DataOut.position - cameraPos);
    DataOut.normal = normal.rgb;
    DataOut.lightDir = normalize(vec3(-lightDir));

	gl_Position = m_pvm * pos;
}