//=======================================================================================
// Caustics
//=======================================================================================

uniform mat4 m_projectionView;

layout(binding = 9) uniform sampler2D causticsMap;
layout(binding = 10) uniform sampler2D causticsMapPath;


vec2 worldToCausticsMap(vec3 worldCoords) {
	vec2 texCoords = vec2((worldCoords.x * oodx + bcCount + 1) / float(nWidth + 2 * bcCount), 
						  (worldCoords.z * oodx + bcCount + 1) / float(nHeight + 2 * bcCount));
	
    texCoords.y = 1 - texCoords.y;

	return texCoords;
}


// projects caustics texture into receiver to get light intensity and path length
vec2 getCausticsData(vec3 position) {

	vec2 texCoords = worldToCausticsMap(position);
	float intensity = texture(causticsMap, texCoords).r;
	float pathLength = texture(causticsMapPath, texCoords).r;
	
	return vec2(intensity, pathLength);
}

float getCausticsIntensity(vec3 position) {
	return texture(causticsMap, worldToCausticsMap(position)).r;
}

vec2 getCausticsPathLength(vec3 position) {
	return vec2(texture(causticsMapPath, worldToCausticsMap(position)).r, 0);
}



// projects caustics texture into receiver to get light intensity
// caustics map is in camera's view
float getCausticsIntensityView(vec3 position) {

	// project into camera's view
	vec4 projCoords = m_projectionView * vec4(position, 1);
	vec2 texProjCoords = (projCoords.xy / projCoords.w) * 0.5 + 0.5;
	float lightIntensity = texture(causticsMap, texProjCoords).r;
	
	return lightIntensity; 
}