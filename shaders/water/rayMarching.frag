//=======================================================================================
// Heightfield ray marching
//=======================================================================================



vec2 worldToInner(vec2 worldCoords) {
	return vec2((worldCoords.x * oodx + bcCount) / float(nWidth + 2 * bcCount), 
				(worldCoords.y * oodx + bcCount) / float(nHeight + 2 * bcCount));
}

float getHeight(vec2 pos) {
	vec2 npos = worldToInner(pos);
	return texture(bathymetry, npos).r;
}

uniform int linearSteps = 30;
uniform int refineSteps = 5;

/*
	Linear search followed by a refinement binary search

	Inputs:
	ray origin -> p0
	ray direction -> dir , dir.y > 0

	Outputs:
	ray hit point -> p
	ray path length -> t
	hit terrain? -> return bool
*/
bool rayCastTerrainBinary(vec3 p0, vec3 dir, out float t, out vec3 p) {

    float xMax = nWidth * dx;
    float zMax = nHeight * dx;

	// linear search

	// stepSize is determined so that linearSteps are needed to reach the lowest possible height 0
	float stepSize = -p0.y / dir.y / linearSteps;
	p = p0;
	t = 0; 

	for(int i = 0; i < linearSteps; i++){

		float h = getHeight(p.xz);

		// below terrain
		if (h >= p.y){
			// binary search
			float stepSize = stepSize * 0.5;
			t -= stepSize; // take half step back

			p = p0 + dir * t;

			for(int j = 0; j < refineSteps; j++){
				h = getHeight(p.xz);

				// below terrain
                stepSize *= (h >= p.y) ? -0.5 : 0.5;

				// intersects AABB
				if (p.x < 0 || p.x >= xMax || p.z < 0 || p.z >= zMax) { 
					return false;
				}

				t += stepSize;
				p = p0 + dir * t;
			}

			return true;
		}

		// intersects AABB
		if (p.x < 0 || p.x >= xMax || p.z < 0 || p.z >= zMax) { 
			return false;
		}

		t += stepSize;
		p = p0 + dir * t;
	}

	// should not reach
	return true;
}

bool rayCastWater(vec3 p0, vec3 dir, float yMax, out vec3 p) {

    float xMax = nWidth * dx;
    float zMax = nHeight * dx;

	if(dir.y <= 0) {
		return false;
	}

	// linear search

	// stepSize is determined so that linearSteps are needed to reach the highest possible height yMax
	float stepSize = (yMax - p0.y) / dir.y / linearSteps;

	p = p0;
	float t = 0; 

	for(int i = 0; i < linearSteps; i++){

		float h = getHeight(p.xz);

		// below terrain
		if (h >= p.y){
			// binary search
			float stepSize = stepSize / 2;
			t -= stepSize; // take half step back

			p = p0 + dir * t;

			for(int j = 0; j < refineSteps; j++){
				h = getHeight(p.xz);

				// below terrain
				if(h >= p.y) {
					stepSize = -stepSize / 2;
				} else {
					stepSize = stepSize / 2;
				}

				// intersects AABB
				if (p.x < 0 || p.x >= xMax || p.z < 0 || p.z >= zMax || p.y >= yMax) { 
					return false;
				}

				t += stepSize;
				p = p0 + dir * t;
			}

			return true;
		}

		// intersects AABB
		if (p.x < 0 || p.x >= xMax || p.z < 0 || p.z >= zMax || p.y >= yMax) { 
			return false;
		}

		t += stepSize;
		p = p0 + dir * t;
	}

	// should not reach
	return false;
}