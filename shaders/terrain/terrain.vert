#version 430

in vec4 position;
in vec3 normal;
in vec2 texCoord0;

out Data {
	vec3 lightDir;
	vec3 position;
} DataOut;


uniform	mat4 m_pvm;
uniform mat4 m_view;
uniform	mat3 m_normal;
uniform	mat4 m_model;

uniform	vec4 lightDir;


void main() {

	// all vectors to camera space
    vec3 normal = normalize(m_normal * normal);
	
	vec3 t1 = cross(normal, vec3(0,1,0));
    vec3 t2 = cross(normal, vec3(0,0,1));

    vec3 tangent = length(t1) > length(t2) ? t1 : t2;
    tangent = normalize(tangent);
	vec3 bitangent = normalize(cross(normal, tangent));
	
	mat3 tbn = transpose(mat3(tangent, bitangent, normal));

	// lighting vectors to tangent space
	DataOut.lightDir = tbn * vec3(m_view * -normalize(lightDir));
	DataOut.position = vec3(position * m_model);

    gl_Position = m_pvm * position;
}