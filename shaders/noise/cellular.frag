

in vec2 texCoord;

out vec3 outColor;

uniform float time;
uniform float baseFrequency;
uniform float baseAmplitude;
uniform float baseSpeed;
uniform float warping;
uniform float perlinShare;

uniform int octaves;
uniform float persistence;
uniform float lacunarity;

uniform int squared;
uniform int windEnabled;

uniform uint nWidth;
uniform uint nHeight;

vec2 color(vec2 xy) {
    return cellular(vec3(xy, time * baseSpeed));
}

float colorPerlin(vec2 xy) {
    vec3 gradient;
    return psrdnoise(vec3(xy, time * baseSpeed), vec3(0), 0, gradient);
}

float fractalSum(vec2 xy) {    

    const vec2 step = vec2(1.3, 1.7); 

    float frequency = baseFrequency;
    float amplitude = 1;
	
    float t = 0.0;
    float norm = 1;

    for(int i = 0; i < octaves; i++) {
        t += amplitude * color(xy * frequency - i * step).x;
		
		norm += amplitude; 
        frequency *= lacunarity;
        amplitude *= persistence;
    }

    t /= norm;
    t *= baseAmplitude;

    return t;
}

float fractalSumPerlin(vec2 xy) {    

    const vec2 step = vec2(1.3, 1.7); 

    float frequency = baseFrequency;
    float amplitude = 1;

    float t = 0.0;

    for(int i = 0; i < octaves; i++) {
        t += amplitude * colorPerlin(xy * frequency - i * step);
        frequency *= lacunarity;
        amplitude *= persistence;

    }

    return t;
}


void main() {
    
	float width = float(nWidth);
    float height = float(nHeight);
    vec2 p = texCoord;

    // maintain scale over both dimensions
    if(width > height) {
        p.x *= width/height;
    } else {
        p.y *= height/width;
    }
    p = p * 2 - 1;

    // scrolls texture over a direction
    if (windEnabled == 1) {
        p.x *= 2;
        p.y *= 0.5;
        vec2 windDir = vec2(-1,0);
        vec2 offset = windDir * time * 0.15; 
        p += offset;
    }

    // warps coords using perlin noise
    float q = 0;
    if(warping > 0) {                   
        q = fractalSumPerlin(p);
        p += warping * q;
    }

	float n = fractalSum(p);

    // mixes cellular and perlin noise
    n = mix(n, q, perlinShare);

    if(squared == 1) {
        n*= n;
    }

    outColor = vec3(n);      
}