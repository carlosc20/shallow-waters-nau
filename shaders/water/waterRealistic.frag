//=======================================================================================
// in out
in Data {
	vec3 eye;
	vec3 lightDir;
	vec3 position;
	mat3 tbn;
	vec3 debug;
	float depth;
	} DataIn;

out vec4 fragColour;

//=======================================================================================

// noise normal map 
uniform int noiseMode;
layout(binding = 7) uniform sampler2D normalMapNoise;

uniform int reflEnabled;
uniform int intersectionMode;
uniform float fresnelEpsilon;


//=======================================================================================
// Main
//=======================================================================================
void main() {

	vec3 eye = normalize(DataIn.eye);
	vec3 l = normalize(vec3(-lightDir));

	// ---------------------------------------------------------------------------------
	// small surface details -> normal mapping
	vec3 normal;
	if(noiseMode != 0) {
		vec2 normalTexCoord = worldToTexData(DataIn.position);
		vec3 normalT1 = texture(normalMapNoise, normalTexCoord).rgb * 2 - 1;

		normal = normalize(DataIn.tbn * normalT1);

	} else {
		normal = normalize(DataIn.tbn[2]);
	}

	// DEBUG simple diffuse color
	// fragColour = vec4(lambert(vec3(0.11,0.64,0.93),normal,l),1);
	// return;

	// ---------------------------------------------------------------------------------
	// macro surface fresnel factor
	float f0 = (waterIor - 1) / (waterIor + 1); // 0.02 for water
	f0 *= f0;
	float dot_VN = clamp(dot(-eye, normal), 0, 1);
	float fresnel = fresnel_schlick(f0, dot_VN);

	// ---------------------------------------------------------------------------------
	// environment reflection

	// world space
	vec3 rayOrigin = DataIn.position;
	vec3 hitPos;
	bool hit;

	vec3 reflectDir = normalize(reflect(eye, normal));

	vec3 envReflection;

	// casts a ray to intersect the bathymetry, if not hit uses skybox
	if(reflEnabled != 0 && fresnel > fresnelEpsilon) {
		hit = intersectMaxMipmapUp(rayOrigin, reflectDir, hitPos);

		if(hit) {
			// coords to tex space
			vec2 npos = worldToTex(hitPos);
			vec2 nposData = worldToTexInnerData(hitPos);

			// get color and normal
			vec3 bottomColor = texture(terrainTex, npos * terrainTiling).rgb;
			bottomColor = toLinearSpace(bottomColor);

			mat3 m_normal = mat3(transpose(inverse(m_model)));
			vec3 bottomNormal = normalize(m_normal * texture(normalTex, nposData).xyz);

			envReflection = lambert(bottomColor, bottomNormal, -l);
		} else {
			envReflection = texture(skybox, -reflectDir).rgb;
			envReflection = toLinearSpace(envReflection);
		}
	} else {
		envReflection = texture(skybox, -reflectDir).rgb;
		envReflection = toLinearSpace(envReflection);
	}	

	// ---------------------------------------------------------------------------------
	// transmission

	vec3 refractDir = normalize(refract(eye, normal, eta));

	// aprox. refracted light dir with horizontal planar surface
	vec3 refractedDirLight = normalize(refract(-l, vec3(0,1,0), eta));

	vec3 bottomReflection;

	int iterCount = 0;

	float pathLength;
	if(intersectionMode == 0) {
		//hit = intersectMaxMipmap(rayOrigin, refractDir, pathLength, hitPos, iterCount);
		hit = intersectMaxMipmap(rayOrigin, refractDir, pathLength, hitPos);
	} else {
		hit = rayCastTerrainBinary(rayOrigin, refractDir, pathLength, hitPos);
	}

	// DEBUG iteration heat map
	// if (test > 1) {
	//     vec3 HEATMAP = getHeatMapColor((iterCount - 7)/23.0);

	// 	fragColour = vec4(HEATMAP,1);
	// 	return;
	// }

	// aprox light path from planar surface to bottom
	float lightPath = 0;

	// casts a ray to intersect the bathymetry, if hits boundary -> uses skybox
	if(hit) {

		// coords to tex space
		vec2 npos = worldToTex(hitPos);
		vec2 nposData = worldToTexInnerData(hitPos);

		// get color and normal
		vec3 bottomColor = texture(terrainTex, npos * terrainTiling).rgb;
		bottomColor = toLinearSpace(bottomColor);

		//bottomColor = vec3(1);

		mat3 m_normal = mat3(transpose(inverse(m_model)));
		vec3 bottomNormal = normalize(m_normal * texture(normalTex, nposData).xyz);

		// lighting
		if(causticsEnabled == 1){
			
			// returns (intensity, path length)
			vec2 causticsData = getCausticsData(hitPos);

			// smoothstep(0, test, DataIn.depth)
			//float causticsIntensity = mix(1, max(causticsData.x, ambient), smoothstep(0, test, DataIn.depth));

			// multiply bottom color by caustics intensity, with minimum ambient
			float causticsIntensity = max(causticsData.x, ambient);
			bottomReflection = bottomColor * causticsIntensity;


			if(aproxLightPath != 1) {
				// uses caustics light path instead of aproximate
				float defaultVal = 100;
				lightPath = (causticsData.y < defaultVal) ? causticsData.y : lightPath;
			}

		} else {
			// adds approximate path from light to bottom
			float aproxDepth = rayOrigin.y - hitPos.y;
			lightPath = aproxDepth / dot(refractedDirLight, vec3(0,-1,0));

			bottomReflection = lambert(bottomColor, bottomNormal, l);
		}
	}
	else {
		// refract again
		vec3 aabbNormal = vec3(0);
		if(hitPos.x <= 0) aabbNormal = vec3(1,0,0);
		if(hitPos.x >= nWidth * dx) aabbNormal = vec3(-1,0,0);
		if(hitPos.z <= 0) aabbNormal = vec3(0,0,1);
		if(hitPos.z >= nHeight * dx) aabbNormal = vec3(0,0,-1);

		vec3 outRefractDir = normalize(refract(refractDir, aabbNormal, 1/eta));
		bottomReflection = texture(skybox, -outRefractDir).rgb;
		
		// doesnt refract again
		bottomReflection = texture(skybox, -refractDir).rgb;
		bottomReflection = toLinearSpace(bottomReflection);
	}


	// adds path from light to bottom to path length
	pathLength += lightPath;

	// ---------------------------------------------------------------------------------

	float dot_NL = max(clamp(dot(normal,l), 0.0, 1.0), ambient);


	// environment reflection
	vec3 envL = vec3(1);
	vec3 skyR = envL * envReflection * fresnel * dot_NL;

	// refraction/transmission
	vec3 transmission = (bottomReflection * transmittance(pathLength) + scatterColor());

	vec3 waterR = transmission * (1-fresnel);

	// sun reflection
	vec3 sunR = cookTorranceSpecular(normal, -eye, l) * dot_NL;


	// ---------------------------------------------------------------------------------
	// final blend

	vec3 color = vec3(0);
	if(mode == 0) { 
		// All
		color = sunR + skyR + waterR;
	} else if(mode == 1) { 
		// Environment Reflection
		color = skyR;
	} else if(mode == 2) { 
		// Sun Reflection
		color = sunR + skyR;
	} else if(mode == 3) { 
		// Transmission
		color = bottomReflection * (1-fresnel) * transmittance(pathLength);
	} else if(mode == 4) { 
		// Refraction
		color = bottomReflection;
	} else if(mode == 5) { 
		// Transmittance
		color = transmittance(pathLength);
	} else if(mode == 6) { 
		// Scattering
		color = scatterColor() * (1-fresnel) * dot_NL;
	} else if(mode == 7) { 
		// Flat diffuse
		color = lambert(vec3(0.1, 0.1, 0.9), normal, l);
	} else if(mode == 8) { 
		// Normal
		color = vec3(normal.x, 0, normal.z);
	}

    color = fromLinearSpace(color);

	fragColour = vec4(color,1);
}