//=======================================================================================
// in out
in Data {
	vec3 eye;
	vec3 normal;
	vec3 lightDir;
	vec3 position;
    bool isWet;
} DataIn;

out vec4 fragColour;

uniform int intersectionMode;


//=======================================================================================
// Main
//=======================================================================================
void main() {

	vec3 eye = normalize(DataIn.eye);
	vec3 normal = normalize(DataIn.normal);
	vec3 l = DataIn.lightDir;

	// ---------------------------------------------------------------------------------
	// reflection

	vec3 reflectDir = reflect(eye, normal);
	vec3 envReflection = texture(skybox, -reflectDir).rgb;
	envReflection = toLinearSpace(envReflection);

	// ---------------------------------------------------------------------------------
	// transmission/refraction

	// world space
	vec3 refractDir = normalize(refract(eye, normal, eta));
	vec3 rayOrigin = DataIn.position;

	// aprox. refracted light dir with horizontal planar surface
	vec3 refractedDirLight = normalize(refract(-l, vec3(0,1,0), eta));

	vec3 bottomReflection;

	// casts a ray to intersect the bathymetry, if not hit -> uses skybox
	float pathLength;
	vec3 hitPos;

	// DEBUG iteration heat map
	// int iterCount;
	// bool hit = intersectMaxMipmap(rayOrigin, refractDir, pathLength, hitPos, iterCount);

	// if (test > 1) {
	//     vec3 HEATMAP = getHeatMapColor((iterCount - 7)/23.0);

	// 	fragColour = vec4(HEATMAP,1);
	// 	return;
	// }

	bool hit;
	if(intersectionMode == 0) {
		// hit = intersectMaxMipmap(rayOrigin, refractDir, pathLength, hitPos, iterCount);
		hit = intersectMaxMipmap(rayOrigin, refractDir, pathLength, hitPos);
	} else {
		hit = rayCastTerrainBinary(rayOrigin, refractDir, pathLength, hitPos);
	}
	

	float lightPath = 0;

	if(hit) {

		// coords to tex space
		vec2 npos = worldToTex(hitPos);
		vec2 nposData = worldToTexInnerData(hitPos);

		// get color and normal
		vec3 bottomColor = texture(terrainTex, npos * terrainTiling).rgb;
		bottomColor = toLinearSpace(bottomColor);

		mat3 m_normal = mat3(transpose(inverse(m_model)));
		vec3 bottomNormal = normalize(m_normal * texture(normalTex, nposData).xyz);

		// lighting
		if(causticsEnabled == 1){
			
			// returns (intensity, path length)
			vec2 causticsData = getCausticsData(hitPos);

			// multiply bottom color by caustics intensity, with minimum ambient
			bottomReflection = bottomColor * max(causticsData.x, ambient);

			if(aproxLightPath != 1) {
				// uses caustics light path instead of aproximate
				float defaultVal = 100;
				lightPath = (causticsData.y < defaultVal) ? causticsData.y : lightPath;
			}

		} else {
			// aprox light path from planar surface to bottom,
			float aproxDepth = rayOrigin.y - hitPos.y;
			float lightPath = aproxDepth / dot(refractedDirLight, vec3(0,-1,0));

			bottomReflection = lambert(bottomColor, bottomNormal, l);
		}
	}
	else {
		vec3 aabbNormal = vec3(0);
		if(hitPos.x <= 0) aabbNormal = vec3(1,0,0);
		if(hitPos.x >= nWidth * dx) aabbNormal = vec3(-1,0,0);
		if(hitPos.z <= 0) aabbNormal = vec3(0,0,1);
		if(hitPos.z >= nHeight * dx) aabbNormal = vec3(0,0,-1);

		// TODO testar, por vetor direito
		vec3 outRefractDir = normalize(refract(refractDir, aabbNormal, 1/eta));

		bottomReflection = texture(skybox, -outRefractDir).rgb;
		
		// TODO fix
		bottomReflection = texture(skybox, -refractDir).rgb;
		bottomReflection = toLinearSpace(bottomReflection);
	}

	pathLength += lightPath;

	// ---------------------------------------------------------------------------------
	// macro surface fresnel factor
	float f0 = (waterIor - 1) / (waterIor + 1); // 0.02 for water
	f0 *= f0;
	float dot_VN = clamp(dot(-eye, normal), 0, 1);
	float fresnel = fresnel_schlick(f0, dot_VN);
	
	float dot_NL = max(clamp(dot(normal,l), 0.0, 1.0), ambient);


	// environment reflection
	vec3 envL = vec3(1);
	vec3 skyR = envL * envReflection * fresnel;

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
		color = sunR;
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

    //color = reinhardTonemap(color);
    color = fromLinearSpace(color);

	fragColour = vec4(color,1);
}