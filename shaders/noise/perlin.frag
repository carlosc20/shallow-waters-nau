
in vec2 texCoord;

out vec3 outColor;

uniform float time;
uniform float baseSpeed;

uniform int octaves;
uniform float warping;

uniform float speedGain;

uniform float persistence;
uniform float lacunarity;

uniform float baseFrequency;
uniform float baseAmplitude;

uniform int windEnabled;

uniform uint nWidth;
uniform uint nHeight;


float color(vec2 xy, float speed, out vec3 gradient) { 
    return psrdnoise(vec3(xy, time * speed), vec3(0), 0, gradient);
}

float colorPerlin(vec2 xy) {
    vec3 gradient;
    return psrdnoise(vec3(xy, time * baseSpeed), vec3(0), 0, gradient);
}

float fractalSum(vec2 xy, out vec3 gradient) {    

    gradient = vec3(0);

    vec3 grad;
    const vec2 step = vec2(1.3, 1.7); 

    float frequency = baseFrequency;
    float amplitude = 1;
    float speed = baseSpeed;
    
    float t = 0.0;
    float norm = 1;

    for(int i = 0; i < octaves; i++) {
        t += amplitude * color(xy * frequency - i * step, speed, grad);
        gradient += amplitude * grad;

        norm += amplitude;
        frequency *= lacunarity;
        amplitude *= persistence * 2; // *2 ?
        speed *= speedGain;
    }

    t /= norm;
    t *= baseAmplitude * 0.1;
    gradient /= norm;
    gradient *= baseAmplitude * 0.2;

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
    p = p * 2 - 1; // [0, 1] -> [-1, 1]


    // rotate
    // vec2 flowDir = vec2(sin(time * 1),cos(time * 1));
    // mat2 rotMatCC = mat2(flowDir.y, flowDir.x, 
		// 		       -flowDir.x, flowDir.y);
    // mat2 rotMatC = mat2(flowDir.y, -flowDir.x, 
		// 			flowDir.x, flowDir.y);
    // p *= rotMatC;


    if (windEnabled == 1) {
        p.x *= 4;
        vec2 windDir = vec2(-1,0);
        vec2 offset = windDir * time * 0.15; 
        p += offset;
    }

    if(warping > 0) {
        float q = fractalSumPerlin(p);
        p += warping * vec2(q,q);
    }

    vec3 gradient;
    float n = fractalSum( p, gradient );

    vec3 normal;

    normal.x = -gradient.x;
    normal.y = gradient.y;
    normal.z = 2;
    normal = normalize(normal);

    normal = (normal + 1) / 2; // [-1, 1] -> [0, 1]

    outColor = normal;
}