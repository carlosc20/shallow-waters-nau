#version 430

//=======================================================================================
// simulation
layout(binding = 0) uniform sampler2D bathymetry;   

uniform float dx;
uniform	float oodx;
uniform uint nHeight;
uniform uint nWidth;

// math consts
const float PI = 3.14159265359;

//=======================================================================================
// rendering
layout(binding = 3) uniform samplerCube skybox;
layout(binding = 4) uniform sampler2D terrainTex;
layout(binding = 5) uniform sampler2D normalTex;

uniform	mat4 m_model;

uniform int mode;
uniform int causticsEnabled;
uniform float threshold;
uniform int aproxLightPath;

uniform float terrainTiling;

// water optical properties
uniform float waterIor;
const float eta = 1 / waterIor; // relative ior -> nAir / waterIor

uniform	vec4 lightDir;
uniform float ambient; 

// debug
uniform float test;	

const int bcCount = 4;

//=======================================================================================
// Utils
//=======================================================================================

vec2 worldToTexData(vec3 worldCoords) {
	return vec2((worldCoords.x * oodx + bcCount + 0.5) / float(nWidth + 2 * bcCount), 
				(worldCoords.z * oodx + bcCount + 0.5) / float(nHeight + 2 * bcCount));
}

vec2 worldToTexInnerData(vec3 worldCoords) {
	return vec2((worldCoords.x * oodx + 0.5) / float(nWidth), 
				(worldCoords.z * oodx + 0.5) / float(nHeight));
}


vec2 worldToTex(vec3 worldCoords) {
	float minDim = min(nWidth, nHeight);

	return vec2((worldCoords.x * oodx) / float(minDim), 
				(worldCoords.z * oodx) / float(minDim));
}



// gamma correction
const float gamma = 2.2;
vec3 toLinearSpace(vec3 color) {
	return pow(color, vec3(gamma));
}

vec3 fromLinearSpace(vec3 color) {
	return pow(color, vec3(1.0/gamma));
}  

// HDR tonemapping -> Reinhard operator
vec3 reinhardTonemap(vec3 color) {
	return color / (color + vec3(1.0));
}
