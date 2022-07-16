#version 430

in Data {
	vec3 lightDir;
	vec3 position;
} DataIn;

out vec4 fragColour;

layout(binding = 0) uniform sampler2D terrainTex;
layout(binding = 1) uniform sampler2D normalMap;
layout(binding = 2) uniform sampler2D causticsMap;

uniform float terrainTiling;

uniform int terrainCausticsEnabled;

uniform mat4 m_projectionView;
uniform	float oodx;
uniform uint nHeight;
uniform uint nWidth;

const int bcCount = 4;

uniform float ambient;

vec2 worldToTex(vec3 worldCoords) {
	float minDim = min(nWidth, nHeight);

	return vec2((worldCoords.x * oodx) / float(minDim), 
				(worldCoords.z * oodx) / float(minDim));
}

vec2 worldToCausticsMap(vec3 worldCoords) {
	vec2 texCoords = vec2((worldCoords.x * oodx + bcCount + 1) / float(nWidth + 2 * bcCount), 
						  (worldCoords.z * oodx + bcCount + 1) / float(nHeight + 2 * bcCount));
	texCoords.y = 1 - texCoords.y;
	return texCoords;
}

// gamma correction
const float gamma = 2.2;
vec3 toLinearSpace(vec3 color) {
	return pow(color, vec3(gamma));
}

vec3 fromLinearSpace(vec3 color) {
	return pow(color, vec3(1.0/gamma));
}  


void main() {
	vec2 texCoord = worldToTex(DataIn.position);

	vec3 diffuse = texture(terrainTex, texCoord * terrainTiling).rgb;
	diffuse = toLinearSpace(diffuse);
	// diffuse = vec3(0.18,0.08,0.01);
	// diffuse = vec3(1);

	vec3 normal = vec3(texture(normalMap, texCoord * terrainTiling) * 2.0 - 1.0);
	
	// normal = vec3(0,0,1);
	float intensity = max(dot(normal,DataIn.lightDir), ambient);

	if(terrainCausticsEnabled == 1){
		fragColour = vec4(texture(causticsMap, worldToCausticsMap(DataIn.position)).r);
		return;
	}

	diffuse *= intensity;
	fragColour = vec4(fromLinearSpace(diffuse),1);
}