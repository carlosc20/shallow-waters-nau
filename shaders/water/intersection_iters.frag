//=======================================================================================
// Heightfield ray casting accelerated with maximum quadtree/mipmap
//=======================================================================================

const float n = nWidth;

vec3 worldToTexel(vec3 worldPos) {
	vec3 texPos;
	texPos.x = (worldPos.x * oodx + bcCount);
    texPos.y = worldPos.y;
	texPos.z = (worldPos.z * oodx + bcCount);
	
    texPos = texPos.xzy;
	return texPos;
}

vec3 texelToWorld(vec3 texPos) {
	vec3 worldPos;
	worldPos.x = (texPos.x - bcCount) * dx;
	worldPos.y = (texPos.y - bcCount) * dx;
	worldPos.z = texPos.z;

    worldPos = worldPos.xzy;
	return worldPos;
}

vec3 worldDirToTexel(vec3 worldDir) {
	vec3 texDir;
	texDir.x = (worldDir.x * oodx);
    texDir.y = worldDir.y;
	texDir.z = (worldDir.z * oodx);

    texDir = texDir.xzy;
	return texDir;
}

uniform int maxLevels;
uniform int finestLevel;
uniform int linearAprox = 1;
/*
	
	https://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.160.7119&rep=rep1&type=pdf


    https://catlikecoding.com/unity/tutorials/rendering/part-20/
    https://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.88.876&rep=rep1&type=pdf

*/

// DEBUG, returns finestLevel height at origin
bool testLevel(vec3 texOrigin, vec3 dir, out vec3 hitPos) {

    int level = finestLevel;
    int invTexSize = int(pow(2,level));

    //// fecth current heightfield texel
    vec2 currentTexel = vec2(floor(texOrigin.x / invTexSize),
                             floor(texOrigin.y / invTexSize));

    float height = texelFetch(bathymetry, ivec2(currentTexel), level).x;

    hitPos = vec3(height);
    return true;
}




// value is [0,1]
vec3 getHeatMapColor(float value) {

    const int NUM_COLORS = 4;
    vec3 color[NUM_COLORS] = {vec3(0,0,1), vec3(0,1,0), vec3(1,1,0), vec3(1,0,0)};
    
	value = clamp(value, 0, 1) * (NUM_COLORS - 1);
	int idx  = int(floor(value));

    return mix(color[idx], color[idx + 1], value - idx);
}

// -------------------------------------
// rayDir.z < 0

bool intersectMaxMipmapAux(vec3 texOrigin, vec3 dir, out vec3 hitPos, out int iters) {

	// start in second coarsest level
    int level = maxLevels - 1;

	vec3 texEntry = texOrigin;
    float height = texOrigin.z;


    iters = 0;
    // while the ray does not intersect the height field and does not leave the domain of the tile
    while(texEntry.x < n + bcCount && texEntry.y < n + bcCount ) {
        iters++;

        int invTexSize = int(pow(2,level));

        //// fetch current heightfield texel
        vec2 currentTexel = floor(texEntry.xy / invTexSize);
        
        float prevHeight = height;
        height = texelFetch(bathymetry, ivec2(currentTexel), level).x;

        //// compute ray exit point
        // intersect with two edges
        vec2 texEdges = (currentTexel + 1) * invTexSize;
        vec2 deltaTxy = (texEdges - texEntry.xy) / dir.xy;
        float deltaT = min(deltaTxy.x, deltaTxy.y);
        
        // texExit is first intersection -> smaller delta
		vec3 texExit = texEntry + deltaT * dir;

		// precise intersection to avoid round-off errors
        if(deltaT == deltaTxy.x) {
            texExit.x = texEdges.x;
        } else {
            texExit.y = texEdges.y;
        }

        // intersects texel height
        if(texExit.z <= height) {
		
            if(level > finestLevel) { 
				// descend one level
                level--; 
                // move entry to intersection point
                texEntry += max((height - texEntry.z) / dir.z, 0) * dir;
            } else { 
                // finest level
                if(linearAprox == 1){
                    int texSize = textureSize(bathymetry,0).x;
                    // sample before and after, intersect dir with linear interpolation from sampled points 
                    float prevSurfaceH = textureLod(bathymetry, texEntry.xy / texSize, finestLevel).x;
                    // prevSurfaceH = prevHeight; 
                    float surfaceH = textureLod(bathymetry, texExit.xy / texSize, finestLevel).x;
                    
                    // check intersection
                    if(surfaceH < texExit.z) {
                        // advance ray to texel's exit position
                        texEntry = texExit;

                        // step level up if ray leaves 2x2 texel block
                        int edge = int((deltaT == deltaTxy.x) ? floor(texExit.x/invTexSize) : floor(texExit.y/invTexSize));
                        level = int(min(level + 1 - mod(edge,2), maxLevels - 1));

                        continue;
                    }

                    float prevDif = abs(texEntry.z - prevSurfaceH);
                    float dif = abs(surfaceH - texExit.z);
                    hitPos = mix(texEntry, texExit, prevDif / (prevDif + dif));
                } else {
                    // intersection point with square prism
                    hitPos = texEntry + max((height - texEntry.z) / dir.z, 0) * dir;
                }
                return true;
            }
        }
        else {	
            // advance ray to texel's exit position
            texEntry = texExit;

            // step level up if ray leaves 2x2 texel block
            int edge = int((deltaT == deltaTxy.x) ? floor(texExit.x/invTexSize) : floor(texExit.y/invTexSize));
            level = int(min(level + 1 - mod(edge,2), maxLevels - 1));
        }
    }

	// intersect boundaries
    vec2 boundaries = vec2(n);
    vec2 deltaTxy = (boundaries - texOrigin.xy) / dir.xy;
	float deltaT = min(deltaTxy.x, deltaTxy.y);
	hitPos = texOrigin + deltaT * dir;

    return false;
}

bool intersectMaxMipmapAuxInvX(vec3 texOrigin, vec3 dir, out vec3 hitPos, out int iters) {

	// start in second coarsest level
    int level = maxLevels - 1;

	vec3 texEntry = texOrigin;

    iters = 0;

    // while the ray does not intersect the height field and does not leave the domain of the tile
    while(texEntry.x >= bcCount && texEntry.y < n + bcCount ) {
        iters++;

        int invTexSize = int(pow(2,level));

        //// fetch current heightfield texel
        ivec2 currentTexel = ivec2(ceil(texEntry.x / invTexSize) - 1,
                                   floor(texEntry.y / invTexSize));

        float height = texelFetch(bathymetry, currentTexel, level).x;

        //// compute ray exit point
        // intersect with two edges

        vec2 texEdges = (currentTexel + vec2(0,1)) * invTexSize;
        vec2 deltaTxy = (texEdges - texEntry.xy) / dir.xy;
        float deltaT = min(deltaTxy.x, deltaTxy.y);
        
        // texExit is first intersection -> smaller delta
		vec3 texExit = texEntry + deltaT * dir;

		// precise intersection to avoid round-off errors
        if(deltaT == deltaTxy.x) {
            texExit.x = texEdges.x;
        } else {
            texExit.y = texEdges.y;
        }

        // intersects texel height
        if(texExit.z <= height) {

            // move entry to intersection point
            vec3 newTexEntry = texEntry;
            texEntry = texEntry + max((height - texEntry.z) / dir.z, 0) * dir;

            if(level > finestLevel) { 
				// descend one level
                level--; 
            } else { 
                // finest level
                if(linearAprox == 1){
                    int texSize = textureSize(bathymetry,0).x;
                    // sample before and after, intersect dir with linear interpolation from sampled points 
                    float prevSurfaceH = textureLod(bathymetry, newTexEntry.xy / texSize, finestLevel).x;
                    float surfaceH = textureLod(bathymetry, texExit.xy / texSize, finestLevel).x;
                    
                    // check intersection
                    if(surfaceH < texExit.z) {
                        // advance ray to texel's exit position
                        texEntry = texExit;

                        // step level up if ray leaves 2x2 texel block
                        int edge = int((deltaT == deltaTxy.x) ? floor(texExit.x/invTexSize) : floor(texExit.y/invTexSize));
                        level = int(min(level + 1 - mod(edge,2), maxLevels - 1));

                        continue;
                    }

                    float prevDif = abs(newTexEntry.z - prevSurfaceH);
                    float dif = abs(surfaceH - texExit.z);
                    hitPos = mix(newTexEntry, texExit, prevDif / (prevDif + dif));
                } else {
                    hitPos = texEntry;
                }
                return true;
            }
        }
        else {	
            // advance ray to texel's exit position
            texEntry = texExit;

            // step level up if ray leaves 2x2 texel block
            int edge = int((deltaT == deltaTxy.x) ? ceil(texExit.x/invTexSize) : floor(texExit.y/invTexSize));
            level = int(min(level + 1 - mod(edge,2), maxLevels - 1));
        }
    }

	// intersect boundaries
    vec2 boundaries = vec2(-4, n);
    vec2 deltaTxy = (boundaries - texOrigin.xy) / dir.xy;
	float deltaT = min(deltaTxy.x, deltaTxy.y);
	hitPos = texOrigin + deltaT * dir;

    return false;
}

bool intersectMaxMipmapAuxInvY(vec3 texOrigin, vec3 dir, out vec3 hitPos, out int iters) {

	// start in second coarsest level
    int level = maxLevels - 1;

	vec3 texEntry = texOrigin;

    iters = 0;

    // while the ray does not intersect the height field and does not leave the domain of the tile
    while(texEntry.x < n + bcCount  && texEntry.y >= bcCount) {
        iters++;

        int invTexSize = int(pow(2,level));

        //// fecth current heightfield texel
        ivec2 currentTexel = ivec2(floor(texEntry.x / invTexSize),
                                   ceil(texEntry.y / invTexSize) - 1);

        float height = texelFetch(bathymetry, currentTexel, level).x;

        //// compute ray exit point
        // intersect with two edges

        vec2 texEdges = (currentTexel + vec2(1,0)) * invTexSize;
        vec2 deltaTxy = (texEdges - texEntry.xy) / dir.xy;
        float deltaT = min(deltaTxy.x, deltaTxy.y);
        
        // texExit is first intersection -> smaller delta
		vec3 texExit = texEntry + deltaT * dir;

		// precise intersection to avoid round-off errors
        if(deltaT == deltaTxy.x) {
            texExit.x = texEdges.x;
        } else {
            texExit.y = texEdges.y;
        }

        // intersects texel height
        if(texExit.z <= height) {
		
            // move entry to intersection point
            vec3 newTexEntry = texEntry;
            texEntry = texEntry + max((height - texEntry.z) / dir.z, 0) * dir;

            if(level > finestLevel) { 
				// descend one level
                level--; 
            } else { 
                // finest level
                if(linearAprox == 1){
                    int texSize = textureSize(bathymetry,0).x;
                    // sample before and after, intersect dir with linear interpolation from sampled points 
                    float prevSurfaceH = textureLod(bathymetry, newTexEntry.xy / texSize, finestLevel).x;
                    float surfaceH = textureLod(bathymetry, texExit.xy / texSize, finestLevel).x;
                    
                    // check intersection
                    if(surfaceH < texExit.z) {
                        // advance ray to texel's exit position
                        texEntry = texExit;

                        // step level up if ray leaves 2x2 texel block
                        int edge = int((deltaT == deltaTxy.x) ? floor(texExit.x/invTexSize) : floor(texExit.y/invTexSize));
                        level = int(min(level + 1 - mod(edge,2), maxLevels - 1));

                        continue;
                    }

                    float prevDif = abs(newTexEntry.z - prevSurfaceH);
                    float dif = abs(surfaceH - texExit.z);
                    hitPos = mix(newTexEntry, texExit, prevDif / (prevDif + dif));
                } else {
                    hitPos = texEntry;
                }
                return true;
            }
        }
        else {	
            // advance ray to texel's exit position
            texEntry = texExit;

            // step level up if ray leaves 2x2 texel block
            int edge = int((deltaT == deltaTxy.x) ? floor(texExit.x/invTexSize) : ceil(texExit.y/invTexSize));
            level = int(min(level + 1 - mod(edge,2), maxLevels - 1));
        }
    }

	// intersect boundaries
    vec2 boundaries = vec2(n, -4);
    vec2 deltaTxy = (boundaries - texOrigin.xy) / dir.xy;
	float deltaT = min(deltaTxy.x, deltaTxy.y);
	hitPos = texOrigin + deltaT * dir;

    return false;
}

bool intersectMaxMipmapAuxInvXY(vec3 texOrigin, vec3 dir, out vec3 hitPos, out int iters) {

	// start in second coarsest level
    int level = maxLevels - 1;

	vec3 texEntry = texOrigin;

    iters = 0;

    // while the ray does not intersect the height field and does not leave the domain of the tile
    while(texEntry.x >= bcCount && texEntry.y >= bcCount) {
        iters++;

        int invTexSize = int(pow(2,level));

        //// fecth current heightfield texel
        ivec2 currentTexel = ivec2(ceil(texEntry.x / invTexSize) - 1,
                                   ceil(texEntry.y / invTexSize) - 1);

        float height = texelFetch(bathymetry, currentTexel, level).x;

        //// compute ray exit point
        // intersect with two edges

        vec2 texEdges = (currentTexel + vec2(0)) * invTexSize;
        vec2 deltaTxy = (texEdges - texEntry.xy) / dir.xy;
        float deltaT = min(deltaTxy.x, deltaTxy.y);
        
        // texExit is first intersection -> smaller delta
		vec3 texExit = texEntry + deltaT * dir;

		// precise intersection to avoid round-off errors
        if(deltaT == deltaTxy.x) {
            texExit.x = texEdges.x;
        } else {
            texExit.y = texEdges.y;
        }

        // intersects texel height
        if(texExit.z <= height) {
		
            // move entry to intersection point
            vec3 newTexEntry = texEntry;
            texEntry = texEntry + max((height - texEntry.z) / dir.z, 0) * dir;

            if(level > finestLevel) { 
				// descend one level
                level--; 
            } else { 
                // finest level
                if(linearAprox == 1){
                    int texSize = textureSize(bathymetry,0).x;
                    // sample before and after, intersect dir with linear interpolation from sampled points 
                    float prevSurfaceH = textureLod(bathymetry, newTexEntry.xy / texSize, finestLevel).x;
                    float surfaceH = textureLod(bathymetry, texExit.xy / texSize, finestLevel).x;
                    
                    // check intersection
                    if(surfaceH < texExit.z) {
                        // advance ray to texel's exit position
                        texEntry = texExit;

                        // step level up if ray leaves 2x2 texel block
                        int edge = int((deltaT == deltaTxy.x) ? floor(texExit.x/invTexSize) : floor(texExit.y/invTexSize));
                        level = int(min(level + 1 - mod(edge,2), maxLevels - 1));

                        continue;
                    }

                    float prevDif = abs(newTexEntry.z - prevSurfaceH);
                    float dif = abs(surfaceH - texExit.z);
                    hitPos = mix(newTexEntry, texExit, prevDif / (prevDif + dif));
                } else {
                    hitPos = texEntry;
                }
                return true;
            }
        }
        else {	
            // advance ray to texel's exit position
            texEntry = texExit;

            // step level up if ray leaves 2x2 texel block
            int edge = int((deltaT == deltaTxy.x) ? ceil(texExit.x/invTexSize) : ceil(texExit.y/invTexSize));
            level = int(min(level + 1 - mod(edge,2), maxLevels - 1));
        }
    }

	// intersect boundaries
    vec2 boundaries = vec2(-4, -4);
    vec2 deltaTxy = (boundaries - texOrigin.xy) / dir.xy;
	float deltaT = min(deltaTxy.x, deltaTxy.y);
	hitPos = texOrigin + deltaT * dir;

    return false;
}

bool intersectMaxMipmap(vec3 rayOrigin, vec3 rayDir, out float pathLength, out vec3 hitPos, out int iters) {

    vec3 ro = worldToTexel(rayOrigin);
	vec3 rd = worldDirToTexel(rayDir);

	vec3 hp;
	bool hit;

	// mirror coords so: dir.x >= 0 && dir.y >= 0
	if (rd.x < 0 && rd.y < 0) {
		hit = intersectMaxMipmapAuxInvXY(ro, rd, hp, iters);
    } else if (rd.x < 0) {
        hit = intersectMaxMipmapAuxInvX(ro, rd, hp, iters);
    } else if (rd.y < 0) {
		hit = intersectMaxMipmapAuxInvY(ro, rd, hp, iters);
    } else {
		hit = intersectMaxMipmapAux(ro, rd, hp, iters);
	}
    //hit = testLevel(ro, rd, hp);

	hitPos = texelToWorld(hp);
	pathLength = distance(hitPos, rayOrigin);
	return hit;
}


// -------------------------------------
// rayDir.z >= 0


bool intersectMaxMipmapAuxUp(vec3 texOrigin, vec3 dir, out vec3 hitPos) {

	// start in second coarsest level
    int level = maxLevels - 1;

	vec3 texEntry = texOrigin;

    float maxHeight = texelFetch(bathymetry, ivec2(0,0), maxLevels).x;

    // while the ray does not intersect the height field and does not leave the domain of the tile
    while(texEntry.x < n - bcCount && texEntry.y < n - bcCount && texEntry.z < maxHeight) {

        int invTexSize = int(pow(2,level));

        //// fecth current heightfield texel
        vec2 currentTexel = floor(texEntry.xy / invTexSize);
        
        float height = texelFetch(bathymetry, ivec2(currentTexel), level).x;

        //// compute ray exit point
        // intersect with two edges
        vec2 texEdges = (currentTexel + 1) * invTexSize;
        vec2 deltaTxy = (texEdges - texEntry.xy) / dir.xy;
        float deltaT = min(deltaTxy.x, deltaTxy.y);
        
        // texExit is first intersection -> smaller delta
		vec3 texExit = texEntry + deltaT * dir;

		// precise intersection to avoid round-off errors
        if(deltaT == deltaTxy.x) {
            texExit.x = texEdges.x;
        } else {
            texExit.y = texEdges.y;
        }

        // intersects texel height
        if(texEntry.z <= height) {
		
            if(level > finestLevel) { 
				// descend one level
                level--; 
            } else { 

                // finest level
                if(linearAprox == 1){
                    int texSize = textureSize(bathymetry,0).x;
                    // sample before and after, intersect dir with linear interpolation from sampled points 
                    float prevSurfaceH = textureLod(bathymetry, texEntry.xy / texSize, finestLevel).x;
                    // prevSurfaceH = prevHeight; 
                    float surfaceH = textureLod(bathymetry, texExit.xy / texSize, finestLevel).x;
                    
                    // check intersection
                    if(surfaceH < texExit.z) {
                        // advance ray to texel's exit position
                        texEntry = texExit;

                        // step level up if ray leaves 2x2 texel block
                        int edge = int((deltaT == deltaTxy.x) ? floor(texExit.x/invTexSize) : floor(texExit.y/invTexSize));
                        level = int(min(level + 1 - mod(edge,2), maxLevels - 1));

                        continue;
                    }

                    float prevDif = abs(texEntry.z - prevSurfaceH);
                    float dif = abs(surfaceH - texExit.z);
                    hitPos = mix(texEntry, texExit, prevDif / (prevDif + dif));
                } else {
                    hitPos = texEntry;
                }

                return true;
            }
        }
        else {	
            // advance ray to texel's exit position
            texEntry = texExit;

            // step level up if ray leaves 2x2 texel block
            int edge = int((deltaT == deltaTxy.x) ? floor(texExit.x/invTexSize) : floor(texExit.y/invTexSize));
            level = int(min(level + 1 - mod(edge,2), maxLevels - 1));
        }
    }

	// intersect boundaries
    vec3 boundaries = vec3(n - 4, n - 4, maxHeight);
    vec3 deltaTxyz = (boundaries - texOrigin.xyz) / dir.xyz;
	float deltaT = min(min(deltaTxyz.x, deltaTxyz.y), deltaTxyz.z);
	hitPos = texOrigin + deltaT * dir;

    return false;
}

bool intersectMaxMipmapAuxUpInvX(vec3 texOrigin, vec3 dir, out vec3 hitPos) {

	// start in second coarsest level
    int level = maxLevels - 1;

	vec3 texEntry = texOrigin;

    float maxHeight = texelFetch(bathymetry, ivec2(0,0), maxLevels).x;
    
    // while the ray does not intersect the height field and does not leave the domain of the tile
    while(texEntry.x >= bcCount && texEntry.y < n - bcCount && texEntry.z < maxHeight) {

        int invTexSize = int(pow(2,level));

        //// fecth current heightfield texel
        ivec2 currentTexel = ivec2(ceil(texEntry.x / invTexSize),
                                   floor(texEntry.y / invTexSize));

        ivec2 currentTexelInvX = ivec2(ceil(texEntry.x / invTexSize) - 1,
                                       floor(texEntry.y / invTexSize));

        float height = texelFetch(bathymetry, currentTexelInvX, level).x;

        //// compute ray exit point
        // intersect with two edges

        vec2 texEdges = (currentTexel + vec2(-1,1)) * invTexSize;
        vec2 deltaTxy = (texEdges - texEntry.xy) / dir.xy;
        float deltaT = min(deltaTxy.x, deltaTxy.y);
        
        // texExit is first intersection -> smaller delta
		vec3 texExit = texEntry + deltaT * dir;

		// precise intersection to avoid round-off errors
        if(deltaT == deltaTxy.x) {
            texExit.x = texEdges.x;
        } else {
            texExit.y = texEdges.y;
        }

        // intersects texel height
        if(texEntry.z <= height) {
		
            // move entry to intersection point

            if(level > finestLevel) { 
				// descend one level
                level--; 
            } else { 
                // finest level
                if(linearAprox == 1){
                    int texSize = textureSize(bathymetry,0).x;
                    // sample before and after, intersect dir with linear interpolation from sampled points 
                    float prevSurfaceH = textureLod(bathymetry, texEntry.xy / texSize, finestLevel).x;
                    // prevSurfaceH = prevHeight; 
                    float surfaceH = textureLod(bathymetry, texExit.xy / texSize, finestLevel).x;
                    
                    // check intersection
                    if(surfaceH < texExit.z) {
                        // advance ray to texel's exit position
                        texEntry = texExit;

                        // step level up if ray leaves 2x2 texel block
                        int edge = int((deltaT == deltaTxy.x) ? floor(texExit.x/invTexSize) : floor(texExit.y/invTexSize));
                        level = int(min(level + 1 - mod(edge,2), maxLevels - 1));

                        continue;
                    }

                    float prevDif = abs(texEntry.z - prevSurfaceH);
                    float dif = abs(surfaceH - texExit.z);
                    hitPos = mix(texEntry, texExit, prevDif / (prevDif + dif));
                } else {
                    hitPos = texEntry;
                }

                return true;
            }
        }
        else {	
            // advance ray to texel's exit position
            texEntry = texExit;

            // step level up if ray leaves 2x2 texel block
            int edge = int((deltaT == deltaTxy.x) ? ceil(texExit.x/invTexSize) : floor(texExit.y/invTexSize));
            level = int(min(level + 1 - mod(edge,2), maxLevels - 1));
        }
    }

	// intersect boundaries
    vec3 boundaries = vec3(-4, n - 4, maxHeight);
    vec3 deltaTxyz = (boundaries - texOrigin.xyz) / dir.xyz;
	float deltaT = min(min(deltaTxyz.x, deltaTxyz.y), deltaTxyz.z);
	hitPos = texOrigin + deltaT * dir;

    return false;
}

bool intersectMaxMipmapAuxUpInvY(vec3 texOrigin, vec3 dir, out vec3 hitPos) {

	// start in second coarsest level
    int level = maxLevels - 1;

	vec3 texEntry = texOrigin;

    float maxHeight = texelFetch(bathymetry, ivec2(0,0), maxLevels).x;

    // while the ray does not intersect the height field and does not leave the domain of the tile
    while(texEntry.x < n - bcCount && texEntry.y >= bcCount && texEntry.z < maxHeight) {

        int invTexSize = int(pow(2,level));

        //// fecth current heightfield texel
        ivec2 currentTexel = ivec2(floor(texEntry.x / invTexSize),
                                   ceil(texEntry.y / invTexSize));

        ivec2 currentTexelInvY = ivec2(floor(texEntry.x / invTexSize),
                                       ceil(texEntry.y / invTexSize) - 1);

        float height = texelFetch(bathymetry, currentTexelInvY, level).x;

        //// compute ray exit point
        // intersect with two edges

        vec2 texEdges = (currentTexel + vec2(1,-1)) * invTexSize;
        vec2 deltaTxy = (texEdges - texEntry.xy) / dir.xy;
        float deltaT = min(deltaTxy.x, deltaTxy.y);
        
        // texExit is first intersection -> smaller delta
		vec3 texExit = texEntry + deltaT * dir;

		// precise intersection to avoid round-off errors
        if(deltaT == deltaTxy.x) {
            texExit.x = texEdges.x;
        } else {
            texExit.y = texEdges.y;
        }

        // intersects texel height
        if(texEntry.z <= height) {
		
            // move entry to intersection point
            if(level > finestLevel) { 
				// descend one level
                level--; 
            } else { 
                // finest level
                if(linearAprox == 1){
                    int texSize = textureSize(bathymetry,0).x;
                    // sample before and after, intersect dir with linear interpolation from sampled points 
                    float prevSurfaceH = textureLod(bathymetry, texEntry.xy / texSize, finestLevel).x;
                    // prevSurfaceH = prevHeight; 
                    float surfaceH = textureLod(bathymetry, texExit.xy / texSize, finestLevel).x;
                    
                    // check intersection
                    if(surfaceH < texExit.z) {
                        // advance ray to texel's exit position
                        texEntry = texExit;

                        // step level up if ray leaves 2x2 texel block
                        int edge = int((deltaT == deltaTxy.x) ? floor(texExit.x/invTexSize) : floor(texExit.y/invTexSize));
                        level = int(min(level + 1 - mod(edge,2), maxLevels - 1));

                        continue;
                    }

                    float prevDif = abs(texEntry.z - prevSurfaceH);
                    float dif = abs(surfaceH - texExit.z);
                    hitPos = mix(texEntry, texExit, prevDif / (prevDif + dif));
                } else {
                    hitPos = texEntry;
                }

                return true;
            }
        }
        else {	
            // advance ray to texel's exit position
            texEntry = texExit;

            // step level up if ray leaves 2x2 texel block
            int edge = int((deltaT == deltaTxy.x) ? floor(texExit.x/invTexSize) : ceil(texExit.y/invTexSize));
            level = int(min(level + 1 - mod(edge,2), maxLevels - 1));
        }
    }

	// intersect boundaries
    vec3 boundaries = vec3(n - 4, -4, maxHeight);
    vec3 deltaTxyz = (boundaries - texOrigin.xyz) / dir.xyz;
	float deltaT = min(min(deltaTxyz.x, deltaTxyz.y), deltaTxyz.z);
	hitPos = texOrigin + deltaT * dir;

    return false;
}

bool intersectMaxMipmapAuxUpInvXY(vec3 texOrigin, vec3 dir, out vec3 hitPos) {

	// start in second coarsest level
    int level = maxLevels - 1;

	vec3 texEntry = texOrigin;

    float maxHeight = texelFetch(bathymetry, ivec2(0,0), maxLevels).x;

    // while the ray does not intersect the height field and does not leave the domain of the tile
    while(texEntry.x >= bcCount && texEntry.y >= bcCount && texEntry.z < maxHeight) {

        int invTexSize = int(pow(2,level));

        //// fecth current heightfield texel
        ivec2 currentTexel = ivec2(ceil(texEntry.x / invTexSize),
                                   ceil(texEntry.y / invTexSize));

        ivec2 currentTexelInvY = ivec2(ceil(texEntry.x / invTexSize) - 1,
                                       ceil(texEntry.y / invTexSize) - 1);

        float height = texelFetch(bathymetry, currentTexelInvY, level).x;

        //// compute ray exit point
        // intersect with two edges

        vec2 texEdges = (currentTexel + vec2(-1)) * invTexSize;
        vec2 deltaTxy = (texEdges - texEntry.xy) / dir.xy;
        float deltaT = min(deltaTxy.x, deltaTxy.y);
        
        // texExit is first intersection -> smaller delta
		vec3 texExit = texEntry + deltaT * dir;

		// precise intersection to avoid round-off errors
        if(deltaT == deltaTxy.x) {
            texExit.x = texEdges.x;
        } else {
            texExit.y = texEdges.y;
        }

        // intersects texel height
        if(texEntry.z <= height) {
		
            if(level > finestLevel) { 
				// descend one level
                level--; 
            } else { 
                // finest level
                if(linearAprox == 1){
                    int texSize = textureSize(bathymetry,0).x;
                    // sample before and after, intersect dir with linear interpolation from sampled points 
                    float prevSurfaceH = textureLod(bathymetry, texEntry.xy / texSize, finestLevel).x;
                    // prevSurfaceH = prevHeight; 
                    float surfaceH = textureLod(bathymetry, texExit.xy / texSize, finestLevel).x;
                    
                    // check intersection
                    if(surfaceH < texExit.z) {
                        // advance ray to texel's exit position
                        texEntry = texExit;

                        // step level up if ray leaves 2x2 texel block
                        int edge = int((deltaT == deltaTxy.x) ? floor(texExit.x/invTexSize) : floor(texExit.y/invTexSize));
                        level = int(min(level + 1 - mod(edge,2), maxLevels - 1));

                        continue;
                    }

                    float prevDif = abs(texEntry.z - prevSurfaceH);
                    float dif = abs(surfaceH - texExit.z);
                    hitPos = mix(texEntry, texExit, prevDif / (prevDif + dif));
                } else {
                    hitPos = texEntry;
                }

                return true;
            }
        }
        else {	
            // advance ray to texel's exit position
            texEntry = texExit;

            // step level up if ray leaves 2x2 texel block
            int edge = int((deltaT == deltaTxy.x) ? ceil(texExit.x/invTexSize) : ceil(texExit.y/invTexSize));
            level = int(min(level + 1 - mod(edge,2), maxLevels - 1));
        }
    }

	// intersect boundaries
    vec3 boundaries = vec3(-4, -4, maxHeight);
    vec3 deltaTxyz = (boundaries - texOrigin.xyz) / dir.xyz;
	float deltaT = min(min(deltaTxyz.x, deltaTxyz.y), deltaTxyz.z);
	hitPos = texOrigin + deltaT * dir;

    return false;
}

bool intersectMaxMipmapUp(vec3 rayOrigin, vec3 rayDir, out vec3 hitPos) {

	
    vec3 ro = worldToTexel(rayOrigin);
	vec3 rd = worldDirToTexel(rayDir);

	vec3 hp;
	bool hit;

	if (rd.x < 0 && rd.y < 0) {
		hit = intersectMaxMipmapAuxUpInvXY(ro, rd, hp);
    } else  if (rd.x < 0) {
		hit = intersectMaxMipmapAuxUpInvX(ro, rd, hp);
    } else if (rd.y < 0) {
		hit = intersectMaxMipmapAuxUpInvY(ro, rd, hp);
    } else {
		hit = intersectMaxMipmapAuxUp(ro, rd, hp);
	}

	hitPos = texelToWorld(hp);

	return hit;
}